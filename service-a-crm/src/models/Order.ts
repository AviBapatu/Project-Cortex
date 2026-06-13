import { Schema, model, Document } from 'mongoose';

export interface IOrderItem {
  sku: string;
  name: string;
  qty: number;
  price: number;
}

export interface IOrder extends Document {
  customerId: string;
  items: IOrderItem[];
  totalAmount: number;
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  customerId: { type: String, required: true, index: true },
  items: [{
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  purchasedAt: { type: Date, required: true }
}, { timestamps: true });

export const Order = model<IOrder>('Order', OrderSchema);
