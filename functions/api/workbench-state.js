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

  // 使用在wrangler.toml中配置的KV Namespace
  const kv = env.WORKBENCH_STATE;

  if (!kv) {
    console.error('WORKBENCH_STATE KV binding is not configured');
    return new Response(
      JSON.stringify({ error: 'WORKBENCH_STATE KV binding is not configured.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    if (method === 'GET') {
      const data = await kv.get(STORE_KEY);
      const body = data != null ? data : 'null';
      console.log('GET request successful, data length:', body.length);
      return new Response(body, { status: 200, headers: CORS_HEADERS });
    }

    if (method === 'POST') {
      const body = await request.text();
      await kv.put(STORE_KEY, body || 'null');
      console.log('POST request successful, data saved');
      return new Response('{}', { status: 200, headers: CORS_HEADERS });
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('Error in workbench-state function:', err);
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}