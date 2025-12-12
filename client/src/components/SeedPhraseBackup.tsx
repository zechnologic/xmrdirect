/**
 * Seed Phrase Backup Component
 *
 * Forces users to backup their 25-word seed phrase before continuing
 * Includes confirmation quiz to ensure they actually wrote it down
 */

import { useState } from "react";

interface SeedPhraseBackupProps {
  seed: string;
  onConfirmed: () => void;
}

export default function SeedPhraseBackup({ seed, onConfirmed }: SeedPhraseBackupProps) {
  const [hasWrittenDown, setHasWrittenDown] = useState(false);
  const [quizWord3, setQuizWord3] = useState("");
  const [quizWord7, setQuizWord7] = useState("");
  const [quizWord15, setQuizWord15] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [error, setError] = useState("");
  const [isBlurred, setIsBlurred] = useState(true);

  const words = seed.split(" ");

  const handleContinue = () => {
    if (!hasWrittenDown) {
      setError("Please confirm you have written down your seed phrase");
      return;
    }
    setShowQuiz(true);
    setError("");
  };

  const handleQuizSubmit = () => {
    // Validate quiz answers
    const correct3 = words[2]?.toLowerCase() === quizWord3.toLowerCase().trim();
    const correct7 = words[6]?.toLowerCase() === quizWord7.toLowerCase().trim();
    const correct15 = words[14]?.toLowerCase() === quizWord15.toLowerCase().trim();

    if (!correct3 || !correct7 || !correct15) {
      setError("Incorrect words. Please check your backup and try again.");
      return;
    }

    // Quiz passed!
    onConfirmed();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(seed);
    alert("Seed phrase copied to clipboard! Make sure to paste it somewhere safe.");
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2a2a2a] border-2 border-red-600 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8">

        {!showQuiz ? (
          <>
            {/* Warning Header */}
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-3xl font-bold text-red-500 mb-2">
                BACKUP YOUR SEED PHRASE
              </h2>
              <p className="text-gray-300 text-lg">
                This is your ONLY way to recover your wallet and funds
              </p>
            </div>

            {/* Critical Instructions */}
            <div className="bg-red-900/20 border border-red-600 p-4 mb-6 rounded">
              <h3 className="font-bold text-red-400 mb-2">⚠️ CRITICAL INSTRUCTIONS:</h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✍️ <strong>Write these 25 words on paper</strong> (in order)</li>
                <li>🔒 <strong>Store it in a secure location</strong> (safe, lockbox, etc.)</li>
                <li>❌ <strong>NEVER store it digitally</strong> (no photos, no cloud, no screenshots)</li>
                <li>🚫 <strong>We CANNOT recover it for you</strong> - it never touches our servers</li>
                <li>💰 <strong>Anyone with these words can steal your funds</strong></li>
              </ul>
            </div>

            {/* Seed Phrase Display */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-orange-400">Your 25-Word Seed Phrase:</h3>
                <button
                  onClick={() => setIsBlurred(!isBlurred)}
                  className="text-sm text-orange-600 hover:text-orange-500"
                >
                  {isBlurred ? "👁️ Show" : "👁️‍🗨️ Hide"}
                </button>
              </div>

              <div
                className={`bg-black/50 p-6 rounded border-2 border-orange-600 ${
                  isBlurred ? "blur-sm" : ""
                }`}
              >
                <div className="grid grid-cols-5 gap-4">
                  {words.map((word, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{index + 1}</div>
                      <div className="font-mono text-white font-semibold bg-gray-800 py-2 px-1 rounded">
                        {word}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                >
                  📋 Copy to Clipboard
                </button>
                <p className="text-xs text-gray-400">
                  Click "Show" to reveal your seed phrase
                </p>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="mb-6">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWrittenDown}
                  onChange={(e) => setHasWrittenDown(e.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <span className="text-gray-300">
                  <strong className="text-white">I have written down my 25-word seed phrase on paper</strong> and understand that:
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• I will lose access to my funds if I lose this seed phrase</li>
                    <li>• XMR Direct cannot recover it for me</li>
                    <li>• Anyone with this seed can steal my funds</li>
                  </ul>
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-600 p-3 mb-4 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleContinue}
              disabled={!hasWrittenDown}
              className="w-full px-6 py-4 bg-orange-600 text-white font-bold text-lg rounded hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Have Written It Down - Continue to Quiz
            </button>
          </>
        ) : (
          <>
            {/* Quiz Section */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-2xl font-bold text-orange-400 mb-2">
                Backup Verification Quiz
              </h2>
              <p className="text-gray-300">
                Enter the following words from your seed phrase to confirm you backed it up correctly
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Word #3:
                </label>
                <input
                  type="text"
                  value={quizWord3}
                  onChange={(e) => setQuizWord3(e.target.value)}
                  placeholder="Enter word #3"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white rounded focus:outline-none focus:border-orange-500"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Word #7:
                </label>
                <input
                  type="text"
                  value={quizWord7}
                  onChange={(e) => setQuizWord7(e.target.value)}
                  placeholder="Enter word #7"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white rounded focus:outline-none focus:border-orange-500"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Word #15:
                </label>
                <input
                  type="text"
                  value={quizWord15}
                  onChange={(e) => setQuizWord15(e.target.value)}
                  placeholder="Enter word #15"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-orange-600 text-white rounded focus:outline-none focus:border-orange-500"
                  autoComplete="off"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-600 p-3 mb-4 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowQuiz(false)}
                className="flex-1 px-6 py-3 bg-gray-700 text-white font-semibold rounded hover:bg-gray-600 transition-colors"
              >
                ← Back to Seed Phrase
              </button>
              <button
                onClick={handleQuizSubmit}
                disabled={!quizWord3 || !quizWord7 || !quizWord15}
                className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify & Continue →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
