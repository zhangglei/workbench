const STORE_KEY = 'state';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method || 'GET';

  // 需要在 Cloudflare Pages / Workers 的项目设置里
  // 绑定一个 KV Namespace，变量名为 WORKBENCH_STATE
  const kv = env.WORKBENCH_STATE;

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'WORKBENCH_STATE KV binding is not configured.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  if (method === 'GET') {
    try {
      const data = await kv.get(STORE_KEY);
      const body = data != null ? data : 'null';
      return new Response(body, { status: 200, headers: CORS_HEADERS });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: String(err.message || err) }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  if (method === 'POST') {
    try {
      const body = await request.text();
      await kv.put(STORE_KEY, body || 'null');
      return new Response('{}', { status: 200, headers: CORS_HEADERS });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: String(err.message || err) }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: CORS_HEADERS }
  );
}

