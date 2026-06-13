import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { pipeline } from '@xenova/transformers';
import { Shopper } from '../models/Shopper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || '';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  // 1. Check total documents
  const totalDocs = await Shopper.countDocuments();
  const activeDocs = await Shopper.countDocuments({ status: 'ACTIVE' });
  const withEmbeddings = await Shopper.countDocuments({ 'ai.embeddingVector': { $ne: null } });
  console.log(`Total shoppers: ${totalDocs}`);
  console.log(`ACTIVE shoppers: ${activeDocs}`);
  console.log(`With embeddings: ${withEmbeddings}\n`);

  // 2. Check a sample embedding
  const sample = await Shopper.findOne({ 'ai.embeddingVector': { $ne: null } }).lean();
  if (sample) {
    const vec = (sample as any).ai?.embeddingVector;
    console.log(`Sample embedding dims: ${vec?.length}`);
    console.log(`Sample first 5 values: [${vec?.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}]`);
    console.log(`Sample summary: "${(sample as any).ai?.digitalTwinSummary?.substring(0, 100)}..."\n`);
  }

  // 3. Init embedding pipeline
  console.log('Loading Xenova/all-MiniLM-L6-v2...');
  const embedPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  async function embedText(text: string): Promise<number[]> {
    const output = await embedPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  // 4. Test two different queries
  const queries = ['impulse buyers who buy cheap hiking gear', 'luxury high-spending whale customers'];

  for (const query of queries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`QUERY: "${query}"`);
    console.log('='.repeat(60));

    const queryVector = await embedText(query);
    console.log(`Query vector dims: ${queryVector.length}`);
    console.log(`Query vector first 5: [${queryVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

    try {
      const results = await Shopper.aggregate([
        {
          $vectorSearch: {
            index: 'cortex_vector_index',
            path: 'ai.embeddingVector',
            queryVector,
            numCandidates: 200,
            limit: 10,
            filter: { status: { $eq: 'ACTIVE' } },
          }
        },
        { $addFields: { score: { $meta: 'vectorSearchScore' } } },
        { $project: { firstName: 1, lastName: 1, status: 1, score: 1, 'rfm.totalLifetimeValue': 1, 'rfm.frequencyScore': 1, 'ai.digitalTwinSummary': 1 } }
      ]);

      console.log(`\nResults (${results.length}):`);
      results.forEach((r: any, i: number) => {
        console.log(`  ${i + 1}. ${r.firstName} ${r.lastName} | Score: ${r.score?.toFixed(4)} | LTV: $${r.rfm?.totalLifetimeValue} | Freq: ${r.rfm?.frequencyScore}`);
        console.log(`     Summary: "${r.ai?.digitalTwinSummary?.substring(0, 80)}..."`);
      });
    } catch (err: any) {
      console.error(`\n❌ $vectorSearch FAILED:`);
      console.error(`   codeName: ${err?.codeName}`);
      console.error(`   message: ${err?.message}`);
      console.error(`   Full error:`, err);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(console.error);
