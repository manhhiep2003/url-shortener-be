import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Resolves the project root by walking up from the compiled (or source) file
// location until `package.json` is found. This works regardless of the
// current working directory and of the `tsc` output layout
// (`dist/config/...` vs `dist/src/config/...`).
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

export const ENV_FILE_PATH = join(findProjectRoot(__dirname), '.env');

export interface Env {
  port: number;
  apiPrefix: string;
  shortBaseUrl: string;
  databaseUrl: string;
  redisUrl: string;
  redisCacheTtl: number;
  jwtSecret: string;
  jwtExpiresIn: string;
}

function required(raw: Record<string, string | undefined>, key: string, errors: string[]): string {
  const value = raw[key];
  if (value === undefined) {
    errors.push(`${key} is missing`);
    return '';
  }
  if (value === '') {
    errors.push(`${key} is set but empty`);
    return '';
  }
  return value;
}

function parsePort(value: string | undefined, errors: string[]): number {
  if (value === undefined || value === '') return 3000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be an integer between 1 and 65535 (got "${value}")`);
    return 3000;
  }
  return port;
}

function parsePositiveInt(
  value: string | undefined,
  key: string,
  fallback: number,
  errors: string[],
): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${key} must be a positive integer (got "${value}")`);
    return fallback;
  }
  return parsed;
}

export function validateEnv(
  raw: Record<string, string | undefined>,
  source = 'process environment',
): Env {
  const errors: string[] = [];

  const databaseUrl = required(raw, 'DATABASE_URL', errors);
  if (databaseUrl !== '' && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL must be a postgresql:// connection string');
  }

  const redisUrl = required(raw, 'REDIS_URL', errors);
  if (redisUrl !== '' && !redisUrl.startsWith('redis://')) {
    errors.push('REDIS_URL must be a redis:// connection string');
  }

  const jwtSecret = required(raw, 'JWT_SECRET', errors);
  if (jwtSecret !== '' && jwtSecret.length < 16) {
    errors.push('JWT_SECRET must be at least 16 characters long');
  }

  const shortBaseUrl = raw['SHORT_BASE_URL'] ?? 'http://localhost:3000';
  try {
    const parsed = new URL(shortBaseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push('SHORT_BASE_URL must use http:// or https://');
    }
  } catch {
    errors.push(`SHORT_BASE_URL is not a valid URL (got "${shortBaseUrl}")`);
  }

  const env: Env = {
    port: parsePort(raw['PORT'], errors),
    apiPrefix: raw['API_PREFIX'] ?? 'api/v1',
    shortBaseUrl,
    databaseUrl,
    redisUrl,
    redisCacheTtl: parsePositiveInt(raw['REDIS_CACHE_TTL'], 'REDIS_CACHE_TTL', 3600, errors),
    jwtSecret,
    jwtExpiresIn: raw['JWT_EXPIRES_IN'] ?? '7d',
  };

  if (errors.length > 0) {
    throw new Error(`Environment validation failed (source: ${source}):\n- ${errors.join('\n- ')}`);
  }

  return env;
}
