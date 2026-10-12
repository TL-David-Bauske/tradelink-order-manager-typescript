import express from 'express';
import type { Database } from './database.js';
import { AllocationService } from './allocation/service.js';
import { createAllocationRoutes } from './http/allocation-routes.js';
import { ApiError, errorHandler } from './http/errors.js';
import { createRoutes } from './http/routes.js';
import { CatalogRepository } from './repositories/catalog.js';
import { OrderRepository } from './repositories/orders.js';

export function createApp(db: Database): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  const orders = new OrderRepository(db);
  const catalog = new CatalogRepository(db);
  app.use(createRoutes(orders, catalog));
  app.use(createAllocationRoutes(orders, new AllocationService(db, orders, catalog)));
  app.use((_req, _res) => { throw new ApiError(404, 'Route not found'); });
  app.use(errorHandler);
  return app;
}
