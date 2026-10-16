import { test, expect, expectApiError } from './helpers.js';

test.describe('GET /products', () => {
  test('lista produtos com a estrutura esperada', async ({ request }) => {
    const res = await request.get('/products');
    expect(res.status()).toBe(200);
    const { items } = await res.json();
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) {
      expect(p).toEqual({
        id: expect.any(Number),
        name: expect.any(String),
        price: expect.any(Number),
        stock: expect.any(Number),
      });
      expect(p.price).toBeGreaterThan(0);
      expect(p.stock).toBeGreaterThanOrEqual(0);
    }
  });

  test('detalha um produto existente', async ({ request }) => {
    const res = await request.get('/products/2');
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: 2, name: 'Mouse Óptico', price: 80 });
  });

  test('produto inexistente retorna 404 PRODUCT_NOT_FOUND', async ({ request }) => {
    await expectApiError(await request.get('/products/9999'), 404, 'PRODUCT_NOT_FOUND');
  });

  test('id não numérico cai na rota inexistente (404 NOT_FOUND)', async ({ request }) => {
    await expectApiError(await request.get('/products/abc'), 404, 'NOT_FOUND');
  });
});
