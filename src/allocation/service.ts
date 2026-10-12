import type { Database } from '../database.js';
import type { Order, Warehouse } from '../models.js';
import type { CatalogRepository } from '../repositories/catalog.js';
import type { OrderRepository } from '../repositories/orders.js';
import { RankedSelector } from './ranked-selector.js';

interface AllocationResponse {
  statusCode: number;
  body: Order | { error: string };
}

export class AllocationService {
  constructor(
    private readonly db: Database,
    private readonly orders: OrderRepository,
    private readonly catalog: CatalogRepository,
  ) {}

  async allocate(orderId: string): Promise<AllocationResponse> {
    const order = await this.orders.find(orderId);
    if (!order) return { statusCode: 404, body: { error: 'Order not found' } };

    const selector = new RankedSelector<Warehouse>(
      (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
      async (warehouse) => {
        const stock = await this.catalog.stock(warehouse.id);
        return order.items.every((item) => {
          const productStock = stock.find((row) => row.sku === item.sku);
          return productStock !== undefined && productStock.onHand >= item.quantity;
        });
      },
    );
    const warehouse = await selector.select(await this.catalog.warehouses());
    if (!warehouse) {
      return { statusCode: 409, body: { error: 'No warehouse can fulfill this order' } };
    }

    for (const item of order.items) {
      await this.db.run(`
        UPDATE stock SET reserved = reserved + ? WHERE warehouse_id = ? AND sku = ?
      `, item.quantity, warehouse.id, item.sku);
    }
    await this.db.run(`
      UPDATE orders SET status = 'assigned', warehouse_id = ? WHERE id = ?
    `, warehouse.id, order.id);

    return { statusCode: 200, body: (await this.orders.find(order.id))! };
  }
}
