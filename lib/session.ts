// Browser helpers shared by the claim page and the Desk: API calls with the wallet session, and EVM wallet sign-in.
export const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;
const TOKEN_KEY = 'fides_session';

/** Any injected EVM wallet (EIP-1193), for example MetaMask. */
interface EvmProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface ApiResult { ok: boolean; status: number; json: any }

export const readToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const writeToken = (t: string | null) => {
  try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
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

const utf8ToHex = (text: string) => '0x' + Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, '0')).join('');

/** Signs in with an EVM wallet (a signature only, no transaction and no fee). Returns the session token or a message to show. */
export async function signInWithWallet(): Promise<{ token: string } | { error: string }> {
  try {
    const wallet = (window as unknown as { ethereum?: EvmProvider }).ethereum;
    if (!wallet) return { error: 'Install an EVM wallet such as MetaMask to sign in.' };
    const accounts = (await wallet.request({ method: 'eth_requestAccounts' })) as string[];
    const walletAddress = accounts[0];
    const n = await apiCall('/auth/nonce', null, { walletAddress });
    if (!n.ok) return { error: errorText(n) };
    const signature = (await wallet.request({ method: 'personal_sign', params: [utf8ToHex(n.json.message), walletAddress] })) as string;
    const v = await apiCall('/auth/verify', null, { walletAddress, nonce: n.json.nonce, signature });
    if (!v.ok) return { error: errorText(v) };
    writeToken(v.json.token);
    return { token: v.json.token };
  } catch (e) {
    // 4001 is the EIP-1193 code for a request the user rejected. Anything else is a real problem, such as a blocked API call.
    if ((e as { code?: number })?.code === 4001) return { error: 'Wallet request was cancelled.' };
    if (e instanceof TypeError) return { error: 'Could not reach the FIDES API. Check your connection and try again.' };
    return { error: 'Wallet sign-in failed. Try again.' };
  }
}
