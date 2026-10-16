// Runs before e2e test files are imported. Fills vars that are absent OR empty,
// so a real `.env` or CI environment always wins when it holds real values
// (dotenv never overrides these).
process.env.DATABASE_URL ||=
  'postgresql://postgres:postgres@localhost:5432/url_shortener?schema=public';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.JWT_SECRET ||= 'e2e-test-secret-0123456789abcdef';
