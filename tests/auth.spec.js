import { test, expect, expectApiError, CREDENTIALS } from './helpers.js';

test.describe('POST /auth/login', () => {
  test('credenciais válidas retornam 200 com token', async ({ request }) => {
    const res = await request.post('/auth/login', { data: CREDENTIALS });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ expiresIn: 3600 });
    expect(body.token).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('senha incorreta retorna 401 INVALID_CREDENTIALS', async ({ request }) => {
    const res = await request.post('/auth/login', { data: { ...CREDENTIALS, password: 'errada' } });
    await expectApiError(res, 401, 'INVALID_CREDENTIALS');
  });

  for (const [campo, payload] of [
    ['email ausente', { password: 'x' }],
    ['password ausente', { email: 'qa@example.com' }],
    ['corpo vazio', {}],
  ]) {
    test(`${campo} retorna 400 VALIDATION_ERROR`, async ({ request }) => {
      const res = await request.post('/auth/login', { data: payload });
      await expectApiError(res, 400, 'VALIDATION_ERROR');
    });
  }

  test('JSON malformado retorna 400 INVALID_JSON', async ({ request }) => {
    const res = await request.post('/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: Buffer.from('{"email": '), // Buffer evita que o Playwright serialize a string como JSON válido
    });
    await expectApiError(res, 400, 'INVALID_JSON');
  });
});
