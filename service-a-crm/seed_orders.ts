import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Note: since this is executed standalone, configure dotenv manually
dotenv.config({ path: resolve(process.cwd(), '.env') });

const OrderSchema = new mongoose.Schema({
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

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

async function seedOrders() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in environment.");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const now = new Date();
  const orders = [];

  // Generate around 50 orders per day for the past 60 days
  for (let i = 0; i < 60; i++) {
    const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    
    // Add some random variance to the number of orders (30 to 70 orders per day)
    const numOrders = Math.floor(Math.random() * 40) + 30;
    
    for (let j = 0; j < numOrders; j++) {
      // Add random time of day
      const orderDate = new Date(targetDate.getTime());
      orderDate.setHours(Math.floor(Math.random() * 24));
      orderDate.setMinutes(Math.floor(Math.random() * 60));

      // Random amount between $20 and $200
      const totalAmount = Math.floor(Math.random() * 180) + 20;

      orders.push({
        customerId: `cust_${Math.floor(Math.random() * 10000)}`,
        items: [{
          sku: `SKU-${Math.floor(Math.random() * 100)}`,
          name: "Sample Product",
          qty: 1,
          price: totalAmount
        }],
        totalAmount,
        purchasedAt: orderDate
      });
    }
  }

  console.log(`Prepared ${orders.length} orders. Inserting into DB...`);
  
  // Clear old dummy orders if needed, or just insert
  // await Order.deleteMany({});
  
  await Order.insertMany(orders);
  console.log("Successfully seeded orders.");
  
  await mongoose.disconnect();
}

seedOrders().catch(console.error);
