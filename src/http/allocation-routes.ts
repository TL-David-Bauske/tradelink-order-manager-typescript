import { Router } from 'express';
import type { AllocationService } from '../allocation/service.js';
import type { OrderRepository } from '../repositories/orders.js';
import { ApiError } from './errors.js';

export function createAllocationRoutes(orders: OrderRepository, allocation: AllocationService): Router {
  const router = Router();
  router.post('/orders/:id/allocate', async (req, res) => {
    if (!await orders.find(req.params.id)) throw new ApiError(404, 'Order not found');
    const result = await allocation.allocate(req.params.id);
    res.status(result.statusCode).json(result.body);
  });
  return router;
}
