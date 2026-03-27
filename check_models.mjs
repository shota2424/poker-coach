import fs from 'fs';
import dotenv from 'dotenv';
const env = dotenv.parse(fs.readFileSync('.env'));
const key = env.VITE_GEMINI_API_KEY.trim();
const fetchModels = async () => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    if (data.error) {
      console.error("API Error Response:", data.error.message);
    } else {
      console.log("AVAILABLE_MODELS:", data.models.map(m => m.name).join(', '));
    }
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
fetchModels();
