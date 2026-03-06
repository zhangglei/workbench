// 使用内存存储作为临时解决方案
let memoryStorage = {};
const STORE_KEY = 'state';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export async function onRequest(context) {
  const { request } = context;
  const method = request.method || 'GET';

  // 处理OPTIONS请求（预检请求）
  if (method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (method === 'GET') {
      const data = memoryStorage[STORE_KEY] || 'null';
      return new Response(data, { status: 200, headers: CORS_HEADERS });
    }

    if (method === 'POST') {
      const body = await request.text();
      memoryStorage[STORE_KEY] = body || 'null';
      return new Response('{}', { status: 200, headers: CORS_HEADERS });
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}