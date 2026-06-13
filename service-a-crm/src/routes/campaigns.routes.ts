import { Router } from 'express';
import {
  createCampaign,
  launchCampaign,
  listCampaigns,
  getCampaign,
  getCampaignStats,
  toggleSave,
  updateVariantTemplate,
  refineCampaignVariants,
  updateCampaignChannels,
} from '../controllers/campaign.controller.js';
import { backpressureMiddleware } from '../middleware/backpressure.middleware.js';

const router = Router();

router.post('/', createCampaign);
router.get('/', listCampaigns);
router.get('/:id/stats', getCampaignStats);
router.get('/:id', getCampaign);
router.post('/:id/launch', backpressureMiddleware, launchCampaign);
router.post('/:id/toggle-save', toggleSave);
router.put('/:id/channels', updateCampaignChannels);
router.put('/:id/variants/:variantId', updateVariantTemplate);
router.post('/:id/refine', refineCampaignVariants);

export default router;
