import Groq from 'groq-sdk';
import { Order } from '../models/Order.js';
import { Shopper } from '../models/Shopper.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Aggregates a shopper's order history into a plain-text narrative summary.
 * This text becomes the input to the embedding model (the "Digital Twin").
 *
 * AI Authority Boundary: The LLM is given ONLY hard data and instructed to
 * produce a precise 2-sentence summary. It is NOT allowed to invent criteria.
 */
export async function generateSummary(customerId: string): Promise<string> {
  const shopper = await Shopper.findOne({ customerId });
  if (!shopper) throw new Error(`Shopper not found: ${customerId}`);

  const orders = await Order.find({ customerId }).sort({ purchasedAt: -1 }).limit(20);

  if (orders.length === 0 || !orders[0]) {
    return `${shopper.firstName} ${shopper.lastName} has no purchase history on record.`;
  }

  const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrder = totalSpent / orders.length;
  const lastPurchase = orders[0].purchasedAt.toDateString();
  const daysSince = shopper.rfm?.daysSinceLastPurchase ?? 'unknown';

  const topItems = orders
    .flatMap(o => o.items.map(i => i.name))
    .slice(0, 5)
    .join(', ');

  const contextPrompt = `You are writing a CRM behavioral profile summary.
Customer: ${shopper.firstName} ${shopper.lastName}
Total Spent: ₹${totalSpent.toFixed(2)} across ${orders.length} orders
Average Order Value: ₹${avgOrder.toFixed(2)}
Days Since Last Purchase: ${daysSince}
Recent Products: ${topItems || 'N/A'}
RFM Scores — Recency: ${shopper.rfm?.recencyScore}/5, Frequency: ${shopper.rfm?.frequencyScore}/5, Monetary: ${shopper.rfm?.monetaryScore}/5

Task: Write exactly two sentences describing this customer's behavioral profile. Be precise and data-driven. Do NOT invent data not provided. Output only the two sentences.`;

  const res = await groq.chat.completions.create({
    messages: [{ role: 'user', content: contextPrompt }],
    model: 'llama-3.1-8b-instant',
    temperature: 0.1,
    max_tokens: 200,
  });

  return res.choices[0]?.message?.content?.trim() || `${shopper.firstName} is a customer with ${orders.length} orders totaling ₹${totalSpent.toFixed(2)}.`;
}
