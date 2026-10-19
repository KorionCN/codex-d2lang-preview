import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { savePng, pngName } from '../plugin/src/save.mjs';
const blob = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7AAAAABJRU5ErkJggg==';
test('save writes exact PNG bytes only at the selected path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'd2-save-'));
  try {
    const path = join(dir, '中文 export.png');
    const result = await savePng({ blob, name: 'diagram.png' }, async () => path);
    assert.deepEqual(result, { outcome: 'saved', path });
    assert.deepEqual(await readFile(path), Buffer.from(blob, 'base64'));
  } finally { await rm(dir, { recursive: true }); }
});
test('cancel and bad data do not save', async () => {
  assert.deepEqual(await savePng({ blob, name: 'x.png' }, async () => ''), { outcome: 'cancelled' });
  await assert.rejects(savePng({ blob: 'bogus', name: 'x.png' }, async () => { throw new Error('should not open'); }), /PNG/);
  await assert.rejects(savePng({ blob, name: 'x.png' }, async () => '/tmp/source.d2'), /png/);
  assert.equal(pngName('../../name.png'), 'name.png');
});
