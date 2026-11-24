import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Contract, JsonRpcProvider, Network, Wallet, getAddress } from 'ethers';
import {
  PublishedRatingFields, decisionContentHash, decisionRecordId, evidenceContentHash, evidenceRecordId, rationaleHash, ratingContentHash,
  ratingRecordId, reasonHash,
} from './anchor-hash';

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  ratingRegistry: string;
  committeeLog: string;
  /** Optional. Evidence is anchored only when this is set. */
  evidenceAnchor: string | null;
  saltSecret: string;
}

const REQUIRED = ['CHAIN_RPC_URL', 'ANCHOR_PUBLISHER_KEY', 'RATING_REGISTRY_ADDRESS', 'COMMITTEE_LOG_ADDRESS', 'ANCHOR_SALT_SECRET'] as const;

/**
 * Reads the anchoring config from the environment. Returns null when nothing is set (anchoring off).
 * A partial configuration throws, so a half-set production never silently skips anchoring.
 */
export function loadChainConfig(env: Record<string, string | undefined>): ChainConfig | null {
  const set = REQUIRED.filter((k) => env[k]?.trim());
  if (set.length === 0) return null;
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length) throw new Error(`Chain anchoring is partly configured. Missing: ${missing.join(', ')}`);
  if (!/^0x[0-9a-fA-F]{64}$/.test(env.ANCHOR_PUBLISHER_KEY!.trim())) throw new Error('ANCHOR_PUBLISHER_KEY must be a 0x-prefixed 32-byte hex key');
  if (env.ANCHOR_SALT_SECRET!.trim().length < 32) throw new Error('ANCHOR_SALT_SECRET must be at least 32 characters');
  const chainId = Number(env.CHAIN_ID ?? 4663);
  if (!Number.isInteger(chainId) || chainId <= 0) throw new Error('CHAIN_ID must be a positive integer');
  return {
    rpcUrl: env.CHAIN_RPC_URL!.trim(),
    chainId,
    privateKey: env.ANCHOR_PUBLISHER_KEY!.trim(),
    ratingRegistry: getAddress(env.RATING_REGISTRY_ADDRESS!.trim()),
    committeeLog: getAddress(env.COMMITTEE_LOG_ADDRESS!.trim()),
    evidenceAnchor: env.EVIDENCE_ANCHOR_ADDRESS?.trim() ? getAddress(env.EVIDENCE_ANCHOR_ADDRESS.trim()) : null,
    saltSecret: env.ANCHOR_SALT_SECRET!.trim(),
  };
}

const RECORD = 'tuple(bytes32 contentHash, uint64 publishedAt, uint64 revokedAt, bytes32 revokeReasonHash)';
const RATING_ABI = [
  'function publish(bytes32 ratingId, bytes32 contentHash)',
  'function revoke(bytes32 ratingId, bytes32 reasonHash)',
  `function getRecord(bytes32 id) view returns (${RECORD})`,
];
const EVIDENCE_ABI = [
  'function anchor(bytes32 evidenceId, bytes32 contentHash)',
  'function revoke(bytes32 evidenceId, bytes32 reasonHash)',
  `function getRecord(bytes32 id) view returns (${RECORD})`,
];
const COMMITTEE_ABI = [
  'function logDecision(bytes32 decisionId, bytes32 ratingId, bytes32 decisionHash, bytes32 rationaleHash)',
  'function revoke(bytes32 decisionId, bytes32 reasonHash)',
  `function getRecord(bytes32 id) view returns (${RECORD})`,
];

export type AnchorStatus = 'disabled' | 'anchored' | 'exists' | 'conflict' | 'failed';
export interface AnchorResult { status: AnchorStatus; txHashes: string[] }

export interface PublishedDecision extends PublishedRatingFields {
  countedVotes: number;
}

/**
 * Writes hashes of already published, human-decided rating actions to the registries. No AI path calls this.
 * Every write checks the chain first, so a retry never double-writes. Errors are logged, never thrown:
 * the database stays the source of truth and a failed anchor can be repeated.
 */
@Injectable()
export class ChainAnchorService {
  private readonly log = new Logger(ChainAnchorService.name);
  private readonly cfg = loadChainConfig(process.env);
  private provider?: JsonRpcProvider;
  private wallet?: Wallet;
  private rating?: Contract;
  private committee?: Contract;
  private evidence?: Contract;
  private chainChecked = false;
  /** One wallet means one nonce sequence, so writes run one at a time. */
  private tail: Promise<unknown> = Promise.resolve();

  get enabled(): boolean {
    return this.cfg !== null;
  }

  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(job, job);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async contracts() {
    const cfg = this.cfg!;
    if (!this.wallet || !this.provider) {
      // cacheTimeout -1: a cached nonce within one block makes back-to-back writes fail on a fast chain.
      this.provider = new JsonRpcProvider(cfg.rpcUrl, Network.from(cfg.chainId), { staticNetwork: true, cacheTimeout: -1 });
      this.wallet = new Wallet(cfg.privateKey, this.provider);
      this.rating = new Contract(cfg.ratingRegistry, RATING_ABI, this.wallet);
      this.committee = new Contract(cfg.committeeLog, COMMITTEE_ABI, this.wallet);
      if (cfg.evidenceAnchor) this.evidence = new Contract(cfg.evidenceAnchor, EVIDENCE_ABI, this.wallet);
    }
    if (!this.chainChecked) {
      // Fail closed: never write to a node that serves another chain than the one configured.
      const reported = Number(BigInt(await this.provider!.send('eth_chainId', [])));
      if (reported !== cfg.chainId) throw new Error(`RPC serves chain ${reported}, expected ${cfg.chainId}`);
      this.chainChecked = true;
    }
    return { rating: this.rating!, committee: this.committee!, evidence: this.evidence };
  }

  /** Anchors the rating hash and the salted committee decision hash of one published action. */
  anchorPublished(d: PublishedDecision): Promise<AnchorResult> {
    if (!this.cfg) return Promise.resolve({ status: 'disabled', txHashes: [] });
    return this.serial(async () => {
      const txHashes: string[] = [];
      try {
        const { rating, committee } = await this.contracts();
        const ratingId = ratingRecordId(d.actionNumber);
        const contentHash = ratingContentHash(d);
        const existing = await rating.getRecord(ratingId);
        let status: AnchorStatus = 'exists';
        if (existing.publishedAt === 0n) {
          const tx = await rating.publish(ratingId, contentHash);
          await tx.wait(1);
          txHashes.push(tx.hash);
          status = 'anchored';
        } else if (existing.contentHash !== contentHash) {
          this.log.error(`Rating RA-${d.actionNumber}: the chain holds a different hash. Not overwriting.`);
          return { status: 'conflict' as const, txHashes };
        }

        const decisionId = decisionRecordId(d.actionNumber);
        const decisionHash = decisionContentHash({
          secret: this.cfg!.saltSecret, actionNumber: d.actionNumber, rating: d.rating, outlook: d.outlook, countedVotes: d.countedVotes,
        });
        const logged = await committee.getRecord(decisionId);
        if (logged.publishedAt === 0n) {
          const tx = await committee.logDecision(decisionId, ratingId, decisionHash, rationaleHash(d.rationale));
          await tx.wait(1);
          txHashes.push(tx.hash);
          status = 'anchored';
        } else if (logged.contentHash !== decisionHash) {
          this.log.error(`Decision for RA-${d.actionNumber}: the chain holds a different hash. Not overwriting.`);
          return { status: 'conflict' as const, txHashes };
        }
        return { status, txHashes };
      } catch (e) {
        this.log.error(`Anchoring RA-${d.actionNumber} failed: ${(e as Error).message}`);
        return { status: 'failed' as const, txHashes };
      }
    });
  }

  /**
   * Anchors the sha256 of one piece of evidence. The caller must only pass evidence that a human analyst
   * confirmed: pending or rejected evidence is never anchored.
   */
  anchorEvidence(snapshotId: string, sha256Hex: string): Promise<AnchorResult> {
    if (!this.cfg?.evidenceAnchor) return Promise.resolve({ status: 'disabled', txHashes: [] });
    return this.serial(async () => {
      try {
        const { evidence } = await this.contracts();
        const id = evidenceRecordId(snapshotId);
        const hash = evidenceContentHash(sha256Hex);
        const existing = await evidence!.getRecord(id);
        if (existing.publishedAt !== 0n) {
          if (existing.contentHash !== hash) {
            this.log.error('Evidence: the chain holds a different hash. Not overwriting.');
            return { status: 'conflict' as const, txHashes: [] };
          }
          return { status: 'exists' as const, txHashes: [] };
        }
        const tx = await evidence!.anchor(id, hash);
        await tx.wait(1);
        return { status: 'anchored' as const, txHashes: [tx.hash as string] };
      } catch (e) {
        this.log.error(`Anchoring evidence failed: ${(e as Error).message}`);
        return { status: 'failed' as const, txHashes: [] };
      }
    });
  }

  /** Evidence removed or no longer confirmed: revoke the record. The record stays, the reason is only a hash. */
  revokeEvidence(snapshotId: string, reason: string): Promise<AnchorResult> {
    if (!this.cfg?.evidenceAnchor) return Promise.resolve({ status: 'disabled', txHashes: [] });
    return this.serial(async () => {
      try {
        const { evidence } = await this.contracts();
        const id = evidenceRecordId(snapshotId);
        const rec = await evidence!.getRecord(id);
        if (rec.publishedAt === 0n || rec.revokedAt !== 0n) return { status: 'exists' as const, txHashes: [] };
        const tx = await evidence!.revoke(id, reasonHash(reason));
        await tx.wait(1);
        return { status: 'anchored' as const, txHashes: [tx.hash as string] };
      } catch (e) {
        this.log.error(`Revoking evidence failed: ${(e as Error).message}`);
        return { status: 'failed' as const, txHashes: [] };
      }
    });
  }

  /** Takedown: marks the rating and its decision record revoked. The records stay, the reason is only a hash. */
  revokeRating(actionNumber: number, reason: string): Promise<AnchorResult> {
    if (!this.cfg) return Promise.resolve({ status: 'disabled', txHashes: [] });
    return this.serial(async () => {
      const txHashes: string[] = [];
      try {
        const { rating, committee } = await this.contracts();
        const why = reasonHash(reason);
        let changed = false;
        for (const [contract, id] of [[rating, ratingRecordId(actionNumber)], [committee, decisionRecordId(actionNumber)]] as const) {
          const rec = await contract.getRecord(id);
          if (rec.publishedAt === 0n || rec.revokedAt !== 0n) continue; // never anchored, or already revoked
          const tx = await contract.revoke(id, why);
          await tx.wait(1);
          txHashes.push(tx.hash);
          changed = true;
        }
        return { status: changed ? ('anchored' as const) : ('exists' as const), txHashes };
      } catch (e) {
        this.log.error(`Revoking RA-${actionNumber} failed: ${(e as Error).message}`);
        return { status: 'failed' as const, txHashes };
      }
    });
  }
}

/** Global so the committee and admin modules can inject it without extra imports. Off unless fully configured. */
@Global()
@Module({ providers: [ChainAnchorService], exports: [ChainAnchorService] })
export class ChainModule {}
