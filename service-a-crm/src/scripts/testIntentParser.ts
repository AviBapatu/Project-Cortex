import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { parseQueryIntent } from '../services/queryIntent.service.js';

const tests = [
  'customers who spent more than $1000',
  'impulse hikers who love budget gear',
  'customers who bought in the last 15 days',
  'high-spending churned customers who love winter sports',
  'inactive customers',
];

async function main() {
  for (const q of tests) {
    console.log('\n' + '='.repeat(60));
    console.log('QUERY:', q);
    const r = await parseQueryIntent(q);
    console.log('needsSemantic:', r.needsSemanticSearch);
    console.log('semanticQuery:', r.semanticQuery);
    console.log('filters:', JSON.stringify(r.filters));
    console.log('reasoning:', r.reasoning);
  }
  process.exit(0);
}

main().catch(console.error);
