const STORE_KEY = 'knowledge_state';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  const kv = env.workbench_state_kv;

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'workbench_state_kv KV binding is not configured.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    if (method === 'GET') {
      const data = await kv.get(STORE_KEY, { type: 'json' });
      return new Response(JSON.stringify(data != null ? data : {}), { status: 200, headers: CORS_HEADERS });
    }

    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        body = await request.text();
      }
      const storeValue = typeof body === 'object' ? JSON.stringify(body) : body;
      await kv.put(STORE_KEY, storeValue || '{}');
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
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
