import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import http from 'node:http';

test('GET /api/health returns status ok without secrets', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, { status: 'ok' });

    // Assert that no sensitive keys or environment variables are leaked
    assert.equal(body.apiKey, undefined);
    assert.equal(body.GEMINI_API_KEY, undefined);
    assert.equal(body.key, undefined);
  } finally {
    server.close();
  }
});
