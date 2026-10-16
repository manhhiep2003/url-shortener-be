import { registerAs } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { type Env, validateEnv, ENV_FILE_PATH } from './env.validation';

export type AppConfig = Env;

// Builds the typed `app` namespace from a single deterministic source:
// values from the env file (resolved to the project root) merged under the
// real process environment, so exported/shell variables always win and an
// explicitly empty variable stays empty (and is reported as such).
// This does not rely on ConfigModule having populated `process.env` first,
// so it behaves the same in dev (`src`), prod (`dist`), Docker, and tests.
function loadAppConfig(): AppConfig {
  const fileVars: Record<string, string> = existsSync(ENV_FILE_PATH)
    ? parse(readFileSync(ENV_FILE_PATH))
    : {};
  const merged: Record<string, string | undefined> = {
    ...fileVars,
    ...(process.env as Record<string, string | undefined>),
  };
  return validateEnv(merged, ENV_FILE_PATH);
}

export default registerAs('app', loadAppConfig);
