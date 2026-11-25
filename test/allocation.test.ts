import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Order, Stock } from '../src/models.js';
import { createOrder, fixture, orderRequest } from './helpers.js';

test('assigns an order to the highest-priority warehouse and reserves every line', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const order = await createOrder(f);
  const response = await f.request(`/orders/${order.id}/allocate`, { method: 'POST' });
  assert.equal(response.status, 200);
  const assigned = await response.json() as Order;
  assert.equal(assigned.status, 'assigned');
  assert.equal(assigned.warehouseId, 'berlin');
  assert.deepEqual(await (await f.request(`/orders/${order.id}`)).json(), assigned);
  const stock = await (await f.request('/warehouses/berlin/stock')).json() as Stock[];
  assert.deepEqual(stock.map(({ sku, onHand, reserved, available }) => ({ sku, onHand, reserved, available })), [
    { sku: 'BOLT-M8', onHand: 10, reserved: 4, available: 6 },
    { sku: 'WASHER-M8', onHand: 10, reserved: 3, available: 7 },
  ]);
});

test('skips a higher-priority warehouse that is missing a product', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const order = await (await f.request('/orders', orderRequest([
    { sku: 'BOLT-M8', quantity: 2 }, { sku: 'PACKING-TAPE', quantity: 1 },
  ]))).json() as Order;
  const response = await f.request(`/orders/${order.id}/allocate`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as Order).warehouseId, 'hamburg');
});

test('leaves an unfulfillable order pending and does not split it across warehouses', async (t) => {
  const f = await fixture();
  t.after(f.close);
  await f.db.exec(`DELETE FROM stock WHERE sku = 'WASHER-M8' AND warehouse_id != 'berlin'`);
  const order = await (await f.request('/orders', orderRequest([
    { sku: 'BOLT-M8', quantity: 15 }, { sku: 'WASHER-M8', quantity: 3 },
  ]))).json() as Order;
  const response = await f.request(`/orders/${order.id}/allocate`, { method: 'POST' });
  assert.equal(response.status, 409);
  assert.deepEqual(await (await f.request(`/orders/${order.id}`)).json(), order);
  assert.equal((await f.db.get<{ total: number }>('SELECT sum(reserved) AS total FROM stock'))?.total, 0);
});

test('returns 404 when allocating an unknown order', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const response = await f.request('/orders/missing/allocate', { method: 'POST' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Order not found' });
});
