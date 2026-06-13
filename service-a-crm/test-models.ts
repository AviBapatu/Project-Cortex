import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!);

async function run() {
  try {
    const model004 = genAI.getGenerativeModel({ model: "text-embedding-004" });
    await model004.embedContent("Hello world");
    console.log("text-embedding-004 works!");
  } catch (e: any) {
    console.error("text-embedding-004 error:", e.message);
  }

  try {
    const model005 = genAI.getGenerativeModel({ model: "text-embedding-005" });
    await model005.embedContent("Hello world");
    console.log("text-embedding-005 works!");
  } catch (e: any) {
    console.error("text-embedding-005 error:", e.message);
  }
}

run();
