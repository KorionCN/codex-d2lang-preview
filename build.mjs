import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await mkdir('plugin/dist', { recursive: true });
await build({ entryPoints: ['plugin/src/server.mjs'], outfile: 'plugin/dist/server.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22' });
const result = await build({ entryPoints: ['plugin/src/viewer.mjs'], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, minify: true });
const html = (await readFile('plugin/src/viewer.html', 'utf8')).replace('<script>/*APP_SCRIPT*/</script>', () => `<script type="module">${result.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`);
await writeFile('plugin/dist/viewer.html', html);
