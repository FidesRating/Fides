import { parseStaffWallets } from './staff-wallets';

/** Minimum notice period before publication, in hours (CLAUDE.md: never below 48). */
export const MIN_NOTICE_HOURS = 48;

/**
 * Pre-launch mode: the owner sets PRELAUNCH_MODE=true while the site is filled with data before launch.
 * Publication then skips the notice period and the notice proof. Remove the variable at launch: the 48 hour rule returns.
 */
export const isPrelaunch = (env: Record<string, string | undefined> = process.env) => env.PRELAUNCH_MODE === 'true';

/** Refuses to boot in production with an unsafe configuration. Pure function so it can be tested. */
export function assertProductionConfig(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  if (!env.CORS_ORIGINS?.split(',').some((o) => o.trim())) problems.push('CORS_ORIGINS must list the allowed origins');
  if (env.PRELAUNCH_MODE !== undefined && !['true', 'false'].includes(env.PRELAUNCH_MODE)) problems.push('PRELAUNCH_MODE must be true or false');
  if (!isPrelaunch(env) && env.NOTICE_HOURS !== undefined && !(Number(env.NOTICE_HOURS) >= MIN_NOTICE_HOURS)) {
    problems.push(`NOTICE_HOURS must be at least ${MIN_NOTICE_HOURS}`);
  }
  if (env.SEED_DEMO === 'true') problems.push('SEED_DEMO must not be true');
  if (env.X_OAUTH_MOCK === 'true') problems.push('X_OAUTH_MOCK must not be true');
  if (env.TOKEN_GATE_MOCK_BALANCE) problems.push('TOKEN_GATE_MOCK_BALANCE must not be set');
  if (env.ROLE !== undefined && !['all', 'api', 'worker'].includes(env.ROLE)) problems.push('ROLE must be all, api or worker');
  try {
    parseStaffWallets(env.STAFF_WALLETS);
  } catch (e) {
    problems.push((e as Error).message);
  }
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);
}
