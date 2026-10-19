import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

export async function renderD2(source, { layout = 'elk', dark = false, resourcePath } = {}) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 1024 * 1024) throw new Error('D2 source must be text, at most 1 MiB.');
  if (!['elk', 'dagre'].includes(layout)) throw new Error('Unsupported layout.');
  const binary = process.env.D2_BIN || ['/opt/homebrew/bin/d2', '/usr/local/bin/d2'].find(existsSync) || 'd2';
  const cwd = typeof resourcePath === 'string' && isAbsolute(resourcePath) ? dirname(resourcePath) : undefined;
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['--layout', layout, '--theme', dark ? '200' : '0', '--timeout', '30', '--target', '', '--stdout-format', 'svg', '-', '-'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let output = '', errors = '', size = 0, failure;
    const timer = setTimeout(() => { failure = new Error('D2 rendering timed out (35 seconds).'); child.kill('SIGKILL'); }, 35000);
    child.stdout.on('data', data => {
      size += Buffer.byteLength(data);
      if (size > 12 * 1024 * 1024) { failure = new Error('Rendered diagram exceeds 12 MiB.'); child.kill('SIGKILL'); }
      else output += data.toString();
    });
    child.stderr.on('data', data => { errors = (errors + data.toString()).slice(-12000); });
    child.on('error', error => { clearTimeout(timer); reject(new Error(`Cannot start D2: ${error.message}`)); });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(errors || `D2 exited with code ${code}`));
      else if (!output.includes('<svg')) reject(new Error('D2 returned no SVG.'));
      else resolve(output);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(source);
  });
}
