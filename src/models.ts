export interface Product {
  sku: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
  priority: number;
}

export interface Stock {
  warehouseId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface OrderItem {
  sku: string;
  quantity: number;
}

export interface Order {
  id: string;
  status: 'pending' | 'assigned';
  warehouseId: string | null;
  items: OrderItem[];
}
