import 'dotenv/config';

async function testModel() {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004?key=${key}`);
  const data = await res.json();
  console.log(data);
}

testModel();
