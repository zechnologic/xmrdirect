import express, { Request, Response } from "express";
import moneroTs from "monero-ts";
import { randomBytes } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import {
  createSession,
  getSession,
  updateSession,
  getAllSessions,
  getSessionsByUserId,
  MultisigSession,
} from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { MONERO_CONFIG } from "../config/monero.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use(express.json());

const DAEMON_URI = MONERO_CONFIG.nodeUri;
const WALLET_PASSWORD = "supersecretpassword123";

// Helper function to initialize a multisig session with service wallet
export async function initializeMultisigSession(userId: string): Promise<{
  sessionId: string;
  servicePreparedHex: string;
}> {
  const sessionId = randomBytes(16).toString("hex");
  const M = 2; // threshold
  const N = 3; // total participants (service + buyer + seller)

  console.log(`Creating multisig session ${sessionId}...`);

  // Get current blockchain height - this is when the wallet is being created
  // Subtract buffer to ensure we're not ahead of the actual blockchain
  let creationHeight = 0;
  try {
    const daemon = await moneroTs.connectToDaemonRpc(DAEMON_URI);
    const currentHeight = await daemon.getHeight();
    creationHeight = Math.max(0, currentHeight - 10); // 10 block buffer for safety
    console.log(`[Multisig] Current blockchain height: ${currentHeight}, using creation height: ${creationHeight}`);
  } catch (error) {
    console.warn(`[Multisig] Could not get blockchain height:`, error);
  }

  const serviceWalletPath = path.join(
    __dirname,
    `../../wallets/service_${sessionId}`
  );

  // Step 1: Create wallet to get the seed
  let tempWallet = await moneroTs.createWalletFull({
    path: serviceWalletPath,
    password: WALLET_PASSWORD,
    networkType: MONERO_CONFIG.networkType,
  });

  // Get the seed before closing
  const walletSeed = await tempWallet.getSeed();
  await tempWallet.close();

  // Step 2: Delete the wallet files (they were created with scan height 0)
  const fs = await import("fs");
  try {
    fs.unlinkSync(serviceWalletPath);
    fs.unlinkSync(serviceWalletPath + ".keys");
  } catch (e) {
    // Files might not exist, that's ok
  }

  // Step 3: Restore from seed with proper creation height
  const serviceWallet = await moneroTs.createWalletFull({
    path: serviceWalletPath,
    password: WALLET_PASSWORD,
    networkType: MONERO_CONFIG.networkType,
    seed: walletSeed,
    restoreHeight: creationHeight,
  });

  // Prepare multisig for service wallet
  const servicePreparedHex = await serviceWallet.prepareMultisig();
  const serviceAddress = await serviceWallet.getAddress(0, 0);

  // Create session in DB with creation height
  createSession(sessionId, userId, M, N);
  updateSession(sessionId, {
    service_wallet_path: serviceWalletPath,
    service_address: serviceAddress,
    service_prepared_hex: servicePreparedHex,
    creation_height: creationHeight,
  });

  // Close wallet for now
  await serviceWallet.close();

  console.log(`Session ${sessionId} created. Service wallet will scan from height ${creationHeight}.`);

  return { sessionId, servicePreparedHex };
}

// Create a new multisig session and prepare service wallet
router.post("/multisig/create-session", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, servicePreparedHex } = await initializeMultisigSession(req.userId!);

    res.json({
      success: true,
      sessionId,
      servicePreparedHex,
      message:
        "Session created. Service is ready. Users A and B should now prepare their wallets locally and submit their prepared hex.",
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Submit prepared multisig hex (for users A and B)
router.post(
  "/multisig/:sessionId/prepare",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { participantId, preparedHex } = req.body; // participantId: "user_a" or "user_b"

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "preparing") {
        return res.status(400).json({
          success: false,
          error: `Session is in ${session.status} state, cannot accept prepared hex`,
        });
      }

      // Store the prepared hex and track which user is which
      if (participantId === "user_a") {
        updateSession(sessionId, {
          user_a_prepared_hex: preparedHex,
          user_a_id: req.userId
        });
      } else if (participantId === "user_b") {
        updateSession(sessionId, {
          user_b_prepared_hex: preparedHex,
          user_b_id: req.userId
        });
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Invalid participantId" });
      }

      // Check if we have all prepared hexes
      const updatedSession = getSession(sessionId)!;
      const allPrepared =
        updatedSession.service_prepared_hex &&
        updatedSession.user_a_prepared_hex &&
        updatedSession.user_b_prepared_hex;

      if (allPrepared) {
        updateSession(sessionId, { status: "making" });
        console.log(
          `Session ${sessionId}: All participants prepared. Ready for makeMultisig.`
        );
      }

      res.json({
        success: true,
        message: `Prepared hex received for ${participantId}`,
        allPrepared,
        nextStep: allPrepared
          ? "All participants should now call /make with their made hex"
          : "Waiting for other participants to prepare",
      });
    } catch (error) {
      console.error("Error submitting prepared hex:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Make multisig and submit made hex
router.post(
  "/multisig/:sessionId/make",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { participantId } = req.body; // participantId: "service", "user_a", or "user_b"

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "making") {
        return res.status(400).json({
          success: false,
          error: `Session is in ${session.status} state, not ready for makeMultisig`,
        });
      }

      let madeHex: string;

      if (participantId === "service") {
        // Service opens its wallet and makes it multisig
        const serviceWallet = await moneroTs.openWalletFull({
          path: session.service_wallet_path!,
          password: WALLET_PASSWORD,
          networkType: MONERO_CONFIG.networkType,
          server: {
            uri: DAEMON_URI,
          },
        });

        // Collect peer hexes (user_a and user_b)
        const peerHexes = [
          session.user_a_prepared_hex!,
          session.user_b_prepared_hex!,
        ];

        madeHex = await serviceWallet.makeMultisig(
          peerHexes,
          session.threshold,
          WALLET_PASSWORD
        );

        await serviceWallet.close();

        updateSession(sessionId, { service_made_hex: madeHex });
      } else if (participantId === "user_a" || participantId === "user_b") {
        // Users send their made hex (they do makeMultisig locally)
        const { madeHex: userMadeHex } = req.body;

        if (!userMadeHex) {
          return res
            .status(400)
            .json({ success: false, error: "madeHex is required" });
        }

        if (participantId === "user_a") {
          updateSession(sessionId, { user_a_made_hex: userMadeHex });
        } else {
          updateSession(sessionId, { user_b_made_hex: userMadeHex });
        }

        madeHex = userMadeHex;
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Invalid participantId" });
      }

      // Check if both users have made their wallets
      const updatedSession = getSession(sessionId)!;
      const bothUsersMade =
        updatedSession.user_a_made_hex && updatedSession.user_b_made_hex;

      // Automatically make service wallet when both users have made theirs
      if (bothUsersMade && !updatedSession.service_made_hex && participantId !== "service") {
        console.log(`Session ${sessionId}: Both users made multisig. Auto-making service wallet...`);

        try {
          const serviceWallet = await moneroTs.openWalletFull({
            path: updatedSession.service_wallet_path!,
            password: WALLET_PASSWORD,
            networkType: MONERO_CONFIG.networkType,
            server: {
              uri: DAEMON_URI,
            },
          });

          const peerHexes = [
            updatedSession.user_a_prepared_hex!,
            updatedSession.user_b_prepared_hex!,
          ];

          const serviceMadeHex = await serviceWallet.makeMultisig(
            peerHexes,
            updatedSession.threshold,
            WALLET_PASSWORD
          );

          // Save the wallet to ensure multisig state is persisted to disk
          await serviceWallet.save();
          await serviceWallet.close();
          updateSession(sessionId, { service_made_hex: serviceMadeHex });

          console.log(`Session ${sessionId}: ✅ Service wallet automatically made multisig`);
        } catch (error) {
          console.error(`Session ${sessionId}: Failed to auto-make service wallet:`, error);
        }
      }

      // Check if ALL participants (including service) have made
      const finalSession = getSession(sessionId)!;
      const allMade =
        finalSession.service_made_hex &&
        finalSession.user_a_made_hex &&
        finalSession.user_b_made_hex;

      if (allMade) {
        updateSession(sessionId, { status: "exchanging" });
        console.log(
          `Session ${sessionId}: All participants made multisig. Ready for key exchange.`
        );
      }

      res.json({
        success: true,
        message: `Made hex received for ${participantId}`,
        madeHex: participantId === "service" ? madeHex : undefined,
        allMade,
        nextStep: allMade
          ? "All participants should now exchange keys via /exchange"
          : "Waiting for other participants to make multisig",
      });
    } catch (error) {
      console.error("Error making multisig:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Exchange multisig keys
router.post(
  "/multisig/:sessionId/exchange",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { participantId } = req.body; // participantId: "service", "user_a", or "user_b"

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "exchanging") {
        return res.status(400).json({
          success: false,
          error: `Session is in ${session.status} state, not ready for key exchange`,
        });
      }

      // For 2-of-3: N - M + 1 = 3 - 2 + 1 = 2 rounds of exchange
      const totalRounds = session.total_participants - session.threshold + 1;

      let exchangeResultHex: string;

      if (participantId === "service") {
        const serviceWallet = await moneroTs.openWalletFull({
          path: session.service_wallet_path!,
          password: WALLET_PASSWORD,
          networkType: MONERO_CONFIG.networkType,
          server: {
            uri: DAEMON_URI,
          },
        });

        // Determine which hexes to use based on current round
        let hexesToExchange: string[];
        if (session.exchange_round === 0) {
          // First exchange: use made hexes
          hexesToExchange = [
            session.user_a_made_hex!,
            session.user_b_made_hex!,
          ];
        } else {
          // Subsequent exchanges: use previous round's exchange results
          hexesToExchange = [
            session.user_a_exchange_hexes_prev!,
            session.user_b_exchange_hexes_prev!,
          ];
        }

        const result = await serviceWallet.exchangeMultisigKeys(
          hexesToExchange,
          WALLET_PASSWORD
        );
        exchangeResultHex = result.getMultisigHex();

        // If this is the final round, get the multisig address
        if (session.exchange_round === totalRounds - 1) {
          const multisigAddress = await serviceWallet.getAddress(0, 0);
          updateSession(sessionId, { multisig_address: multisigAddress });
        }

        // Save the wallet to persist multisig state
        await serviceWallet.save();
        await serviceWallet.close();

        updateSession(sessionId, { service_exchange_hexes: exchangeResultHex });
      } else if (participantId === "user_a" || participantId === "user_b") {
        const { exchangeHex } = req.body;

        if (!exchangeHex) {
          return res
            .status(400)
            .json({ success: false, error: "exchangeHex is required" });
        }

        if (participantId === "user_a") {
          updateSession(sessionId, { user_a_exchange_hexes: exchangeHex });
        } else {
          updateSession(sessionId, { user_b_exchange_hexes: exchangeHex });
        }

        exchangeResultHex = exchangeHex;
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Invalid participantId" });
      }

      // Check if both users have exchanged for this round
      const updatedSession = getSession(sessionId)!;
      const bothUsersExchanged =
        updatedSession.user_a_exchange_hexes && updatedSession.user_b_exchange_hexes;

      // Automatically exchange service keys when both users have exchanged
      if (bothUsersExchanged && !updatedSession.service_exchange_hexes && participantId !== "service") {
        console.log(`Session ${sessionId}: Both users exchanged keys. Auto-exchanging service keys...`);

        try {
          const serviceWallet = await moneroTs.openWalletFull({
            path: updatedSession.service_wallet_path!,
            password: WALLET_PASSWORD,
            networkType: MONERO_CONFIG.networkType,
            server: {
              uri: DAEMON_URI,
            },
          });

          let hexesToExchange: string[];
          if (updatedSession.exchange_round === 0) {
            hexesToExchange = [
              updatedSession.user_a_made_hex!,
              updatedSession.user_b_made_hex!,
            ];
          } else {
            hexesToExchange = [
              updatedSession.user_a_exchange_hexes!,
              updatedSession.user_b_exchange_hexes!,
            ];
          }

          const result = await serviceWallet.exchangeMultisigKeys(
            hexesToExchange,
            WALLET_PASSWORD
          );
          const serviceExchangeHex = result.getMultisigHex();

          // If this is the final round, get the multisig address
          if (updatedSession.exchange_round === totalRounds - 1) {
            const multisigAddress = await serviceWallet.getAddress(0, 0);
            updateSession(sessionId, {
              service_exchange_hexes: serviceExchangeHex,
              multisig_address: multisigAddress
            });
          } else {
            updateSession(sessionId, { service_exchange_hexes: serviceExchangeHex });
          }

          // Save the wallet to persist multisig state
          await serviceWallet.save();
          await serviceWallet.close();

          console.log(`Session ${sessionId}: ✅ Service wallet automatically exchanged keys`);
        } catch (error) {
          console.error(`Session ${sessionId}: Failed to auto-exchange service keys:`, error);
        }
      }

      // Check if ALL participants have exchanged for this round
      const finalSession = getSession(sessionId)!;
      const allExchanged =
        finalSession.service_exchange_hexes &&
        finalSession.user_a_exchange_hexes &&
        finalSession.user_b_exchange_hexes;

      if (allExchanged) {
        const nextRound = finalSession.exchange_round + 1;

        if (nextRound >= totalRounds) {
          // Done!
          updateSession(sessionId, { status: "ready", exchange_round: nextRound });
          console.log(
            `Session ${sessionId}: Key exchange complete. Multisig is ready!`
          );

          // CRITICAL: Recreate wallet with correct restore height
          // Multisig transformations reset the scan height to 1, and setRestoreHeight() doesn't fix existing wallets
          // We need to delete and restore from seed with the correct height
          try {
            const readySession = getSession(sessionId)!;
            if (readySession.service_wallet_path && readySession.creation_height) {
              console.log(`Session ${sessionId}: Fixing wallet restore height (recreating from seed at height ${readySession.creation_height})...`);

              // Step 1: Open wallet and get seed
              let wallet = await moneroTs.openWalletFull({
                path: readySession.service_wallet_path,
                password: WALLET_PASSWORD,
                networkType: MONERO_CONFIG.networkType,
                server: { uri: DAEMON_URI },
              });

              const walletSeed = await wallet.getSeed();
              await wallet.close();

              // Step 2: Delete wallet files
              const fs = await import("fs");
              try {
                fs.unlinkSync(readySession.service_wallet_path);
                fs.unlinkSync(readySession.service_wallet_path + ".keys");
              } catch (e) {
                console.log(`Session ${sessionId}: Wallet files already deleted or don't exist`);
              }

              // Step 3: Restore from seed with correct restore height
              wallet = await moneroTs.createWalletFull({
                path: readySession.service_wallet_path,
                password: WALLET_PASSWORD,
                networkType: MONERO_CONFIG.networkType,
                seed: walletSeed,
                restoreHeight: readySession.creation_height,
                server: { uri: DAEMON_URI },
              });

              const newHeight = await wallet.getHeight();
              console.log(`Session ${sessionId}: ✓ Wallet recreated with restore height ${readySession.creation_height}, current height: ${newHeight}`);

              await wallet.close();
            }
          } catch (error) {
            console.error(`Session ${sessionId}: Failed to fix wallet restore height:`, error);
          }
        } else {
          // More rounds needed - save current exchange hexes and clear for next round
          updateSession(sessionId, {
            exchange_round: nextRound,
            service_exchange_hexes_prev: finalSession.service_exchange_hexes,
            user_a_exchange_hexes_prev: finalSession.user_a_exchange_hexes,
            user_b_exchange_hexes_prev: finalSession.user_b_exchange_hexes,
            service_exchange_hexes: null,
            user_a_exchange_hexes: null,
            user_b_exchange_hexes: null,
          });
          console.log(
            `Session ${sessionId}: Round ${nextRound}/${totalRounds} complete. Exchange hexes cleared for next round.`
          );
        }
      }

      res.json({
        success: true,
        message: `Exchange hex received for ${participantId}`,
        exchangeHex: participantId === "service" ? exchangeResultHex : undefined,
        currentRound: finalSession.exchange_round,
        totalRounds,
        allExchanged,
        isComplete: finalSession.status === "ready",
        multisigAddress: finalSession.multisig_address,
        nextStep:
          finalSession.status === "ready"
            ? "Multisig setup complete!"
            : allExchanged
            ? "Continue to next exchange round"
            : "Waiting for other participants to exchange keys",
      });
    } catch (error) {
      console.error("Error exchanging keys:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get session status
router.get("/multisig/:sessionId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = getSession(sessionId);

    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    // Return session info including PUBLIC coordination hex data
    res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        threshold: session.threshold,
        totalParticipants: session.total_participants,
        exchangeRound: session.exchange_round,
        multisigAddress: session.multisig_address,
        // PUBLIC hex data for multisig coordination (safe to share)
        service_prepared_hex: session.service_prepared_hex,
        user_a_prepared_hex: session.user_a_prepared_hex,
        user_b_prepared_hex: session.user_b_prepared_hex,
        service_made_hex: session.service_made_hex,
        user_a_made_hex: session.user_a_made_hex,
        user_b_made_hex: session.user_b_made_hex,
        service_exchange_hexes: session.service_exchange_hexes,
        user_a_exchange_hexes: session.user_a_exchange_hexes,
        user_b_exchange_hexes: session.user_b_exchange_hexes,
        service_exchange_hexes_prev: session.service_exchange_hexes_prev,
        user_a_exchange_hexes_prev: session.user_a_exchange_hexes_prev,
        user_b_exchange_hexes_prev: session.user_b_exchange_hexes_prev,
        // Boolean flags for UI
        hasPrepared: {
          service: !!session.service_prepared_hex,
          userA: !!session.user_a_prepared_hex,
          userB: !!session.user_b_prepared_hex,
        },
        hasMade: {
          service: !!session.service_made_hex,
          userA: !!session.user_a_made_hex,
          userB: !!session.user_b_made_hex,
        },
        hasExchanged: {
          service: !!session.service_exchange_hexes,
          userA: !!session.user_a_exchange_hexes,
          userB: !!session.user_b_exchange_hexes,
        },
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// List all sessions for the authenticated user
router.get("/multisig", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = getSessionsByUserId(req.userId!);
    res.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        threshold: s.threshold,
        totalParticipants: s.total_participants,
        multisigAddress: s.multisig_address,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Create a transaction from the multisig wallet
router.post(
  "/multisig/:sessionId/create-transaction",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { destinationAddress, amount } = req.body;

      if (!destinationAddress || !amount) {
        return res.status(400).json({
          success: false,
          error: "destinationAddress and amount are required",
        });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: "Multisig session must be ready before creating transactions",
        });
      }

      // Open the service wallet and create transaction
      const serviceWallet = await moneroTs.openWalletFull({
        path: session.service_wallet_path!,
        password: WALLET_PASSWORD,
        networkType: MONERO_CONFIG.networkType,
        server: {
          uri: DAEMON_URI,
        },
      });

      // Sync wallet to get latest balance
      await serviceWallet.sync();

      // Create the transaction
      const txSet = await serviceWallet.createTx({
        accountIndex: 0,
        address: destinationAddress,
        amount: amount,
      });

      // Get the unsigned tx hex for other participants to sign
      const unsignedTxHex = await serviceWallet.exportMultisigHex();

      await serviceWallet.close();

      res.json({
        success: true,
        message: "Transaction created. Participants must sign it.",
        unsignedTxHex,
        txSet: {
          destinations: [{ address: destinationAddress, amount }],
        },
      });
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Sign a multisig transaction
router.post(
  "/multisig/:sessionId/sign-transaction",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { participantId, unsignedTxHex } = req.body;

      if (!participantId || !unsignedTxHex) {
        return res.status(400).json({
          success: false,
          error: "participantId and unsignedTxHex are required",
        });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: "Multisig session must be ready before signing transactions",
        });
      }

      let signedTxHex: string;

      if (participantId === "service") {
        // Service signs the transaction
        const serviceWallet = await moneroTs.openWalletFull({
          path: session.service_wallet_path!,
          password: WALLET_PASSWORD,
          networkType: MONERO_CONFIG.networkType,
          server: {
            uri: DAEMON_URI,
          },
        });

        // Import the multisig info from other participants
        await serviceWallet.importMultisigHex([unsignedTxHex]);

        // Sign and export
        const signResult = await serviceWallet.signMultisigTxHex(unsignedTxHex);
        signedTxHex = signResult.getSignedMultisigTxHex();

        await serviceWallet.close();
      } else {
        // Users submit their signed tx hex
        const { signedTxHex: userSignedHex } = req.body;
        if (!userSignedHex) {
          return res
            .status(400)
            .json({ success: false, error: "signedTxHex is required for user participants" });
        }
        signedTxHex = userSignedHex;
      }

      res.json({
        success: true,
        message: `Transaction signed by ${participantId}`,
        signedTxHex,
      });
    } catch (error) {
      console.error("Error signing transaction:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Submit a fully signed multisig transaction to the network
router.post(
  "/multisig/:sessionId/submit-transaction",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { signedTxHexes } = req.body; // Array of signed tx hexes from all required signers

      if (!signedTxHexes || !Array.isArray(signedTxHexes)) {
        return res.status(400).json({
          success: false,
          error: "signedTxHexes array is required",
        });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: "Multisig session must be ready",
        });
      }

      // Open the service wallet
      const serviceWallet = await moneroTs.openWalletFull({
        path: session.service_wallet_path!,
        password: WALLET_PASSWORD,
        networkType: MONERO_CONFIG.networkType,
        server: {
          uri: DAEMON_URI,
        },
      });

      // Import all signed tx hexes
      for (const signedHex of signedTxHexes) {
        await serviceWallet.importMultisigHex([signedHex]);
      }

      // Submit the transaction
      const txHashes = await serviceWallet.submitMultisigTxHex(signedTxHexes[0]);

      await serviceWallet.close();

      res.json({
        success: true,
        message: "Transaction submitted to the network",
        txHashes,
      });
    } catch (error) {
      console.error("Error submitting transaction:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get wallet balance for a multisig session
router.get(
  "/multisig/:sessionId/balance",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = getSession(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      if (session.status !== "ready") {
        return res.status(400).json({
          success: false,
          error: "Multisig session must be ready to check balance",
        });
      }

      // Open and sync the service wallet
      const serviceWallet = await moneroTs.openWalletFull({
        path: session.service_wallet_path!,
        password: WALLET_PASSWORD,
        networkType: MONERO_CONFIG.networkType,
        server: {
          uri: DAEMON_URI,
        },
      });

      await serviceWallet.sync();

      const balance = await serviceWallet.getBalance();
      const unlockedBalance = await serviceWallet.getUnlockedBalance();

      await serviceWallet.close();

      res.json({
        success: true,
        balance: balance.toString(),
        unlockedBalance: unlockedBalance.toString(),
        address: session.multisig_address,
      });
    } catch (error) {
      console.error("Error getting balance:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Test endpoint (simplified coordinator test)
router.get("/test", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message:
      "Multisig coordinator is running. Use POST /multisig/create-session to start.",
    endpoints: {
      "POST /multisig/create-session": "Create new multisig session",
      "POST /multisig/:sessionId/prepare": "Submit prepared hex",
      "POST /multisig/:sessionId/make": "Submit made hex",
      "POST /multisig/:sessionId/exchange": "Exchange multisig keys",
      "GET /multisig/:sessionId": "Get session status",
      "GET /multisig": "List all sessions",
      "POST /multisig/:sessionId/create-transaction": "Create a transaction from multisig wallet",
      "POST /multisig/:sessionId/sign-transaction": "Sign a multisig transaction",
      "POST /multisig/:sessionId/submit-transaction": "Submit signed transaction to network",
      "GET /multisig/:sessionId/balance": "Get multisig wallet balance",
    },
  });
});

// Admin endpoint to manually retry service key exchange for stuck sessions
router.post(
  "/multisig/:sessionId/admin/retry-service-exchange",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = getSession(sessionId);

      if (!session) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }

      if (session.status !== "exchanging") {
        return res.status(400).json({
          success: false,
          error: `Session is in ${session.status} state, not exchanging`,
        });
      }

      // Check if both users have exchanged but service hasn't
      const bothUsersExchanged = session.user_a_exchange_hexes && session.user_b_exchange_hexes;
      if (!bothUsersExchanged) {
        return res.status(400).json({
          success: false,
          error: "Both users must exchange keys first",
        });
      }

      if (session.service_exchange_hexes) {
        return res.status(400).json({
          success: false,
          error: "Service already exchanged keys",
        });
      }

      console.log(`[Admin] Manually retrying service key exchange for session ${sessionId}`);

      // For 2-of-3: N - M + 1 = 3 - 2 + 1 = 2 rounds of exchange
      const totalRounds = session.total_participants - session.threshold + 1;

      const serviceWallet = await moneroTs.openWalletFull({
        path: session.service_wallet_path!,
        password: WALLET_PASSWORD,
        networkType: MONERO_CONFIG.networkType,
        server: {
          uri: DAEMON_URI,
        },
      });

      console.log(`[Admin] Service wallet opened, checking multisig status...`);
      const isMultisig = await serviceWallet.isMultisig();
      console.log(`[Admin] Service wallet isMultisig: ${isMultisig}`);

      let hexesToExchange: string[];
      if (session.exchange_round === 0) {
        hexesToExchange = [session.user_a_made_hex!, session.user_b_made_hex!];
      } else {
        hexesToExchange = [session.user_a_exchange_hexes!, session.user_b_exchange_hexes!];
      }

      const result = await serviceWallet.exchangeMultisigKeys(hexesToExchange, WALLET_PASSWORD);
      const serviceExchangeHex = result.getMultisigHex();

      // If this is the final round, get the multisig address
      if (session.exchange_round === totalRounds - 1) {
        const multisigAddress = await serviceWallet.getAddress(0, 0);
        updateSession(sessionId, {
          service_exchange_hexes: serviceExchangeHex,
          multisig_address: multisigAddress,
        });
      } else {
        updateSession(sessionId, { service_exchange_hexes: serviceExchangeHex });
      }

      // Save and close
      await serviceWallet.save();
      await serviceWallet.close();

      // Check if all participants have exchanged
      const updatedSession = getSession(sessionId)!;
      const allExchanged =
        updatedSession.service_exchange_hexes &&
        updatedSession.user_a_exchange_hexes &&
        updatedSession.user_b_exchange_hexes;

      if (allExchanged) {
        const nextRound = updatedSession.exchange_round + 1;
        if (nextRound >= totalRounds) {
          updateSession(sessionId, { status: "ready", exchange_round: nextRound });
          console.log(`[Admin] Session ${sessionId}: Key exchange complete!`);

          // CRITICAL: Recreate wallet with correct restore height
          try {
            const readySession = getSession(sessionId)!;
            if (readySession.service_wallet_path && readySession.creation_height) {
              console.log(`[Admin] Session ${sessionId}: Fixing wallet restore height (recreating from seed at height ${readySession.creation_height})...`);

              let wallet = await moneroTs.openWalletFull({
                path: readySession.service_wallet_path,
                password: WALLET_PASSWORD,
                networkType: MONERO_CONFIG.networkType,
                server: { uri: DAEMON_URI },
              });

              const walletSeed = await wallet.getSeed();
              await wallet.close();

              const fs = await import("fs");
              try {
                fs.unlinkSync(readySession.service_wallet_path);
                fs.unlinkSync(readySession.service_wallet_path + ".keys");
              } catch (e) {
                console.log(`[Admin] Session ${sessionId}: Wallet files already deleted`);
              }

              wallet = await moneroTs.createWalletFull({
                path: readySession.service_wallet_path,
                password: WALLET_PASSWORD,
                networkType: MONERO_CONFIG.networkType,
                seed: walletSeed,
                restoreHeight: readySession.creation_height,
                server: { uri: DAEMON_URI },
              });

              const newHeight = await wallet.getHeight();
              console.log(`[Admin] Session ${sessionId}: ✓ Wallet recreated with restore height ${readySession.creation_height}, current height: ${newHeight}`);

              await wallet.close();
            }
          } catch (error) {
            console.error(`[Admin] Session ${sessionId}: Failed to fix wallet restore height:`, error);
          }
        } else {
          updateSession(sessionId, { exchange_round: nextRound });
          console.log(`[Admin] Session ${sessionId}: Moving to round ${nextRound}`);
        }
      }

      res.json({
        success: true,
        message: "Service key exchange completed",
        isComplete: updatedSession.status === "ready",
        multisigAddress: updatedSession.multisig_address,
      });
    } catch (error) {
      console.error("[Admin] Error retrying service key exchange:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
