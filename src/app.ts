import express from 'express';
import type { Database } from './database.js';
import { ApiError, errorHandler } from './http/errors.js';
import { createRoutes } from './http/routes.js';
import { CatalogRepository } from './repositories/catalog.js';
import { OrderRepository } from './repositories/orders.js';

export function createApp(db: Database): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(createRoutes(new OrderRepository(db), new CatalogRepository(db)));
  app.use((_req, _res) => { throw new ApiError(404, 'Route not found'); });
  app.use(errorHandler);
  return app;
}
