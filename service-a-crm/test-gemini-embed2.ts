import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const res = await model.embedContent("Hello world");
    console.log("text-embedding-004 works! dimensions:", res.embedding.values.length);
  } catch (e: any) {
    console.error("text-embedding-004 error:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const res = await model.embedContent("Hello world");
    console.log("gemini-embedding-001 works! dimensions:", res.embedding.values.length);
  } catch (e: any) {
    console.error("gemini-embedding-001 error:", e.message);
  }
}

run();
