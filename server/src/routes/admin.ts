import express, { Response } from "express";
import {
  getTradeById,
  updateTrade,
  getUserById,
  getOfferById,
  getSession,
  getAllDisputes,
  getDisputeByTradeId,
  updateDispute,
  recordPlatformFee,
  getTotalFeesCollected,
  updateUserReputation,
} from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import db from "../db.js";
import moneroTs from "monero-ts";
import { MONERO_CONFIG } from "../config/monero.js";

const router = express.Router();
router.use(express.json());

// Get all trades (admin only)
router.get(
  "/admin/trades",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const stmt = db.prepare("SELECT * FROM trades ORDER BY created_at DESC");
      const trades = stmt.all();

      // Enrich trades with offer and user info
      const enrichedTrades = trades.map((trade: any) => {
        const offer = getOfferById(trade.offer_id);
        const buyer = getUserById(trade.buyer_id);
        const seller = getUserById(trade.seller_id);

        return {
          ...trade,
          offer,
          buyer_username: buyer?.username || "Unknown",
          seller_username: seller?.username || "Unknown",
        };
      });

      res.json({
        success: true,
        trades: enrichedTrades,
      });
    } catch (error) {
      console.error("Error fetching all trades:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Update trade status (admin only)
router.put(
  "/admin/trades/:id",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ["pending", "funded", "payment_sent", "payment_confirmed", "releasing", "completed", "disputed", "cancelled"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      const trade = getTradeById(id);
      if (!trade) {
        return res.status(404).json({
          success: false,
          error: "Trade not found",
        });
      }

      const oldStatus = trade.status;
      updateTrade(id, { status });

      // Update reputation if status changed to completed or disputed
      if ((status === "completed" || status === "disputed") && oldStatus !== status) {
        updateUserReputation(trade.buyer_id);
        updateUserReputation(trade.seller_id);
      }

      const updatedTrade = getTradeById(id);

      res.json({
        success: true,
        message: "Trade status updated successfully",
        trade: updatedTrade,
      });
    } catch (error) {
      console.error("Error updating trade:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Release escrow (admin only)
router.post(
  "/admin/trades/:id/release-escrow",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { recipient, recipientAddress } = req.body; // "buyer" or "seller", and their XMR address

      if (!recipient || !["buyer", "seller"].includes(recipient)) {
        return res.status(400).json({
          success: false,
          error: 'Recipient must be either "buyer" or "seller"',
        });
      }

      if (!recipientAddress) {
        return res.status(400).json({
          success: false,
          error: "recipientAddress (XMR address) is required",
        });
      }

      const trade = getTradeById(id);
      if (!trade) {
        return res.status(404).json({
          success: false,
          error: "Trade not found",
        });
      }

      if (trade.status !== "payment_confirmed" && trade.status !== "disputed") {
        return res.status(400).json({
          success: false,
          error: "Trade must be in 'payment_confirmed' or 'disputed' status to release escrow. Current status: " + trade.status,
        });
      }

      // Get the multisig session
      if (!trade.multisig_session_id) {
        return res.status(400).json({
          success: false,
          error: "Trade does not have an associated multisig session",
        });
      }

      const session = getSession(trade.multisig_session_id);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: "Multisig session not found",
        });
      }

      if (session.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: "Multisig session is not ready for transactions",
        });
      }

      // Open the service wallet
      const WALLET_PASSWORD = "supersecretpassword123";
      const serviceWallet = await moneroTs.openWalletFull({
        path: session.service_wallet_path!,
        password: WALLET_PASSWORD,
        networkType: MONERO_CONFIG.networkType,
        server: {
          uri: MONERO_CONFIG.nodeUri,
        },
      });

      // Sync wallet
      await serviceWallet.sync();

      // Get balance to verify funds are available
      const balance = await serviceWallet.getUnlockedBalance();
      const tradeAmountAtomic = BigInt(Math.floor(trade.xmr_amount * 1e12)); // Convert XMR to atomic units

      if (balance < tradeAmountAtomic) {
        await serviceWallet.close();
        return res.status(400).json({
          success: false,
          error: `Insufficient balance in escrow. Available: ${Number(balance) / 1e12} XMR, Required: ${trade.xmr_amount} XMR`,
        });
      }

      // Calculate 0.5% platform fee
      const FEE_PERCENTAGE = 0.005; // 0.5%
      const feeXmr = trade.xmr_amount * FEE_PERCENTAGE;
      const amountAfterFee = trade.xmr_amount - feeXmr;
      const amountAfterFeeAtomic = BigInt(Math.floor(amountAfterFee * 1e12));

      console.log(`Trade ${id}: Amount: ${trade.xmr_amount} XMR, Fee (0.5%): ${feeXmr.toFixed(8)} XMR, Recipient gets: ${amountAfterFee.toFixed(8)} XMR`);

      // Create the transaction (amount minus fee)
      const txSet = await serviceWallet.createTx({
        accountIndex: 0,
        address: recipientAddress,
        amount: amountAfterFeeAtomic,
      });

      // Get the unsigned tx hex for other participants to sign
      const unsignedTxHex = await serviceWallet.exportMultisigHex();

      // Service signs the transaction
      const signResult = await serviceWallet.signMultisigTxHex(unsignedTxHex);
      const serviceSignedHex = signResult.getSignedMultisigTxHex();

      await serviceWallet.close();

      // Record platform fee
      const feeId = require("crypto").randomBytes(16).toString("hex");
      recordPlatformFee(feeId, id, feeXmr, FEE_PERCENTAGE);

      console.log(`Platform fee recorded: ${feeXmr.toFixed(8)} XMR for trade ${id}`);

      // Update trade status to indicate escrow release is in progress
      updateTrade(id, { status: "completed" });

      // Update reputation for both parties
      updateUserReputation(trade.buyer_id);
      updateUserReputation(trade.seller_id);

      res.json({
        success: true,
        message: `Escrow release initiated. Transaction created and signed by service. Recipient (${recipient}) must sign the transaction to complete the release.`,
        transaction: {
          recipient,
          recipientAddress,
          tradeAmount: trade.xmr_amount,
          platformFee: feeXmr,
          feePercentage: FEE_PERCENTAGE * 100 + "%",
          recipientReceives: amountAfterFee,
          unsignedTxHex,
          serviceSignedHex,
          instructions: `The ${recipient} must import the unsignedTxHex into their multisig wallet, sign it, and submit both signatures (service + ${recipient}) to complete the transaction.`,
        },
        trade: getTradeById(id),
      });
    } catch (error) {
      console.error("Error releasing escrow:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get trade statistics (admin only)
router.get(
  "/admin/stats",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const totalTrades = db
        .prepare("SELECT COUNT(*) as count FROM trades")
        .get() as { count: number };

      const tradesByStatus = db
        .prepare(
          "SELECT status, COUNT(*) as count FROM trades GROUP BY status"
        )
        .all() as { status: string; count: number }[];

      const totalVolume = db
        .prepare("SELECT SUM(amount) as total FROM trades WHERE status = 'completed'")
        .get() as { total: number | null };

      const totalXmrVolume = db
        .prepare("SELECT SUM(xmr_amount) as total FROM trades WHERE status = 'completed'")
        .get() as { total: number | null };

      const totalFeesCollected = getTotalFeesCollected();

      res.json({
        success: true,
        stats: {
          total_trades: totalTrades.count,
          trades_by_status: tradesByStatus,
          total_fiat_volume: totalVolume.total || 0,
          total_xmr_volume: totalXmrVolume.total || 0,
          total_platform_fees_xmr: totalFeesCollected,
        },
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get all disputes (admin only)
router.get(
  "/admin/disputes",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.query;
      const disputes = getAllDisputes(status as string | undefined);

      // Enrich with trade and user info
      const enrichedDisputes = disputes.map((dispute) => {
        const trade = getTradeById(dispute.trade_id);
        const initiator = getUserById(dispute.initiator_id);

        return {
          ...dispute,
          trade,
          initiator_username: initiator?.username || "Unknown",
        };
      });

      res.json({
        success: true,
        disputes: enrichedDisputes,
      });
    } catch (error) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get specific dispute (admin only)
router.get(
  "/admin/disputes/:id",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const dispute = getDisputeByTradeId(id);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          error: "Dispute not found for this trade",
        });
      }

      const trade = getTradeById(dispute.trade_id);
      const initiator = getUserById(dispute.initiator_id);
      const buyer = trade ? getUserById(trade.buyer_id) : null;
      const seller = trade ? getUserById(trade.seller_id) : null;

      res.json({
        success: true,
        dispute: {
          ...dispute,
          trade,
          initiator_username: initiator?.username || "Unknown",
          buyer_username: buyer?.username || "Unknown",
          seller_username: seller?.username || "Unknown",
        },
      });
    } catch (error) {
      console.error("Error fetching dispute:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Update dispute (admin only)
router.put(
  "/admin/disputes/:tradeId",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { tradeId } = req.params;
      const { status, admin_notes, resolution } = req.body;

      const dispute = getDisputeByTradeId(tradeId);

      if (!dispute) {
        return res.status(404).json({
          success: false,
          error: "Dispute not found for this trade",
        });
      }

      const updates: any = {};
      if (status) updates.status = status;
      if (admin_notes !== undefined) updates.admin_notes = admin_notes;
      if (resolution !== undefined) updates.resolution = resolution;

      if (status === "resolved") {
        updates.resolved_by = req.userId;
        updates.resolved_at = Date.now();
      }

      updateDispute(dispute.id, updates);

      res.json({
        success: true,
        message: "Dispute updated successfully",
        dispute: getDisputeByTradeId(tradeId),
      });
    } catch (error) {
      console.error("Error updating dispute:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
