'use strict';

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'workbench';
const STATE_KEY = 'state';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get(STATE_KEY);
      const body = data != null ? data : 'null';
      return { statusCode: 200, headers, body };
    } catch (err) {
      console.error('workbench-state GET error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: String(err.message) }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = event.body || 'null';
      await store.set(STATE_KEY, body);
      return { statusCode: 200, headers, body: '{}' };
    } catch (err) {
      console.error('workbench-state POST error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: String(err.message) }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
