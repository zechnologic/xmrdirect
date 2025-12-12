/**
 * Browser-based Monero Wallet Service
 *
 * Uses monero-ts WebAssembly to perform ALL cryptographic operations
 * in the browser. Private keys NEVER leave the browser.
 *
 * Only PUBLIC multisig coordination data is sent to the server.
 */

import moneroTs from "monero-ts";

export interface WalletInfo {
  address: string;
  seed: string;
  privateSpendKey: string;
  privateViewKey: string;
}

export interface MultisigInfo {
  multisigHex: string;
  address?: string;
  isMultisigImportNeeded: boolean;
}

/**
 * Browser-based Monero Wallet (LocalMonero model)
 * All private key operations happen in browser using WebAssembly
 */
export class BrowserMoneroWallet {
  private wallet: any = null;
  private isInitialized = false;
  private nodeUri = "http://node.sethforprivacy.com:18089"; // May have CORS issues

  /**
   * Initialize the wallet (loads WebAssembly)
   * monero-ts handles WASM initialization automatically on first use
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("[BrowserMoneroWallet] Initializing monero-ts...");

    // monero-ts will use default path: /monero.worker.js (in browser)
    // Files are automatically copied from public/ to dist/ by Vite

    this.isInitialized = true;
    console.log("[BrowserMoneroWallet] ✅ Ready to create wallets");
  }

  /**
   * Get current blockchain height from daemon
   */
  private async getCurrentHeight(): Promise<number> {
    try {
      const daemon = await moneroTs.connectToDaemonRpc(this.nodeUri);
      const height = await daemon.getHeight();
      console.log(`[BrowserMoneroWallet] Current blockchain height: ${height}`);
      return height;
    } catch (error) {
      console.warn("[BrowserMoneroWallet] Could not get blockchain height, using 0:", error);
      return 0;
    }
  }

  /**
   * Create a new wallet IN BROWSER
   * Private keys generated locally using secure random
   *
   * @param password - Used to encrypt wallet in memory
   * @returns Wallet info (including seed phrase for backup)
   */
  async createWallet(password: string): Promise<WalletInfo> {
    // Ensure WASM is loaded before creating wallet
    await this.initialize();

    console.log("[BrowserMoneroWallet] Creating new wallet in browser...");

    try {
      // Create wallet using WebAssembly (runs locally in browser)
      // Note: restoreHeight cannot be used when creating a NEW wallet, only when restoring
      this.wallet = await moneroTs.createWalletFull({
        password: password,
        networkType: moneroTs.MoneroNetworkType.MAINNET,
        server: {
          uri: this.nodeUri,
        },
      });

      // Get wallet info (all operations happen in browser)
      const address = await this.wallet.getPrimaryAddress();
      const seed = await this.wallet.getSeed();
      const privateSpendKey = await this.wallet.getPrivateSpendKey();
      const privateViewKey = await this.wallet.getPrivateViewKey();

      console.log("[BrowserMoneroWallet] ✅ Wallet created successfully");
      console.log(`[BrowserMoneroWallet] Address: ${address}`);

      // ⚠️ CRITICAL: These private keys stay in browser memory
      // They are NEVER sent to the server
      return {
        address,
        seed,
        privateSpendKey,
        privateViewKey,
      };
    } catch (error) {
      console.error("[BrowserMoneroWallet] ❌ Failed to create wallet:", error);
      throw new Error(`Failed to create wallet: ${error}`);
    }
  }

  /**
   * Restore wallet from seed phrase
   * Used when user wants to recover from backup
   *
   * @param seed - 25-word seed phrase
   * @param password - Encryption password
   * @param restoreHeight - Block height to start scanning from (optional, defaults to current height)
   */
  async restoreFromSeed(
    seed: string,
    password: string,
    restoreHeight?: number
  ): Promise<WalletInfo> {
    // Ensure WASM is loaded before restoring wallet
    await this.initialize();

    console.log("[BrowserMoneroWallet] Restoring wallet from seed...");

    try {
      // If no restore height provided, use current height for multisig wallets
      // (multisig wallets are always newly created, so no old history to scan)
      const effectiveRestoreHeight = restoreHeight !== undefined ? restoreHeight : await this.getCurrentHeight();

      this.wallet = await moneroTs.createWalletFull({
        password: password,
        networkType: moneroTs.MoneroNetworkType.MAINNET,
        seed: seed,
        restoreHeight: effectiveRestoreHeight,
        server: {
          uri: this.nodeUri,
        },
      });

      const address = await this.wallet.getPrimaryAddress();
      const privateSpendKey = await this.wallet.getPrivateSpendKey();
      const privateViewKey = await this.wallet.getPrivateViewKey();

      console.log(`[BrowserMoneroWallet] ✅ Wallet restored (restore height: ${effectiveRestoreHeight})`);

      return {
        address,
        seed,
        privateSpendKey,
        privateViewKey,
      };
    } catch (error) {
      console.error("[BrowserMoneroWallet] ❌ Failed to restore wallet:", error);
      throw new Error(`Failed to restore wallet: ${error}`);
    }
  }

  /**
   * PHASE 1: Prepare for multisig
   * Returns PUBLIC coordination hex (safe to send to server)
   *
   * @returns preparedHex - PUBLIC multisig preparation data
   */
  async prepareMultisig(): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not created. Call createWallet() first.");
    }

    console.log("[BrowserMoneroWallet] Preparing for multisig...");

    try {
      // This returns PUBLIC multisig info, NOT private keys
      const preparedHex = await this.wallet.prepareMultisig();

      console.log("[BrowserMoneroWallet] ✅ Prepared multisig");
      console.log(`[BrowserMoneroWallet] PreparedHex (first 32 chars): ${preparedHex.substring(0, 32)}...`);

      // ✅ SAFE: This hex contains NO private key information
      // It's public coordination data used to set up multisig
      return preparedHex;
    } catch (error) {
      console.error("[BrowserMoneroWallet] ❌ Failed to prepare multisig:", error);
      throw new Error(`Failed to prepare multisig: ${error}`);
    }
  }

  /**
   * PHASE 2: Make multisig wallet
   * Combines PUBLIC hex data from all participants
   *
   * @param otherPreparedHexes - Array of prepared hexes from other parties
   * @param threshold - Number of signatures required (2 for 2-of-3)
   * @returns madeHex - PUBLIC multisig made data
   */
  async makeMultisig(
    otherPreparedHexes: string[],
    threshold: number = 2
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not created. Call createWallet() first.");
    }

    console.log("[BrowserMoneroWallet] Making multisig wallet...");
    console.log(`[BrowserMoneroWallet] Threshold: ${threshold}, Participants: ${otherPreparedHexes.length + 1}`);

    try {
      // Combine prepared hexes to create multisig wallet
      const result = await this.wallet.makeMultisig(
        otherPreparedHexes,
        threshold,
        "" // password (already set during wallet creation)
      );

      console.log("[BrowserMoneroWallet] ✅ Multisig wallet created");
      console.log(`[BrowserMoneroWallet] Result (first 32 chars): ${result.substring(0, 32)}...`);

      // ✅ SAFE: This is public multisig coordination data
      return result;
    } catch (error) {
      console.error("[BrowserMoneroWallet] ❌ Failed to make multisig:", error);
      throw new Error(`Failed to make multisig: ${error}`);
    }
  }

  /**
   * PHASE 3: Exchange multisig keys
   * Final coordination step (may need multiple rounds for N-of-M)
   *
   * @param otherMadeHexes - Array of made hexes from other parties
   * @returns exchangeHex - PUBLIC key exchange data (or empty if complete)
   */
  async exchangeMultisigKeys(otherMadeHexes: string[]): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not created. Call createWallet() first.");
    }

    console.log("[BrowserMoneroWallet] Exchanging multisig keys...");

    try {
      const result = await this.wallet.exchangeMultisigKeys(otherMadeHexes, "");

      // Get the actual hex string from the result object
      const exchangeHex = result ? result.getMultisigHex() : "";
      const isComplete = !exchangeHex || exchangeHex.length === 0;

      if (isComplete) {
        console.log("[BrowserMoneroWallet] ✅ Multisig setup COMPLETE!");
      } else {
        console.log("[BrowserMoneroWallet] ✅ Key exchange round complete, need another round");
      }

      // ✅ SAFE: Public key exchange data
      return exchangeHex;
    } catch (error) {
      console.error("[BrowserMoneroWallet] ❌ Failed to exchange keys:", error);
      throw new Error(`Failed to exchange multisig keys: ${error}`);
    }
  }

  /**
   * Get the multisig address (shared by all participants)
   */
  async getMultisigAddress(): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not created.");
    }

    try {
      const address = await this.wallet.getPrimaryAddress();
      return address;
    } catch (error) {
      throw new Error(`Failed to get address: ${error}`);
    }
  }

  /**
   * Sign a multisig transaction
   * Used when releasing escrow funds
   *
   * @param txHex - Unsigned transaction hex
   * @returns signedTxHex - Partially signed transaction
   */
  async signMultisigTransaction(txHex: string): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not created.");
    }

    console.log("[BrowserMoneroWallet] Signing multisig transaction...");

    try {
      const signResult = await this.wallet.signMultisigTxHex(txHex);
      const signedTxHex = signResult.getSignedMultisigTxHex();

      console.log("[BrowserMoneroWallet] ✅ Transaction signed");

      return signedTxHex;
    } catch (error) {
      console.error("[BrowserMoneroWallet] ❌ Failed to sign transaction:", error);
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  }

  /**
   * Close the wallet and clear memory
   */
  async close(): Promise<void> {
    if (this.wallet) {
      console.log("[BrowserMoneroWallet] Closing wallet...");
      await this.wallet.close();
      this.wallet = null;
      console.log("[BrowserMoneroWallet] ✅ Wallet closed");
    }
  }

  /**
   * Check if wallet is ready
   */
  isWalletReady(): boolean {
    return this.wallet !== null;
  }
}

// Singleton instance
let walletInstance: BrowserMoneroWallet | null = null;

/**
 * Get the global wallet instance (singleton pattern)
 */
export const getWalletInstance = (): BrowserMoneroWallet => {
  if (!walletInstance) {
    walletInstance = new BrowserMoneroWallet();
  }
  return walletInstance;
};
