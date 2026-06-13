import mongoose from 'mongoose';
import { Shopper } from './src/models/Shopper.js';
import { hybridSearch } from './src/services/rag.service.js';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/cortex');
  const count = await Shopper.countDocuments();
  console.log('Total Shoppers:', count);
  const semantic = await Shopper.countDocuments({ 'ai.embeddingVector': { $ne: null } });
  console.log('Embedded Shoppers:', semantic);
  
  const res = await hybridSearch({}, 'people interested in hiking');
  console.log('Search Results:', res.audienceSize);
  process.exit(0);
}
run();
