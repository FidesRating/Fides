const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True when the connection string points at this machine. */
export function isLocalUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    return LOCAL_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

/**
 * The local demo (X_OAUTH_MOCK=true) must never run against a real database or queue. It refuses to boot unless
 * the database and Redis are on this machine, so a forgotten variable cannot point the demo at production data.
 * Pure function so it can be tested.
 */
export function assertDemoConfig(env: Record<string, string | undefined>): void {
  if (env.X_OAUTH_MOCK !== 'true') return;
  const problems: string[] = [];
  if (env.NODE_ENV === 'production') problems.push('X_OAUTH_MOCK must not be true in production');
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'REDIS_URL'] as const) {
    const value = env[key];
    if (key === 'DIRECT_URL' && !value) continue;
    if (!isLocalUrl(value)) problems.push(`${key} must point at this machine (localhost) while X_OAUTH_MOCK is true`);
  }
  if (problems.length) throw new Error(`Unsafe demo configuration:\n- ${problems.join('\n- ')}`);
}
