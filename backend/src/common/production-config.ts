/** Minimum notice period before publication, in hours (CLAUDE.md: never below 48). */
export const MIN_NOTICE_HOURS = 48;

/** Refuses to boot in production with an unsafe configuration. Pure function so it can be tested. */
export function assertProductionConfig(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  if (!env.CORS_ORIGINS?.split(',').some((o) => o.trim())) problems.push('CORS_ORIGINS must list the allowed origins');
  if (env.NOTICE_HOURS !== undefined && !(Number(env.NOTICE_HOURS) >= MIN_NOTICE_HOURS)) {
    problems.push(`NOTICE_HOURS must be at least ${MIN_NOTICE_HOURS}`);
  }
  if (env.SEED_DEMO === 'true') problems.push('SEED_DEMO must not be true');
  if (env.TOKEN_GATE_MOCK_BALANCE) problems.push('TOKEN_GATE_MOCK_BALANCE must not be set');
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);
}
