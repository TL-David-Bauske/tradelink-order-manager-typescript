import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Order } from '../src/models.js';
import { fixture, orderRequest } from './helpers.js';
import { OrderRepository } from '../src/repositories/orders.js';

test('creates a pending order and reads it back through the API', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const response = await f.request('/orders', orderRequest());
  assert.equal(response.status, 201);
  const order = await response.json() as Order;
  assert.equal(response.headers.get('location'), `/orders/${order.id}`);
  assert.equal(order.status, 'pending');
  assert.equal(order.warehouseId, null);
  assert.deepEqual(order.items, [{ sku: 'BOLT-M8', quantity: 4 }, { sku: 'WASHER-M8', quantity: 3 }]);
  assert.deepEqual(await (await f.request(`/orders/${order.id}`)).json(), order);
});

test('rejects invalid quantities, unknown products, duplicate lines and empty orders', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const bodies = [[], [{ sku: 'BOLT-M8', quantity: 0 }], [{ sku: 'BOLT-M8', quantity: 1.5 }],
    [{ sku: 'UNKNOWN', quantity: 1 }], [{ sku: 'BOLT-M8', quantity: 1 }, { sku: 'BOLT-M8', quantity: 2 }]];
  for (const items of bodies) assert.equal((await f.request('/orders', orderRequest(items))).status, 400);
  assert.deepEqual(await (await f.request('/orders')).json(), []);
});

test('exposes catalog and stock; returns JSON errors for missing resources and malformed JSON', async (t) => {
  const f = await fixture();
  t.after(f.close);
  assert.equal((await (await f.request('/products')).json() as unknown[]).length, 3);
  assert.equal((await (await f.request('/warehouses')).json() as unknown[]).length, 3);
  const stock = await (await f.request('/warehouses/berlin/stock')).json() as { available: number }[];
  assert.equal(stock[0]?.available, 10);
  for (const path of ['/orders/missing', '/warehouses/missing/stock', '/missing']) {
    const response = await f.request(path);
    assert.equal(response.status, 404);
    assert.equal(typeof (await response.json() as { error: unknown }).error, 'string');
  }
  const malformed = await f.request('/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
});

test('order creation rolls back all writes if an order line cannot be stored', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const orders = new OrderRepository(f.db);
  await assert.rejects(orders.create([{ sku: 'BOLT-M8', quantity: 1 }, { sku: 'UNKNOWN', quantity: 1 }]));
  assert.deepEqual(await orders.list(), []);
  assert.equal((await f.db.get<{ count: number }>('SELECT count(*) AS count FROM order_items'))?.count, 0);
});

test('database prevents invalid stock and inconsistent order assignment states', async (t) => {
  const f = await fixture();
  t.after(f.close);
  await assert.rejects(f.db.run('UPDATE stock SET reserved = 11 WHERE warehouse_id = ? AND sku = ?',
    'berlin', 'BOLT-M8'));
  await assert.rejects(f.db.run('INSERT INTO orders (id, status) VALUES (?, ?)', 'bad', 'assigned'));
});

test('concurrent order requests each persist their own complete order', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const responses = await Promise.all(Array.from({ length: 8 }, () => f.request('/orders', orderRequest())));
  assert.ok(responses.every((response) => response.status === 201));
  const orders = await Promise.all(responses.map(async (response) => await response.json() as Order));
  assert.equal(new Set(orders.map((order) => order.id)).size, 8);
  assert.ok(orders.every((order) => order.items.length === 2));
  assert.equal((await (await f.request('/orders')).json() as Order[]).length, 8);
});

test('a failing transaction does not roll back another concurrent order', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const orders = new OrderRepository(f.db);
  const [failed, successful] = await Promise.allSettled([
    orders.create([{ sku: 'BOLT-M8', quantity: 1 }, { sku: 'UNKNOWN', quantity: 1 }]),
    orders.create([{ sku: 'BOLT-M8', quantity: 2 }]),
  ]);
  assert.equal(failed.status, 'rejected');
  assert.equal(successful.status, 'fulfilled');
  const persisted = await orders.list();
  assert.equal(persisted.length, 1);
  assert.deepEqual(persisted[0]?.items, [{ sku: 'BOLT-M8', quantity: 2 }]);
});
