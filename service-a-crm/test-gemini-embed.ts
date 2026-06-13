import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const res = await model.embedContent("Hello world");
    console.log("gemini-embedding-2 works! dimensions:", res.embedding.values.length);
  } catch (e: any) {
    console.error("gemini-embedding-2 error:", e.message);
  }
}

run();
