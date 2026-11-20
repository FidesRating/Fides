// Browser helpers shared by the claim page and the Desk: API calls with the wallet session, and EVM or Solana wallet sign-in.
export const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;
const TOKEN_KEY = 'fides_session';
const WALLET_KEY = 'fides_session_wallet';
const KIND_KEY = 'fides_session_wallet_kind';

export type WalletKind = 'evm' | 'solana';

/** Any injected EVM wallet (EIP-1193), for example MetaMask. */
interface EvmProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** A Solana wallet that follows the Phantom provider API (Phantom and compatible wallets). */
export interface SolanaProvider {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: 'utf8' | 'hex'): Promise<{ signature: Uint8Array }>;
  on?(event: 'accountChanged' | 'disconnect', handler: (publicKey?: { toString(): string } | null) => void): void;
  removeListener?(event: 'accountChanged' | 'disconnect', handler: (publicKey?: { toString(): string } | null) => void): void;
}

export const solanaProvider = (): SolanaProvider | null => {
  const w = window as unknown as { phantom?: { solana?: SolanaProvider }; solana?: SolanaProvider };
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? null;
};

export interface ApiResult { ok: boolean; status: number; json: any }

export const readToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const writeToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(WALLET_KEY); sessionStorage.removeItem(KIND_KEY); }
  } catch { /* storage blocked */ }
};

/** The wallet address the session was signed in with. The wallet guard compares it with the wallet's current account. */
export const readSessionWallet = () => {
  try { return sessionStorage.getItem(WALLET_KEY); } catch { return null; }
};
/** The kind of wallet the session was signed in with. Sessions from before Solana support are EVM. */
export const readSessionKind = (): WalletKind => {
  try { return sessionStorage.getItem(KIND_KEY) === 'solana' ? 'solana' : 'evm'; } catch { return 'evm'; }
};
// EVM addresses are compared in lowercase. Solana addresses are case sensitive.
const writeSessionWallet = (address: string, kind: WalletKind) => {
  try {
    sessionStorage.setItem(WALLET_KEY, kind === 'evm' ? address.toLowerCase() : address);
    sessionStorage.setItem(KIND_KEY, kind);
  } catch { /* storage blocked */ }
};

export async function apiCall(path: string, token: string | null, body?: unknown, method?: string): Promise<ApiResult> {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export const errorText = (r: ApiResult) => [r.json?.message ?? 'Something went wrong. Try again.'].flat().join(' ');

/**
 * Signs out: the server session is deleted, the stored token is cleared, and the wallet is asked to revoke this
 * site's access to its accounts (MetaMask supports this; other wallets may ignore it, which is harmless).
 */
export async function signOutSession(token: string | null): Promise<void> {
  if (token) await apiCall('/auth/logout', token, {}).catch(() => undefined);
  const kind = readSessionKind();
  writeToken(null);
  if (kind === 'solana') {
    try { await solanaProvider()?.disconnect(); } catch { /* the wallet was already disconnected */ }
    return;
  }
  try {
    const wallet = (window as unknown as { ethereum?: EvmProvider }).ethereum;
    await wallet?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  } catch {
    /* the wallet does not support revoking, or the user dismissed it */
  }
}

const utf8ToHex = (text: string) => '0x' + Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, '0')).join('');
const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Asks the injected wallet of the given kind for its first account. Null when no such wallet is installed. */
export async function connectedAccount(kind: WalletKind = 'evm'): Promise<string | null> {
  if (kind === 'solana') {
    const p = solanaProvider();
    return p ? (await p.connect()).publicKey.toString() : null;
  }
  const wallet = (window as unknown as { ethereum?: EvmProvider }).ethereum;
  if (!wallet) return null;
  const accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
  return accounts[0] ?? null;
}

/** Signs a text with the injected wallet (a signature only, no transaction and no fee). Solana signatures are returned as hex. */
export async function signText(text: string, address: string, kind: WalletKind = 'evm'): Promise<string> {
  if (kind === 'solana') {
    const p = solanaProvider();
    if (!p) throw new Error('No wallet');
    const { signature } = await p.signMessage(new TextEncoder().encode(text), 'utf8');
    return bytesToHex(signature);
  }
  const wallet = (window as unknown as { ethereum?: EvmProvider }).ethereum;
  if (!wallet) throw new Error('No wallet');
  return (await wallet.request({ method: 'personal_sign', params: [utf8ToHex(text), address] })) as string;
}

/** Signs in with an EVM or Solana wallet (a signature only, no transaction and no fee). Returns the session token or a message to show. */
export async function signInWithWallet(kind: WalletKind = 'evm'): Promise<{ token: string } | { error: string }> {
  try {
    const walletAddress = await connectedAccount(kind);
    if (!walletAddress) {
      return { error: kind === 'solana' ? 'Install a Solana wallet such as Phantom to sign in.' : 'Install an EVM wallet such as MetaMask to sign in.' };
    }
    const n = await apiCall('/auth/nonce', null, { walletAddress });
    if (!n.ok) return { error: errorText(n) };
    const signature = await signText(n.json.message, walletAddress, kind);
    const v = await apiCall('/auth/verify', null, { walletAddress, nonce: n.json.nonce, signature });
    if (!v.ok) return { error: errorText(v) };
    writeToken(v.json.token);
    writeSessionWallet(walletAddress, kind);
    return { token: v.json.token };
  } catch (e) {
    // 4001 is the code for a request the user rejected (EIP-1193 and Phantom). Anything else is a real problem, such as a blocked API call.
    if ((e as { code?: number })?.code === 4001) return { error: 'Wallet request was cancelled.' };
    if (e instanceof TypeError) return { error: 'Could not reach the FIDES API. Check your connection and try again.' };
    return { error: 'Wallet sign-in failed. Try again.' };
  }
}
