// Throwaway receiver for the contact form (development and the browser recipe only; excluded from the build).
//   node scripts/dev/mock-contact-receiver.mjs            listens on 127.0.0.1:4010
// Set CONTACT_WEBHOOK_URL=http://127.0.0.1:4010/ in .env.local.
//   ?fail=1 or header x-fail: 1   answers 500
//   x-slow: 1                     waits 6 s (past the 5 s timeout)
// It prints only the reference, never the message or any personal data.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4010);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let reference = '(none)';
    try {
      reference = JSON.parse(Buffer.concat(chunks).toString('utf8')).reference ?? reference;
    } catch {
      // not JSON: ignore
    }
    const failIt = url.searchParams.get('fail') === '1' || req.headers['x-fail'] === '1';
    const delay = req.headers['x-slow'] === '1' ? 6000 : 0;
    setTimeout(() => {
      console.log(`${failIt ? 'FAIL' : 'OK  '} reference=${reference}`);
      res.writeHead(failIt ? 500 : 200, { 'content-type': 'application/json' });
      res.end('{}');
    }, delay);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`mock contact receiver on http://127.0.0.1:${PORT}/`));
