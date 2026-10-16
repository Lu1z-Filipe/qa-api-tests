import { test as base, expect } from '@playwright/test';

export const CREDENTIALS = { email: 'qa@example.com', password: 'Passw0rd!' };

/** Fixture reutilizável: `authHeaders` já traz um token válido obtido via login. */
export const test = base.extend({
  authHeaders: async ({ request }, use) => {
    const res = await request.post('/auth/login', { data: CREDENTIALS });
    expect(res.status(), 'login do fixture deve funcionar').toBe(200);
    const { token } = await res.json();
    await use({ Authorization: `Bearer ${token}` });
  },
});

export { expect };

/** Contrato de erro da API: { error: { code, message, details? } } */
export async function expectApiError(res, status, code) {
  expect(res.status()).toBe(status);
  expect(res.headers()['content-type']).toContain('application/json');
  const body = await res.json();
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe('string');
  return body.error;
}
