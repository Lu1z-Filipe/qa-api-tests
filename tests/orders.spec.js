import { test, expect, expectApiError } from './helpers.js';

// Os testes de pedidos consomem estoque; a ordem é fixa (workers: 1) e cada teste
// usa produtos/quantidades que não interferem nos demais.
test.describe('POST /orders — regras de negócio', () => {
  test('pedido abaixo de R$ 500 não recebe desconto', async ({ request, authHeaders }) => {
    const res = await request.post('/orders', {
      headers: authHeaders,
      data: { items: [{ productId: 2, quantity: 2 }] }, // 2 x 80 = 160
    });
    expect(res.status()).toBe(201);
    const order = await res.json();
    expect(order).toMatchObject({ status: 'CREATED', subtotal: 160, discount: 0, total: 160 });
  });

  test('pedido a partir de R$ 500 recebe 10% de desconto (limite exato)', async ({ request, authHeaders }) => {
    const res = await request.post('/orders', {
      headers: authHeaders,
      data: { items: [{ productId: 1, quantity: 2 }] }, // 2 x 250 = 500 (fronteira)
    });
    expect(res.status()).toBe(201);
    expect(await res.json()).toMatchObject({ subtotal: 500, discount: 50, total: 450 });
  });

  test('pedido criado pode ser consultado por id', async ({ request, authHeaders }) => {
    const created = await (
      await request.post('/orders', { headers: authHeaders, data: { items: [{ productId: 2, quantity: 1 }] } })
    ).json();
    const res = await request.get(`/orders/${created.id}`, { headers: authHeaders });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  test('pedido baixa o estoque do produto', async ({ request, authHeaders }) => {
    const before = await (await request.get('/products/2')).json();
    await request.post('/orders', { headers: authHeaders, data: { items: [{ productId: 2, quantity: 3 }] } });
    const after = await (await request.get('/products/2')).json();
    expect(after.stock).toBe(before.stock - 3);
  });

  test('estoque insuficiente retorna 409 e não altera o estoque', async ({ request, authHeaders }) => {
    const before = await (await request.get('/products/3')).json();
    const res = await request.post('/orders', {
      headers: authHeaders,
      data: { items: [{ productId: 3, quantity: before.stock + 1 }] },
    });
    await expectApiError(res, 409, 'INSUFFICIENT_STOCK');
    expect((await (await request.get('/products/3')).json()).stock).toBe(before.stock);
  });

  test('produto inexistente no pedido retorna 404', async ({ request, authHeaders }) => {
    const res = await request.post('/orders', { headers: authHeaders, data: { items: [{ productId: 9999, quantity: 1 }] } });
    await expectApiError(res, 404, 'PRODUCT_NOT_FOUND');
  });
});

test.describe('POST /orders — validação e segurança', () => {
  test('sem token retorna 401', async ({ request }) => {
    const res = await request.post('/orders', { data: { items: [{ productId: 1, quantity: 1 }] } });
    await expectApiError(res, 401, 'UNAUTHORIZED');
  });

  test('token inválido retorna 401', async ({ request }) => {
    const res = await request.post('/orders', {
      headers: { Authorization: 'Bearer token-falso' },
      data: { items: [{ productId: 1, quantity: 1 }] },
    });
    await expectApiError(res, 401, 'UNAUTHORIZED');
  });

  const invalidos = [
    ['items ausente', {}, 'items'],
    ['items vazio', { items: [] }, 'items'],
    ['quantity zero', { items: [{ productId: 1, quantity: 0 }] }, 'items[0].quantity'],
    ['quantity negativa', { items: [{ productId: 1, quantity: -1 }] }, 'items[0].quantity'],
    ['quantity acima do máximo (11)', { items: [{ productId: 1, quantity: 11 }] }, 'items[0].quantity'],
    ['quantity decimal', { items: [{ productId: 1, quantity: 1.5 }] }, 'items[0].quantity'],
    ['quantity como texto', { items: [{ productId: 1, quantity: '2' }] }, 'items[0].quantity'],
    ['productId como texto', { items: [{ productId: 'abc', quantity: 1 }] }, 'items[0].productId'],
  ];
  for (const [nome, data, campo] of invalidos) {
    test(`${nome} retorna 422 apontando o campo ${campo}`, async ({ request, authHeaders }) => {
      const res = await request.post('/orders', { headers: authHeaders, data });
      const err = await expectApiError(res, 422, 'VALIDATION_ERROR');
      expect(err.details.map((d) => d.field)).toContain(campo);
    });
  }

  test('pedido inexistente retorna 404 ORDER_NOT_FOUND', async ({ request, authHeaders }) => {
    await expectApiError(await request.get('/orders/nao-existe', { headers: authHeaders }), 404, 'ORDER_NOT_FOUND');
  });

  test('consulta de pedido sem token retorna 401', async ({ request }) => {
    await expectApiError(await request.get('/orders/qualquer'), 401, 'UNAUTHORIZED');
  });
});

test('GET /health responde ok', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});
