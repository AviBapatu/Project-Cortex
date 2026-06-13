import { Order } from '../models/Order.js';
import { Shopper } from '../models/Shopper.js';

const RECENCY_THRESHOLDS = [7, 30, 90, 180] as const;
const FREQUENCY_THRESHOLDS = [2, 5, 10, 20] as const;
const MONETARY_THRESHOLDS = [50, 200, 500, 1000] as const;

function scoreRecency(days: number): 1 | 2 | 3 | 4 | 5 {
  if (days <= RECENCY_THRESHOLDS[0]) return 5;
  if (days <= RECENCY_THRESHOLDS[1]) return 4;
  if (days <= RECENCY_THRESHOLDS[2]) return 3;
  if (days <= RECENCY_THRESHOLDS[3]) return 2;
  return 1;
}

function scoreFrequency(count: number): 1 | 2 | 3 | 4 | 5 {
  if (count >= FREQUENCY_THRESHOLDS[3]) return 5;
  if (count >= FREQUENCY_THRESHOLDS[2]) return 4;
  if (count >= FREQUENCY_THRESHOLDS[1]) return 3;
  if (count >= FREQUENCY_THRESHOLDS[0]) return 2;
  return 1;
}

function scoreMonetary(ltv: number): 1 | 2 | 3 | 4 | 5 {
  if (ltv >= MONETARY_THRESHOLDS[3]) return 5;
  if (ltv >= MONETARY_THRESHOLDS[2]) return 4;
  if (ltv >= MONETARY_THRESHOLDS[1]) return 3;
  if (ltv >= MONETARY_THRESHOLDS[0]) return 2;
  return 1;
}

export async function calculateRFM(customerId: string): Promise<void> {
  const orders = await Order.find({ customerId }).sort({ purchasedAt: -1 });

  if (orders.length === 0) {
    await Shopper.updateOne({ customerId }, {
      $set: {
        'rfm.recencyScore': 1,
        'rfm.frequencyScore': 1,
        'rfm.monetaryScore': 1,
        'rfm.totalLifetimeValue': 0,
        'rfm.totalOrders': 0,
        'rfm.daysSinceLastPurchase': 9999,
      },
    });
    return;
  }

  const now = new Date();
  const firstOrder = orders[0];
  if (!firstOrder) return;

  const daysSinceLastPurchase = Math.floor(
    (now.getTime() - firstOrder.purchasedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalOrders = orders.length;
  const totalLifetimeValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  await Shopper.updateOne({ customerId }, {
    $set: {
      'rfm.recencyScore': scoreRecency(daysSinceLastPurchase),
      'rfm.frequencyScore': scoreFrequency(totalOrders),
      'rfm.monetaryScore': scoreMonetary(totalLifetimeValue),
      'rfm.totalLifetimeValue': parseFloat(totalLifetimeValue.toFixed(2)),
      'rfm.totalOrders': totalOrders,
      'rfm.daysSinceLastPurchase': daysSinceLastPurchase,
    },
  });
}
