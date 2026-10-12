import type { Database } from '../database.js';
import type { Product, Stock, Warehouse } from '../models.js';

export class CatalogRepository {
  constructor(private readonly db: Database) {}

  products(): Promise<Product[]> {
    return this.db.all<Product>('SELECT sku, name FROM products ORDER BY sku');
  }

  async hasProduct(sku: string): Promise<boolean> {
    return (await this.db.get('SELECT 1 FROM products WHERE sku = ?', sku)) !== undefined;
  }

  warehouses(): Promise<Warehouse[]> {
    return this.db.all<Warehouse>('SELECT * FROM warehouses ORDER BY priority, id');
  }

  stock(warehouseId: string): Promise<Stock[]> {
    return this.db.all<Stock>(`
      SELECT warehouse_id AS warehouseId, sku, on_hand AS onHand,
        reserved, on_hand - reserved AS available
      FROM stock WHERE warehouse_id = ? ORDER BY sku
    `, warehouseId);
  }
}
