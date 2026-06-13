import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define strict structural types for production reliability
interface Transaction {
  item_name: string;
  category: string;
  price: number;
  purchase_date: string;
}

interface UserProfile {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  location: {
    city: string;
    state: string;
  };
  age: number;
  status: 'ACTIVE' | 'INACTIVE' | 'CHURNED';
  rfm_recency: number | null; // Days since last purchase
  rfm_frequency: number;
  rfm_monetary: number;
  primary_tier: string;
  transactions: Transaction[];
}

// Product Catalogs with discrete prices and categories
const whaleItems = [
  { name: "Summit Pro 4-Season Tent", price: 650, cat: "Expedition Gear" },
  { name: "Garmin Fenix 7 Sapphire Solar", price: 800, cat: "Electronics" },
  { name: "Hilleberg Soulo 1-Person Tent", price: 900, cat: "Expedition Gear" },
  { name: "Osprey Aether Plus 85L Backpack", price: 380, cat: "Pack Systems" },
  { name: "MSR Guardian Purifier", price: 390, cat: "Utility" }
];

const hikerItems = [
  { name: "Black Diamond HotForge Carabiner", price: 12, cat: "Climbing Hardware" },
  { name: "Merino Wool Tough Hiker Socks", price: 25, cat: "Apparel" },
  { name: "Sawyer Squeeze Water Filter", price: 45, cat: "Utility" },
  { name: "Petzl Actik Core Headlamp", price: 80, cat: "Electronics" },
  { name: "Jetboil Flash Cooking System", price: 130, cat: "Camp Kitchen" },
  { name: "Nalgene Wide Mouth 32oz", price: 16, cat: "Utility" }
];

const gorpcoreItems = [
  { name: "Salomon XT-6 Trail Runners", price: 200, cat: "Footwear" },
  { name: "Arc'teryx Alpha SV Shell Jacket", price: 900, cat: "Technical Outerwear" },
  { name: "And Wander Stretch Packing Pants", price: 320, cat: "Apparel" },
  { name: "Oakley Factory Team Nubuck Sneakers", price: 190, cat: "Footwear" },
  { name: "Snow Peak Flexible Insulated Cardigan", price: 230, cat: "Apparel" }
];

const snowItems = [
  { name: "Burton Custom Camber Snowboard", price: 660, cat: "Alpine Hardware" },
  { name: "Oakley Flight Deck M Goggles", price: 230, cat: "Alpine Optics" },
  { name: "Jones Mountain Twin Snowboard", price: 550, cat: "Alpine Hardware" },
  { name: "Anon M4 Toric Goggles", price: 320, cat: "Alpine Optics" },
  { name: "Patagonia PowSlayer GORE-TEX Jacket", price: 750, cat: "Technical Outerwear" }
];

const basicItems = [
  { name: "Basic 2-Person Dome Tent", price: 60, cat: "Camping Gear" },
  { name: "Foam Roll-Up Sleeping Pad", price: 30, cat: "Camping Gear" },
  { name: "Coleman Sundome 3-Person Tent", price: 80, cat: "Camping Gear" },
  { name: "Ozark Trail Fleece Sleeping Bag", price: 25, cat: "Camping Gear" },
  { name: "Intex Twin Camping Air Mattress", price: 35, cat: "Camping Gear" }
];

const allProducts = [...whaleItems, ...hikerItems, ...gorpcoreItems, ...snowItems, ...basicItems];

const TOTAL_USERS = 4000;
const users: UserProfile[] = [];

// Distribution counters for logging validation metrics
const stats = {
  Whales: 0,
  Hikers: 0,
  Gorpcore: 0,
  Snow: 0,
  Campers: 0,
  Generalists: 0,
  Ghosts: 0
};

function generateTransactions(primaryPool: typeof allProducts, count: number): Transaction[] {
  const list: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    // 80% chance to select from targeted cohort pool, 20% chance to pull from cross-domain catalog
    const useCrossPollination = Math.random() < 0.20;
    const pool = useCrossPollination ? allProducts : primaryPool;
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!item) continue; // TypeScript safety check for array bounds

    list.push({
      item_name: item.name,
      category: item.cat,
      price: item.price,
      purchase_date: faker.date.recent({ days: 730 }).toISOString().substring(0, 10)
    });
  }
  return list;
}

for (let i = 0; i < TOTAL_USERS; i++) {
  const rand = Math.random();
  let tier = '';
  let status: 'ACTIVE' | 'INACTIVE' | 'CHURNED' = 'ACTIVE';
  let recency: number | null = faker.number.int({ min: 1, max: 30 });
  let txs: Transaction[] = [];

  // Base metadata fields uniform across users
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = faker.internet.email({ firstName, lastName });
  const location = { city: faker.location.city(), state: faker.location.state() };
  const age = faker.number.int({ min: 18, max: 65 });

  if (rand < 0.10) {
    // 10% Churning Whales
    tier = 'Whales';
    status = 'CHURNED';
    recency = faker.number.int({ min: 300, max: 730 });
    txs = generateTransactions(whaleItems, faker.number.int({ min: 3, max: 6 }));
    stats.Whales++;
  } else if (rand < 0.30) {
    // 20% Impulsive Hikers
    tier = 'Hikers';
    status = 'ACTIVE';
    recency = faker.number.int({ min: 1, max: 14 });
    txs = generateTransactions(hikerItems, faker.number.int({ min: 10, max: 20 }));
    stats.Hikers++;
  } else if (rand < 0.50) {
    // 20% Urban Gorpcore Trenders
    tier = 'Gorpcore';
    status = 'ACTIVE';
    recency = faker.number.int({ min: 5, max: 45 });
    txs = generateTransactions(gorpcoreItems, faker.number.int({ min: 4, max: 9 }));
    stats.Gorpcore++;
  } else if (rand < 0.60) {
    // 10% Seasonal Snow Addicts
    tier = 'Snow';
    status = 'ACTIVE';
    recency = faker.number.int({ min: 15, max: 180 });
    txs = generateTransactions(snowItems, faker.number.int({ min: 2, max: 5 }));
    stats.Snow++;
  } else if (rand < 0.70) {
    // 10% One-Off Campers
    tier = 'Campers';
    status = 'CHURNED';
    recency = faker.number.int({ min: 365, max: 730 });
    txs = generateTransactions(basicItems, 1);
    stats.Campers++;
  } else if (rand < 0.90) {
    // 20% Generalists (Noise Layer)
    tier = 'Generalists';
    status = Math.random() > 0.3 ? 'ACTIVE' : 'CHURNED';
    recency = faker.number.int({ min: 10, max: 400 });
    txs = generateTransactions(allProducts, faker.number.int({ min: 2, max: 8 }));
    stats.Generalists++;
  } else {
    // 10% Ghosts (Zero Value Inactives)
    tier = 'Ghosts';
    status = 'INACTIVE';
    recency = null;
    txs = [];
    stats.Ghosts++;
  }

  const frequency = txs.length;
  const monetary = txs.reduce((sum, t) => sum + t.price, 0);

  users.push({
    customer_id: faker.string.uuid(),
    first_name: firstName,
    last_name: lastName,
    email,
    location,
    age,
    status,
    rfm_recency: recency,
    rfm_frequency: frequency,
    rfm_monetary: monetary,
    primary_tier: tier,
    transactions: txs
  });
}

// Write file synchronously to clean local project root location
const outputPath = path.join(__dirname, 'raw_shoppers.json');
fs.writeFileSync(outputPath, JSON.stringify(users, null, 2), 'utf-8');

console.log('--- DATA GENERATION ENGINE METRICS ---');
console.log(`Target Matrix Executed: Generated ${users.length} unique profiles.`);
console.table(stats);
console.log(`File committed to: ${outputPath}`);