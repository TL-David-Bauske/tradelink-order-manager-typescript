import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';
import { seedDatabase } from '../src/seed.js';
import type { Order } from '../src/models.js';

export async function fixture() {
  const db = await openDatabase(':memory:');
  await seedDatabase(db);
  const server: Server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    db,
    request: (path: string, options?: RequestInit) => fetch(`${baseUrl}${path}`, options),
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await db.close();
    },
  };
}

export function orderRequest(items = [{ sku: 'BOLT-M8', quantity: 4 }, { sku: 'WASHER-M8', quantity: 3 }]): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) };
}

export async function createOrder(f: Awaited<ReturnType<typeof fixture>>): Promise<Order> {
  const response = await f.request('/orders', orderRequest());
  if (response.status !== 201) throw new Error(`Order creation failed: ${response.status}`);
  return await response.json() as Order;
}
