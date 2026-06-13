import 'dotenv/config';

async function listModels() {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  if (data.models) {
    const embedModels = data.models.filter((m: any) => m.name.includes('embed'));
    console.log(JSON.stringify(embedModels, null, 2));
  } else {
    console.error("Failed to list models:", data);
  }
}

listModels();
