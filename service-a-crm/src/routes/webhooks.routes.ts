import { Router } from 'express';
import { handleWebhook } from '../controllers/webhook.controller.js';

const router = Router();

// POST /webhooks/:provider  (e.g. /webhooks/stub, /webhooks/twilio)
router.post('/:provider', handleWebhook);

export default router;
