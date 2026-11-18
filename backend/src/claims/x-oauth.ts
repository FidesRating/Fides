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
