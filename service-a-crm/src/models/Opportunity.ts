import { Schema, model, Document } from 'mongoose';

export interface IOpportunity extends Document {
  opportunityId: string;
  segmentRuleId: string;
  ruleDefinition: Record<string, any>;
  audienceMatchCount: number;
  llmTitle: string;
  llmDescription: string;
  status: 'NEW' | 'CONVERTED_TO_CAMPAIGN' | 'DISMISSED';
  isSaved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OpportunitySchema = new Schema<IOpportunity>({
  opportunityId: { type: String, required: true, unique: true },
  segmentRuleId: { type: String, required: true },
  ruleDefinition: { type: Schema.Types.Mixed, required: true },
  audienceMatchCount: { type: Number, required: true },
  llmTitle: { type: String, required: true },
  llmDescription: { type: String, required: true },
  status: { type: String, enum: ['NEW', 'CONVERTED_TO_CAMPAIGN', 'DISMISSED'], default: 'NEW', index: true },
  isSaved: { type: Boolean, default: false }
}, { timestamps: true });

export const Opportunity = model<IOpportunity>('Opportunity', OpportunitySchema);
