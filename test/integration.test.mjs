import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { renderD2 } from '../plugin/src/render.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('installed Codex MCP configuration starts without shell PATH or placeholder expansion', { skip: !process.env.D2_TEST_INSTALLED }, async () => {
  const cfg = JSON.parse(execFileSync('codex', ['mcp', 'get', 'd2-preview', '--json'], { encoding: 'utf8' }));
  assert.ok(!cfg.transport.args.some(a => a.includes('${')), 'Unresolved variable in installed config');
  const client = new Client({ name: 'installed-config-test', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ command: cfg.transport.command, args: cfg.transport.args, env: { PATH: '/usr/bin:/bin', ...cfg.transport.env } }));
    assert.ok((await client.listTools()).tools.some(t => t.name === 'open_d2'));
    const result = await client.callTool({ name: 'render_d2', arguments: { source: 'a -> b: installed config' } });
    assert.ok(!result.isError);
    assert.match(result.structuredContent.svg, /installed config/);
  } finally { await client.close(); }
});

test('stdio advertises .d2 file entrypoint and bundled UI; renders and reports errors', async () => {
  const client = new Client({ name: 'preview-test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('plugin/dist/server.cjs')] }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.find(t => t.name === 'open_d2')._meta['openai/ui'].entrypoints, [{ type: 'file', extensions: ['.d2'] }]);
    const ui = await client.readResource({ uri: 'ui://d2-preview/viewer.html' });
    assert.match(ui.contents[0].text, /适应窗口/);
    assert.ok(!ui.contents[0].text.includes('/*APP_SCRIPT*/'));
    const result = await client.callTool({ name: 'render_d2', arguments: { source: 'a: 中文\na -> b: test' } });
    assert.ok(!result.isError, JSON.stringify(result));
    assert.match(result.structuredContent.svg, /<svg/);
    assert.match(result.structuredContent.svg, /中文/);
    const invalid = await client.callTool({ name: 'render_d2', arguments: { source: 'a: {' } });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0].text, /1/);
  } finally { await client.close(); }
});

test('relative imports resolve beside the host-provided file, dark rendering works', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'd2-preview-test-'));
  try {
    await writeFile(join(dir, 'shared.d2'), 'a: imported');
    const svg = await renderD2('...@shared\na -> b', { dark: true, resourcePath: join(dir, 'input.d2') });
    assert.match(svg, /imported/);
  } finally { await rm(dir, { recursive: true }); }
});

test('oversized input and unsupported layout are rejected', async () => {
  await assert.rejects(renderD2('x'.repeat(1024 * 1024 + 1)), /1 MiB/);
  await assert.rejects(renderD2('a -> b', { layout: 'bogus' }), /Unsupported/);
});


test('portable installer generates a working package in a path with spaces', async () => {
  const { prepareInstall } = await import('../scripts/prepare-install.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'd2 install test '));
  const client = new Client({ name: 'portable-install-test', version: '1' });
  try {
    const { config } = await prepareInstall(dir);
    const cfg = config.mcpServers['d2-preview'];
    assert.ok(!cfg.args.some(arg => arg.includes('${')));
    await client.connect(new StdioClientTransport({ ...cfg, env: { PATH: '/usr/bin:/bin', ...cfg.env } }));
    const elk = await client.callTool({ name: 'render_d2', arguments: { source: 'a -> b\na -> c\nb -> d\nc -> d', layout: 'elk' } });
    const dagre = await client.callTool({ name: 'render_d2', arguments: { source: 'a -> b\na -> c\nb -> d\nc -> d', layout: 'dagre' } });
    assert.ok(!elk.isError && !dagre.isError);
    assert.notEqual(elk.structuredContent.svg, dagre.structuredContent.svg);
    const ui = await client.readResource({ uri: 'ui://d2-preview/viewer.html' });
    assert.match(ui.contents[0].text, /适应窗口/);
  } finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
});
