import moneroTs from "monero-ts";
import { getSession, updateTrade, getTradeById } from "../db.js";
import db from "../db.js";
import notificationService from "./notifications.js";

const DAEMON_URI = "http://node.sethforprivacy.com:18089";
const WALLET_PASSWORD = "supersecretpassword123";
const POLL_INTERVAL = 60000; // Check every 60 seconds
const CONFIRMATION_BLOCKS = 10; // Number of confirmations required

interface MonitoredTrade {
  id: string;
  multisig_session_id: string;
  xmr_amount: number;
  status: string;
}

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Checks a specific multisig wallet for deposits
 */
async function checkWalletDeposits(
  sessionId: string,
  expectedAmount: number
): Promise<{ hasDeposit: boolean; isUnlocked: boolean; balance: bigint }> {
  const session = getSession(sessionId);
  if (!session || session.status !== "ready") {
    return { hasDeposit: false, isUnlocked: false, balance: BigInt(0) };
  }

  let serviceWallet = null;
  try {
    console.log(`[DepositMonitor] Opening wallet for session ${sessionId}...`);

    // Open and sync the service wallet
    serviceWallet = await moneroTs.openWalletFull({
      path: session.service_wallet_path!,
      password: WALLET_PASSWORD,
      networkType: moneroTs.MoneroNetworkType.MAINNET,
      server: {
        uri: DAEMON_URI,
      },
    });

    console.log(`[DepositMonitor] Syncing wallet for session ${sessionId}...`);
    console.log(`[DepositMonitor] NOTE: First sync may take 5+ minutes. Subsequent syncs will be much faster.`);

    // Sync with a longer timeout for first sync (can take several minutes)
    // Subsequent syncs will be much faster since they only scan new blocks
    const SYNC_TIMEOUT = 10 * 60 * 1000; // 10 minutes for first sync
    await Promise.race([
      serviceWallet.sync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Sync timeout after ${SYNC_TIMEOUT / 1000} seconds`)), SYNC_TIMEOUT)
      )
    ]);

    console.log(`[DepositMonitor] Getting balance for session ${sessionId}...`);
    const balance = await serviceWallet.getBalance();
    const unlockedBalance = await serviceWallet.getUnlockedBalance();

    console.log(`[DepositMonitor] Balance: ${balance}, Unlocked: ${unlockedBalance}`);

    await serviceWallet.close();

    const expectedAtomic = BigInt(Math.floor(expectedAmount * 1e12));
    const hasDeposit = balance >= expectedAtomic;
    const isUnlocked = unlockedBalance >= expectedAtomic;

    return { hasDeposit, isUnlocked, balance };
  } catch (error) {
    console.error(`[DepositMonitor] Error checking wallet deposits for session ${sessionId}:`, error);

    // Make sure to close wallet on error
    if (serviceWallet) {
      try {
        await serviceWallet.close();
      } catch (closeError) {
        console.error(`[DepositMonitor] Error closing wallet:`, closeError);
      }
    }

    return { hasDeposit: false, isUnlocked: false, balance: BigInt(0) };
  }
}

/**
 * Main monitoring loop
 */
async function monitorDeposits() {
  console.log("[DepositMonitor] Running deposit check...");

  try {
    // Get all trades that are pending and have a multisig session
    const stmt = db.prepare(`
      SELECT id, multisig_session_id, xmr_amount, status
      FROM trades
      WHERE status = 'pending' AND multisig_session_id IS NOT NULL
    `);
    const trades = stmt.all() as MonitoredTrade[];

    console.log(`[DepositMonitor] Monitoring ${trades.length} pending trades`);

    for (const trade of trades) {
      const { hasDeposit, isUnlocked, balance } = await checkWalletDeposits(
        trade.multisig_session_id,
        trade.xmr_amount
      );

      const balanceXmr = Number(balance) / 1e12;

      if (isUnlocked) {
        console.log(
          `[DepositMonitor] Trade ${trade.id}: Deposit confirmed and unlocked (${balanceXmr} XMR)`
        );
        updateTrade(trade.id, { status: "funded" });

        // Notify both parties
        const updatedTrade = getTradeById(trade.id);
        if (updatedTrade) {
          await notificationService.notifyTradeParticipants(
            "deposit_detected",
            trade.id,
            updatedTrade.buyer_id,
            updatedTrade.seller_id,
            { amount: balanceXmr }
          );
        }
      } else if (hasDeposit) {
        console.log(
          `[DepositMonitor] Trade ${trade.id}: Deposit detected but not yet unlocked (${balanceXmr} XMR, waiting for confirmations)`
        );
        // Optionally, you could add a "confirming" status here
      } else {
        console.log(
          `[DepositMonitor] Trade ${trade.id}: No deposit yet (balance: ${balanceXmr} XMR)`
        );
      }
    }
  } catch (error) {
    console.error("[DepositMonitor] Error in monitoring loop:", error);
  }
}

/**
 * Start the deposit monitoring service
 */
export function startDepositMonitor() {
  if (monitorInterval) {
    console.log("[DepositMonitor] Already running");
    return;
  }

  console.log(`[DepositMonitor] Starting deposit monitor (polling every ${POLL_INTERVAL}ms)`);

  // Run immediately
  monitorDeposits();

  // Then run on interval
  monitorInterval = setInterval(monitorDeposits, POLL_INTERVAL);
}

/**
 * Stop the deposit monitoring service
 */
export function stopDepositMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[DepositMonitor] Stopped");
  }
}

/**
 * Manually trigger a deposit check for a specific trade
 */
export async function checkTradeDeposit(tradeId: string): Promise<{
  success: boolean;
  hasDeposit: boolean;
  isUnlocked: boolean;
  balance: string;
}> {
  try {
    const stmt = db.prepare(`
      SELECT id, multisig_session_id, xmr_amount, status
      FROM trades
      WHERE id = ?
    `);
    const trade = stmt.get(tradeId) as MonitoredTrade | undefined;

    if (!trade) {
      return { success: false, hasDeposit: false, isUnlocked: false, balance: "0" };
    }

    if (!trade.multisig_session_id) {
      return { success: false, hasDeposit: false, isUnlocked: false, balance: "0" };
    }

    const { hasDeposit, isUnlocked, balance } = await checkWalletDeposits(
      trade.multisig_session_id,
      trade.xmr_amount
    );

    // Update trade status if deposit is unlocked
    if (isUnlocked && trade.status === "pending") {
      updateTrade(tradeId, { status: "funded" });
    }

    return {
      success: true,
      hasDeposit,
      isUnlocked,
      balance: (Number(balance) / 1e12).toFixed(8),
    };
  } catch (error) {
    console.error(`Error checking deposit for trade ${tradeId}:`, error);
    return { success: false, hasDeposit: false, isUnlocked: false, balance: "0" };
  }
}
