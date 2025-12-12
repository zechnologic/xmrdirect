import { useState, useEffect } from "react";
import walletStorage from "../utils/walletStorage";

interface WalletManagerProps {
  tradeId: string;
}

function WalletManager({ tradeId }: WalletManagerProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletSeed, setWalletSeed] = useState("");
  const [savedWalletSeed, setSavedWalletSeed] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    // Check if wallet exists for this trade
    setIsLocked(walletStorage.hasWallets());
  }, []);

  const saveWallet = async () => {
    if (!walletSeed.trim()) {
      setMessage("Please enter your wallet seed");
      return;
    }

    if (!password || password.length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      await walletStorage.storeWallet(
        tradeId,
        { seed: walletSeed },
        password
      );

      setMessage("✓ Wallet saved securely!");
      setSavedWalletSeed(walletSeed);
      setWalletSeed("");
      setPassword("");
      setConfirmPassword("");
      setIsLocked(true);
    } catch (error) {
      setMessage("Error saving wallet: " + error);
    }
  };

  const unlockWallet = async () => {
    if (!password) {
      setMessage("Please enter your password");
      return;
    }

    setIsUnlocking(true);
    setMessage("");

    try {
      const walletData = await walletStorage.getWallet(tradeId, password);

      if (walletData && walletData.seed) {
        setSavedWalletSeed(walletData.seed);
        setMessage("✓ Wallet unlocked!");
        setIsLocked(false);
      } else {
        setMessage("No wallet found for this trade");
      }
    } catch (error) {
      setMessage("Failed to unlock wallet. Incorrect password?");
    } finally {
      setIsUnlocking(false);
    }
  };

  const lockWallet = () => {
    setSavedWalletSeed(null);
    setPassword("");
    setIsLocked(true);
    setMessage("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage("✓ Copied to clipboard!");
    setTimeout(() => setMessage(""), 2000);
  };

  if (isLocked && walletStorage.hasWallets()) {
    return (
      <div className="bg-[#2a2a2a] border border-orange-600 p-6">
        <h3 className="text-xl font-semibold mb-4">Wallet Manager</h3>
        <p className="text-gray-300 text-sm mb-4">
          Enter your password to unlock your saved wallet information.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && unlockWallet()}
          placeholder="Enter password"
          className="w-full px-3 py-2 bg-[#232323] border border-orange-600 text-white text-sm focus:outline-none focus:border-orange-500 mb-4"
        />

        <button
          onClick={unlockWallet}
          disabled={isUnlocking}
          className="w-full px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold disabled:opacity-50"
        >
          {isUnlocking ? "Unlocking..." : "Unlock Wallet"}
        </button>

        {message && (
          <div
            className={`mt-4 p-3 text-sm ${
              message.includes("Error") || message.includes("Failed")
                ? "bg-red-900/20 border border-red-600"
                : "bg-green-900/20 border border-green-600"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    );
  }

  if (!isLocked && savedWalletSeed) {
    return (
      <div className="bg-[#2a2a2a] border border-green-600 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Wallet Manager</h3>
          <button
            onClick={lockWallet}
            className="px-3 py-1 bg-gray-700 text-white hover:bg-gray-600 transition-colors font-semibold text-sm"
          >
            Lock
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-4">
          Your wallet information for this trade:
        </p>

        <div className="bg-[#232323] border border-green-600 p-4 mb-4">
          <div className="text-xs text-gray-400 mb-2">Wallet Seed:</div>
          <div className="font-mono text-xs text-gray-300 break-all mb-2">
            {savedWalletSeed}
          </div>
          <button
            onClick={() => copyToClipboard(savedWalletSeed)}
            className="px-3 py-1 bg-green-600 text-white hover:bg-green-700 transition-colors font-semibold text-sm"
          >
            Copy Seed
          </button>
        </div>

        <div className="bg-orange-900/20 border border-orange-600 p-3 text-xs text-gray-300">
          <strong>Important:</strong> Keep your seed phrase safe. You'll need it to
          access your wallet and sign transactions. Never share it with anyone.
        </div>

        {message && (
          <div className="mt-4 p-3 text-sm bg-green-900/20 border border-green-600">
            {message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#2a2a2a] border border-orange-600 p-6">
      <h3 className="text-xl font-semibold mb-4">Save Wallet Information</h3>
      <p className="text-gray-300 text-sm mb-4">
        Store your wallet seed securely encrypted in your browser. You'll need it to
        sign transactions and access your funds.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Wallet Seed Phrase:</label>
          <textarea
            value={walletSeed}
            onChange={(e) => setWalletSeed(e.target.value)}
            placeholder="Enter your 25-word Monero seed phrase"
            className="w-full px-3 py-2 bg-[#232323] border border-orange-600 text-white text-sm font-mono focus:outline-none focus:border-orange-500 resize-vertical"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Encryption Password (min 8 characters):
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            className="w-full px-3 py-2 bg-[#232323] border border-orange-600 text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Confirm Password:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className="w-full px-3 py-2 bg-[#232323] border border-orange-600 text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>

        <button
          onClick={saveWallet}
          className="w-full px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-semibold"
        >
          Save Wallet Securely
        </button>
      </div>

      <div className="mt-4 bg-blue-900/20 border border-blue-600 p-3 text-xs text-gray-300">
        <strong>Note:</strong> Your wallet data is encrypted with your password and stored
        locally in your browser. XMRDirect never has access to your wallet or seed phrase.
      </div>

      {message && (
        <div
          className={`mt-4 p-3 text-sm ${
            message.includes("Error")
              ? "bg-red-900/20 border border-red-600"
              : "bg-green-900/20 border border-green-600"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default WalletManager;
