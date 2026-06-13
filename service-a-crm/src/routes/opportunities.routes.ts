import { Router } from 'express';
import {
  listOpportunities,
  getOpportunity,
  convertOpportunity,
  dismissOpportunity,
  runEngine,
  toggleSave,
} from '../controllers/opportunity.controller.js';

const router = Router();

router.post('/run', runEngine); // Must be before /:id to avoid matching id="run"
router.get('/', listOpportunities);
router.get('/:id', getOpportunity);
router.post('/:id/convert', convertOpportunity);
router.patch('/:id/dismiss', dismissOpportunity);
router.post('/:id/toggle-save', toggleSave);

export default router;
