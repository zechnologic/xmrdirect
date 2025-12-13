/**
 * Browser-Based Wallet Setup Guide
 *
 * NEW VERSION - Uses browser wallets (LocalMonero model)
 * NO CLI required - everything happens with button clicks
 * Private keys NEVER sent to server
 */

import { useState, useEffect } from "react";
import { useMoneroWallet } from "../hooks/useMoneroWallet";
import WalletPasswordModal from "./WalletPasswordModal";
import SeedPhraseBackup from "./SeedPhraseBackup";
import { API_BASE_URL } from "../config/api";

interface WalletSetupGuideProps {
  tradeId: string;
  sessionId: string;
  currentPhase: "preparing" | "making" | "exchanging" | "ready";
  userRole: "buyer" | "seller";
  userId: string;
  hasPrepared: boolean;
  hasMade: boolean;
  hasExchanged: boolean;
  exchangeRound: number;
  totalRounds: number;
}

export default function WalletSetupGuide({
  tradeId,
  sessionId,
  currentPhase,
  userRole,
  userId,
  hasPrepared,
  hasMade,
  hasExchanged,
  exchangeRound,
  totalRounds,
}: WalletSetupGuideProps) {
  const wallet = useMoneroWallet(tradeId, userId);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSeedBackup, setShowSeedBackup] = useState(false);
  const [currentStep, setCurrentStep] = useState<"create" | "prepare" | "make" | "exchange" | "done">("create");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hasStoredWallet, setHasStoredWallet] = useState(false);

  const participantId = userRole === "buyer" ? "user_a" : "user_b";
  const token = localStorage.getItem("token");

  // Check if wallet exists on mount
  useEffect(() => {
    async function checkWallet() {
      const exists = await wallet.checkWalletExists();
      setHasStoredWallet(exists);
    }
    checkWallet();
  }, [wallet]);

  // Determine current step based on phase and user progress
  useEffect(() => {
    if (currentPhase === "ready") {
      setCurrentStep("done");
    } else if (currentPhase === "exchanging" && hasMade) {
      setCurrentStep("exchange");
    } else if (currentPhase === "making" && hasPrepared) {
      setCurrentStep("make");
    } else if (currentPhase === "making") {
      setCurrentStep("prepare");
    } else if (!wallet.isWalletReady) {
      setCurrentStep("create");
    } else if (!hasPrepared) {
      setCurrentStep("prepare");
    }
  }, [currentPhase, hasPrepared, hasMade, wallet.isWalletReady]);

  /**
   * STEP 1: Create Wallet OR Unlock Existing Wallet
   */
  const handleCreateWallet = async (password: string, shouldStore: boolean) => {
    setShowPasswordModal(false);
    setError("");

    try {
      if (hasStoredWallet) {
        // UNLOCKING existing wallet - NO seed quiz needed!
        setMessage("Unlocking your wallet...");
        await wallet.loadStoredWallet(password);
        setMessage("✅ Wallet unlocked! You can now proceed with multisig setup.");
        // Don't show seed backup for existing wallets
      } else {
        // CREATING new wallet - seed quiz IS required!
        setMessage("Creating wallet in your browser...");
        await wallet.createWallet(password, shouldStore);
        // Show seed phrase backup screen (CRITICAL for new wallets!)
        setShowSeedBackup(true);
      }
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create/unlock wallet");
      setMessage("");
    }
  };

  /**
   * STEP 2: After seed backup confirmed, prepare multisig
   */
  const handleSeedBackupConfirmed = async () => {
    setShowSeedBackup(false);
    setMessage("Preparing multisig coordination data...");

    console.log(`[WalletSetup] 🔑 Seed backup confirmed for ${participantId} (${userRole})`);

    try {
      // 3. Prepare multisig (returns PUBLIC hex data)
      const preparedHex = await wallet.prepareMultisig();

      console.log(`[WalletSetup] ✅ Prepared hex (first 50 chars): ${preparedHex.substring(0, 50)}...`);
      console.log(`[WalletSetup] 📤 Submitting to session: ${sessionId}, as ${participantId}`);

      // 4. Submit PUBLIC coordination data to server
      const response = await fetch(
        `${API_BASE_URL}/multisig/${sessionId}/prepare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            preparedHex, // ✅ SAFE - Only PUBLIC coordination data
          }),
        }
      );

      const data = await response.json();

      console.log(`[WalletSetup] 📥 Server response:`, data);

      if (data.success) {
        setMessage("✅ Preparation complete! Waiting for other party...");
        setCurrentStep("prepare");
        console.log(`[WalletSetup] ✅ Prepare successful. All prepared: ${data.allPrepared}`);
        // Refresh page to update status
        setTimeout(() => window.location.reload(), 2000);
      } else {
        console.error(`[WalletSetup] ❌ Server error:`, data.error);
        setError("Failed to submit: " + data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare multisig");
    }
  };

  /**
   * STEP 3: Make Multisig
   */
  const handleMakeMultisig = async () => {
    setMessage("Fetching coordination data and creating multisig wallet...");
    setError("");

    console.log(`[WalletSetup] 🏗️ Starting makeMultisig as ${participantId}`);
    console.log(`[WalletSetup] 🔍 Fetching session: ${sessionId}`);

    try {
      // 1. Get other participants' prepared hexes from server
      const response = await fetch(
        `${API_BASE_URL}/multisig/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const sessionData = await response.json();

      if (!sessionData.success) {
        throw new Error("Failed to get session data");
      }

      const session = sessionData.session;

      console.log(`[WalletSetup] 📋 Session status: ${session.status}`);
      console.log(`[WalletSetup] 📋 Service prepared: ${!!session.service_prepared_hex}`);
      console.log(`[WalletSetup] 📋 User A prepared: ${!!session.user_a_prepared_hex}`);
      console.log(`[WalletSetup] 📋 User B prepared: ${!!session.user_b_prepared_hex}`);

      // Collect other prepared hexes
      const otherHexes: string[] = [];
      if (session.service_prepared_hex) otherHexes.push(session.service_prepared_hex);
      if (participantId === "user_a" && session.user_b_prepared_hex) {
        otherHexes.push(session.user_b_prepared_hex);
      }
      if (participantId === "user_b" && session.user_a_prepared_hex) {
        otherHexes.push(session.user_a_prepared_hex);
      }

      console.log(`[WalletSetup] 📦 Collected ${otherHexes.length} other hexes (need 2)`);

      if (otherHexes.length < 2) {
        throw new Error("Not all participants have prepared yet");
      }

      // Check if wallet is ready, if not prompt to unlock
      if (!wallet.isWalletReady) {
        console.log(`[WalletSetup] ⚠️ Wallet not in memory, checking for stored wallet...`);

        if (hasStoredWallet) {
          setError("Please unlock your stored wallet first by clicking the 'Unlock Stored Wallet' button above.");
          return;
        } else {
          setError("Wallet not found. Please create a new wallet first.");
          return;
        }
      }

      console.log(`[WalletSetup] ✅ Wallet is ready in memory`);

      // 2. Make multisig wallet IN BROWSER
      const madeHex = await wallet.makeMultisig(otherHexes, 2);

      // 2.5 Save multisig state to storage (public coordination data)
      console.log(`[WalletSetup] 💾 Saving multisig state after makeMultisig...`);
      const { storeMultisigState } = await import("../utils/walletEncryption");
      storeMultisigState(tradeId, userId, {
        stage: "made",
        otherPreparedHexes: otherHexes,
      });
      console.log(`[WalletSetup] ✅ Multisig state saved`);

      // 3. Submit made hex to server
      const makeResponse = await fetch(
        `${API_BASE_URL}/multisig/${sessionId}/make`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            madeHex, // ✅ SAFE - Only PUBLIC coordination data
          }),
        }
      );

      const makeData = await makeResponse.json();

      if (makeData.success) {
        setMessage("✅ Multisig wallet created! Waiting for key exchange...");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setError("Failed to submit: " + makeData.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to make multisig");
    }
  };

  /**
   * STEP 4: Exchange Keys (One Round Per Click)
   */
  const handleExchangeKeys = async () => {
    setMessage("Exchanging multisig keys...");
    setError("");

    try {
      // Check if wallet is ready, if not prompt to unlock
      if (!wallet.isWalletReady) {
        console.log(`[WalletSetup] ⚠️ Wallet not in memory for exchangeKeys...`);

        if (hasStoredWallet) {
          setError("Please unlock your stored wallet first by clicking the 'Unlock Stored Wallet' button above.");
          return;
        } else {
          setError("Wallet not found. Please create a new wallet first.");
          return;
        }
      }

      console.log(`[WalletSetup] ✅ Wallet is ready in memory for exchangeKeys`);

      // 1. Get session info to determine which round we're on
      const response = await fetch(
        `${API_BASE_URL}/multisig/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const sessionData = await response.json();
      const session = sessionData.session;
      const totalRounds = session.totalParticipants - session.threshold + 1;

      console.log(`[WalletSetup] 📍 Current round: ${session.exchangeRound}/${totalRounds - 1}`);

      // 2. Determine which hexes to use for this round
      const hexesToExchange: string[] = [];

      if (session.exchangeRound === 0) {
        // Round 0: Use made hexes
        console.log(`[WalletSetup] Round 0: Using made hexes for exchange`);
        if (session.service_made_hex) hexesToExchange.push(session.service_made_hex);
        if (participantId === "user_a" && session.user_b_made_hex) {
          hexesToExchange.push(session.user_b_made_hex);
        }
        if (participantId === "user_b" && session.user_a_made_hex) {
          hexesToExchange.push(session.user_a_made_hex);
        }
      } else {
        // Round 1+: Use previous round's exchange hexes
        console.log(`[WalletSetup] Round ${session.exchangeRound}: Using exchange hexes from previous round`);
        if (session.service_exchange_hexes_prev) hexesToExchange.push(session.service_exchange_hexes_prev);
        if (participantId === "user_a" && session.user_b_exchange_hexes_prev) {
          hexesToExchange.push(session.user_b_exchange_hexes_prev);
        }
        if (participantId === "user_b" && session.user_a_exchange_hexes_prev) {
          hexesToExchange.push(session.user_a_exchange_hexes_prev);
        }
      }

      if (hexesToExchange.length < 2) {
        throw new Error(`Not all participants have completed round ${session.exchangeRound}. Waiting for others...`);
      }

      // 3. Exchange keys IN BROWSER
      console.log(`[WalletSetup] 🔐 Exchanging keys for round ${session.exchangeRound + 1}...`);
      const { exchangeHex, multisigAddress } = await wallet.exchangeMultisigKeys(hexesToExchange);

      // 3.5 Save wallet state after exchange (wallet has internally advanced to next round)
      if (wallet.walletInfo) {
        console.log(`[WalletSetup] 💾 Saving wallet state after round ${session.exchangeRound + 1}...`);
        const { storeEncryptedWalletWithSync } = await import("../utils/walletEncryption");
        const walletPassword = sessionStorage.getItem(`wallet_password_${tradeId}`);
        if (walletPassword) {
          try {
            await storeEncryptedWalletWithSync(userId, wallet.walletInfo, walletPassword, token!);
            console.log(`[WalletSetup] ✅ Wallet state saved after exchange`);
          } catch (saveError) {
            console.warn(`[WalletSetup] ⚠️ Failed to save wallet state:`, saveError);
          }
        }
      }

      // 4. Submit exchange hex (may be empty if complete)
      const exchangeResponse = await fetch(
        `${API_BASE_URL}/multisig/${sessionId}/exchange`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            exchangeHex: exchangeHex || "", // May be empty if setup complete
          }),
        }
      );

      const exchangeData = await exchangeResponse.json();

      if (exchangeData.success) {
        // Save multisig state after EVERY exchange round, not just the final one
        // This is critical so we can restore the correct round state after page reload
        const { storeMultisigState, retrieveMultisigState } = await import("../utils/walletEncryption");
        const previousState = retrieveMultisigState(tradeId, userId);
        const otherPreparedHexes = previousState?.otherPreparedHexes || [];

        storeMultisigState(tradeId, userId, {
          stage: "exchanged",
          otherPreparedHexes: otherPreparedHexes,
          otherMadeHexes: hexesToExchange,
        });

        if (multisigAddress || exchangeData.isComplete) {
          setMessage(`✅ Multisig setup complete! Address: ${multisigAddress || exchangeData.multisigAddress}`);
          // Reload page after setup complete
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setMessage(`✅ Round ${session.exchangeRound + 1} complete! Waiting for other party...`);
          // Don't reload - let polling detect next round
          // The wallet state has been saved above, polling will show next round button
        }
      } else {
        setError("Failed to submit: " + exchangeData.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to exchange keys");
    }
  };

  // Wallet Ready State
  if (currentPhase === "ready") {
    return (
      <div className="bg-green-900/20 border-2 border-green-600 p-6 rounded">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-4xl">🎉</div>
          <div>
            <h3 className="text-2xl font-bold text-green-400 mb-1">Escrow Wallet Ready!</h3>
            <p className="text-gray-300">
              Your multisig wallet setup is complete. The escrow wallet is now ready for deposits and transactions.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 text-sm py-4">
          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
          <span className="text-gray-400">→</span>
          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
          <span className="text-gray-400">→</span>
          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
        </div>

        {wallet.multisigAddress && (
          <div className="bg-green-950/50 border border-green-600 p-4 rounded">
            <p className="text-sm text-gray-300 mb-2">
              <strong>Multisig Address:</strong>
            </p>
            <div className="font-mono text-xs bg-black/50 p-3 rounded break-all">
              {wallet.multisigAddress}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#2a2a2a] border border-orange-600 p-6 rounded">
      <h3 className="text-xl font-semibold mb-4">🔐 Browser-Based Wallet Setup</h3>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between text-sm mb-6">
        <div className={`flex items-center space-x-2 ${currentStep === "create" ? "text-orange-400" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full ${currentStep === "create" ? "bg-orange-600" : "bg-gray-700"} text-white flex items-center justify-center font-bold`}>
            {wallet.isWalletReady ? "✓" : "1"}
          </div>
          <span className="font-semibold">Create</span>
        </div>
        <span className="text-gray-400">→</span>
        <div className={`flex items-center space-x-2 ${currentStep === "prepare" ? "text-orange-400" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full ${hasPrepared ? "bg-green-600" : currentStep === "prepare" ? "bg-orange-600" : "bg-gray-700"} text-white flex items-center justify-center font-bold`}>
            {hasPrepared ? "✓" : "2"}
          </div>
          <span className="font-semibold">Prepare</span>
        </div>
        <span className="text-gray-400">→</span>
        <div className={`flex items-center space-x-2 ${currentStep === "make" ? "text-orange-400" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full ${hasMade ? "bg-green-600" : currentStep === "make" ? "bg-orange-600" : "bg-gray-700"} text-white flex items-center justify-center font-bold`}>
            {hasMade ? "✓" : "3"}
          </div>
          <span className="font-semibold">Make</span>
        </div>
        <span className="text-gray-400">→</span>
        <div className={`flex items-center space-x-2 ${currentStep === "exchange" ? "text-orange-400" : "text-gray-400"}`}>
          <div className={`w-8 h-8 rounded-full ${hasExchanged ? "bg-green-600" : currentStep === "exchange" ? "bg-orange-600" : "bg-gray-700"} text-white flex items-center justify-center font-bold`}>
            {hasExchanged ? "✓" : "4"}
          </div>
          <span className="font-semibold">Exchange</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-600 p-4 mb-6 rounded text-sm">
        <div className="flex items-start space-x-2">
          <div className="text-blue-400 text-xl">ℹ️</div>
          <div>
            <div className="font-semibold text-blue-400 mb-1">100% Non-Custodial</div>
            <div className="text-gray-300 text-xs">
              Your wallet is created IN YOUR BROWSER using WebAssembly. Private keys NEVER leave your device.
              We only receive PUBLIC coordination data to set up the multisig escrow.
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="space-y-6">
        {/* STEP 1: Create Wallet */}
        {!wallet.isWalletReady && (
          <div className="bg-orange-900/20 border-2 border-orange-600 p-6 rounded">
            <div className="flex items-start space-x-3 mb-4">
              <div className="text-3xl">💼</div>
              <div>
                <h4 className="font-bold text-lg mb-2">Step 1: Create Your Wallet</h4>
                <p className="text-sm text-gray-300 mb-4">
                  Your browser will generate a secure Monero wallet. You'll receive a 25-word seed phrase that you MUST backup.
                </p>

                {hasStoredWallet ? (
                  <div className="mb-4">
                    <div className="bg-blue-900/20 border border-blue-600 p-3 rounded mb-3 text-sm text-gray-300">
                      <strong>Wallet Found:</strong> You have an encrypted wallet stored locally for this trade.
                    </div>
                    <button
                      onClick={() => {
                        setShowPasswordModal(true);
                      }}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded transition-colors"
                    >
                      🔓 Unlock Stored Wallet
                    </button>
                  </div>
                ) : null}

                <button
                  onClick={() => setShowPasswordModal(true)}
                  disabled={wallet.isCreating}
                  className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg rounded transition-colors disabled:opacity-50"
                >
                  {wallet.isCreating ? "⏳ Creating Wallet..." : "🔐 Create New Wallet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Waiting for Prepare */}
        {wallet.isWalletReady && !hasPrepared && currentStep === "prepare" && (
          <div className="bg-yellow-900/20 border-2 border-yellow-600 p-6 rounded text-center">
            <div className="text-4xl mb-3">⏳</div>
            <h4 className="font-bold text-lg mb-2">Waiting for Multisig Setup...</h4>
            <p className="text-sm text-gray-300">
              Your wallet is prepared. Waiting for the other party to prepare their wallet...
            </p>
            <div className="mt-4">
              <div className="inline-block animate-pulse text-yellow-500">●</div>
              <span className="text-gray-400 ml-2">Checking status...</span>
            </div>
          </div>
        )}

        {/* STEP 3: Make Multisig */}
        {currentPhase === "making" && hasPrepared && !hasMade && (
          <div className="bg-orange-900/20 border-2 border-orange-600 p-6 rounded">
            <div className="flex items-start space-x-3 mb-4">
              <div className="text-3xl">🔗</div>
              <div>
                <h4 className="font-bold text-lg mb-2">Step 2: Create Multisig Wallet</h4>
                <p className="text-sm text-gray-300 mb-4">
                  All parties are ready! Click below to combine the coordination data and create the multisig wallet.
                </p>

                <button
                  onClick={handleMakeMultisig}
                  disabled={wallet.multisig.isMaking}
                  className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg rounded transition-colors disabled:opacity-50"
                >
                  {wallet.multisig.isMaking ? "⏳ Creating..." : "🔗 Create Multisig Wallet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Waiting for Make */}
        {currentPhase === "making" && hasMade && !hasExchanged && (
          <div className="bg-yellow-900/20 border-2 border-yellow-600 p-6 rounded text-center">
            <div className="text-4xl mb-3">⏳</div>
            <h4 className="font-bold text-lg mb-2">Multisig Wallet Created!</h4>
            <p className="text-sm text-gray-300">
              Waiting for the other party to create their multisig wallet...
            </p>
          </div>
        )}

        {/* STEP 5: Exchange Keys */}
        {currentPhase === "exchanging" && hasMade && !hasExchanged && (
          <div className="bg-orange-900/20 border-2 border-orange-600 p-6 rounded">
            <div className="flex items-start space-x-3 mb-4">
              <div className="text-3xl">🔐</div>
              <div>
                <h4 className="font-bold text-lg mb-2">
                  Step 3: Key Exchange {totalRounds > 1 ? `(Round ${exchangeRound + 1}/${totalRounds})` : ""}
                </h4>
                <p className="text-sm text-gray-300 mb-4">
                  {totalRounds > 1
                    ? `Exchange round ${exchangeRound + 1} of ${totalRounds}. After clicking, the page will auto-refresh and you may need to click again for the next round.`
                    : "Almost done! Click below to complete the key exchange."}
                </p>

                <button
                  onClick={handleExchangeKeys}
                  disabled={wallet.multisig.isExchanging}
                  className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg rounded transition-colors disabled:opacity-50"
                >
                  {wallet.multisig.isExchanging ? "⏳ Exchanging..." : `🔐 Exchange Keys (Round ${exchangeRound + 1})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Waiting for Exchange */}
        {currentPhase === "exchanging" && hasExchanged && (
          <div className="bg-yellow-900/20 border-2 border-yellow-600 p-6 rounded text-center">
            <div className="text-4xl mb-3">⏳</div>
            <h4 className="font-bold text-lg mb-2">
              Round {exchangeRound + 1} Complete!
            </h4>
            <p className="text-sm text-gray-300">
              Waiting for the other party to complete round {exchangeRound + 1}...
              {exchangeRound < totalRounds - 1 && ` Once everyone finishes, you'll need to exchange again for round ${exchangeRound + 2}.`}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className="mt-4 bg-blue-900/30 border border-blue-600 p-3 rounded text-sm text-blue-400">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-600 p-3 rounded text-sm text-red-400">
          ❌ {error}
        </div>
      )}

      {/* Modals */}
      {showPasswordModal && (
        <WalletPasswordModal
          title={hasStoredWallet ? "Unlock Your Wallet" : "Create New Wallet"}
          mode={hasStoredWallet ? "restore" : "create"}
          onSubmit={handleCreateWallet}
          onCancel={() => setShowPasswordModal(false)}
          loading={wallet.isCreating || wallet.isRestoring}
        />
      )}

      {showSeedBackup && wallet.walletInfo && (
        <SeedPhraseBackup
          seed={wallet.walletInfo.seed}
          onConfirmed={handleSeedBackupConfirmed}
        />
      )}
    </div>
  );
}
