// api-check.js — test the running nyxbio API
import http from 'node:http';

const base = 'http://localhost:3001';
const req = (path) => new Promise((resolve, reject) => {
  http.get(base + path, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  }).on('error', reject);
});

async function main() {
  try {
    const r = await req('/health');
    console.log('GET /health ->', r.status, r.body);

    const r2 = await req('/api/model/status');
    console.log('GET /api/model/status ->', r2.status, r2.body);

    const r3 = await req('/api/profile');
    console.log('GET /api/profile ->', r3.status, r3.body.slice(0, 200));

    const r4 = await req('/api/chat');
    console.log('POST /api/chat ->', r4.status, r4.body);
  } catch (e) {
    console.error('ERR', e && e.message ? e.message : e);
    console.error('stack', e && e.stack ? e.stack : '');
    process.exit(1);
  }
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
