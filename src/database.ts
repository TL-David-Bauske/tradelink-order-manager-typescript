import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sqlite3 from 'sqlite3';
import { Database as Connection, open } from 'sqlite';

type Parameter = string | number | null;

export class Database {
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly connection: Connection) {}

  // A transaction owns the shared connection until commit or rollback. All
  // other operations queue behind it, rather than joining its transaction.
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.then(() => {}, () => {});
    return result;
  }

  get<T>(sql: string, ...parameters: Parameter[]): Promise<T | undefined> {
    return this.enqueue(() => this.connection.get<T>(sql, ...parameters));
  }

  all<T>(sql: string, ...parameters: Parameter[]): Promise<T[]> {
    return this.enqueue(() => this.connection.all<T[]>(sql, ...parameters));
  }

  run(sql: string, ...parameters: Parameter[]): Promise<void> {
    return this.enqueue(async () => { await this.connection.run(sql, ...parameters); });
  }

  exec(sql: string): Promise<void> {
    return this.enqueue(() => this.connection.exec(sql));
  }

  transaction<T>(operation: (connection: Connection) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.connection.exec('BEGIN IMMEDIATE');
      try {
        const result = await operation(this.connection);
        await this.connection.exec('COMMIT');
        return result;
      } catch (error) {
        await this.connection.exec('ROLLBACK');
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.enqueue(() => this.connection.close());
  }
}

export async function openDatabase(path = process.env.DATABASE_PATH ?? 'data/orders.sqlite'): Promise<Database> {
  if (path !== ':memory:') await mkdir(dirname(path), { recursive: true });
  const db = new Database(await open({ filename: path, driver: sqlite3.Database }));
  try {
    await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL CHECK (priority >= 0)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS stock (
      warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
      sku TEXT NOT NULL REFERENCES products(sku),
      on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
      reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
      PRIMARY KEY (warehouse_id, sku)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned')),
      warehouse_id TEXT REFERENCES warehouses(id),
      CHECK ((status = 'pending' AND warehouse_id IS NULL)
        OR (status = 'assigned' AND warehouse_id IS NOT NULL))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id),
      sku TEXT NOT NULL REFERENCES products(sku),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (order_id, sku)
    ) STRICT;
  `);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
