import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import redis from './config/redis.js';

const app: Application = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'project-cortex-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

const bootstrap = async () => {
  try {
    // Await database connection
    await connectDB();

    // Verify Redis connection before starting
    await redis.ping();
    console.log('Redis ping successful');

    // Start server
    app.listen(config.PORT, () => {
      console.log(`Server is running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    });
  } catch (error) {
    console.error('Failed to bootstrap server:', error);
    process.exit(1);
  }
};

bootstrap();
