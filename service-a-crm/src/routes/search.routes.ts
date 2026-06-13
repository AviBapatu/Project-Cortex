import { Router } from 'express';
import { discoverAudience } from '../controllers/search.controller.js';

const router = Router();

// POST /api/search/discover — stateless preview; no DB writes
router.post('/discover', discoverAudience);

export default router;
