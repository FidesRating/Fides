import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

/** Adapter for "Login with X". It only proves who controls an X account; no posts are read. */
export interface XOAuthAdapter {
  authorizeUrl(state: string, codeChallenge: string): string;
  /** Exchanges the authorization code and returns the verified X profile. The username is lowercase, without @. */
  verifiedProfile(code: string, codeVerifier: string): Promise<XProfile>;
}

export interface XProfile {
  username: string;
  name: string;
  followers: number;
  avatarUrl: string | null;
}

export const X_OAUTH = Symbol('X_OAUTH');

/** PKCE (RFC 7636, S256): the verifier stays on the server, only its hash goes to X. */
export function makePkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Credentials come from the environment only. Without them the claim flow stays closed. */
@Injectable()
export class HttpXOAuth implements XOAuthAdapter {
  private cfg() {
    const clientId = process.env.X_CLIENT_ID;
    const redirectUri = process.env.X_REDIRECT_URI;
    if (!clientId || !redirectUri) throw new ServiceUnavailableException('Profile claims are not open yet');
    return { clientId, redirectUri, secret: process.env.X_CLIENT_SECRET, api: process.env.X_API_URL || 'https://api.x.com' };
  }

  authorizeUrl(state: string, codeChallenge: string) {
    const { clientId, redirectUri } = this.cfg();
    const q = new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'users.read tweet.read',
      state, code_challenge: codeChallenge, code_challenge_method: 'S256',
    });
    return `${process.env.X_AUTH_URL || 'https://x.com/i/oauth2/authorize'}?${q}`;
  }

  async verifiedProfile(code: string, codeVerifier: string): Promise<XProfile> {
    const { clientId, redirectUri, secret, api } = this.cfg();
    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
    if (secret) headers.authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
    const tokenRes = await fetch(`${api}/2/oauth2/token`, {
      method: 'POST', headers,
      body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code_verifier: codeVerifier }),
    });
    const token = tokenRes.ok ? ((await tokenRes.json()) as { access_token?: string }).access_token : undefined;
    if (!token) throw new UnauthorizedException('X did not confirm this login. Try again.');
    const meRes = await fetch(`${api}/2/users/me?user.fields=public_metrics,profile_image_url`, { headers: { authorization: `Bearer ${token}` } });
    const data = meRes.ok
      ? ((await meRes.json()) as { data?: { username?: string; name?: string; profile_image_url?: string; public_metrics?: { followers_count?: number } } }).data
      : undefined;
    if (!data?.username) throw new UnauthorizedException('Could not read your X account. Try again.');
    // Fail closed: a missing count must not be stored as 0 followers, or a real account is rejected with a wrong reason.
    const followers = data.public_metrics?.followers_count;
    if (typeof followers !== 'number') throw new UnauthorizedException('X did not return your follower count. Try again later.');
    return {
      username: data.username.toLowerCase(),
      name: data.name || data.username,
      followers,
      avatarUrl: data.profile_image_url ?? null,
    };
  }
}

// ───────────────────────── Local demo login ─────────────────────────

/** Fictional X accounts offered by the demo login. They exist only in the demo; none is a real person. */
export const MOCK_X_PROFILES: XProfile[] = [
  { username: 'lunar_alpha', name: 'Lunar Alpha (demo)', followers: 182_000, avatarUrl: null }, // the covered demo account from the seed
  { username: 'demo_newcomer', name: 'Demo Newcomer', followers: 12_000, avatarUrl: null }, // not covered yet: shows the application
  { username: 'demo_small', name: 'Demo Small Account', followers: 1_200, avatarUrl: null }, // below the follower minimum: shows the rejection
];

/** The mock login is for local demos only. It can never be switched on in production. */
export const isXMockEnabled = (env: Record<string, string | undefined> = process.env) =>
  env.X_OAUTH_MOCK === 'true' && env.NODE_ENV !== 'production';

/**
 * Stand-in for X on a developer machine. The "authorize" step opens a small page served by this API where the
 * demo account is picked, then sends the browser back to the claim page with a code, exactly like X does.
 * Nothing is sent to X and no credentials are needed.
 */
@Injectable()
export class MockXOAuth implements XOAuthAdapter {
  authorizeUrl(state: string, codeChallenge: string) {
    const base = process.env.X_MOCK_BASE_URL || `http://localhost:${process.env.PORT || 3001}/api/v1`;
    return `${base}/demo/x/authorize?${new URLSearchParams({ state, code_challenge: codeChallenge })}`;
  }

  async verifiedProfile(code: string): Promise<XProfile> {
    const profile = MOCK_X_PROFILES.find((p) => `mock-${p.username}` === code);
    if (!profile) throw new UnauthorizedException('X did not confirm this login. Try again.');
    return profile;
  }
}

/** Real X login everywhere, except the explicit local demo switch. */
export const xOAuthFactory = (): XOAuthAdapter => (isXMockEnabled() ? new MockXOAuth() : new HttpXOAuth());
