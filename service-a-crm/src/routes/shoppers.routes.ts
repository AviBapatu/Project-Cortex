import { Router, type Request, type Response } from 'express';
import { Shopper } from '../models/Shopper.js';

const router = Router();

// GET /api/shoppers?status=ACTIVE&page=1&limit=20
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20', search } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && typeof status === 'string') filter['status'] = status;
    if (search && typeof search === 'string') {
      filter['$or'] = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Shopper.countDocuments(filter);
    const shoppers = await Shopper.find(filter)
      .sort({ 'rfm.totalLifetimeValue': -1 })
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .limit(parseInt(limit as string))
      .select('-ai.embeddingVector');

    res.json({ success: true, total, page: parseInt(page as string), shoppers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/shoppers/:customerId
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const customerId = String(req.params['customerId']);
    const shopper = await Shopper.findOne({ customerId }).select('-ai.embeddingVector');
    if (!shopper) {
      res.status(404).json({ success: false, error: 'Shopper not found.' });
      return;
    }
    res.json({ success: true, shopper });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
