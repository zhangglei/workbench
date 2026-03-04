const STORE_KEY = 'workbench_state';

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

/**
 * Vercel Serverless Function
 *
 * 需要在 Vercel 项目里开启/创建 KV，并配置环境变量（Vercel 会自动注入）：
 * - KV_REST_API_URL
 * - KV_REST_API_TOKEN
 *
 * 我们用 KV REST API 直接读写一个 key，值为 JSON 字符串（与 Netlify blobs 保存的内容一致）。
 */
module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end('');
      return;
    }

    const baseUrl = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!baseUrl || !token) {
      json(res, 500, { error: 'Vercel KV is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).' });
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    if (req.method === 'GET') {
      const r = await fetch(`${baseUrl}/get/${encodeURIComponent(STORE_KEY)}`, { headers });
      const data = await r.json();
      // Upstash/Vercel KV: { result: "..." }，不存在为 null
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end(data && data.result != null ? data.result : 'null');
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
      const r = await fetch(`${baseUrl}/set/${encodeURIComponent(STORE_KEY)}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify([STORE_KEY, body || 'null']),
      });
      if (!r.ok) {
        const t = await r.text();
        json(res, 500, { error: `KV set failed: ${t}` });
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end('{}');
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    json(res, 500, { error: String(err && err.message ? err.message : err) });
  }
};

