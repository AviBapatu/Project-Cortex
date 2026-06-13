import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { generateCampaignVariants } from '../services/rag.service.js';

async function main() {
  console.log('Testing generateCampaignVariants...');
  const { variants } = await generateCampaignVariants('impulse hikers who love budget gear', 'impulse hikers who love budget gear');
  console.log(JSON.stringify(variants, null, 2));
}

main().catch(console.error);
