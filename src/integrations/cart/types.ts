export type CartAddInput = {
  customerId: string;
  customOrderId: string;
  productSku: string;
  title: string;
};

export type CartItem = {
  id: string;
  customerId: string;
  customOrderId: string;
  productSku: string;
  title: string;
  quantity: number;
  createdAt: Date;
};

export interface CartService {
  addCustomOrderLine(input: CartAddInput): Promise<CartItem>;
  listByCustomer(customerId: string): Promise<CartItem[]>;
  removeById(id: string, customerId: string): Promise<void>;
}
