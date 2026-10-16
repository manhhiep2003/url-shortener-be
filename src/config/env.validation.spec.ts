import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateEnv, ENV_FILE_PATH } from './env.validation';

const baseEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/url_shortener',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'dev-only-change-me-1234',
};

describe('validateEnv', () => {
  it('should resolve the env file to the project root', () => {
    expect(ENV_FILE_PATH.endsWith('.env')).toBe(true);
    expect(existsSync(dirname(ENV_FILE_PATH) + '/package.json')).toBe(true);
  });
  it('should apply defaults for optional vars', () => {
    const env = validateEnv({ ...baseEnv });
    expect(env.port).toBe(3000);
    expect(env.apiPrefix).toBe('api/v1');
    expect(env.redisCacheTtl).toBe(3600);
    expect(env.jwtExpiresIn).toBe('7d');
  });

  it('should throw when required vars are missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL.*REDIS_URL.*JWT_SECRET/s);
  });

  it('should reject an invalid PORT', () => {
    expect(() => validateEnv({ ...baseEnv, PORT: 'not-a-port' })).toThrow(
      /PORT must be an integer/,
    );
  });

  it('should reject a short JWT_SECRET', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET must be at least 16 characters/,
    );
  });

  it('should distinguish empty vars from missing vars', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL is missing/);
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: '' })).toThrow(
      /JWT_SECRET is set but empty/,
    );
  });

  it('should reject a non-postgres DATABASE_URL', () => {
    expect(() => validateEnv({ ...baseEnv, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL must be a postgresql/,
    );
  });
});
