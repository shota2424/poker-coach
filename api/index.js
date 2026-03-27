// This file is kept for reference only. 
// Active API endpoints are: spot.js, explanation.js, chat.js
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Poker Coach API is running. Use /api/spot, /api/explanation, /api/chat endpoints.',
    env_check: {
      has_gemini_key: !!(process.env.GEMINI_API_KEY),
      has_vite_key: !!(process.env.VITE_GEMINI_API_KEY),
    }
  });
}
