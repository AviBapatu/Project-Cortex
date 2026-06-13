import { type Request, type Response, type NextFunction } from 'express';
import { Campaign } from '../models/Campaign.js';
import { dispatchQueue } from '../queues/queues.js';
import { config } from '../config/env.js';

const BACKPRESSURE_THRESHOLD = parseInt(process.env.BACKPRESSURE_THRESHOLD || '10000', 10);

/**
 * Backpressure middleware — applied ONLY to POST /api/campaigns/:id/launch.
 *
 * Checks the number of waiting jobs in dispatch_queue.
 * If over threshold → marks campaign QUEUED and returns 429.
 * Otherwise → passes control to the launch handler.
 */
export async function backpressureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const campaignId = String(req.params['id']);
    const queueMetrics = await dispatchQueue.getJobCounts('waiting', 'active', 'delayed');
    const totalLoad = (queueMetrics.waiting ?? 0) + (queueMetrics.delayed ?? 0);

    if (totalLoad > BACKPRESSURE_THRESHOLD) {
      await Campaign.updateOne({ _id: campaignId }, { status: 'QUEUED' });
      res.status(429).json({
        success: false,
        error: 'System at capacity. Campaign has been queued and will launch automatically when load subsides.',
        queueLoad: totalLoad,
        threshold: BACKPRESSURE_THRESHOLD,
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
