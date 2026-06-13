import 'dotenv/config';

async function listAllModels() {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  if (data.models) {
    const names = data.models.map((m: any) => m.name);
    console.log(names);
  } else {
    console.error("Failed to list models:", data);
  }
}

listAllModels();
