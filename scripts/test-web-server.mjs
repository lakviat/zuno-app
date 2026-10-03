// Isolate sample-data browser tests from the developer's real Supabase .env files.
import { cpSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = mkdtempSync(path.join(tmpdir(), 'zuno-browser-test-'));
for (const file of [
  'src',
  'assets',
  'plugins',
  'public',
  'App.tsx',
  'index.ts',
  'app.config.ts',
  'package.json',
  'tsconfig.json',
])
  cpSync(path.join(root, file), path.join(stage, file), { recursive: true });
symlinkSync(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
const env = {
  ...process.env,
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_EXPO_GO_PHONE_PREVIEW: '',
  EXPO_PUBLIC_SUPABASE_URL: '',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
  EXPO_PUBLIC_LOCAL_PHONE_PREVIEW: process.env.ZUNO_TEST_PHONE_PREVIEW === '1' ? '1' : '',
};
delete env.EXPO_NO_CLIENT_ENV_VARS;
const child = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/expo/bin/cli'),
    'start',
    '--web',
    '--port',
    process.env.ZUNO_TEST_PORT || '8082',
    '--clear',
  ],
  { cwd: stage, env, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  rmSync(stage, { recursive: true, force: true });
  process.exit(code ?? 0);
});
