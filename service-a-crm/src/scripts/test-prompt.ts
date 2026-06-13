import Groq from 'groq-sdk';
import { config } from '../config/env.js';

// Ensure GROQ_API_KEY exists in process environment or your typed config
const groqApiKey = config.GROQ_API_KEY || process.env.GROQ_API_KEY;
if (!groqApiKey) {
  console.error("FATAL: GROQ_API_KEY is missing from environment variables.");
  process.exit(1);
}

const groq = new Groq({ apiKey: groqApiKey });

const mockShoppers = [
  {
    label: "Churning Whale",
    firstName: "Sarah",
    rfm: { totalLifetimeValue: 2450, totalOrders: 18, daysSinceLastPurchase: 410 }
  },
  {
    label: "Impulsive Weekend Hiker",
    firstName: "Alex",
    rfm: { totalLifetimeValue: 180, totalOrders: 14, daysSinceLastPurchase: 3 }
  },
  {
    label: "Bargain Hunter",
    firstName: "David",
    rfm: { totalLifetimeValue: 35, totalOrders: 1, daysSinceLastPurchase: 180 }
  }
];

async function generateDigitalTwinSummary(firstName: string, rfm: typeof mockShoppers[0]['rfm']) {
  const prompt = `Analyze this retail customer profile for an outdoor/apparel brand:
Name: ${firstName}
Total Spent: $${rfm.totalLifetimeValue}
Total Orders Placed: ${rfm.totalOrders}
Days Since Last Activity: ${rfm.daysSinceLastPurchase} days

Task: Write a precise, exactly two-sentence customer behavioral profile summarizing their intent, loyalty tier, and immediate retail preference. Do not use formatting, lists, or introductory text. Output only the two sentences.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.1-8b-instant',
    temperature: 0.2, // Low variance to keep it strictly factual
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

async function runVerification() {
  console.log("Starting Glass-Box Prompt Verification...\n");
  
  for (const shopper of mockShoppers) {
    console.log(`--------------------------------------------------`);
    console.log(`[Testing Segment Cluster]: ${shopper.label}`);
    console.log(`[Input Facts]: LTV: $${shopper.rfm.totalLifetimeValue} | Orders: ${shopper.rfm.totalOrders} | Recency: ${shopper.rfm.daysSinceLastPurchase} days`);
    
    try {
      const summary = await generateDigitalTwinSummary(shopper.firstName, shopper.rfm);
      console.log(`[Generated Twin Text]:\n"${summary}"`);
    } catch (error) {
      console.error(`[Execution Error for ${shopper.label}]:`, error);
    }
    console.log(`--------------------------------------------------\n`);
  }
}

runVerification();
