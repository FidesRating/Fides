// Stops a demo command when the database or queue is not on this machine.
// Run through the demo:* npm scripts, after node --env-file=.env.demo has loaded the demo variables.
const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLocal(raw) {
  try {
    return LOCAL.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

const problems = [];
if (process.env.NODE_ENV === 'production') problems.push('NODE_ENV must not be production');
if (process.env.X_OAUTH_MOCK !== 'true') problems.push('X_OAUTH_MOCK must be true (is .env.demo loaded?)');
for (const key of ['DATABASE_URL', 'DIRECT_URL', 'REDIS_URL']) {
  const value = process.env[key];
  if (key === 'DIRECT_URL' && !value) continue;
  if (!value || !isLocal(value)) problems.push(`${key} must point at localhost`);
}

if (problems.length) {
  console.error(`Demo guard stopped this command:\n- ${problems.join('\n- ')}\nNothing was changed. Check backend/.env.demo.`);
  process.exit(1);
}
console.log('Demo guard: database and queue are local.');
