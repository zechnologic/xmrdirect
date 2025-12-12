import express, { Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { storeEncryptedWallet, getEncryptedWallet } from "../db.js";

const router = express.Router();
router.use(express.json());

/**
 * Store encrypted wallet for authenticated user
 *
 * IMPORTANT: Encryption happens CLIENT-SIDE
 * - The wallet is already encrypted before being sent to server
 * - Password is NEVER sent to server
 * - Server only stores encrypted blob it cannot decrypt
 * - This keeps the platform NON-CUSTODIAL
 *
 * POST /wallet
 * Body: { encryptedWallet: { encrypted: string, iv: string, salt: string } }
 */
router.post("/wallet", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { encryptedWallet } = req.body;

    if (!encryptedWallet || !encryptedWallet.encrypted || !encryptedWallet.iv || !encryptedWallet.salt) {
      return res.status(400).json({
        success: false,
        error: "Invalid encrypted wallet data. Must include encrypted, iv, and salt fields.",
      });
    }

    // Store encrypted wallet as JSON string
    const walletJson = JSON.stringify(encryptedWallet);
    storeEncryptedWallet(req.userId!, walletJson);

    res.json({
      success: true,
      message: "Encrypted wallet stored successfully",
    });
  } catch (error) {
    console.error("Error storing encrypted wallet:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to store wallet",
    });
  }
});

/**
 * Retrieve encrypted wallet for authenticated user
 *
 * GET /wallet
 * Returns: { encryptedWallet: { encrypted: string, iv: string, salt: string } | null }
 */
router.get("/wallet", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const walletJson = getEncryptedWallet(req.userId!);

    if (!walletJson) {
      return res.json({
        success: true,
        encryptedWallet: null,
      });
    }

    const encryptedWallet = JSON.parse(walletJson);

    res.json({
      success: true,
      encryptedWallet,
    });
  } catch (error) {
    console.error("Error retrieving encrypted wallet:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve wallet",
    });
  }
});

export default router;
