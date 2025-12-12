import express, { Response } from "express";
import { randomBytes } from "crypto";
import {
  createOffer,
  getOfferById,
  getAllActiveOffers,
  getOffersByUserId,
  updateOffer,
  deleteOffer,
  getUserById,
  getUserReputation,
} from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = express.Router();
router.use(express.json());

// Get all active offers (public, with optional filters)
router.get("/offers", async (req, res: Response) => {
  try {
    const { type, currencyCode, countryCode, paymentMethodCode } = req.query;

    let offers = getAllActiveOffers();

    // Apply filters
    if (type && (type === "buy" || type === "sell")) {
      offers = offers.filter((offer) => offer.offer_type === type);
    }

    if (currencyCode && typeof currencyCode === "string") {
      offers = offers.filter(
        (offer) => offer.currency.toUpperCase() === currencyCode.toUpperCase()
      );
    }

    if (countryCode && typeof countryCode === "string") {
      offers = offers.filter(
        (offer) =>
          offer.country_code &&
          offer.country_code.toUpperCase() === countryCode.toUpperCase()
      );
    }

    if (paymentMethodCode && typeof paymentMethodCode === "string") {
      offers = offers.filter((offer) =>
        offer.payment_method
          .toLowerCase()
          .includes(paymentMethodCode.toLowerCase())
      );
    }

    // Enrich offers with seller username and reputation
    const enrichedOffers = offers.map((offer) => {
      const user = getUserById(offer.user_id);
      const reputation = getUserReputation(offer.user_id);
      return {
        ...offer,
        seller_username: user?.username || "Unknown",
        seller_reputation: {
          total_trades: reputation.total_trades,
          completed_trades: reputation.completed_trades,
          success_rate: reputation.success_rate,
        },
      };
    });

    res.json({
      success: true,
      offers: enrichedOffers,
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get a specific offer
router.get("/offers/:id", async (req, res: Response) => {
  try {
    const { id } = req.params;
    const offer = getOfferById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: "Offer not found",
      });
    }

    const user = getUserById(offer.user_id);
    const reputation = getUserReputation(offer.user_id);

    res.json({
      success: true,
      offer: {
        ...offer,
        seller_username: user?.username || "Unknown",
        seller_reputation: {
          total_trades: reputation.total_trades,
          completed_trades: reputation.completed_trades,
          success_rate: reputation.success_rate,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create a new offer (authenticated)
router.post("/offers", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      offer_type,
      payment_method,
      price_per_xmr,
      currency,
      min_limit,
      max_limit,
      description,
      country_code,
    } = req.body;

    // Validation
    if (
      !offer_type ||
      !payment_method ||
      !price_per_xmr ||
      !currency ||
      min_limit === undefined ||
      max_limit === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (offer_type !== "buy" && offer_type !== "sell") {
      return res.status(400).json({
        success: false,
        error: "offer_type must be 'buy' or 'sell'",
      });
    }

    if (min_limit > max_limit) {
      return res.status(400).json({
        success: false,
        error: "min_limit cannot be greater than max_limit",
      });
    }

    const offerId = randomBytes(16).toString("hex");

    const offer = createOffer(
      offerId,
      req.userId!,
      offer_type,
      payment_method,
      price_per_xmr,
      currency,
      min_limit,
      max_limit,
      description,
      country_code
    );

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      offer,
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Update an offer (authenticated, owner only)
router.put("/offers/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const offer = getOfferById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: "Offer not found",
      });
    }

    // Check ownership
    if (offer.user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You can only update your own offers",
      });
    }

    const {
      payment_method,
      price_per_xmr,
      currency,
      min_limit,
      max_limit,
      description,
      country_code,
      is_active,
    } = req.body;

    const updates: any = {};

    if (payment_method !== undefined) updates.payment_method = payment_method;
    if (price_per_xmr !== undefined) updates.price_per_xmr = price_per_xmr;
    if (currency !== undefined) updates.currency = currency;
    if (min_limit !== undefined) updates.min_limit = min_limit;
    if (max_limit !== undefined) updates.max_limit = max_limit;
    if (description !== undefined) updates.description = description;
    if (country_code !== undefined) updates.country_code = country_code;
    if (is_active !== undefined) updates.is_active = is_active;

    updateOffer(id, updates);

    const updatedOffer = getOfferById(id);

    res.json({
      success: true,
      message: "Offer updated successfully",
      offer: updatedOffer,
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Delete an offer (authenticated, owner only)
router.delete("/offers/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const offer = getOfferById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: "Offer not found",
      });
    }

    // Check ownership
    if (offer.user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own offers",
      });
    }

    deleteOffer(id);

    res.json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get user's own offers (authenticated)
router.get("/my-offers", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const offers = getOffersByUserId(req.userId!);

    res.json({
      success: true,
      offers,
    });
  } catch (error) {
    console.error("Error fetching user offers:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
