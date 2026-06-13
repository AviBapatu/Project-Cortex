import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import redis from './config/redis.js';

// Routes
import campaignRoutes from './routes/campaigns.routes.js';
import opportunityRoutes from './routes/opportunities.routes.js';
import shopperRoutes from './routes/shoppers.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import searchRoutes from './routes/search.routes.js';

const app: Application = express();

// ── Global Middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'project-cortex-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/campaigns', campaignRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/shoppers', shopperRoutes);
app.use('/api/search', searchRoutes);
app.use('/webhooks', webhookRoutes);

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ── Global Error Handler (must be last) ────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
});

// ── Bootstrap ──────────────────────────────────────────────────────────────────
const bootstrap = async () => {
  try {
    await connectDB();
    await redis.ping();
    console.log('Redis ping successful');

    app.listen(config.PORT, () => {
      console.log(`✅ Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    });
  } catch (error) {
    console.error('Failed to bootstrap server:', error);
    process.exit(1);
  }
};

bootstrap();

