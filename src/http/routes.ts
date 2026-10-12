import { Router } from 'express';
import type { OrderItem } from '../models.js';
import type { CatalogRepository } from '../repositories/catalog.js';
import type { OrderRepository } from '../repositories/orders.js';
import { ApiError } from './errors.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function parseItems(body: unknown, catalog: CatalogRepository): Promise<OrderItem[]> {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    throw new ApiError(400, 'items must contain between 1 and 50 order lines');
  }
  const items: OrderItem[] = [];
  const seen = new Set<string>();
  for (const item of body.items as unknown[]) {
    if (!isRecord(item) || typeof item.sku !== 'string' || !/^[A-Z0-9-]{1,40}$/.test(item.sku)
      || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0 || item.quantity > 10000) {
      throw new ApiError(400, 'Each item needs a valid sku and an integer quantity between 1 and 10000');
    }
    if (seen.has(item.sku)) throw new ApiError(400, 'Duplicate product lines are not allowed');
    if (!await catalog.hasProduct(item.sku)) throw new ApiError(400, `Unknown product: ${item.sku}`);
    seen.add(item.sku);
    items.push({ sku: item.sku, quantity: item.quantity });
  }
  return items;
}

export function createRoutes(orders: OrderRepository, catalog: CatalogRepository): Router {
  const router = Router();
  router.get('/products', async (_req, res) => res.json(await catalog.products()));
  router.get('/warehouses', async (_req, res) => res.json(await catalog.warehouses()));
  router.get('/warehouses/:id/stock', async (req, res) => {
    if (!(await catalog.warehouses()).some((warehouse) => warehouse.id === req.params.id)) {
      throw new ApiError(404, 'Warehouse not found');
    }
    res.json(await catalog.stock(req.params.id));
  });
  router.get('/orders', async (_req, res) => res.json(await orders.list()));
  router.get('/orders/:id', async (req, res) => {
    const order = await orders.find(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    res.json(order);
  });
  router.post('/orders', async (req, res) => {
    const order = await orders.create(await parseItems(req.body as unknown, catalog));
    res.status(201).location(`/orders/${order.id}`).json(order);
  });
  return router;
}
