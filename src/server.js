// API local controlada ("Loja Demo") usada como alvo dos testes.
// Sem dependências: apenas node:http. Dados 100% sintéticos, em memória.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

export const DEMO_USER = { email: 'qa@example.com', password: 'Passw0rd!' };
const DISCOUNT_THRESHOLD = 500; // subtotal a partir do qual vale 10% de desconto
const MAX_QTY_PER_ITEM = 10;

function seedProducts() {
  return [
    { id: 1, name: 'Teclado Mecânico', price: 250, stock: 5 },
    { id: 2, name: 'Mouse Óptico', price: 80, stock: 20 },
    { id: 3, name: 'Monitor 27"', price: 1200, stock: 2 },
  ];
}

export function createApp() {
  const products = new Map(seedProducts().map((p) => [p.id, p]));
  const orders = new Map();
  const tokens = new Set();

  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  const error = (res, status, code, message, details) =>
    send(res, status, { error: { code, message, ...(details ? { details } : {}) } });

  const readJson = (req) =>
    new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('INVALID_JSON'));
        }
      });
    });

  const authorized = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    return Boolean(m && tokens.has(m[1]));
  };

  function validateOrder(body) {
    const problems = [];
    if (!Array.isArray(body.items) || body.items.length === 0) {
      problems.push({ field: 'items', message: 'items é obrigatório e não pode ser vazio' });
      return problems;
    }
    body.items.forEach((item, i) => {
      if (!Number.isInteger(item?.productId)) problems.push({ field: `items[${i}].productId`, message: 'deve ser inteiro' });
      if (!Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > MAX_QTY_PER_ITEM)
        problems.push({ field: `items[${i}].quantity`, message: `deve ser inteiro entre 1 e ${MAX_QTY_PER_ITEM}` });
    });
    return problems;
  }

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    const method = req.method;

    try {
      if (method === 'GET' && pathname === '/health') return send(res, 200, { status: 'ok' });

      if (method === 'POST' && pathname === '/auth/login') {
        const body = await readJson(req);
        if (!body.email || !body.password) return error(res, 400, 'VALIDATION_ERROR', 'email e password são obrigatórios');
        if (body.email !== DEMO_USER.email || body.password !== DEMO_USER.password)
          return error(res, 401, 'INVALID_CREDENTIALS', 'Credenciais inválidas');
        const token = randomUUID();
        tokens.add(token);
        return send(res, 200, { token, expiresIn: 3600 });
      }

      if (method === 'GET' && pathname === '/products') return send(res, 200, { items: [...products.values()] });

      const productMatch = /^\/products\/(\d+)$/.exec(pathname);
      if (method === 'GET' && productMatch) {
        const product = products.get(Number(productMatch[1]));
        return product ? send(res, 200, product) : error(res, 404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado');
      }

      if (method === 'POST' && pathname === '/orders') {
        if (!authorized(req)) return error(res, 401, 'UNAUTHORIZED', 'Token ausente ou inválido');
        const body = await readJson(req);
        const problems = validateOrder(body);
        if (problems.length) return error(res, 422, 'VALIDATION_ERROR', 'Pedido inválido', problems);

        for (const item of body.items) {
          const p = products.get(item.productId);
          if (!p) return error(res, 404, 'PRODUCT_NOT_FOUND', `Produto ${item.productId} não encontrado`);
          if (p.stock < item.quantity) return error(res, 409, 'INSUFFICIENT_STOCK', `Estoque insuficiente para o produto ${p.id}`);
        }
        let subtotal = 0;
        for (const item of body.items) {
          const p = products.get(item.productId);
          p.stock -= item.quantity;
          subtotal += p.price * item.quantity;
        }
        const discount = subtotal >= DISCOUNT_THRESHOLD ? subtotal * 0.1 : 0;
        const order = {
          id: randomUUID(),
          status: 'CREATED',
          items: body.items,
          subtotal,
          discount,
          total: subtotal - discount,
        };
        orders.set(order.id, order);
        return send(res, 201, order);
      }

      const orderMatch = /^\/orders\/([\w-]+)$/.exec(pathname);
      if (method === 'GET' && orderMatch) {
        if (!authorized(req)) return error(res, 401, 'UNAUTHORIZED', 'Token ausente ou inválido');
        const order = orders.get(orderMatch[1]);
        return order ? send(res, 200, order) : error(res, 404, 'ORDER_NOT_FOUND', 'Pedido não encontrado');
      }

      return error(res, 404, 'NOT_FOUND', 'Rota não encontrada');
    } catch (e) {
      if (e.message === 'INVALID_JSON') return error(res, 400, 'INVALID_JSON', 'Corpo da requisição não é um JSON válido');
      return error(res, 500, 'INTERNAL_ERROR', 'Erro interno');
    }
  };

  return http.createServer(handler);
}

if (process.argv[1]?.endsWith('server.js')) {
  const port = Number(process.env.PORT ?? 3100);
  createApp().listen(port, () => console.log(`Loja Demo API em http://localhost:${port}`));
}
