import { App } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions, OpenAIFileEntrypointInputSchema } from '@openai/mcp-extensions/app';
const app = new App({ name: 'D2 Preview', version: '0.1.0' });
const ext = new OpenAIExtensions(app);
const $ = id => document.getElementById(id);
let file, ready = false, source, generation = 0, zoom = 1, fit = true, debounce;
let dark = matchMedia('(prefers-color-scheme:dark)').matches;
function error(message) { $('error').textContent = message; $('error').style.display = 'block'; $('status').textContent = '预览失败 · 修正源文件后会自动重试'; }
function resize() {
  const img = $('diagram');
  if (!img.naturalWidth) return;
  if (fit) zoom = Math.min(($('stage').clientWidth - 40) / img.naturalWidth, ($('stage').clientHeight - 40) / img.naturalHeight);
  img.style.width = `${Math.max(.05, zoom) * img.naturalWidth}px`;
  img.style.height = 'auto';
}
function zoomAt(factor, clientX, clientY) {
  const stage = $('stage'), img = $('diagram');
  if (!img.naturalWidth) return;
  const before = img.getBoundingClientRect();
  const viewport = stage.getBoundingClientRect();
  const x = clientX ?? viewport.left + stage.clientWidth / 2;
  const y = clientY ?? viewport.top + stage.clientHeight / 2;
  const imageX = (x - before.left) / before.width;
  const imageY = (y - before.top) / before.height;
  // Include the fitted scale so the first zoom never jumps in the wrong direction.
  const maxZoom = Math.max(8, zoom);
  fit = false;
  zoom = Math.min(maxZoom, Math.max(.05, zoom * factor));
  resize();
  const after = img.getBoundingClientRect();
  stage.scrollLeft += after.left + imageX * after.width - x;
  stage.scrollTop += after.top + imageY * after.height - y;
}
async function render() {
  if (source === undefined) return;
  const ticket = ++generation;
  $('status').textContent = '正在渲染…';
  try {
    const result = await app.callServerTool({ name: 'render_d2', arguments: { source, layout: $('layout').value, dark } });
    if (ticket !== generation) return;
    if (result.isError) throw new Error(result.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || 'D2 渲染失败');
    const svg = result.structuredContent?.svg;
    if (typeof svg !== 'string') throw new Error('渲染器未返回 SVG');
    // Image context prevents SVG scripts and links from executing in the app.
    // The desktop sandbox CSP allows data: images but blocks blob: images.
    // data: SVG preserves image isolation without depending on that origin.
    const next = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const loaded = new Image();
    await new Promise((resolve, reject) => {
      loaded.onload = resolve;
      loaded.onerror = () => reject(new Error('SVG 图像加载失败，请重新打开预览标签页。'));
      loaded.src = next;
    });
    if (ticket !== generation) return;
    $('diagram').onload = resize;
    $('diagram').onerror = () => error('SVG 图像加载失败');
    $('diagram').src = next;
    $('diagram').style.display = 'block'; $('placeholder').style.display = 'none'; $('error').style.display = 'none';
    $('status').textContent = '已更新 · 保存 .d2 后自动刷新 · ' + new Date().toLocaleTimeString();
  } catch (e) { if (ticket === generation) error(e.message); }
}
async function reload() {
  if (!ready || !file) return;
  const current = file.resourceUri;
  try {
    if (!ext.resources) throw new Error('当前宿主未提供文件资源接口，请更新桌面应用后重试。');
    const result = await ext.resources.read({ uri: current, representation: 'text' });
    if (file.resourceUri !== current) return;
    const c = result.contents[0];
    if (!c) throw new Error('文件内容为空');
    source = 'text' in c ? c.text : new TextDecoder().decode(Uint8Array.from(atob(c.blob), x => x.charCodeAt(0)));
    await render();
  } catch (e) { error(e.message); }
}
async function open(args) {
  const parsed = OpenAIFileEntrypointInputSchema.safeParse(args);
  if (!parsed.success) return;
  const previous = file?.resourceUri;
  file = parsed.data.file; $('filename').textContent = file.name;
  if (!ready) return;
  if (previous && previous !== file.resourceUri) await ext.resources?.unsubscribe({ uri: previous }).catch(() => {});
  if (previous !== file.resourceUri) await ext.resources?.subscribe({ uri: file.resourceUri }).catch(e => { $('status').textContent = '自动刷新订阅失败：' + e.message; });
  await reload();
}
function theme() {
  const value = app.getHostContext()?.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = value;
  const changed = dark !== (value === 'dark'); dark = value === 'dark'; if (changed) render();
}
app.addEventListener('toolinput', ({ arguments: args }) => { open(args); });
app.addEventListener('hostcontextchanged', theme);
$('refresh').onclick = reload; $('layout').onchange = render;
$('fit').onclick = () => { fit = true; resize(); };
$('plus').onclick = () => zoomAt(1.25);
$('minus').onclick = () => zoomAt(1 / 1.25);
$('stage').addEventListener('wheel', event => {
  if (!$('diagram').naturalWidth || event.deltaY === 0) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? $('stage').clientHeight : 1;
  const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
  zoomAt(Math.exp(-delta * .002), event.clientX, event.clientY);
}, { passive: false });
new ResizeObserver(resize).observe($('stage'));
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', theme);
try {
  await app.connect(); ready = true; theme();
  ext.resources?.addUpdateHandler(({ params }) => {
    if (params.uri === file?.resourceUri) { ++generation; clearTimeout(debounce); debounce = setTimeout(reload, 150); }
  });
  if (file) { await ext.resources?.subscribe({ uri: file.resourceUri }); await reload(); }
  else $('status').textContent = '已连接 · 请打开 .d2 文件';
} catch (e) { error(e.message); }
