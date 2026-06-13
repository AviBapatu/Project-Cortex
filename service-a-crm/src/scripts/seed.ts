import mongoose from 'mongoose';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { connectDB } from '../config/db.js';
import { Shopper } from '../models/Shopper.js';
import 'dotenv/config';

// 1. Initialize SDKs
const groqApiKey = process.env.GROQ_API_KEY;
const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!groqApiKey || !geminiApiKey) {
  console.error("FATAL: GROQ_API_KEY or GEMINI_API_KEY is missing from environment variables.");
  process.exit(1);
}

const groq = new Groq({ apiKey: groqApiKey });
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// 2. Deterministic Persona Generation
const MOCK_PRODUCTS = [
  "Summit Tent Series 4", "Carabiner 5-Pack", "Alpine Trail Boots", 
  "Merino Wool Socks", "Hydration Pack 2L", "Titanium Camp Stove",
  "GORE-TEX Base Layer", "Lightweight Puffer Jacket"
];

function generateShoppers(count: number) {
  const shoppers = [];
  for (let i = 1; i <= count; i++) {
    // Distribute 50 users evenly across 3 strict personas
    const personaType = i % 3;
    let label, ltv, orders, recency, firstName;

    if (personaType === 0) {
      label = "Churning Whale";
      firstName = `WhaleUser_${i}`;
      ltv = Math.floor(Math.random() * 1500) + 1500; // $1500 - $3000
      orders = Math.floor(Math.random() * 10) + 10;   // 10 - 20 orders
      recency = Math.floor(Math.random() * 200) + 180; // 180 - 380 days ago
    } else if (personaType === 1) {
      label = "Impulsive Weekend Hiker";
      firstName = `HikerUser_${i}`;
      ltv = Math.floor(Math.random() * 300) + 100;   // $100 - $400
      orders = Math.floor(Math.random() * 15) + 15;   // 15 - 30 orders
      recency = Math.floor(Math.random() * 14) + 1;    // 1 - 15 days ago
    } else {
      label = "Active Bargain Hunter";
      firstName = `BargainUser_${i}`;
      ltv = Math.floor(Math.random() * 60) + 20;     // $20 - $80
      orders = Math.floor(Math.random() * 4) + 1;     // 1 - 5 orders
      recency = Math.floor(Math.random() * 60) + 30;   // 30 - 90 days ago
    }

    shoppers.push({
      customerId: `CUST_${1000 + i}`,
      firstName,
      lastName: "Demo",
      email: `${firstName.toLowerCase()}@example.com`,
      phone: `+1555010${i.toString().padStart(3, '0')}`,
      label,
      rfm: {
        recencyScore: recency < 30 ? 5 : recency < 100 ? 3 : 1,
        frequencyScore: orders > 15 ? 5 : orders > 5 ? 3 : 1,
        monetaryScore: ltv > 1000 ? 5 : ltv > 200 ? 3 : 1,
        totalLifetimeValue: ltv,
        totalOrders: orders,
        daysSinceLastPurchase: recency
      }
    });
  }
  return shoppers;
}

// 3. The Delay Utility (Rate Limit Protection)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// 4. The Execution Engine
async function runIngestion() {
  console.log("🚀 Starting Data Ingestion Pipeline...");
  await connectDB();
  
  // Clear out old data to ensure clean runs
  await Shopper.deleteMany({});
  console.log("🧹 Cleared existing Shopper collection.");

  const shoppers = generateShoppers(50); // Generating exactly 50 to respect API limits
  console.log(`🧬 Generated ${shoppers.length} deterministic profiles. Commencing AI Enrichment...`);

  for (const [index, shopperData] of shoppers.entries()) {
    console.log(`\n[${index + 1}/${shoppers.length}] Processing ${shopperData.firstName} (${shopperData.label})...`);

    try {
      // STEP A: Generate Digital Twin via Groq
      // We pass the deterministic label INTO the prompt to stop hallucinations.
      const prompt = `Analyze this retail customer profile for an outdoor/apparel brand.
Name: ${shopperData.firstName}
Total Spent: $${shopperData.rfm.totalLifetimeValue}
Total Orders Placed: ${shopperData.rfm.totalOrders}
Days Since Last Activity: ${shopperData.rfm.daysSinceLastPurchase} days
Heuristic Segment Label: ${shopperData.label}

Task: Write a precise, exactly two-sentence customer behavioral profile. Explicitly integrate their 'Heuristic Segment Label' vibe into the description. Output only the two sentences.`;

      const groqRes = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1, 
      });

      const digitalTwinSummary = groqRes.choices[0]?.message?.content?.trim() || 'Summary generation failed.';

      // STEP B: Generate Vector via Google AI
      const embedRes = await embeddingModel.embedContent(digitalTwinSummary);
      const embeddingVector = embedRes.embedding.values;

      if (embeddingVector.length !== 3072) {
        throw new Error(`Invalid embedding dimensions: ${embeddingVector.length} (expected 3072)`);
      }

      // STEP C: Save to MongoDB
      await Shopper.create({
        customerId: shopperData.customerId,
        firstName: shopperData.firstName,
        lastName: shopperData.lastName,
        email: shopperData.email,
        phone: shopperData.phone,
        status: 'ACTIVE',
        rfm: shopperData.rfm,
        ai: {
          digitalTwinSummary,
          embeddingVector,
          embeddingModel: 'gemini-embedding-001',
          lastEmbeddedAt: new Date()
        }
      });

      console.log(`✅ Success | Vector [3072-dim] Attached.`);

    } catch (error) {
      console.error(`❌ FAILED on ${shopperData.customerId}:`, error);
    }

    // STEP D: Strict Rate Limit Delay (2 seconds)
    // DO NOT REMOVE THIS. It keeps you under Free Tier RPM caps.
    await delay(2000); 
  }

  console.log("\n🎯 INGESTION COMPLETE. Database is loaded and ready for Hybrid Search.");
  process.exit(0);
}

runIngestion();
