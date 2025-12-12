import express, { Response, Request } from "express";
import {
  getUserByUsername,
  getOffersByUserId,
  getTradesByUserId,
  getUserById,
  getUserReputation,
} from "../db.js";

const router = express.Router();
router.use(express.json());

// Get user profile by username
router.get("/user/:username", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get user's offers
    const offers = getOffersByUserId(user.id);

    // Get user's trades to calculate statistics
    const trades = getTradesByUserId(user.id);

    // Get reputation from stored data
    const reputation = getUserReputation(user.id);

    // Calculate unique trading partners
    const partnerIds = new Set<string>();
    trades.forEach((trade) => {
      if (trade.buyer_id === user.id) {
        partnerIds.add(trade.seller_id);
      } else {
        partnerIds.add(trade.buyer_id);
      }
    });

    // For now, we'll use placeholder data for some fields
    // These can be enhanced later with actual feedback system
    const profile = {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
      statistics: {
        total_trades: reputation.total_trades,
        completed_trades: reputation.completed_trades,
        disputed_trades: reputation.disputed_trades,
        success_rate: reputation.success_rate,
        trading_partners: partnerIds.size,
        feedback_score: reputation.total_trades > 0 ? reputation.success_rate : 0,
        typical_finalization_time: "N/A", // Placeholder
      },
      offers: {
        buy: offers.filter((o) => o.offer_type === "buy" && o.is_active),
        sell: offers.filter((o) => o.offer_type === "sell" && o.is_active),
      },
      feedback: [], // Placeholder for feedback system
    };

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
