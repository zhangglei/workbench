import { getStore } from '@netlify/blobs';

const STORE_NAME = 'workbench';
const STATE_KEY = 'state';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (req.method === 'GET') {
    try {
      const data = await store.get(STATE_KEY);
      const body = data != null ? data : 'null';
      return new Response(body, { status: 200, headers: CORS_HEADERS });
    } catch (err) {
      console.error('workbench-state GET error:', err);
      return new Response(JSON.stringify({ error: String(err.message) }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text();
      await store.set(STATE_KEY, body || 'null');
      return new Response('{}', { status: 200, headers: CORS_HEADERS });
    } catch (err) {
      console.error('workbench-state POST error:', err);
      return new Response(JSON.stringify({ error: String(err.message) }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: CORS_HEADERS,
  });
};
