// Development-only MCP host fixture. This is not proof of Codex integration.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { renderD2 } from '../plugin/src/render.mjs';
const host = `<!doctype html><html><body style="margin:0"><div style="padding:8px;font:14px system-ui">MCP host test fixture · <button id="dark">切换深色</button><button id="change">模拟文件保存</button><button id="invalid">模拟语法错误</button></div><iframe allow="clipboard-write" title="D2 Preview" src="/viewer" style="width:100%;height:85vh;border:0"></iframe><script>
let source='a: 中文源文件\\na -> b: 自动预览', dark=false;
const f=document.querySelector('iframe');
function send(method,params){f.contentWindow.postMessage({jsonrpc:'2.0',method,params},location.origin)}
window.addEventListener('message',async e=>{if(e.source!==f.contentWindow)return;const m=e.data;if(!m?.method)return;let result={};try{
if(m.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostInfo:{name:'Local test fixture',version:'1'},hostCapabilities:{serverTools:{},serverResources:{},experimental:{'openai/resource':{}}},hostContext:{theme:'light',displayMode:'fullscreen'}};
else if(m.method==='ui/notifications/initialized'){send('ui/notifications/tool-input',{arguments:{file:{name:'fixture.d2',resourceUri:'host-resource://fixture'}}});return;}
else if(m.method==='resources/read')result={contents:[{uri:'host-resource://fixture',text:source,mimeType:'text/plain'}]};
else if(m.method==='ui/download-file')result=await fetch('/download',{method:'POST',body:JSON.stringify(m.params)}).then(r=>r.json());
else if(m.method==='tools/call')result=await fetch('/render',{method:'POST',body:JSON.stringify(m.params.arguments)}).then(r=>r.json());
if(m.id!==undefined)f.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result},location.origin);
}catch(err){if(m.id!==undefined)f.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,error:{code:-32603,message:err.message}},location.origin)}});
document.querySelector('#dark').onclick=()=>{dark=!dark;send('ui/notifications/host-context-changed',{theme:dark?'dark':'light'})};
document.querySelector('#change').onclick=()=>{source='a: 已保存更新\\na -> b: 自动刷新成功';send('notifications/resources/updated',{uri:'host-resource://fixture'})};
document.querySelector('#invalid').onclick=()=>{source='a: {';send('notifications/resources/updated',{uri:'host-resource://fixture'})};
</script></body></html>`;
createServer(async (req, res) => {
  try {
    if (req.url === '/download' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const resource = JSON.parse(body).contents[0].resource;
      await writeFile(new URL('./export-preview.png', import.meta.url), Buffer.from(resource.blob, 'base64'));
      res.setHeader('Content-Type', 'application/json'); res.end('{}');
    } else if (req.url === '/render' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const { source, ...opts } = JSON.parse(body);
      let result;
      try { result = { content: [], structuredContent: { svg: await renderD2(source, opts) } }; }
      catch (e) { result = { isError: true, content: [{ type: 'text', text: e.message }] }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Match the relevant desktop sandbox restriction: no blob: images.
      if (req.url === '/viewer') res.setHeader('Content-Security-Policy', "img-src 'self' data:");
      res.end(req.url === '/viewer' ? await readFile(new URL('../plugin/dist/viewer.html', import.meta.url)) : host);
    }
  } catch (e) { res.statusCode = 500; res.end(e.message); }
}).listen(18942, '127.0.0.1', () => console.log('Development fixture: http://127.0.0.1:18942'));
