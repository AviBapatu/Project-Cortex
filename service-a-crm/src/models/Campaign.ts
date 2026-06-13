import { Schema, model, Document } from 'mongoose';

export interface ICampaignVariant {
  variantId: 'A' | 'B' | 'C';
  template: string;
  stats: {
    sent: number;
    opens: number;
    clicks: number;
  };
}

export interface ICampaign extends Document {
  campaignId: string;
  name: string;
  goal: string;
  segmentQuery: Record<string, any>;
  audienceSize: number;
  variants: ICampaignVariant[];
  status: 'DRAFT' | 'QUEUED' | 'EXECUTING' | 'OPTIMIZING' | 'COMPLETED' | 'FAILED';
  winnerVariant: string | null;
  processed: number;
  failed: number;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  campaignId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  goal: { type: String, required: true },
  segmentQuery: { type: Schema.Types.Mixed, required: true },
  audienceSize: { type: Number, required: true },
  variants: [{
    variantId: { type: String, enum: ['A', 'B', 'C'], required: true },
    template: { type: String, required: true },
    stats: {
      sent: { type: Number, default: 0 },
      opens: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 }
    }
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'QUEUED', 'EXECUTING', 'OPTIMIZING', 'COMPLETED', 'FAILED'],
    default: 'DRAFT',
    index: true
  },
  winnerVariant: { type: String, default: null },
  processed: { type: Number, default: 0 },
  failed: { type: Number, default: 0 }
}, { timestamps: true });

export const Campaign = model<ICampaign>('Campaign', CampaignSchema);
