/**
 * Client-Side Wallet Encryption Utilities
 *
 * Encrypts wallet seed phrases using Web Crypto API (AES-256-GCM)
 * Password NEVER sent to server - all encryption happens in browser
 */

import { API_BASE_URL } from "../config/api";

export interface EncryptedWallet {
  encrypted: string; // Base64 encrypted data
  iv: string; // Base64 initialization vector
  salt: string; // Base64 salt for key derivation
}

/**
 * Derive encryption key from password using PBKDF2
 * Slow by design (100k iterations) to resist brute force attacks
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // Convert password to key material
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000, // 100k iterations (slow but secure)
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt wallet data CLIENT-SIDE
 *
 * @param data - Sensitive wallet data (seed phrase, keys)
 * @param password - User's encryption password (NEVER sent to server)
 * @returns Encrypted wallet object (safe to store locally)
 */
export async function encryptWallet(
  data: string,
  password: string
): Promise<EncryptedWallet> {
  try {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive encryption key from password
    const key = await deriveKey(password, salt);

    // Encrypt the data
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      dataBuffer
    );

    // Convert to base64 for storage
    const encrypted = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const saltBase64 = btoa(String.fromCharCode(...salt));

    return {
      encrypted,
      iv: ivBase64,
      salt: saltBase64,
    };
  } catch (error) {
    console.error("[WalletEncryption] Failed to encrypt:", error);
    throw new Error(`Encryption failed: ${error}`);
  }
}

/**
 * Decrypt wallet data CLIENT-SIDE
 *
 * @param encryptedWallet - Encrypted wallet data from storage
 * @param password - User's decryption password
 * @returns Decrypted sensitive data
 */
export async function decryptWallet(
  encryptedWallet: EncryptedWallet,
  password: string
): Promise<string> {
  try {
    // Decode from base64
    const encryptedBuffer = Uint8Array.from(atob(encryptedWallet.encrypted), c =>
      c.charCodeAt(0)
    );
    const iv = Uint8Array.from(atob(encryptedWallet.iv), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(encryptedWallet.salt), c => c.charCodeAt(0));

    // Derive the same key from password
    const key = await deriveKey(password, salt);

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedBuffer
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("[WalletEncryption] Failed to decrypt:", error);
    throw new Error("Decryption failed. Wrong password or corrupted data.");
  }
}

/**
 * Store encrypted wallet in localStorage (user-level, not per-trade)
 *
 * @param userId - User ID
 * @param walletData - Sensitive data to encrypt (seed, keys)
 * @param password - Encryption password
 */
export async function storeEncryptedWallet(
  userId: string,
  walletData: any,
  password: string
): Promise<void> {
  try {
    const dataString = JSON.stringify(walletData);
    const encrypted = await encryptWallet(dataString, password);

    const storageKey = `user_wallet_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(encrypted));

    console.log(`[WalletStorage] ✅ Encrypted wallet stored locally for user ${userId}`);
  } catch (error) {
    console.error("[WalletStorage] Failed to store wallet:", error);
    throw error;
  }
}

/**
 * Retrieve and decrypt wallet from localStorage
 *
 * @param userId - User ID
 * @param password - Decryption password
 * @returns Decrypted wallet data
 */
export async function retrieveEncryptedWallet(
  userId: string,
  password: string
): Promise<any> {
  try {
    const storageKey = `user_wallet_${userId}`;
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      throw new Error("No wallet found for this user");
    }

    const encrypted: EncryptedWallet = JSON.parse(stored);
    const decryptedString = await decryptWallet(encrypted, password);

    return JSON.parse(decryptedString);
  } catch (error) {
    console.error("[WalletStorage] Failed to retrieve wallet:", error);
    throw error;
  }
}

/**
 * Delete wallet from localStorage
 */
export function deleteStoredWallet(userId: string): void {
  const storageKey = `user_wallet_${userId}`;
  localStorage.removeItem(storageKey);
  console.log(`[WalletStorage] ✅ Deleted wallet for user ${userId}`);
}

/**
 * Check if wallet exists in localStorage
 */
export function hasStoredWallet(userId: string): boolean {
  const storageKey = `user_wallet_${userId}`;
  return localStorage.getItem(storageKey) !== null;
}

/**
 * Export wallet as encrypted backup file (JSON)
 * User can download and save this
 */
export async function exportWalletBackup(
  walletData: any,
  password: string
): Promise<Blob> {
  const encrypted = await encryptWallet(JSON.stringify(walletData), password);

  const backup = {
    version: 1,
    timestamp: Date.now(),
    ...encrypted,
  };

  return new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
}

/**
 * Import wallet from backup file
 */
export async function importWalletBackup(
  file: File,
  password: string
): Promise<any> {
  const text = await file.text();
  const backup = JSON.parse(text);

  if (backup.version !== 1) {
    throw new Error("Unsupported backup version");
  }

  const encrypted: EncryptedWallet = {
    encrypted: backup.encrypted,
    iv: backup.iv,
    salt: backup.salt,
  };

  const decrypted = await decryptWallet(encrypted, password);
  return JSON.parse(decrypted);
}

/**
 * Store multisig state (unencrypted - it's public coordination data)
 */
export function storeMultisigState(
  tradeId: string,
  userId: string,
  state: {
    stage: "created" | "made" | "exchanged";
    otherPreparedHexes?: string[];
    otherMadeHexes?: string[];
  }
): void {
  const key = `multisig_state_${tradeId}_${userId}`;
  localStorage.setItem(key, JSON.stringify(state));
  console.log(`[WalletStorage] 💾 Multisig state saved: ${state.stage}`);
}

/**
 * Retrieve multisig state
 */
export function retrieveMultisigState(
  tradeId: string,
  userId: string
): {
  stage: "created" | "made" | "exchanged";
  otherPreparedHexes?: string[];
  otherMadeHexes?: string[];
} | null {
  const key = `multisig_state_${tradeId}_${userId}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  return JSON.parse(stored);
}

/**
 * Delete multisig state
 */
export function deleteMultisigState(tradeId: string, userId: string): void {
  const key = `multisig_state_${tradeId}_${userId}`;
  localStorage.removeItem(key);
}

/**
 * Store encrypted wallet with server sync
 * Stores both locally (cache) and on server
 *
 * @param userId - User ID
 * @param walletData - Wallet data to encrypt and store
 * @param password - Encryption password (client-side only!)
 * @param token - JWT auth token
 */
export async function storeEncryptedWalletWithSync(
  userId: string,
  walletData: any,
  password: string,
  token: string
): Promise<void> {
  try {
    const dataString = JSON.stringify(walletData);
    const encrypted = await encryptWallet(dataString, password);

    // Store locally as cache
    const storageKey = `user_wallet_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(encrypted));

    // Sync to server
    const response = await fetch(`${API_BASE_URL}/wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ encryptedWallet: encrypted }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to sync wallet to server");
    }

    console.log(`[WalletStorage] ✅ Wallet stored locally and synced to server for user ${userId}`);
  } catch (error) {
    console.error("[WalletStorage] Failed to store wallet with sync:", error);
    throw error;
  }
}

/**
 * Retrieve encrypted wallet with server sync
 * Tries server first, falls back to localStorage
 *
 * @param userId - User ID
 * @param password - Decryption password
 * @param token - JWT auth token
 * @returns Decrypted wallet data or null if not found
 */
export async function retrieveEncryptedWalletWithSync(
  userId: string,
  password: string,
  token: string
): Promise<any | null> {
  try {
    // Try server first
    const response = await fetch(`${API_BASE_URL}/wallet`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success && data.encryptedWallet) {
      // Decrypt server wallet
      const decryptedString = await decryptWallet(data.encryptedWallet, password);
      const walletData = JSON.parse(decryptedString);

      // Cache locally
      const storageKey = `user_wallet_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(data.encryptedWallet));

      console.log(`[WalletStorage] ✅ Wallet retrieved from server for user ${userId}`);
      return walletData;
    }

    // Fall back to localStorage
    const storageKey = `user_wallet_${userId}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      const encrypted: EncryptedWallet = JSON.parse(stored);
      const decryptedString = await decryptWallet(encrypted, password);
      console.log(`[WalletStorage] ✅ Wallet retrieved from localStorage for user ${userId}`);
      return JSON.parse(decryptedString);
    }

    return null;
  } catch (error) {
    console.error("[WalletStorage] Failed to retrieve wallet:", error);
    throw error;
  }
}

/**
 * Check if user has a wallet (checks both server and localStorage)
 *
 * @param userId - User ID
 * @param token - JWT auth token
 * @returns true if wallet exists
 */
export async function hasWalletAnywhere(userId: string, token: string): Promise<boolean> {
  try {
    // Check server first
    const response = await fetch(`${API_BASE_URL}/wallet`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (data.success && data.encryptedWallet) {
      return true;
    }

    // Check localStorage
    return hasStoredWallet(userId);
  } catch (error) {
    // If server check fails, fall back to localStorage
    return hasStoredWallet(userId);
  }
}
