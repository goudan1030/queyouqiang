const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.m4a':'audio/mp4', '.png':'image/png', '.json':'application/json; charset=utf-8' };
const server = http.createServer((req,res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control':path.extname(file)==='.m4a'?'public, max-age=31536000, immutable':'no-cache' };
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end(); return; }
      const start = Number(match[1]), end = match[2] ? Math.min(Number(match[2]),stat.size-1) : stat.size-1;
      if (start >= stat.size || end < start) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end(); return; }
      res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${stat.size}`});
      fs.createReadStream(file,{start,end}).pipe(res);
    } else { res.writeHead(200,{...headers,'Content-Length':stat.size}); fs.createReadStream(file).pipe(res); }
  });
});
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => console.log(`雀有腔 http://localhost:${server.address().port}`));
