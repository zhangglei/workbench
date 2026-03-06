const STORE_KEY = 'state';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase(); // 统一转大写，避免大小写问题

  // 处理OPTIONS请求（预检请求）
  if (method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  // 使用在Cloudflare Pages中配置的KV Namespace
  const kv = env.workbench_state_kv;

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'workbench_state_kv KV binding is not configured.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    if (method === 'GET') {
      // 关键修复1：指定type为json，确保返回合法JSON（而非字符串）
      const data = await kv.get(STORE_KEY, { type: 'json' });
      // 关键修复2：空数据返回{}而非'null'，避免前端解析异常
      const body = JSON.stringify(data || {});
      return new Response(body, { status: 200, headers: CORS_HEADERS });
    }

    if (method === 'POST') {
      // 关键修复3：优先解析JSON，兼容前端传JSON的场景
      let body;
      try {
        body = await request.json(); // 前端传JSON时解析
      } catch (e) {
        body = await request.text(); // 兼容纯文本场景
      }
      // 关键修复4：存入KV前确保是合法JSON字符串
      const storeValue = typeof body === 'object' ? JSON.stringify(body) : body;
      await kv.put(STORE_KEY, storeValue || '{}');
      // 关键修复5：返回成功标识，而非空对象
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