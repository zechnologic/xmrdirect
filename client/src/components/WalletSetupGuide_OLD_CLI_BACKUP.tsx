import { useState } from "react";

interface WalletSetupGuideProps {
  tradeId: string;
  sessionId: string;
  currentPhase: "preparing" | "making" | "exchanging" | "ready";
  userRole: "buyer" | "seller";
  hasPrepared: boolean;
  hasMade: boolean;
  hasExchanged: boolean;
}

function WalletSetupGuide({
  tradeId,
  sessionId,
  currentPhase,
  userRole,
  hasPrepared,
  hasMade,
  hasExchanged,
}: WalletSetupGuideProps) {
  const [preparedHex, setPreparedHex] = useState("");
  const [madeHex, setMadeHex] = useState("");
  const [exchangeHex, setExchangeHex] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const participantId = userRole === "buyer" ? "user_a" : "user_b";
  const token = localStorage.getItem("token");

  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const submitPreparedHex = async () => {
    if (!preparedHex.trim()) {
      setMessage("Please enter your prepared hex");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://localhost:3000/multisig/${sessionId}/prepare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            preparedHex: preparedHex.trim(),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage("✓ Prepared hex submitted successfully! " + data.nextStep);
        setPreparedHex("");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage("Error: " + data.error);
      }
    } catch (error) {
      setMessage("Error submitting prepared hex: " + error);
    } finally {
      setLoading(false);
    }
  };

  const submitMadeHex = async () => {
    if (!madeHex.trim()) {
      setMessage("Please enter your made hex");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://localhost:3000/multisig/${sessionId}/make`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            madeHex: madeHex.trim(),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage("✓ Made hex submitted successfully! " + data.nextStep);
        setMadeHex("");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage("Error: " + data.error);
      }
    } catch (error) {
      setMessage("Error submitting made hex: " + error);
    } finally {
      setLoading(false);
    }
  };

  const submitExchangeHex = async () => {
    if (!exchangeHex.trim()) {
      setMessage("Please enter your exchange hex");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://localhost:3000/multisig/${sessionId}/exchange`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            participantId,
            exchangeHex: exchangeHex.trim(),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage("✓ Exchange hex submitted successfully! " + data.nextStep);
        setExchangeHex("");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage("Error: " + data.error);
      }
    } catch (error) {
      setMessage("Error submitting exchange hex: " + error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceHex = async (type: "prepared" | "made" | "exchange") => {
    try {
      const response = await fetch(
        `http://localhost:3000/trades/${tradeId}/service-${type}-hex`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      if (data.success) {
        const hexKey =
          type === "prepared"
            ? "servicePreparedHex"
            : type === "made"
            ? "serviceMadeHex"
            : "serviceExchangeHex";
        const hex = data[hexKey];

        if (hex) {
          navigator.clipboard.writeText(hex);
          setMessage(`✓ Service ${type} hex copied to clipboard!`);
        } else {
          setMessage(`Service ${type} hex not available yet`);
        }
      }
    } catch (error) {
      setMessage(`Error fetching service ${type} hex: ` + error);
    }
  };

  if (currentPhase === "ready") {
    return (
      <div className="bg-green-900/20 border-2 border-green-600 p-6">
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

        <div className="bg-green-950/50 border border-green-600 p-4 rounded">
          <p className="text-sm text-gray-300">
            <strong>Next steps:</strong> The seller can now deposit XMR to the escrow address. Keep your wallet accessible to sign transactions when needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#2a2a2a] border border-orange-600 p-6">
      <h3 className="text-xl font-semibold mb-4">Wallet Setup Guide</h3>

      {/* Phase 1: Prepare */}
      {currentPhase === "preparing" && (
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">1</div>
              <span className="font-semibold">Prepare Wallet</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center font-bold">2</div>
              <span>→</span>
              <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center font-bold">3</div>
            </div>
          </div>

          <div className="bg-orange-900/20 border-2 border-orange-600 p-6">
            <div className="flex items-start space-x-3 mb-4">
              <div className="text-3xl">💼</div>
              <div>
                <h4 className="font-bold text-lg mb-2">Create & Prepare Your Monero Wallet</h4>
                <p className="text-sm text-gray-300">
                  Follow these steps in your Monero wallet CLI to prepare for multisig escrow. This takes about 2-3 minutes.
                </p>
              </div>
            </div>

            {/* Step A: Create Wallet */}
            <div className="mb-6 bg-[#232323] border border-orange-600/50 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-orange-400">Step 1A: Create a New Wallet</h5>
                <span className="text-xs text-gray-400">~1 min</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Open your terminal and run this command to create a dedicated wallet for this trade:
              </p>
              <div className="relative">
                <div className="bg-black p-3 rounded font-mono text-sm overflow-x-auto">
                  monero-wallet-cli --generate-new-wallet my-trade-wallet-{tradeId.slice(0, 8)}
                </div>
                <button
                  onClick={() => copyCommand(`monero-wallet-cli --generate-new-wallet my-trade-wallet-${tradeId.slice(0, 8)}`, 'create')}
                  className="absolute top-2 right-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors"
                >
                  {copiedCommand === 'create' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                💡 Save your seed phrase! You'll need it to restore access to this wallet.
              </p>
            </div>

            {/* Step B: Prepare Multisig */}
            <div className="mb-6 bg-[#232323] border border-orange-600/50 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-orange-400">Step 1B: Prepare for Multisig</h5>
                <span className="text-xs text-gray-400">~30 sec</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                In your wallet, run this command:
              </p>
              <div className="relative">
                <div className="bg-black p-3 rounded font-mono text-sm">
                  prepare_multisig
                </div>
                <button
                  onClick={() => copyCommand('prepare_multisig', 'prepare')}
                  className="absolute top-2 right-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors"
                >
                  {copiedCommand === 'prepare' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 bg-blue-900/20 border border-blue-600 p-3 rounded text-sm text-gray-300">
                <strong>⚠️ Important:</strong> Copy the entire output hex string (starts with "MultisigV1..."). You'll paste it below.
              </div>
            </div>

            {/* Step C: Submit Hex */}
            <div className="border-t-2 border-orange-600/30 pt-6">
              <h5 className="font-semibold text-orange-400 mb-3">Step 1C: Submit Your Prepared Hex</h5>

              {!hasPrepared ? (
                <>
                  <p className="text-sm text-gray-300 mb-3">
                    Paste the hex output from step 1B here:
                  </p>
                  <textarea
                    value={preparedHex}
                    onChange={(e) => setPreparedHex(e.target.value)}
                    placeholder="MultisigV1... (paste your full prepared multisig hex here)"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white text-sm font-mono focus:outline-none focus:border-orange-500 resize-vertical rounded"
                    rows={5}
                  />
                  <button
                    onClick={submitPreparedHex}
                    disabled={loading || !preparedHex.trim()}
                    className="mt-3 w-full px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-bold text-lg rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "⏳ Submitting..." : "✓ Submit Prepared Hex"}
                  </button>
                </>
              ) : (
                <div className="bg-green-900/20 border-2 border-green-600 p-4 rounded">
                  <div className="flex items-center space-x-2 text-green-400 font-semibold">
                    <span className="text-2xl">✓</span>
                    <span>Prepared hex submitted successfully!</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">
                    Waiting for the other party to prepare their wallet...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="bg-gray-800 border border-gray-700 p-4 rounded text-xs">
            <details>
              <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white">
                ❓ Troubleshooting & Common Issues
              </summary>
              <div className="mt-3 space-y-2 text-gray-400">
                <p><strong>Command not found?</strong> Make sure Monero CLI is installed and in your PATH.</p>
                <p><strong>Invalid hex error?</strong> Ensure you copied the entire output including "MultisigV1".</p>
                <p><strong>Wallet already exists?</strong> Choose a different wallet name or delete the existing one.</p>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Phase 2: Make */}
      {currentPhase === "making" && (
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">2</div>
              <span className="font-semibold">Make Multisig</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center font-bold">3</div>
            </div>
          </div>

          <div className="bg-orange-900/20 border-2 border-orange-600 p-6">
            <div className="flex items-start space-x-3 mb-4">
              <div className="text-3xl">🔗</div>
              <div>
                <h4 className="font-bold text-lg mb-2">Create the Multisig Wallet</h4>
                <p className="text-sm text-gray-300">
                  Now combine the prepared hexes from all parties to create the actual multisig wallet. This takes about 1 minute.
                </p>
              </div>
            </div>

            {/* Step A: Get Other Party's Hex */}
            <div className="mb-6 bg-[#232323] border border-orange-600/50 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-orange-400">Step 2A: Get Other Participants' Hexes</h5>
                <span className="text-xs text-gray-400">~10 sec</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Click this button to get the service's prepared hex (the other party's hex will be fetched automatically):
              </p>
              <button
                onClick={() => fetchServiceHex("prepared")}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
              >
                📋 Copy Service Prepared Hex
              </button>
              <p className="text-xs text-gray-400 mt-2">
                💡 This hex will be copied to your clipboard. You'll use it in the next step.
              </p>
            </div>

            {/* Step B: Make Multisig */}
            <div className="mb-6 bg-[#232323] border border-orange-600/50 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-orange-400">Step 2B: Run Make Multisig Command</h5>
                <span className="text-xs text-gray-400">~30 sec</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                In your wallet CLI, run this command (replace &lt;service_hex&gt; and &lt;other_user_hex&gt; with the actual hex strings):
              </p>
              <div className="relative">
                <div className="bg-black p-3 rounded font-mono text-sm overflow-x-auto">
                  make_multisig &lt;service_hex&gt; &lt;other_user_hex&gt; 2
                </div>
                <button
                  onClick={() => copyCommand('make_multisig <service_hex> <other_user_hex> 2', 'make')}
                  className="absolute top-2 right-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors"
                >
                  {copiedCommand === 'make' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 bg-blue-900/20 border border-blue-600 p-3 rounded text-sm text-gray-300">
                <strong>⚠️ Important:</strong> Copy the entire output hex string (starts with "MultisigxV1..."). You'll paste it below.
              </div>
            </div>

            {/* Step C: Submit Made Hex */}
            <div className="border-t-2 border-orange-600/30 pt-6">
              <h5 className="font-semibold text-orange-400 mb-3">Step 2C: Submit Your Made Hex</h5>

              {!hasMade ? (
                <>
                  <p className="text-sm text-gray-300 mb-3">
                    Paste the hex output from step 2B here:
                  </p>
                  <textarea
                    value={madeHex}
                    onChange={(e) => setMadeHex(e.target.value)}
                    placeholder="MultisigxV1... (paste your full made multisig hex here)"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white text-sm font-mono focus:outline-none focus:border-orange-500 resize-vertical rounded"
                    rows={5}
                  />
                  <button
                    onClick={submitMadeHex}
                    disabled={loading || !madeHex.trim()}
                    className="mt-3 w-full px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-bold text-lg rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "⏳ Submitting..." : "✓ Submit Made Hex"}
                  </button>
                </>
              ) : (
                <div className="bg-green-900/20 border-2 border-green-600 p-4 rounded">
                  <div className="flex items-center space-x-2 text-green-400 font-semibold">
                    <span className="text-2xl">✓</span>
                    <span>Made hex submitted successfully!</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">
                    Waiting for the other party to make their multisig wallet...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="bg-gray-800 border border-gray-700 p-4 rounded text-xs">
            <details>
              <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white">
                ❓ Troubleshooting & Common Issues
              </summary>
              <div className="mt-3 space-y-2 text-gray-400">
                <p><strong>Error with hexes?</strong> Make sure you pasted all the hex strings correctly, including the full length.</p>
                <p><strong>Wrong number of participants?</strong> The "2" at the end specifies the threshold (2-of-3 multisig).</p>
                <p><strong>Wallet not in multisig mode?</strong> Make sure you completed Step 1 (prepare_multisig) first.</p>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Phase 3: Exchange */}
      {currentPhase === "exchanging" && (
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">✓</div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">3</div>
              <span className="font-semibold">Exchange Keys</span>
            </div>
          </div>

          <div className="bg-orange-900/20 border-2 border-orange-600 p-6">
            <div className="flex items-start space-x-3 mb-4">
              <div className="text-3xl">🔐</div>
              <div>
                <h4 className="font-bold text-lg mb-2">Final Step: Exchange Multisig Keys</h4>
                <p className="text-sm text-gray-300">
                  Almost done! Exchange keys with all parties to finalize the escrow wallet. This takes about 1 minute.
                </p>
              </div>
            </div>

            {/* Step A: Get Made Hexes */}
            <div className="mb-6 bg-[#232323] border border-orange-600/50 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-orange-400">Step 3A: Get Other Participants' Made Hexes</h5>
                <span className="text-xs text-gray-400">~10 sec</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                Click this button to get the service's made hex (the other party's hex will be fetched automatically):
              </p>
              <button
                onClick={() => fetchServiceHex("made")}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
              >
                📋 Copy Service Made Hex
              </button>
              <p className="text-xs text-gray-400 mt-2">
                💡 This hex will be copied to your clipboard. You'll use it in the next step.
              </p>
            </div>

            {/* Step B: Exchange Keys */}
            <div className="mb-6 bg-[#232323] border border-orange-600/50 p-4 rounded">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-orange-400">Step 3B: Run Exchange Keys Command</h5>
                <span className="text-xs text-gray-400">~30 sec</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                In your wallet CLI, run this command (replace &lt;service_made_hex&gt; and &lt;other_user_made_hex&gt; with the actual hex strings):
              </p>
              <div className="relative">
                <div className="bg-black p-3 rounded font-mono text-sm overflow-x-auto">
                  exchange_multisig_keys &lt;service_made_hex&gt; &lt;other_user_made_hex&gt;
                </div>
                <button
                  onClick={() => copyCommand('exchange_multisig_keys <service_made_hex> <other_user_made_hex>', 'exchange')}
                  className="absolute top-2 right-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors"
                >
                  {copiedCommand === 'exchange' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 bg-blue-900/20 border border-blue-600 p-3 rounded text-sm text-gray-300">
                <strong>⚠️ Note:</strong> If there are multiple exchange rounds, the command will output another hex. Copy it and paste below. If the wallet says "Wallet is fully signed", you can leave the field empty.
              </div>
            </div>

            {/* Step C: Submit Exchange Hex */}
            <div className="border-t-2 border-orange-600/30 pt-6">
              <h5 className="font-semibold text-orange-400 mb-3">Step 3C: Submit Exchange Hex (if applicable)</h5>

              {!hasExchanged ? (
                <>
                  <p className="text-sm text-gray-300 mb-3">
                    If the command outputs an exchange hex, paste it here. Otherwise, submit an empty field to mark completion:
                  </p>
                  <textarea
                    value={exchangeHex}
                    onChange={(e) => setExchangeHex(e.target.value)}
                    placeholder="MultisigxV1... (paste exchange hex if there's another round, or leave empty if wallet is fully signed)"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white text-sm font-mono focus:outline-none focus:border-orange-500 resize-vertical rounded"
                    rows={5}
                  />
                  <button
                    onClick={submitExchangeHex}
                    disabled={loading}
                    className="mt-3 w-full px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 transition-colors font-bold text-lg rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "⏳ Submitting..." : "✓ Submit & Complete"}
                  </button>
                </>
              ) : (
                <div className="bg-green-900/20 border-2 border-green-600 p-4 rounded">
                  <div className="flex items-center space-x-2 text-green-400 font-semibold">
                    <span className="text-2xl">✓</span>
                    <span>Exchange hex submitted successfully!</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">
                    Waiting for the other party to complete key exchange...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="bg-gray-800 border border-gray-700 p-4 rounded text-xs">
            <details>
              <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white">
                ❓ Troubleshooting & Common Issues
              </summary>
              <div className="mt-3 space-y-2 text-gray-400">
                <p><strong>How many rounds?</strong> Usually 2-of-3 multisig needs 1-2 exchange rounds. Keep repeating until wallet is fully signed.</p>
                <p><strong>"Wallet already signed"?</strong> Your wallet might be complete! Submit an empty field to proceed.</p>
                <p><strong>Error with hexes?</strong> Make sure you used the "made" hexes, not the "prepared" hexes from step 1.</p>
              </div>
            </details>
          </div>
        </div>
      )}

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

export default WalletSetupGuide;
