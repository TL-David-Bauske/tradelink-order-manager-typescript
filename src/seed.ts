import type { Database } from './database.js';

export async function seedDatabase(db: Database): Promise<void> {
  // Keep seeding explicit and non-destructive: existing catalog data is an error.
  await db.transaction(async (connection) => {
    await connection.exec(`
      INSERT INTO products (sku, name) VALUES
        ('BOLT-M8', 'M8 bolt'), ('WASHER-M8', 'M8 washer'), ('PACKING-TAPE', 'Packing tape');
      INSERT INTO warehouses (id, name, priority) VALUES
        ('berlin', 'Berlin', 10), ('hamburg', 'Hamburg', 20), ('munich', 'Munich', 30);
      INSERT INTO stock (warehouse_id, sku, on_hand, reserved) VALUES
        ('berlin', 'BOLT-M8', 10, 0), ('berlin', 'WASHER-M8', 10, 0),
        ('hamburg', 'BOLT-M8', 20, 0), ('hamburg', 'WASHER-M8', 20, 0),
        ('hamburg', 'PACKING-TAPE', 5, 0),
        ('munich', 'BOLT-M8', 50, 0), ('munich', 'WASHER-M8', 50, 0),
        ('munich', 'PACKING-TAPE', 10, 0);
    `);
  });
}
