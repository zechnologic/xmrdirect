import { Link } from "react-router";
import Layout from "../components/Layout";

function HowItWorks() {
  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-16 bg-[#232323] text-gray-300">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-bold text-5xl uppercase text-orange-600 mb-8">
            How It Works
          </h1>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              2-of-3 Multisig Escrow
            </h2>
            <p className="text-lg mb-4">
              XMR Direct uses <span className="text-orange-400 font-semibold">2-of-3 multisignature wallets</span> for trustless escrow.
              This means three parties each hold one key, and any two of the three keys can authorize a transaction.
            </p>
            <div className="bg-[#2a2a2a] border border-orange-600/30 p-6 rounded">
              <h3 className="font-semibold text-xl text-orange-400 mb-3">The 3 Participants:</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">1.</span>
                  <span><strong className="text-white">Buyer</strong> - Creates wallet locally on their device</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">2.</span>
                  <span><strong className="text-white">Seller</strong> - Creates wallet locally on their device</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">3.</span>
                  <span><strong className="text-white">XMR Direct</strong> - Acts as neutral coordinator</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              We Never Hold Your Keys
            </h2>
            <p className="text-lg mb-4">
              Unlike traditional exchanges, <span className="text-orange-400 font-semibold">we never have custody of your funds</span>.
              You create your wallet locally on your device, and only send coordination data to our servers.
            </p>
            <div className="bg-[#2a2a2a] border border-green-600/30 p-6 rounded mb-4">
              <h3 className="font-semibold text-lg text-green-400 mb-2">✓ Safe to send (coordination data):</h3>
              <ul className="ml-4 space-y-1 font-mono text-sm text-gray-400">
                <li>• preparedHex</li>
                <li>• madeHex</li>
                <li>• exchangeHex</li>
              </ul>
              <p className="mt-2 text-sm">These are public multisig coordination strings. They do NOT contain your private keys.</p>
            </div>
            <div className="bg-[#2a2a2a] border border-red-600/30 p-6 rounded">
              <h3 className="font-semibold text-lg text-red-400 mb-2">✗ NEVER sent to server:</h3>
              <ul className="ml-4 space-y-1 font-mono text-sm text-gray-400">
                <li>• 25-word seed phrase</li>
                <li>• Private spend key</li>
                <li>• Private view key</li>
              </ul>
              <p className="mt-2 text-sm">Your private keys stay on your device. Period.</p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              The Trading Process
            </h2>
            <div className="space-y-6">
              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Step 1: Buyer & Seller Agree</h3>
                <p>Both parties agree on trade details: amount, price, payment method.</p>
              </div>
              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Step 2: Create Multisig Wallet</h3>
                <p>
                  All three parties coordinate to create a 2-of-3 multisig wallet.
                  The seller deposits XMR into this shared escrow address.
                </p>
              </div>
              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Step 3: Buyer Sends Payment</h3>
                <p>
                  Buyer sends fiat payment directly to seller via their agreed method
                  (bank transfer, cash, PayPal, etc.).
                </p>
              </div>
              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Step 4: Release Escrow</h3>
                <p>
                  Once payment is confirmed, buyer + service (or seller + service) sign
                  the transaction to release XMR to the buyer. Trade complete!
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              What If Something Goes Wrong?
            </h2>
            <div className="bg-[#2a2a2a] border border-orange-600/30 p-6 rounded space-y-4">
              <div>
                <h3 className="font-semibold text-lg text-orange-400 mb-2">Dispute Resolution</h3>
                <p>
                  If there's a dispute, XMR Direct acts as mediator. We review evidence
                  from both parties and sign with the party we determine is in the right.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-orange-400 mb-2">Service Goes Offline?</h3>
                <p>
                  No problem! Since it's 2-of-3, the buyer and seller can still sign
                  transactions together without XMR Direct. Your funds are never trapped.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-orange-400 mb-2">Service Tries to Steal?</h3>
                <p>
                  Impossible. We only hold 1 of 3 keys and can't move funds without
                  cooperation from either the buyer or seller.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              Your Backup Responsibility
            </h2>
            <div className="bg-red-900/20 border border-red-600 p-6 rounded">
              <p className="text-lg mb-4">
                <span className="text-red-400 font-bold">⚠️ CRITICAL:</span> You are responsible for backing up your wallet data.
              </p>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-white mb-1">1. Write Down Your Seed Phrase</h4>
                  <p className="text-sm">
                    When you create your wallet, you'll see 25 words. Write them on paper
                    and store them safely. This is the ONLY way to recover your wallet.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">2. Download Backup File</h4>
                  <p className="text-sm">
                    After multisig setup, download your backup file for extra security.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">3. We Cannot Help You</h4>
                  <p className="text-sm">
                    If you lose your seed phrase and backup, your wallet is gone forever.
                    We do not have access to your keys and cannot recover them.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              Why This Is Better
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-[#2a2a2a] p-6 rounded border border-orange-600/20">
                <h3 className="font-semibold text-lg text-orange-400 mb-2">🔒 No KYC Required</h3>
                <p className="text-sm">
                  Since we never hold your funds, we're not a custodian and don't need
                  to collect your identity information.
                </p>
              </div>
              <div className="bg-[#2a2a2a] p-6 rounded border border-orange-600/20">
                <h3 className="font-semibold text-lg text-orange-400 mb-2">🛡️ Maximum Security</h3>
                <p className="text-sm">
                  Your private keys never leave your device. Even if we get hacked,
                  your funds are safe.
                </p>
              </div>
              <div className="bg-[#2a2a2a] p-6 rounded border border-orange-600/20">
                <h3 className="font-semibold text-lg text-orange-400 mb-2">🌍 True P2P</h3>
                <p className="text-sm">
                  Trades happen directly between users. Any payment method, any currency,
                  anywhere in the world.
                </p>
              </div>
              <div className="bg-[#2a2a2a] p-6 rounded border border-orange-600/20">
                <h3 className="font-semibold text-lg text-orange-400 mb-2">💰 Lower Fees</h3>
                <p className="text-sm">
                  Maximum 0.5% per trade. No withdrawal fees, no deposit fees, no hidden costs.
                </p>
              </div>
            </div>
          </section>

          <div className="text-center mt-12">
            <Link to="/signup">
              <button className="px-8 py-4 text-white text-lg font-semibold bg-orange-600 hover:bg-orange-700 transition-colors cursor-pointer">
                Get Started
              </button>
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              Questions? Check out our{" "}
              <a href="https://github.com/yourusername/xmrdirect" className="text-orange-500 hover:text-orange-400">
                GitHub
              </a>{" "}
              or read the{" "}
              <Link to="/" className="text-orange-500 hover:text-orange-400">
                documentation
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default HowItWorks;
