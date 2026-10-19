import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pngSize } from '../plugin/src/png.mjs';
test('PNG uses SVG dimensions at 2x, not preview dimensions', () => {
  assert.deepEqual(pngSize('<svg viewBox="0 0 1055 268">'), { width: 2110, height: 536 });
});
test('large PNG exports stay within canvas memory and dimension limits', () => {
  for (const [w,h] of [[20000,10000], [100000,20], [2,50000]]) {
    const size = pngSize(`<svg viewBox="0 0 ${w} ${h}">`);
    assert.ok(size.width <= 8192 && size.height <= 8192);
    assert.ok(size.width * size.height <= 16000000);
  }
});
test('invalid dimensions are rejected', () => {
  for (const vb of ['', '0 0 0 1', '0 0 NaN 1', '0 0 -2 1']) {
    assert.throws(() => pngSize(`<svg viewBox="${vb}">`));
  }
});
