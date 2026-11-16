import { Injectable, Logger } from '@nestjs/common';

/**
 * Checks a holder's SPL token balance on Solana.
 * Mint and threshold come from env only. There are no defaults: both are open owner decisions,
 * so when either is missing the gate fails closed (nobody is a holder).
 */
@Injectable()
export class TokenGateService {
  private readonly logger = new Logger(TokenGateService.name);

  get mint(): string | null {
    return process.env.TOKEN_MINT?.trim() || null;
  }

  get minBalance(): number | null {
    const raw = process.env.MEMBER_MIN_BALANCE?.trim();
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  get configured(): boolean {
    return this.mint !== null && this.minBalance !== null;
  }

  /** Returns the balance (uiAmount). An RPC failure returns null, not 0, so access is never revoked by mistake. */
  async getBalance(wallet: string): Promise<number | null> {
    if (!this.configured) {
      this.logger.warn('TOKEN_MINT or MEMBER_MIN_BALANCE is not set: holder gate is closed');
      return null;
    }
    if (wallet.startsWith('0x')) return 0;
    if (process.env.TOKEN_GATE_MOCK_BALANCE) return Number(process.env.TOKEN_GATE_MOCK_BALANCE);

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'fides-token-gate',
          method: 'getTokenAccountsByOwner',
          params: [wallet, { mint: this.mint }, { encoding: 'jsonParsed' }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const accounts = data?.result?.value ?? [];
      return accounts.reduce(
        (sum: number, a: any) => sum + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0),
        0,
      );
    } catch (e) {
      this.logger.warn(`Balance check failed for ${wallet}: ${e.message}`);
      return null;
    }
  }

  isMember(balance: number | null): boolean {
    const min = this.minBalance;
    return min !== null && balance !== null && balance >= min;
  }
}
