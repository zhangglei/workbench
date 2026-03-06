const { kv } = require('@vercel/kv');

const STORE_KEY = 'workbench_state';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setCors(res);
  res.end(JSON.stringify(data));
}

/**
 * Vercel Serverless Function
 *
 * 需要在 Vercel 项目里启用 Vercel KV（Storage → KV）。
 * 启用后 Vercel 会自动注入 KV 相关环境变量，`@vercel/kv` 会自动读取并连接。
 */
module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      setCors(res);
      res.end('');
      return;
    }

    if (req.method === 'GET') {
      const raw = await kv.get(STORE_KEY);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      setCors(res);
      res.end(raw != null ? String(raw) : 'null');
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
      await kv.set(STORE_KEY, body || 'null');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      setCors(res);
      res.end('{}');
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    json(res, 500, { error: String(err && err.message ? err.message : err) });
  }
};

