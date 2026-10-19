import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, extname } from 'node:path';
const execFileAsync = promisify(execFile);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export function decodePng(blob) {
  if (typeof blob !== 'string' || blob.length > 32 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(blob)) throw new Error('PNG 数据无效或超过 24 MiB');
  const bytes = Buffer.from(blob, 'base64');
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) throw new Error('不是有效的 PNG 图片');
  return bytes;
}
export function pngName(name) {
  const clean = String(name || 'diagram.png').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f:]/g, '_');
  return (clean.replace(/\.png$/i, '').slice(0, 160) || 'diagram') + '.png';
}
export async function choosePngPath(name) {
  if (process.platform !== 'darwin') throw new Error('当前原生保存窗口仅支持 macOS，请使用 PNG至剪切板');
  // Only a fixed script is executed; the suggested filename is an argv value.
  const script = `on run argv
    try
      activate
      set targetFile to choose file name with prompt "保存 PNG 图表" default name (item 1 of argv)
      return POSIX path of targetFile
    on error number -128
      return ""
    end try
  end run`;
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script, pngName(name)], { timeout: 300000 });
  return stdout.trim();
}
export async function savePng({ blob, name }, choosePath = choosePngPath) {
  const bytes = decodePng(blob);
  const path = await choosePath(pngName(name));
  if (!path) return { outcome: 'cancelled' };
  if (!isAbsolute(path) || extname(path).toLowerCase() !== '.png') throw new Error('请选择以 .png 结尾的文件名');
  await writeFile(path, bytes);
  return { outcome: 'saved', path };
}
