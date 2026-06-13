import 'dotenv/config';
import express from 'express';
import sendRoutes from './routes/send.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'service-b-channel-stub', status: 'healthy' });
});

app.use('/send', sendRoutes);

app.listen(PORT, () => {
  console.log(`✅ Service B (Channel Stub) running on port ${PORT}`);
});
