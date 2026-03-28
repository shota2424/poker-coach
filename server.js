import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatHandler from './api/chat.js';
import explanationHandler from './api/explanation.js';
import spotHandler from './api/spot.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', chatHandler);
app.post('/api/explanation', explanationHandler);
app.post('/api/spot', spotHandler);

app.get('/api', (req, res) => res.json({ message: 'API running' }));

const PORT = Math.floor(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`🚀 Local Backend Server running on http://localhost:${PORT}`);
  console.log(`Listening for API requests on /api/*`);
});
