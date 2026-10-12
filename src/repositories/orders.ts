import { randomUUID } from 'node:crypto';
import type { Database } from '../database.js';
import type { Order, OrderItem } from '../models.js';

interface OrderRow {
  id: string;
  status: Order['status'];
  warehouse_id: string | null;
}

export class OrderRepository {
  constructor(private readonly db: Database) {}

  async find(id: string): Promise<Order | undefined> {
    const row = await this.db.get<OrderRow>('SELECT * FROM orders WHERE id = ?', id);
    if (!row) return undefined;
    const items = await this.db.all<OrderItem>(
      'SELECT sku, quantity FROM order_items WHERE order_id = ? ORDER BY sku', id,
    );
    return { id: row.id, status: row.status, warehouseId: row.warehouse_id, items };
  }

  async list(): Promise<Order[]> {
    const rows = await this.db.all<{ id: string }>('SELECT id FROM orders ORDER BY id');
    return Promise.all(rows.map(async (row) => (await this.find(row.id))!));
  }

  async create(items: OrderItem[]): Promise<Order> {
    const id = randomUUID();
    await this.db.transaction(async (connection) => {
      await connection.run('INSERT INTO orders (id) VALUES (?)', id);
      for (const item of items) {
        await connection.run('INSERT INTO order_items (order_id, sku, quantity) VALUES (?, ?, ?)',
          id, item.sku, item.quantity);
      }
    });
    return (await this.find(id))!;
  }
}
