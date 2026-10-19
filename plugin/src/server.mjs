import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderD2 } from './render.mjs';

const server = new McpServer({ name: 'd2-preview', version: '0.1.0' });
const uri = 'ui://d2-preview/viewer.html';
server.registerResource('D2 Preview', uri, { mimeType: 'text/html;profile=mcp-app' }, async () => ({
  contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: readFileSync(join(__dirname, 'viewer.html'), 'utf8'), _meta: {
    ui: { csp: { connectDomains: [], resourceDomains: [] } },
    'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'fullscreen' }
  } }]
}));
server.registerTool('open_d2', {
  title: 'D2 Preview', description: 'Open a .d2 file in the diagram viewer.',
  inputSchema: { file: z.object({ name: z.string(), resourceUri: z.string() }) },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  _meta: { ui: { resourceUri: uri, visibility: ['app'] }, 'openai/ui': { entrypoints: [{ type: 'file', extensions: ['.d2'] }] } }
}, async ({ file }) => ({ content: [], structuredContent: { file } }));
server.registerTool('render_d2', {
  title: 'Render D2', description: 'Render source from the currently opened D2 file to SVG using the local D2 CLI.',
  inputSchema: { source: z.string().max(1024 * 1024), layout: z.enum(['elk', 'dagre']).default('elk'), dark: z.boolean().default(false) },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  _meta: { ui: { visibility: ['app'] } }
}, async ({ source, layout, dark }, extra) => {
  try {
    const svg = await renderD2(source, { layout, dark, resourcePath: extra._meta?.['openai/resource']?.path });
    return { content: [], structuredContent: { svg } };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});
server.connect(new StdioServerTransport()).catch(e => { console.error(e); process.exit(1); });
