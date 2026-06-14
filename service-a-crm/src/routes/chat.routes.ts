import { Router, type Request, type Response } from 'express';
import { processChat } from '../services/agent.service.js';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, error: 'messages array is required' });
      return;
    }

    const aiMessage = await processChat(messages);
    
    res.json({
      success: true,
      message: aiMessage
    });
  } catch (error: any) {
    console.error('[chat.routes] Error processing chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
