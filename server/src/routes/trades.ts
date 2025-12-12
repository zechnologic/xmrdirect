import express, { Response } from "express";
import { randomBytes } from "crypto";
import * as moneroTs from "monero-ts";
import {
  createTrade,
  getTradeById,
  getTradesByUserId,
  getOfferById,
  getUserById,
  updateTrade,
  getSession,
  createDispute,
  updateUserReputation,
  recordPlatformFee,
} from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { initializeMultisigSession } from "./multisig.js";
import { checkTradeDeposit } from "../services/depositMonitor.js";
import notificationService from "../services/notifications.js";
import { MONERO_CONFIG } from "../config/monero.js";

const router = express.Router();
router.use(express.json());

// Create a new trade (authenticated)
router.post("/trades", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { offer_id, amount, xmr_amount } = req.body;

    // Validation
    if (!offer_id || !amount || !xmr_amount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: offer_id, amount, xmr_amount",
      });
    }

    // Get the offer
    const offer = getOfferById(offer_id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: "Offer not found",
      });
    }

    if (!offer.is_active) {
      return res.status(400).json({
        success: false,
        error: "This offer is no longer active",
      });
    }

    // Check limits
    if (amount < offer.min_limit) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${offer.min_limit} ${offer.currency}`,
      });
    }

    if (offer.max_limit < 999999999 && amount > offer.max_limit) {
      return res.status(400).json({
        success: false,
        error: `Amount must not exceed ${offer.max_limit} ${offer.currency}`,
      });
    }

    // Prevent users from trading with themselves
    if (offer.user_id === req.userId) {
      return res.status(400).json({
        success: false,
        error: "You cannot trade with your own offer",
      });
    }

    // Determine buyer and seller based on offer type
    // If offer_type is "buy" (user wants to buy XMR), they are the buyer
    // If offer_type is "sell" (user wants to sell XMR), they are the seller
    const buyerId = offer.offer_type === "buy" ? offer.user_id : req.userId!;
    const sellerId = offer.offer_type === "buy" ? req.userId! : offer.user_id;

    const tradeId = randomBytes(16).toString("hex");

    const trade = createTrade(
      tradeId,
      offer_id,
      buyerId,
      sellerId,
      amount,
      xmr_amount
    );

    // Automatically create and link multisig escrow session
    console.log(`Creating multisig escrow for trade ${tradeId}...`);
    const { sessionId, servicePreparedHex } = await initializeMultisigSession(req.userId!);

    // Link the multisig session to the trade
    updateTrade(tradeId, { multisig_session_id: sessionId });

    console.log(`Trade ${tradeId} created with multisig session ${sessionId}`);

    // Send notifications to both parties
    await notificationService.notifyTradeParticipants(
      "trade_created",
      tradeId,
      buyerId,
      sellerId,
      { amount, xmr_amount }
    );

    res.status(201).json({
      success: true,
      message: "Trade request created successfully with escrow wallet",
      trade: {
        ...trade,
        multisig_session_id: sessionId,
      },
      escrow: {
        sessionId,
        servicePreparedHex,
        nextStep: "Both buyer and seller must prepare their wallets and submit prepared hex to begin escrow setup",
      },
    });
  } catch (error) {
    console.error("Error creating trade:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get a specific trade (authenticated, participant only)
router.get("/trades/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    // Check if user is a participant
    if (trade.buyer_id !== req.userId && trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to view this trade",
      });
    }

    // Enrich with user and offer info
    const offer = getOfferById(trade.offer_id);
    const buyer = getUserById(trade.buyer_id);
    const seller = getUserById(trade.seller_id);

    // Get multisig session info if linked
    let multisigSession = null;
    if (trade.multisig_session_id) {
      const session = getSession(trade.multisig_session_id);
      if (session) {
        // Map user_a/user_b to buyer/seller based on actual user IDs
        const buyerIsUserA = session.user_a_id === trade.buyer_id;
        const buyerIsUserB = session.user_b_id === trade.buyer_id;

        multisigSession = {
          id: session.id,
          status: session.status,
          threshold: session.threshold,
          totalParticipants: session.total_participants,
          multisigAddress: session.multisig_address,
          exchangeRound: session.exchange_round,
          hasPrepared: {
            service: !!session.service_prepared_hex,
            buyer: buyerIsUserA ? !!session.user_a_prepared_hex : buyerIsUserB ? !!session.user_b_prepared_hex : false,
            seller: buyerIsUserA ? !!session.user_b_prepared_hex : buyerIsUserB ? !!session.user_a_prepared_hex : false,
          },
          hasMade: {
            service: !!session.service_made_hex,
            buyer: buyerIsUserA ? !!session.user_a_made_hex : buyerIsUserB ? !!session.user_b_made_hex : false,
            seller: buyerIsUserA ? !!session.user_b_made_hex : buyerIsUserB ? !!session.user_a_made_hex : false,
          },
          hasExchanged: {
            service: !!session.service_exchange_hexes,
            buyer: buyerIsUserA ? !!session.user_a_exchange_hexes : buyerIsUserB ? !!session.user_b_exchange_hexes : false,
            seller: buyerIsUserA ? !!session.user_b_exchange_hexes : buyerIsUserB ? !!session.user_a_exchange_hexes : false,
          },
        };
      }
    }

    res.json({
      success: true,
      trade: {
        ...trade,
        offer,
        buyer_username: buyer?.username || "Unknown",
        seller_username: seller?.username || "Unknown",
        multisig_session: multisigSession,
      },
    });
  } catch (error) {
    console.error("Error fetching trade:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get user's trades (authenticated)
router.get("/my-trades", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const trades = getTradesByUserId(req.userId!);

    // Enrich trades with offer and user info
    const enrichedTrades = trades.map((trade) => {
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
    console.error("Error fetching user trades:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Manually check deposit status for a trade (authenticated, participant only)
router.post("/trades/:id/check-deposit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    // Check if user is a participant
    if (trade.buyer_id !== req.userId && trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to check this trade",
      });
    }

    const result = await checkTradeDeposit(id);

    res.json({
      ...result,
      currentStatus: getTradeById(id)?.status,
    });
  } catch (error) {
    console.error("Error checking deposit:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get service prepared hex for a trade (to help users complete multisig setup)
router.get("/trades/:id/service-prepared-hex", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    // Check if user is a participant
    if (trade.buyer_id !== req.userId && trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this trade",
      });
    }

    if (!trade.multisig_session_id) {
      return res.status(400).json({
        success: false,
        error: "Trade does not have a multisig session",
      });
    }

    const session = getSession(trade.multisig_session_id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Multisig session not found",
      });
    }

    res.json({
      success: true,
      servicePreparedHex: session.service_prepared_hex,
      sessionId: session.id,
      instructions: "Use this hex when calling makeMultisig() on your local wallet. You'll need the prepared hex from the other participant as well.",
    });
  } catch (error) {
    console.error("Error getting service prepared hex:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get service made hex for a trade
router.get("/trades/:id/service-made-hex", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    if (trade.buyer_id !== req.userId && trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this trade",
      });
    }

    if (!trade.multisig_session_id) {
      return res.status(400).json({
        success: false,
        error: "Trade does not have a multisig session",
      });
    }

    const session = getSession(trade.multisig_session_id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Multisig session not found",
      });
    }

    res.json({
      success: true,
      serviceMadeHex: session.service_made_hex,
      sessionId: session.id,
      instructions: "Use this hex when calling exchangeMultisigKeys() on your local wallet.",
    });
  } catch (error) {
    console.error("Error getting service made hex:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get service exchange hex for a trade
router.get("/trades/:id/service-exchange-hex", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    if (trade.buyer_id !== req.userId && trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this trade",
      });
    }

    if (!trade.multisig_session_id) {
      return res.status(400).json({
        success: false,
        error: "Trade does not have a multisig session",
      });
    }

    const session = getSession(trade.multisig_session_id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Multisig session not found",
      });
    }

    res.json({
      success: true,
      serviceExchangeHex: session.service_exchange_hexes,
      sessionId: session.id,
      exchangeRound: session.exchange_round,
      instructions: "Use this hex to complete the key exchange on your local wallet.",
    });
  } catch (error) {
    console.error("Error getting service exchange hex:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Mark payment as sent (buyer only)
router.post("/trades/:id/mark-payment-sent", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    // Only buyer can mark payment as sent
    if (trade.buyer_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Only the buyer can mark payment as sent",
      });
    }

    if (trade.status !== "funded") {
      return res.status(400).json({
        success: false,
        error: "Trade must be in 'funded' status. Current status: " + trade.status,
      });
    }

    updateTrade(id, { status: "payment_sent" });

    // Notify seller
    await notificationService.notify({
      type: "payment_sent",
      tradeId: id,
      userId: trade.seller_id,
      data: { amount: trade.amount, currency: getOfferById(trade.offer_id)?.currency },
    });

    res.json({
      success: true,
      message: "Payment marked as sent. Waiting for seller to confirm receipt.",
      trade: getTradeById(id),
    });
  } catch (error) {
    console.error("Error marking payment as sent:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Step 1: Seller initiates escrow release (prepares transaction)
router.post("/trades/:id/initiate-release", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientAddress } = req.body; // Seller's XMR address

    const trade = getTradeById(id);
    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    // Only seller can initiate release
    if (trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Only the seller can initiate escrow release",
      });
    }

    if (trade.status !== "payment_sent") {
      return res.status(400).json({
        success: false,
        error: "Trade must be in 'payment_sent' status. Current status: " + trade.status,
      });
    }

    if (!recipientAddress) {
      return res.status(400).json({
        success: false,
        error: "recipientAddress (your XMR address) is required",
      });
    }

    // Get multisig session
    if (!trade.multisig_session_id) {
      return res.status(400).json({
        success: false,
        error: "Trade does not have an associated multisig session",
      });
    }

    const session = getSession(trade.multisig_session_id);
    if (!session || session.status !== "ready") {
      return res.status(400).json({
        success: false,
        error: "Multisig session is not ready",
      });
    }

    // Open service wallet and create transaction
    const WALLET_PASSWORD = "supersecretpassword123";
    const serviceWallet = await moneroTs.openWalletFull({
      path: session.service_wallet_path!,
      password: WALLET_PASSWORD,
      networkType: MONERO_CONFIG.networkType,
      server: {
        uri: MONERO_CONFIG.nodeUri,
      },
    });

    await serviceWallet.sync();

    // Calculate amount minus 0.5% platform fee
    const FEE_PERCENTAGE = 0.005;
    const feeXmr = trade.xmr_amount * FEE_PERCENTAGE;
    const amountAfterFee = trade.xmr_amount - feeXmr;
    const amountAfterFeeAtomic = BigInt(Math.floor(amountAfterFee * 1e12));

    console.log(`[Release] Trade ${id}: ${trade.xmr_amount} XMR - ${feeXmr.toFixed(8)} fee = ${amountAfterFee.toFixed(8)} XMR to seller`);

    // Create transaction
    await serviceWallet.createTx({
      accountIndex: 0,
      address: recipientAddress,
      amount: amountAfterFeeAtomic,
    });

    // Export unsigned multisig hex for seller to sign
    const unsignedTxHex = await serviceWallet.exportMultisigHex();

    await serviceWallet.close();

    res.json({
      success: true,
      message: "Transaction prepared. Sign with your wallet and submit.",
      unsignedTxHex,
      recipientAddress,
      tradeAmount: trade.xmr_amount,
      platformFee: feeXmr,
      recipientReceives: amountAfterFee,
    });
  } catch (error) {
    console.error("Error initiating release:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Step 2: Seller submits signature, server co-signs and broadcasts
router.post("/trades/:id/finalize-release", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sellerSignedHex } = req.body;

    const trade = getTradeById(id);
    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    if (trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Only the seller can finalize release",
      });
    }

    if (!sellerSignedHex) {
      return res.status(400).json({
        success: false,
        error: "sellerSignedHex is required",
      });
    }

    const session = getSession(trade.multisig_session_id!);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Multisig session not found",
      });
    }

    // Mark as releasing
    updateTrade(id, { status: "releasing" });

    // Open service wallet
    const WALLET_PASSWORD = "supersecretpassword123";
    const serviceWallet = await moneroTs.openWalletFull({
      path: session.service_wallet_path!,
      password: WALLET_PASSWORD,
      networkType: MONERO_CONFIG.networkType,
      server: {
        uri: MONERO_CONFIG.nodeUri,
      },
    });

    // Sign the seller's partially signed hex with service wallet (adds 2nd signature)
    // In 2-of-3 multisig: unsigned → seller signs → service signs → fully signed
    const signResult = await serviceWallet.signMultisigTxHex(sellerSignedHex);
    const finalSignedHex = signResult.getSignedMultisigTxHex();

    // Submit fully signed transaction to network
    const txHashes = await serviceWallet.submitMultisigTxHex(finalSignedHex);

    await serviceWallet.close();

    // Record fee and update trade
    const FEE_PERCENTAGE = 0.005;
    const feeXmr = trade.xmr_amount * FEE_PERCENTAGE;
    const feeId = require("crypto").randomBytes(16).toString("hex");
    recordPlatformFee(feeId, id, feeXmr, FEE_PERCENTAGE);

    updateTrade(id, { status: "completed" });

    // Update reputation
    updateUserReputation(trade.buyer_id);
    updateUserReputation(trade.seller_id);

    // Notify buyer
    await notificationService.notify({
      type: "escrow_released",
      tradeId: id,
      userId: trade.buyer_id,
      data: { amount: trade.amount, xmr_amount: trade.xmr_amount },
    });

    res.json({
      success: true,
      message: "Escrow released! Transaction broadcast to network.",
      txHashes,
      trade: getTradeById(id),
    });
  } catch (error) {
    console.error("Error finalizing release:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Open a dispute (buyer or seller)
router.post("/trades/:id/dispute", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Dispute reason is required",
      });
    }

    const trade = getTradeById(id);

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: "Trade not found",
      });
    }

    // Only participants can open disputes
    if (trade.buyer_id !== req.userId && trade.seller_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to dispute this trade",
      });
    }

    // Can't dispute completed or already disputed trades
    if (trade.status === "completed" || trade.status === "disputed") {
      return res.status(400).json({
        success: false,
        error: `Cannot dispute a trade with status: ${trade.status}`,
      });
    }

    // Create dispute record
    const disputeId = randomBytes(16).toString("hex");
    const dispute = createDispute(disputeId, id, req.userId!, reason);

    // Update trade status
    updateTrade(id, { status: "disputed" });

    // Update reputation for both parties
    updateUserReputation(trade.buyer_id);
    updateUserReputation(trade.seller_id);

    console.log(`Dispute ${disputeId} opened for trade ${id} by user ${req.userId}: ${reason}`);

    // Notify both parties
    await notificationService.notifyTradeParticipants(
      "dispute_opened",
      id,
      trade.buyer_id,
      trade.seller_id,
      { reason, initiator: req.userId, disputeId }
    );

    res.json({
      success: true,
      message: "Dispute opened. An administrator will review this case.",
      trade: getTradeById(id),
      dispute,
    });
  } catch (error) {
    console.error("Error opening dispute:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
