/**
 * React Hook for Browser-Based Monero Wallet
 *
 * Manages wallet state and operations in React components
 * All cryptography happens in browser - private keys never sent to server
 */

import { useState, useCallback, useEffect } from "react";
import { getWalletInstance, type WalletInfo } from "../services/moneroWallet";
import {
  storeEncryptedWalletWithSync,
  retrieveEncryptedWalletWithSync,
  hasWalletAnywhere,
  deleteStoredWallet,
  retrieveMultisigState,
} from "../utils/walletEncryption";

export interface WalletState {
  isInitialized: boolean;
  isCreating: boolean;
  isRestoring: boolean;
  walletInfo: WalletInfo | null;
  error: string | null;
  multisigAddress: string | null;
}

export interface MultisigProgress {
  isPreparing: boolean;
  isMaking: boolean;
  isExchanging: boolean;
  preparedHex: string | null;
  madeHex: string | null;
  exchangeHex: string | null;
  error: string | null;
}

export const useMoneroWallet = (tradeId?: string, userId?: string) => {
  const [walletState, setWalletState] = useState<WalletState>({
    isInitialized: false,
    isCreating: false,
    isRestoring: false,
    walletInfo: null,
    error: null,
    multisigAddress: null,
  });

  const [multisigState, setMultisigState] = useState<MultisigProgress>({
    isPreparing: false,
    isMaking: false,
    isExchanging: false,
    preparedHex: null,
    madeHex: null,
    exchangeHex: null,
    error: null,
  });

  const wallet = getWalletInstance();

  /**
   * Initialize wallet service (loads WebAssembly)
   */
  const initialize = useCallback(async () => {
    try {
      await wallet.initialize();
      setWalletState((prev) => ({ ...prev, isInitialized: true }));
    } catch (error) {
      setWalletState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Initialization failed",
      }));
    }
  }, [wallet]);

  /**
   * Create a new wallet IN BROWSER
   * Keys generated locally, never sent to server
   * Wallet is synced to server for cross-device access
   */
  const createWallet = useCallback(
    async (password: string, shouldStore: boolean = true) => {
      setWalletState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        const walletInfo = await wallet.createWallet(password);

        setWalletState((prev) => ({
          ...prev,
          isCreating: false,
          walletInfo,
        }));

        // Store encrypted wallet (syncs to server and caches locally)
        if (shouldStore && userId) {
          const token = localStorage.getItem("token");
          if (!token) {
            throw new Error("Authentication required to sync wallet");
          }
          await storeEncryptedWalletWithSync(userId, walletInfo, password, token);
          console.log("[useMoneroWallet] ✅ Wallet created and synced to server");
        }

        return walletInfo;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to create wallet";
        setWalletState((prev) => ({
          ...prev,
          isCreating: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [wallet, userId]
  );

  /**
   * Restore wallet from seed phrase
   */
  const restoreWallet = useCallback(
    async (seed: string, password: string, restoreHeight?: number) => {
      setWalletState((prev) => ({ ...prev, isRestoring: true, error: null }));

      try {
        const walletInfo = await wallet.restoreFromSeed(seed, password, restoreHeight);

        setWalletState((prev) => ({
          ...prev,
          isRestoring: false,
          walletInfo,
        }));

        return walletInfo;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to restore wallet";
        setWalletState((prev) => ({
          ...prev,
          isRestoring: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [wallet]
  );

  /**
   * Load wallet from server (or localStorage as fallback)
   * Automatically restores multisig state if wallet was in multisig mode
   */
  const loadStoredWallet = useCallback(
    async (password: string) => {
      setWalletState((prev) => ({ ...prev, isRestoring: true, error: null }));

      try {
        if (!userId) {
          throw new Error("User ID is required to load wallet");
        }

        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication required to sync wallet");
        }

        // Load wallet data from server (or localStorage fallback)
        const walletInfo = await retrieveEncryptedWalletWithSync(userId, password, token);

        if (!walletInfo) {
          throw new Error("No wallet found. Please create a new wallet.");
        }

        // Load multisig state separately if tradeId is provided (it's stored unencrypted as public data)
        let multisigState = null;
        if (tradeId) {
          multisigState = retrieveMultisigState(tradeId, userId);
          console.log("[useMoneroWallet] 🔍 Multisig state for trade:", multisigState);
        }

        console.log("[useMoneroWallet] 📂 Loaded wallet from server/storage");

        // Restore wallet from seed
        await wallet.restoreFromSeed(walletInfo.seed, password);

        // If wallet was in multisig mode, restore that state
        if (multisigState) {
          console.log(`[useMoneroWallet] 🔄 Restoring multisig state: ${multisigState.stage}`);

          if (multisigState.stage === "made" || multisigState.stage === "exchanged") {
            // Restore multisig wallet by re-running makeMultisig
            if (multisigState.otherPreparedHexes && multisigState.otherPreparedHexes.length >= 2) {
              console.log("[useMoneroWallet] 🔧 Re-running makeMultisig to restore multisig wallet...");
              await wallet.makeMultisig(multisigState.otherPreparedHexes, 2);
              console.log("[useMoneroWallet] ✅ Multisig wallet state restored to 'made'!");

              // If wallet was in "exchanged" stage, we need to replay the exchange rounds
              // to get the wallet's internal round counter to the correct state
              if (multisigState.stage === "exchanged" && multisigState.otherMadeHexes && multisigState.otherMadeHexes.length >= 2) {
                console.log("[useMoneroWallet] 🔧 Replaying previous exchange rounds to restore wallet round state...");
                await wallet.exchangeMultisigKeys(multisigState.otherMadeHexes);
                console.log("[useMoneroWallet] ✅ Wallet exchange state restored! Ready for next round.");
              }
            }
          }
        }

        setWalletState((prev) => ({
          ...prev,
          isRestoring: false,
          walletInfo,
        }));

        return walletInfo;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to load wallet";
        setWalletState((prev) => ({
          ...prev,
          isRestoring: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [wallet, tradeId, userId]
  );

  /**
   * PHASE 1: Prepare for multisig
   * Returns PUBLIC coordination hex (safe to send to server)
   */
  const prepareMultisig = useCallback(async () => {
    setMultisigState((prev) => ({ ...prev, isPreparing: true, error: null }));

    try {
      const preparedHex = await wallet.prepareMultisig();

      setMultisigState((prev) => ({
        ...prev,
        isPreparing: false,
        preparedHex,
      }));

      return preparedHex;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to prepare multisig";
      setMultisigState((prev) => ({
        ...prev,
        isPreparing: false,
        error: errorMsg,
      }));
      throw error;
    }
  }, [wallet]);

  /**
   * PHASE 2: Make multisig wallet
   * Combines PUBLIC hex data from all participants
   */
  const makeMultisig = useCallback(
    async (otherPreparedHexes: string[], threshold: number = 2) => {
      setMultisigState((prev) => ({ ...prev, isMaking: true, error: null }));

      try {
        const madeHex = await wallet.makeMultisig(otherPreparedHexes, threshold);

        setMultisigState((prev) => ({
          ...prev,
          isMaking: false,
          madeHex,
        }));

        return madeHex;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to make multisig";
        setMultisigState((prev) => ({
          ...prev,
          isMaking: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [wallet]
  );

  /**
   * PHASE 3: Exchange multisig keys
   * Final coordination step
   */
  const exchangeMultisigKeys = useCallback(
    async (otherMadeHexes: string[]) => {
      setMultisigState((prev) => ({ ...prev, isExchanging: true, error: null }));

      try {
        const exchangeHex = await wallet.exchangeMultisigKeys(otherMadeHexes);

        // Get the multisig address after setup is complete
        let address: string | null = null;
        if (!exchangeHex || exchangeHex.length === 0) {
          address = await wallet.getMultisigAddress();
          setWalletState((prev) => ({ ...prev, multisigAddress: address }));
        }

        setMultisigState((prev) => ({
          ...prev,
          isExchanging: false,
          exchangeHex,
        }));

        return { exchangeHex, multisigAddress: address };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Failed to exchange multisig keys";
        setMultisigState((prev) => ({
          ...prev,
          isExchanging: false,
          error: errorMsg,
        }));
        throw error;
      }
    },
    [wallet]
  );

  /**
   * Sign a multisig transaction
   */
  const signTransaction = useCallback(
    async (txHex: string) => {
      try {
        const signedTxHex = await wallet.signMultisigTransaction(txHex);
        return signedTxHex;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to sign transaction";
        setWalletState((prev) => ({ ...prev, error: errorMsg }));
        throw error;
      }
    },
    [wallet]
  );

  /**
   * Clear wallet state and close
   */
  const closeWallet = useCallback(async () => {
    await wallet.close();
    setWalletState({
      isInitialized: true,
      isCreating: false,
      isRestoring: false,
      walletInfo: null,
      error: null,
      multisigAddress: null,
    });
    setMultisigState({
      isPreparing: false,
      isMaking: false,
      isExchanging: false,
      preparedHex: null,
      madeHex: null,
      exchangeHex: null,
      error: null,
    });
  }, [wallet]);

  /**
   * Delete stored wallet from localStorage
   */
  const deleteWallet = useCallback(() => {
    if (userId) {
      deleteStoredWallet(userId);
    }
  }, [userId]);

  /**
   * Check if wallet exists (checks server and localStorage)
   */
  const checkWalletExists = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
      return await hasWalletAnywhere(userId, token);
    } catch (error) {
      console.error("[useMoneroWallet] Failed to check wallet existence:", error);
      return false;
    }
  }, [userId]);

  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    // Wallet state
    ...walletState,
    isWalletReady: wallet.isWalletReady(),

    // Multisig state
    multisig: multisigState,

    // Wallet operations
    createWallet,
    restoreWallet,
    loadStoredWallet,
    closeWallet,
    deleteWallet,
    checkWalletExists,

    // Multisig operations
    prepareMultisig,
    makeMultisig,
    exchangeMultisigKeys,
    signTransaction,
  };
};
