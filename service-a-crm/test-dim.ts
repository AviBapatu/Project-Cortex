import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const res = await model.embedContent({
      content: { role: 'user', parts: [{ text: "Hello world" }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      title: "Hello world"
      // Wait, is outputDimensionality supported in the SDK? Let's just try.
    });
    console.log("Without outputDimensionality:", res.embedding.values.length);
  } catch (e: any) {
    console.error("error:", e.message);
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${process.env.GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/gemini-embedding-2",
        content: { parts: [{ text: "Hello world" }] },
        outputDimensionality: 768
      })
    });
    const data = await res.json();
    console.log("With outputDimensionality 768:", data.embedding?.values?.length);
  } catch(e: any) {
    console.log("error", e.message);
  }
}

run();
