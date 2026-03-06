const STORE_KEY = 'state';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method || 'GET';

  // 处理OPTIONS请求（预检请求）
  if (method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  // 使用在Cloudflare Pages中配置的KV Namespace
  const kv = env.workbench_state_kv;  // 使用您配置的绑定名称

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'workbench_state_kv KV binding is not configured.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    if (method === 'GET') {
      const data = await kv.get(STORE_KEY);
      const body = data != null ? data : 'null';
      return new Response(body, { status: 200, headers: CORS_HEADERS });
    }

    if (method === 'POST') {
      const body = await request.text();
      await kv.put(STORE_KEY, body || 'null');
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