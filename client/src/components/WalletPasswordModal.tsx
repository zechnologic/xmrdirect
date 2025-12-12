/**
 * Wallet Password Modal
 *
 * Gets password from user for wallet encryption
 * Shows security information and storage options
 */

import { useState } from "react";

interface WalletPasswordModalProps {
  title: string;
  mode: "create" | "restore";
  onSubmit: (password: string, shouldStore: boolean) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function WalletPasswordModal({
  title,
  mode,
  onSubmit,
  onCancel,
  loading = false,
}: WalletPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [shouldStore, setShouldStore] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const getPasswordStrength = (pwd: string): { strength: string; color: string } => {
    if (pwd.length === 0) return { strength: "", color: "" };
    if (pwd.length < 8) return { strength: "Weak", color: "text-red-500" };
    if (pwd.length < 12) return { strength: "Medium", color: "text-yellow-500" };
    if (pwd.length < 16) return { strength: "Good", color: "text-green-500" };
    return { strength: "Strong", color: "text-green-400" };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = () => {
    setError("");

    // Validate password
    if (!password) {
      setError("Password is required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (mode === "create" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    onSubmit(password, shouldStore);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2a2a2a] border-2 border-orange-600 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-sm text-gray-400">
            {mode === "create"
              ? "Create a strong password to encrypt your wallet"
              : "Enter your password to decrypt your wallet"}
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-900/20 border border-blue-600 p-4 mb-6 rounded text-sm">
          <div className="font-semibold text-blue-400 mb-2">🔒 Security Notice:</div>
          <ul className="text-gray-300 space-y-1 text-xs">
            <li>• Your password <strong>NEVER</strong> leaves your browser</li>
            <li>• Used to encrypt your wallet locally</li>
            <li>• We cannot recover your password if you forget it</li>
            <li>• Always keep your seed phrase as backup</li>
          </ul>
        </div>

        {/* Password Input */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Password:
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white rounded focus:outline-none focus:border-orange-500 pr-24"
              autoFocus
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-orange-600 hover:text-orange-500 px-2"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {mode === "create" && password && (
            <div className={`text-xs mt-1 ${passwordStrength.color}`}>
              Strength: {passwordStrength.strength}
            </div>
          )}
        </div>

        {/* Confirm Password (create mode only) */}
        {mode === "create" && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Confirm Password:
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Re-enter password"
              className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white rounded focus:outline-none focus:border-orange-500"
              disabled={loading}
            />
            {confirmPassword && password !== confirmPassword && (
              <div className="text-xs text-red-500 mt-1">Passwords do not match</div>
            )}
          </div>
        )}

        {/* Storage Option */}
        <div className="mb-6">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shouldStore}
              onChange={(e) => setShouldStore(e.target.checked)}
              className="mt-1 w-4 h-4"
              disabled={loading}
            />
            <div className="text-sm">
              <div className="text-white font-semibold mb-1">
                Store encrypted wallet locally
              </div>
              <div className="text-gray-400 text-xs">
                Wallet will be encrypted with your password and stored in your browser.
                You can resume this trade later without re-entering your seed phrase.
              </div>
            </div>
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-600 p-3 mb-4 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gray-700 text-white font-semibold rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              !password ||
              (mode === "create" && password !== confirmPassword)
            }
            className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ Processing..." : mode === "create" ? "Create Wallet" : "Unlock Wallet"}
          </button>
        </div>

        {/* Additional Help */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>
            {mode === "create"
              ? "Make sure to backup your seed phrase after creating your wallet"
              : "Need help? Make sure you're entering the correct password"}
          </p>
        </div>
      </div>
    </div>
  );
}
