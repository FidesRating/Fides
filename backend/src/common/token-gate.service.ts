import { Injectable, Logger } from '@nestjs/common';
import { formatUnits } from 'ethers';
import { isValidEvmAddress } from './wallet-signature';

const BALANCE_OF = '0x70a08231'; // balanceOf(address)
const DECIMALS = '0x313ce567'; // decimals()

/**
 * Checks a holder's ERC-20 balance on an EVM chain.
 * The token contract, the chain RPC URL and the threshold come from env only. There are no defaults: all three
 * are open owner decisions, so when any is missing the gate fails closed (nobody is a holder).
 */
@Injectable()
export class TokenGateService {
  private readonly logger = new Logger(TokenGateService.name);
  private decimals: number | null = null;

  get contract(): string | null {
    const c = process.env.TOKEN_CONTRACT?.trim();
    return c && isValidEvmAddress(c) ? c.toLowerCase() : null;
  }

  get rpcUrl(): string | null {
    return process.env.TOKEN_RPC_URL?.trim() || null;
  }

  get minBalance(): number | null {
    const raw = process.env.MEMBER_MIN_BALANCE?.trim();
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  get configured(): boolean {
    return this.contract !== null && this.rpcUrl !== null && this.minBalance !== null;
  }

  private async ethCall(rpcUrl: string, to: string, data: string): Promise<bigint> {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'fides-token-gate', method: 'eth_call', params: [{ to, data }, 'latest'] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`RPC ${res.status}`);
    const json = (await res.json()) as { result?: string };
    if (!json.result || !/^0x[0-9a-fA-F]+$/.test(json.result)) throw new Error('RPC returned no result');
    return BigInt(json.result);
  }

  /** Returns the balance in whole tokens. An RPC failure returns null, not 0, so access is never revoked by mistake. */
  async getBalance(wallet: string): Promise<number | null> {
    const contract = this.contract;
    const rpcUrl = this.rpcUrl;
    if (!contract || !rpcUrl || this.minBalance === null) {
      this.logger.warn('TOKEN_CONTRACT, TOKEN_RPC_URL or MEMBER_MIN_BALANCE is not set: holder gate is closed');
      return null;
    }
    if (process.env.TOKEN_GATE_MOCK_BALANCE) return Number(process.env.TOKEN_GATE_MOCK_BALANCE);
    if (!isValidEvmAddress(wallet)) return 0;

    try {
      if (this.decimals === null) this.decimals = Number(await this.ethCall(rpcUrl, contract, DECIMALS));
      const raw = await this.ethCall(rpcUrl, contract, BALANCE_OF + wallet.trim().slice(2).toLowerCase().padStart(64, '0'));
      return Number(formatUnits(raw, this.decimals));
    } catch (e) {
      this.logger.warn(`Balance check failed for ${wallet}: ${(e as Error).message}`);
      return null;
    }
  }

  isMember(balance: number | null): boolean {
    const min = this.minBalance;
    return min !== null && balance !== null && balance >= min;
  }
}
