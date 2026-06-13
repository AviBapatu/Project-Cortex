import { Router } from 'express';
import {
  listOpportunities,
  getOpportunity,
  convertOpportunity,
  dismissOpportunity,
} from '../controllers/opportunity.controller.js';

const router = Router();

router.get('/', listOpportunities);
router.get('/:id', getOpportunity);
router.post('/:id/convert', convertOpportunity);
router.patch('/:id/dismiss', dismissOpportunity);

export default router;
