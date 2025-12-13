import Layout from "../components/Layout";

function Privacy() {
  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-16 bg-[#232323] text-gray-300">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-bold text-5xl uppercase text-orange-600 mb-8">
            Privacy Policy
          </h1>

          <div className="bg-[#2a2a2a] border border-orange-600/30 p-8 rounded mb-8">
            <h2 className="font-bold text-3xl text-orange-500 mb-6">
              TL;DR: We don't track shit.
            </h2>
            <p className="text-lg mb-4">
              No analytics. No cookies. No tracking pixels. No third-party surveillance nonsense.
            </p>
            <p className="text-lg">
              We're here to facilitate P2P XMR trades, not to build a dossier on you.
            </p>
          </div>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              What We Store
            </h2>
            <div className="space-y-6">
              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Login Information</h3>
                <p className="mb-2">
                  We store your username and hashed password (bcrypt). That's it.
                </p>
                <p className="text-sm text-gray-400">
                  No email. No phone number. No real name. Just what you need to log in.
                </p>
              </div>

              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Trade Details (Temporary)</h3>
                <p className="mb-2">
                  During an active trade, we store the multisig coordination data and trade status.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-orange-400 font-semibold">This gets wiped when the trade completes.</span> We don't
                  keep a history of who traded what with whom.
                </p>
              </div>

              <div className="bg-[#2a2a2a] border-l-4 border-orange-600 p-6">
                <h3 className="font-semibold text-xl text-white mb-2">Reputation Stats</h3>
                <p className="mb-2">
                  We track your completed trade count and ratings so other users know if you're trustworthy.
                </p>
                <p className="text-sm text-gray-400">
                  This is public info visible on your profile. No transaction amounts, no dates, just stats.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              What We Don't Store
            </h2>
            <div className="bg-red-900/20 border border-red-600 p-6 rounded space-y-4">
              <ul className="space-y-3 text-lg">
                <li className="flex items-start">
                  <span className="text-red-400 mr-3 text-2xl">✗</span>
                  <span><strong className="text-white">IP addresses</strong> - We don't log them</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-3 text-2xl">✗</span>
                  <span><strong className="text-white">Browser fingerprints</strong> - Not interested</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-3 text-2xl">✗</span>
                  <span><strong className="text-white">Analytics data</strong> - No Google Analytics, no nothing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-3 text-2xl">✗</span>
                  <span><strong className="text-white">Trade history details</strong> - Deleted when trade completes</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-3 text-2xl">✗</span>
                  <span><strong className="text-white">Your wallet keys</strong> - They never leave your device</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              Why So Minimal?
            </h2>
            <div className="bg-[#2a2a2a] border border-orange-600/30 p-6 rounded">
              <p className="text-lg mb-4">
                Because we believe in <span className="text-orange-400 font-semibold">financial privacy</span>.
                The whole point of Monero is untraceable transactions. It would be pretty hypocritical to
                surveil our users while they're trading privacy coins, wouldn't it?
              </p>
              <p className="text-lg mb-4">
                Plus, storing less data means there's less to leak if we ever get hacked.
                <span className="text-orange-400 font-semibold"> We can't lose what we don't have.</span>
              </p>
              <p className="text-lg">
                We're not here to build a surveillance empire. We're here to help people trade XMR peer-to-peer. That's it.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              Third Parties
            </h2>
            <div className="bg-[#2a2a2a] p-6 rounded">
              <p className="text-lg mb-4">
                We don't share your data with anyone. There are no "analytics partners" or "marketing affiliates"
                because we don't do any of that bullshit.
              </p>
              <p className="text-lg">
                The only external service we interact with is the Monero blockchain (obviously).
                That's public and pseudonymous by design.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              Law Enforcement Requests
            </h2>
            <div className="bg-[#2a2a2a] border border-yellow-600/30 p-6 rounded">
              <p className="text-lg mb-4">
                If we get a legal request, we can only provide what we actually have:
                usernames and reputation stats. That's it.
              </p>
              <p className="text-lg">
                We can't provide trade history (we delete it), we can't provide IPs (we don't log them),
                and we definitely can't provide wallet keys (we never had them).
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-3xl text-orange-500 mb-4">
              Questions?
            </h2>
            <div className="bg-[#2a2a2a] p-6 rounded">
              <p className="text-lg mb-4">
                This is an open-source project. Want to verify we're actually doing what we claim?
                Check the source code.
              </p>
              <p className="text-lg">
                If you have concerns or questions about privacy, open an issue on our GitHub repo.
              </p>
            </div>
          </section>

          <div className="text-center text-sm text-gray-500 mt-12 pt-8 border-t border-gray-700">
            <p>Last updated: December 2024</p>
            <p className="mt-2">We reserve the right to update this policy, but our core principles won't change:
            minimal data collection, maximum privacy.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Privacy;
