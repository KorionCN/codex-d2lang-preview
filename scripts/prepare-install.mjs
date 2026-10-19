import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function findD2() {
  const candidates = process.env.D2_BIN ? [resolve(process.env.D2_BIN)] : [
    '/opt/homebrew/bin/d2', '/usr/local/bin/d2',
    ...(process.env.PATH || '').split(delimiter).filter(Boolean).map(p => resolve(p, process.platform === 'win32' ? 'd2.exe' : 'd2')),
  ];
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); execFileSync(candidate, ['--version'], { stdio: 'pipe' }); return candidate; } catch {}
  }
  throw new Error('D2 CLI not found. Install D2 or set D2_BIN to its executable path.');
}
export async function prepareInstall(destination = join(root, '.local', 'marketplace'), d2 = undefined) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22+ is required.');
  d2 ??= await findD2();
  if (!isAbsolute(d2)) throw new Error('D2 executable must be absolute.');
  const marketplace = resolve(destination), plugin = join(marketplace, 'plugin');
  await access(join(root, 'plugin/dist/server.cjs'));
  await mkdir(join(plugin, '.codex-plugin'), { recursive: true });
  await cp(join(root, 'plugin/dist'), join(plugin, 'dist'), { recursive: true });
  await cp(join(root, 'plugin/.codex-plugin/plugin.json'), join(plugin, '.codex-plugin/plugin.json'));
  const config = { mcpServers: { 'd2-preview': {
    command: process.execPath, args: [join(plugin, 'dist/server.cjs')], env: { D2_BIN: d2 },
  } } };
  await writeFile(join(plugin, '.mcp.json'), JSON.stringify(config, null, 2) + '\n');
  await mkdir(join(marketplace, '.agents/plugins'), { recursive: true });
  await writeFile(join(marketplace, '.agents/plugins/marketplace.json'), await readFile(join(root, '.agents/plugins/marketplace.json')));
  return { marketplace, config };
}
