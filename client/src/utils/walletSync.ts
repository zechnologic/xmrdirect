/**
 * Wallet Sync Service
 *
 * Handles syncing encrypted wallets between client and server
 *
 * SECURITY MODEL:
 * - Encryption happens CLIENT-SIDE using walletEncryption.ts
 * - Password NEVER sent to server
 * - Server stores encrypted blobs it cannot decrypt
 * - Platform remains NON-CUSTODIAL
 */

import { encryptWallet, decryptWallet } from "./walletEncryption";

const API_BASE = "http://localhost:3000";

/**
 * Store encrypted wallet on server
 *
 * @param walletData - Unencrypted wallet data (seed, keys, etc)
 * @param password - Encryption password (stays in browser!)
 * @param token - JWT authentication token
 */
export async function syncWalletToServer(
  walletData: any,
  password: string,
  token: string
): Promise<void> {
  try {
    // Encrypt wallet CLIENT-SIDE
    const encryptedWallet = await encryptWallet(JSON.stringify(walletData), password);

    // Send encrypted wallet to server
    const response = await fetch(`${API_BASE}/wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ encryptedWallet }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to sync wallet to server");
    }

    console.log("[WalletSync] ✅ Wallet synced to server");
  } catch (error) {
    console.error("[WalletSync] Failed to sync wallet to server:", error);
    throw error;
  }
}

/**
 * Retrieve and decrypt wallet from server
 *
 * @param password - Decryption password
 * @param token - JWT authentication token
 * @returns Decrypted wallet data or null if no wallet found
 */
export async function syncWalletFromServer(
  password: string,
  token: string
): Promise<any | null> {
  try {
    // Fetch encrypted wallet from server
    const response = await fetch(`${API_BASE}/wallet`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to retrieve wallet from server");
    }

    // No wallet found
    if (!data.encryptedWallet) {
      return null;
    }

    // Decrypt wallet CLIENT-SIDE
    const decryptedString = await decryptWallet(data.encryptedWallet, password);
    const walletData = JSON.parse(decryptedString);

    console.log("[WalletSync] ✅ Wallet retrieved and decrypted from server");
    return walletData;
  } catch (error) {
    console.error("[WalletSync] Failed to sync wallet from server:", error);
    throw error;
  }
}

/**
 * Check if user has a wallet stored on server
 *
 * @param token - JWT authentication token
 */
export async function hasServerWallet(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/wallet`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return data.success && data.encryptedWallet !== null;
  } catch (error) {
    console.error("[WalletSync] Failed to check for server wallet:", error);
    return false;
  }
}
