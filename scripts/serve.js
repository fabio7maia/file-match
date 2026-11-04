import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDir = join(root, 'public');
const srcDir = join(root, 'src');
const port = Number(process.env.PORT) || 3000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const isSrc = pathname.startsWith('/src/');
  const base = isSrc ? srcDir : publicDir;
  const relative = isSrc ? pathname.slice('/src/'.length) : pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(base, relative));

  if (!filePath.startsWith(base + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': types[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => {
  console.log(`Elyvan FileMatch disponível em http://localhost:${port}`);
});
