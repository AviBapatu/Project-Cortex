import { Router } from 'express';
import {
  createCampaign,
  launchCampaign,
  listCampaigns,
  getCampaign,
  getCampaignStats,
} from '../controllers/campaign.controller.js';
import { backpressureMiddleware } from '../middleware/backpressure.middleware.js';

const router = Router();

router.post('/', createCampaign);
router.get('/', listCampaigns);
router.get('/:id/stats', getCampaignStats); // must be before /:id to avoid conflict
router.get('/:id', getCampaign);
router.post('/:id/launch', backpressureMiddleware, launchCampaign);

export default router;
