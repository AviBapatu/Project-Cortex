import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { pipeline } from '@xenova/transformers';
import { Shopper } from '../models/Shopper.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MONGO_URI = process.env.MONGO_URI || '';

/**
 * 1. The Translation Layer
 * Maps raw JSON fields into a cohesive English paragraph.
 */
function buildFactString(user: any): string {
  const age = user.age || 'unknown age';
  const location = user.location ? `${user.location.city}, ${user.location.state}` : 'unknown location';
  const transactions = user.transactions || [];
  
  const purchases = transactions.map((t: any) => `${t.item_name} ($${t.price})`).join(', ');
  
  return `User ${user.first_name} ${user.last_name} is an ${user.status} customer aged ${age} from ${location}. ` +
    `They have spent $${user.rfm_monetary} across ${user.rfm_frequency} orders. ` +
    `Their recent purchases include: ${purchases || 'none'}.`;
}

/**
 * 2. LLM Synthesis (Groq)
 * Calls llama-3.1-8b-instant to generate a 2-sentence psychological and behavioral profile.
 */
async function generateGoldenRecord(factString: string): Promise<string> {
  const systemPrompt = `You are a retail data analyst. Convert the provided customer facts into exactly two sentences describing their psychological and behavioral profile, and identifying what kind of outdoor consumer they are.
CRITICAL RULES:
- Provide ONLY the three sentences.
- Do NOT include any introductions like "Based on...".
- Do NOT include bullet points, lists, or trailing thoughts.
- Output the raw text directly.`;
  
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: factString }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 150,
    });
    
    return chatCompletion.choices[0]?.message?.content?.trim() || factString;
  } catch (error) {
    console.warn(`[Groq Warning] Failed to generate golden record. Falling back to fact string.`, error);
    return factString; // Fallback
  }
}

// Utility for sleep
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('[Ingestion] Starting ETL Pipeline...');

  if (!MONGO_URI) {
    console.error('MONGO_URI is missing from .env');
    process.exit(1);
  }

  // Connect to DB
  await mongoose.connect(MONGO_URI);
  console.log('[Ingestion] Connected to MongoDB.');

  // Initialize Local Embedding Pipeline
  console.log('[Ingestion] Initializing local embedding pipeline (Xenova/all-MiniLM-L6-v2)...');
  const generateVectorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  async function generateVector(text: string): Promise<number[]> {
    const output = await generateVectorPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  // Data Load
  const dataPath = path.join(__dirname, 'raw_shoppers.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`[Error] raw_shoppers.json not found at ${dataPath}`);
    process.exit(1);
  }

  // 1. Load Data (Slice the remaining 3700 records)
  const allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const rawData = allData.slice(1650, 4000); 
  console.log(`[Ingestion] Loaded ${rawData.length} users for Background Run.`);

  // Database Reset (DISABLED for background ingestion)
  // console.log('[Ingestion] Clearing existing Shopper collection...');
  // await Shopper.deleteMany({});
  // console.log('[Ingestion] Collection cleared.');

  // Resilient Batch Processing
  const BATCH_SIZE = 50;
  const totalBatches = Math.ceil(rawData.length / BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const batch = rawData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    
    // STRICT SEQUENTIAL PROCESSING (Rate Limit Protection)
    const processedBatch = [];
    
    for (let j = 0; j < batch.length; j++) {
      const user = batch[j];
      
      process.stdout.write(`\\r[Batch ${i + 1}/${totalBatches}] Synthesizing record ${j + 1}/${batch.length}...`);

      // 1. Translation
      const factString = buildFactString(user);
      
      // 2. Synthesis
      const goldenRecord = await generateGoldenRecord(factString);
      
      // 3. Vectorization
      const embedding = await generateVector(goldenRecord);

      // Map to Mongoose Schema
      processedBatch.push({
        customerId: user.customer_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone || '555-0000',
        rfm: {
          recencyScore: user.rfm_recency || 0,
          frequencyScore: user.rfm_frequency || 0,
          monetaryScore: user.rfm_monetary || 0,
          totalLifetimeValue: user.rfm_monetary || 0,
          daysSinceLastPurchase: user.rfm_recency || 0, // FIXED mapping
          totalOrders: user.rfm_frequency || 0,
        },
        ai: {
          digitalTwinSummary: goldenRecord,
          embeddingVector: embedding,
          lastEmbeddedAt: new Date(),
        },
        status: user.status || 'ACTIVE',
      });

      // Rate limit: 6000 TPM / ~400 tokens per record = 15 records/min max → 5s delay is safe
      await delay(5000); 
    }

    // Insert to DB with upsert to prevent duplicate key errors
    const bulkOps = processedBatch.map(doc => ({
      updateOne: {
        filter: { customerId: doc.customerId },
        update: { $set: doc },
        upsert: true
      }
    }));
    await Shopper.bulkWrite(bulkOps);
    
    console.log(`[Batch ${i + 1}/${totalBatches}] Processed ${batch.length} records. Vectors generated. Inserted.`);
    
    // Rate limit prevention
    if (i < totalBatches - 1) {
      await delay(5000);
    }
  }

  console.log('[Ingestion] ETL Pipeline complete!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(console.error);
