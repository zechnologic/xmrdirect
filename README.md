# XMR Direct

**🔒 100% Non-Custodial P2P Monero Trading**

**All cryptography happens IN YOUR BROWSER. We NEVER see your private keys.**

Unlike other platforms, XMR Direct uses **browser-based Monero wallets** (powered by WebAssembly). Your private keys are generated locally on your device and **never leave your browser**. We only coordinate public multisig setup data between parties.

**How It Works:**
- 🔐 Your browser generates your wallet keys (via monero-ts WebAssembly)
- 📡 Our server **only relays PUBLIC coordination data** between buyer, seller, and arbitrator
- ✅ We **cannot** access your funds (we only hold 1 of 3 keys)
- ✅ Buyer + Seller can **always** recover funds together (2-of-3 multisig)

**This is the same model LocalMonero used** - proven, battle-tested, truly non-custodial.

---

## Why XMR Direct?

**Real Peer-to-Peer Trading**
Trades occur directly between users' wallets. No intermediary custody means no complex compliance requirements and no identity submission.

**Privacy & Security First**
Unlike traditional P2P platforms, we never hold your funds. This unique approach provides maximum security and preserves your privacy.

**Lower Fees**
Maximum 0.5% per trade. No hidden costs.

**Trade Anywhere**
Global trading with any payment method, any currency, any location.

## Tech Stack

**Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + React Router
**Backend:** Express + TypeScript + monero-ts + SQLite (better-sqlite3)
**Monero Node:** http://node.sethforprivacy.com:18089 (MAINNET)

## Market Position & Differentiation

### How XMR Direct Differentiates
1. **Lower Fees**: 0.5% vs SecureSwap's 1%
2. **User Choice**: Convenience Mode OR Paranoid Mode (encrypted seed storage optional)
3. **Open Source**: Fully auditable client-side encryption
4. **Better UX**: Simpler than Haveno, more transparent than SecureSwap
5. **Pure Monero Focus**: Built specifically for XMR, not Bitcoin-first

### Inspiration
XMR Direct follows the proven Hodl Hodl model (2-of-3 multisig, non-custodial) adapted for Monero's privacy-first ecosystem. We combine SecureSwap's practical workflow with additional transparency and user control options.

## Multisig Architecture

### How It Works: 2-of-3 Multisig

XMR Direct uses **2-of-3 multisig wallets** for escrow. This means:
- 3 participants each hold 1 key
- Any 2 of the 3 keys can sign transactions
- No single party has full control of funds

**The 3 Participants:**
1. **Buyer** - creates wallet locally on their device
2. **Seller** - creates wallet locally on their device
3. **Service** (XMR Direct) - creates wallet on the server

### Security Model: Browser-Based Cryptography (LocalMonero Model)

**Critical:** XMR Direct follows the **exact same architecture as LocalMonero** - all private key operations happen in your browser using WebAssembly.

#### How Browser-Based Wallets Work

**1. Key Generation (100% Local)**
```javascript
// This runs IN YOUR BROWSER using monero-ts WebAssembly:
const wallet = await moneroTs.createWalletFull({
  password: "your-password",
  networkType: moneroTs.MoneroNetworkType.MAINNET,
  // Private key generated locally - never leaves browser
});

// Your browser creates:
private_key = secureRandom256Bits()  // Generated locally
public_key = private_key * G          // Elliptic curve math in browser
```

**Your private keys NEVER touch our servers.**

#### What Actually Gets Sent to the Server

**2. Multisig Coordination (Public Data Only)**
```javascript
// ✅ SAFE - Public multisig setup info (sent to server):
{
  preparedHex: "MultisigV1...",     // Public multisig prep data
  madeHex: "MultisigxV1...",        // Public multisig made data
  exchangeHex: "MultisigxV1..."     // Public key exchange data
}

// ❌ NEVER sent to server - stays in browser memory:
wallet.getSeed()                    // 25-word seed phrase
wallet.getPrivateSpendKey()         // Private spend key
wallet.getPrivateViewKey()          // Private view key
wallet.getPrivateKeys()             // Any private key material
```

**The hex strings we relay are PUBLIC coordination info** - they contain zero information about your private keys. This is cryptographically equivalent to sharing your public Monero address.

#### Why This Is Non-Custodial

**Server's Role:** Pure coordinator/message relay
- We relay PUBLIC hex strings between the 3 parties
- We hold 1 of 3 keys (generated on our server for arbitration)
- We **cannot** reconstruct or access user private keys from coordination data

**Mathematical Impossibility:**
- Multisig coordination data is derived using one-way cryptographic functions
- Private keys → Public coordination data (easy)
- Public coordination data → Private keys (**impossible** without breaking elliptic curve cryptography)

**This is identical to how hardware wallets work:**
- Your Ledger/Trezor does crypto locally
- Your computer only sees public transaction data
- Ledger never sends private keys to your computer
- **Same principle, browser instead of hardware device**

### User Experience: No CLI Required

**Simple Button Clicks** (powered by browser WebAssembly):

1. **Click "Start Trade"** → Your browser generates wallet keys locally
2. **Click "Prepare Multisig"** → Browser creates coordination data, sends to server
3. **Wait for other party** → Server notifies when they're ready
4. **Click "Finalize Setup"** → Browser completes multisig coordination
5. **Done!** → Escrow wallet ready, seller can deposit

**Behind the scenes (all in browser):**
- monero-ts WebAssembly loads and initializes
- Cryptographic operations run using browser's secure random number generator
- Keys stored encrypted in browser memory/IndexedDB
- Only PUBLIC hex data transmitted to server

**No terminal commands. No copy-pasting. Just buttons.**

---

### Multisig Setup Flow (Technical Detail)

The service coordinates 4 phases:

**Phase 1: Create Session**
- Service creates its own wallet and prepares multisig
- Returns `sessionId` and `servicePreparedHex`
- DB tracks session state

**Phase 2: Prepare** (`POST /multisig/:sessionId/prepare`)
- Buyer creates wallet locally, runs `prepareMultisig()`
- Seller creates wallet locally, runs `prepareMultisig()`
- Both submit their `preparedHex` to service
- When all 3 prepared hexes collected → status: "making"

**Phase 3: Make Multisig** (`POST /multisig/:sessionId/make`)
- Each participant runs `makeMultisig([otherHexes], 2, password)`
- All 3 submit their `madeHex`
- When all 3 collected → status: "exchanging"

**Phase 4: Exchange Keys** (`POST /multisig/:sessionId/exchange`)
- For 2-of-3: Need 2 rounds of key exchange (N - M + 1 = 2)
- Each participant runs `exchangeMultisigKeys()`
- After 2 complete rounds → status: "ready"
- Multisig wallet is now active and can receive/send funds

### Transaction Flow (After Multisig Setup)

Once the multisig wallet is ready, here's how funds move:

**Phase 5: Deposit** (`status: "funded"`)
- Seller deposits XMR into the multisig address
- Wait for 10 confirmations
- All parties can verify deposit on blockchain

**Phase 6: Export Outputs** (Service coordination)
- Service wallet runs `exportOutputs()`
- Outputs sent to buyer and seller clients
- Buyer/Seller import: `wallet.importOutputs(outputs)`
- This syncs everyone's wallet state

**Phase 7: Create Unsigned Transaction** (Service creates)
- Service creates unsigned transaction:
  - Destination: Buyer's address
  - Amount: Deposit minus 0.5% fee
  - Fee: XMR network fee
- Service returns unsigned tx hex to both parties

**Phase 8: Signing Process** (`POST /multisig/:sessionId/sign`)
- Buyer confirms fiat payment sent → signs transaction
  - `wallet.signMultisigTxHex(unsignedTxHex)`
- Seller confirms fiat received → signs transaction
  - `wallet.signMultisigTxHex(unsignedTxHex)`
- Need 2 of 3 signatures to complete

**Phase 9: Submit Transaction** (Service submits)
- Once 2 signatures collected, service submits:
  - `wallet.submitMultisigTxHex(signedTxHex)`
- Returns tx hash
- Status: "completed"

**Dispute Resolution:**
If buyer and seller disagree:
- Service reviews evidence (payment proof, chat logs, etc.)
- Service signs with the party determined to be correct
- 2 of 3 signatures achieved → transaction submits

### Wallet Management Approaches

**Two modes for user wallet storage:**

#### Convenience Mode (Recommended for most users)
- User creates wallet in browser using monero-ts
- Seed phrase encrypted CLIENT-SIDE with user's password
- Encrypted seed stored on backend for session recovery
- User can resume trades without re-creating wallet
- **Tradeoff:** Trust that encryption is client-side and password is strong

**Security measures:**
- All encryption/decryption code is open source
- Password never sent to server (only used client-side)
- Encrypted seeds use strong encryption (AES-256)
- Users can export encrypted seed themselves
- Optional: Add 2FA for seed decryption

#### Paranoid Mode (Maximum security)
- User creates wallet locally (browser or desktop)
- NO seed storage on server
- User must backup seed phrase manually
- Session recovery via localStorage only
- Can reconnect by importing seed phrase

**Best practice:** Offer both modes, let users choose based on their needs:
- Small amounts / convenience → Convenience Mode
- Large amounts / maximum privacy → Paranoid Mode

### Handling Edge Cases

**User Disconnects Mid-Process:**
- Save multisig state in database
- User can resume when they return
- If using Convenience Mode: decrypt seed and restore wallet
- If using Paranoid Mode: user re-imports seed

**Stale Output Data:**
- If one user delays signing, outputs may become stale
- Auto-refresh: re-export outputs and retry
- Notify users to complete signing within timeframe

**One Party Never Signs:**
- After timeout (e.g., 24 hours), escalate to dispute
- Service reviews and signs with appropriate party
- Or: Buyer + Seller can coordinate externally (2-of-3 works without service)

### Database Schema

**Table: `multisig_sessions`**
```sql
- id (session identifier)
- status ('preparing' | 'making' | 'exchanging' | 'ready')
- threshold (2 for 2-of-3)
- total_participants (3)
- service_wallet_path (filesystem path to service wallet)
- service_address
- service_prepared_hex, user_a_prepared_hex, user_b_prepared_hex
- service_made_hex, user_a_made_hex, user_b_made_hex
- exchange_round (0, 1, 2...)
- service_exchange_hexes, user_a_exchange_hexes, user_b_exchange_hexes
- multisig_address (shared address for all participants)
- created_at, updated_at
```

The "waiting room" UX is just clients polling `GET /multisig/:sessionId` to check when `status` changes.

### User Backup Requirements

**CRITICAL: Users MUST backup their wallet data or funds can be lost forever.**

#### What Users Must Backup:

1. **25-word Seed Phrase** (MOST IMPORTANT)
   - This is the master key to recover their wallet
   - Must be written on paper and stored securely
   - Service NEVER sees this
   - Without it, wallet cannot be recovered

2. **Multisig Info** (after setup complete)
   - Export multisig coordination data
   - Needed to participate in signing
   - Can be downloaded as JSON backup file

3. **localStorage** (convenience only)
   - Encrypted wallet data stored in browser
   - Quick access on same device
   - NOT reliable (can be cleared)
   - NOT a backup strategy

#### Recommended Client UX Flow:

```
1. User creates wallet locally
   ↓
2. STOP - Show seed phrase screen:
   "⚠️ BACKUP YOUR SEED PHRASE ⚠️
    Write these 25 words on paper.
    If you lose these, you lose access forever.
    We CANNOT recover them for you."
   [Display 25 words]
   ☑️ I have written down my seed phrase
   [Quiz: Enter words 3, 7, and 15]
   ↓
3. After multisig setup complete:
   "✅ Multisig created!"
   [Download Backup File] button
   ↓
4. Store encrypted data in localStorage for convenience
```

#### Recovery Options:

Users can restore from:
- Seed phrase (25 words) - always works
- Backup file (JSON download) - if they saved it
- localStorage - only on same device/browser

### Trust Model

**What users trust:**
- The service will coordinate multisig setup correctly
- The service won't collude with one party against the other
- The service's 1 key + either buyer or seller = can move funds

**What users DON'T need to trust:**
- The service to hold their funds (they don't)
- The service to see their private keys (it can't)
- The service's website code (can self-host client in future)

**Protection against service going rogue:**
- Service only has 1 of 3 keys
- Needs cooperation from buyer OR seller
- Cannot unilaterally take funds

**Protection if service disappears:**
- Buyer + Seller can still sign transactions together
- 2-of-3 means any 2 parties can recover funds
- No dependency on service staying online forever

### Open Source & Auditability

**Future improvements for maximum trust:**
- Open source the client wallet code
- Offer downloadable desktop app (Electron/Tauri)
- Browser extension option
- Self-hostable client that talks to our API
- Users can audit: "Does this client send my seed to the server?" (No)

## Getting Started

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Run development servers
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

## Project Structure

```
xmrdirect/
├── client/          # React frontend
│   ├── src/
│   │   ├── page/    # Login, Signup, Home
│   │   └── components/
├── server/          # Express backend
│   └── src/
└── dist/            # Build output
```

## Features

- Anonymous accounts (username only, no email)
- Dark theme with orange accents
- Monero integration ready (monero-ts)
- Non-custodial architecture

---

**Privacy-first cryptocurrency trading.**
