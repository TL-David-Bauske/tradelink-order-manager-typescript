# Warehouse allocation

## Requested change

Add `POST /orders/:id/allocate` so an order can be assigned to a warehouse and its
stock reserved. Use these business rules:

- Select the highest-priority warehouse that has enough available stock for
  **every** order line. Lower priority numbers win; break ties by warehouse ID.
- Available stock is on-hand stock minus stock already reserved for other orders.
- A missing product stock row means that warehouse cannot supply that product.
- Orders never split across warehouses.
- Persist the warehouse assignment and reserve the requested quantity of every
  product. Physical on-hand quantities stay unchanged until dispatch.
- If no warehouse qualifies, return 409 and leave the order and stock unchanged.
- An unknown order returns 404. A successful allocation returns 200 and the order.
- Repeating allocation for an assigned order returns its existing assignment
  without reserving additional stock or moving it to another warehouse.
- If allocation fails partway through, leave both the order and stock unchanged.

Authentication, dispatch, replenishment, cancellation and distributed processing
are outside this change. The service runs as one local API process.

## Review exercise

Review `main...warehouse-allocation` as a colleague's proposed pull request.
The README explains how to run the API and tests. You have approximately
45 minutes; you can inspect or run the code, and ask clarifying questions.

Prioritize feedback by its effect on correctness, maintainability and the
ability to change the allocation rules. Explain consequences and propose
focused improvements. A rewrite or a completed implementation is not required.
Also identify design decisions you would keep.

## Try the allocation endpoint

Follow the README setup instructions, create an order through `POST /orders`,
and substitute its returned `id` below:

```sh
curl -i -X POST http://localhost:3000/orders/ORDER_ID/allocate
curl http://localhost:3000/orders/ORDER_ID
curl http://localhost:3000/warehouses/berlin/stock
```

A successful response contains the assigned order, including its `warehouseId`.
Stock responses expose the physical on-hand, reserved and available quantities.
