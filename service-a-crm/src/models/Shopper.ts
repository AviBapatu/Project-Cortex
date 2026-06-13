import { Schema, model, Document } from 'mongoose';

export interface IShopper extends Document {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rfm: {
    recencyScore: number;
    frequencyScore: number;
    monetaryScore: number;
    totalLifetimeValue: number;
    daysSinceLastPurchase: number;
    totalOrders: number;
  };
  ai: {
    digitalTwinSummary: string;
    embeddingVector: number[] | null;
    lastEmbeddedAt?: Date;
  };
  status: 'ACTIVE' | 'EMBEDDING_PENDING' | 'INACTIVE' | 'CHURNED';
  createdAt: Date;
  updatedAt: Date;
}

const ShopperSchema = new Schema<IShopper>({
  customerId: { type: String, required: true, unique: true, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  rfm: {
    recencyScore: { type: Number, required: true },
    frequencyScore: { type: Number, required: true },
    monetaryScore: { type: Number, required: true },
    totalLifetimeValue: { type: Number, required: true, index: true },
    daysSinceLastPurchase: { type: Number, required: true, index: true },
    totalOrders: { type: Number, required: true }
  },
  ai: {
    digitalTwinSummary: { type: String, required: true },
    embeddingVector: {
      type: [Number],
      default: null,
      validate: {
        validator: function(v: number[] | null) {
          if (v === null) return true;
          return v.length === 384;
        },
        message: 'Embedding vector must be exactly 384 dimensions.'
      }
    },
    lastEmbeddedAt: { type: Date }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EMBEDDING_PENDING', 'INACTIVE', 'CHURNED'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

export const Shopper = model<IShopper>('Shopper', ShopperSchema);
