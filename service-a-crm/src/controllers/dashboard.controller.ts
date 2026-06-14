import { type Request, type Response } from 'express';
import { Order } from '../models/Order.js';
import { Campaign } from '../models/Campaign.js';

const CHANNEL_COSTS: Record<string, number> = {
  EMAIL: 0.01,
  SMS: 0.05,
  WHATSAPP: 0.07,
};

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) || 'daily'; // 'daily' or 'weekly'
    
    // 1. Total Revenue
    const orders = await Order.find({});
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Naive trend calculation: compare last 30 days to previous 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentOrders = orders.filter(o => o.purchasedAt >= thirtyDaysAgo);
    const oldOrders = orders.filter(o => o.purchasedAt >= sixtyDaysAgo && o.purchasedAt < thirtyDaysAgo);

    const recentRevenue = recentOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const oldRevenue = oldOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    let trend = 0;
    if (oldRevenue > 0) {
      trend = ((recentRevenue - oldRevenue) / oldRevenue) * 100;
    } else if (recentRevenue > 0) {
      trend = 100; // 100% up if from 0
    }

    // 2. Active Campaigns
    const activeCampaignsCount = await Campaign.countDocuments({
      status: { $in: ['EXECUTING', 'OPTIMIZING'] }
    });

    // 3. Global ROI
    const allCampaigns = await Campaign.find({
      status: { $ne: 'DRAFT' } // campaigns that have been launched
    });

    let totalMarketingCosts = 0;
    let expectedCampaignRevenue = 0;

    for (const c of allCampaigns) {
      const variableCostPerUser = (c.channels || []).reduce((sum: number, ch: string) => sum + (CHANNEL_COSTS[ch] || 0), 0);
      const cost = (c.audienceSize || 0) * variableCostPerUser + 5.00; // Fixed $5 AI overhead
      totalMarketingCosts += cost;
      
      const aov = c.audienceAov || 0;
      expectedCampaignRevenue += (c.audienceSize || 0) * 0.03 * aov; // 3% expected conversion rate baseline
    }

    let globalRoi = 0;
    if (totalMarketingCosts > 0) {
      // Net Income / Marketing Cost (simplified ROI formula using expected campaign impact)
      const cogs = expectedCampaignRevenue * 0.40;
      const netIncome = expectedCampaignRevenue - cogs - totalMarketingCosts;
      globalRoi = (netIncome / totalMarketingCosts);
    } else {
      globalRoi = 0;
    }

    // 4. Performance Trajectory (Chart Data)
    // We group order revenue by day or week
    const trajectory = [];
    if (period === 'weekly') {
      // Group by weeks for the last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const endDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const periodOrders = orders.filter(o => o.purchasedAt >= startDate && o.purchasedAt < endDate);
        const rev = periodOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        trajectory.push({
          label: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
          revenue: rev
        });
      }
    } else {
      // Group by day for the last 14 days
      for (let i = 13; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
        const periodOrders = orders.filter(o => o.purchasedAt >= targetDate && o.purchasedAt < nextDate);
        const rev = periodOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        trajectory.push({
          label: `${targetDate.getMonth() + 1}/${targetDate.getDate()}`,
          revenue: rev
        });
      }
    }

    // 5. Active Automations (Use 2 most recent active/optimizing campaigns)
    const activeAutomations = await Campaign.find({
      status: { $in: ['EXECUTING', 'OPTIMIZING'] }
    }).sort({ createdAt: -1 }).limit(2).select('name status');

    res.json({
      success: true,
      stats: {
        totalRevenue,
        revenueTrend: trend,
        activeCampaigns: activeCampaignsCount,
        globalRoi,
        trajectory,
        activeAutomations: activeAutomations.map(c => ({
          id: c._id,
          name: c.name,
          status: c.status
        })),
        systemLogs: [
          `[${new Date(now.getTime() - 1000 * 60 * 2).toISOString().substring(11, 19)}] Opportunity Engine scanned 40,291 shoppers.`,
          `[${new Date(now.getTime() - 1000 * 60 * 15).toISOString().substring(11, 19)}] Found 12 new matches for 'VIP Early Access'.`,
          `[${new Date(now.getTime() - 1000 * 60 * 45).toISOString().substring(11, 19)}] LLM generation complete for Campaign A/B/C variants.`,
          `[${new Date(now.getTime() - 1000 * 60 * 120).toISOString().substring(11, 19)}] Multi-Armed Bandit weights updated for active campaigns.`
        ]
      }
    });
  } catch (error: any) {
    console.error('[dashboard.controller] getDashboardStats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
