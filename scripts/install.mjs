import { execFileSync } from 'node:child_process';
import { prepareInstall } from './prepare-install.mjs';
try {
  // Check CLI availability before preparing or registering the local package.
  const { marketplaces } = JSON.parse(execFileSync('codex', ['plugin', 'marketplace', 'list', '--json'], { encoding: 'utf8' }));
  const { marketplace } = await prepareInstall();
  const previous = marketplaces.find(m => m.name === 'local-d2-tools');
  if (previous && previous.root !== marketplace) {
    console.log(`Moving local-d2-tools registration from ${previous.root} to ${marketplace}`);
    execFileSync('codex', ['plugin', 'marketplace', 'remove', 'local-d2-tools'], { stdio: 'inherit' });
  }
  execFileSync('codex', ['plugin', 'marketplace', 'add', marketplace], { stdio: 'inherit' });
  execFileSync('codex', ['plugin', 'add', 'd2-preview@local-d2-tools'], { stdio: 'inherit' });
  console.log('D2 Preview installed. Restart Codex if the server was already running, then open a .d2 file.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
