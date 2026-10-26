const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 4173;
const PUBLIC_DIRECTORY = path.join(__dirname, 'dist');

// 配信するファイルを限定し、Content-Typeを明示する。
const routes = {
  '/': { file: 'index.html', contentType: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', contentType: 'text/javascript; charset=utf-8' },
  '/styles.css': { file: 'styles.css', contentType: 'text/css; charset=utf-8' },
};

http.createServer((request, response) => {
  const pathname = request.url.split('?')[0];
  const route = Object.hasOwn(routes, pathname) ? routes[pathname] : null;

  if (!route) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.setHeader('Content-Type', route.contentType);
  fs.createReadStream(path.join(PUBLIC_DIRECTORY, route.file)).pipe(response);
}).listen(PORT, HOST, () => {
  console.log(`http://${HOST}:${PORT}`);
});
