# XMR Direct

Non-custodial peer-to-peer Monero trading platform using browser-based cryptography and 2-of-3 multisig escrow.

## Overview

XMR Direct enables direct trading between users without custodial control of funds. All private key operations occur locally in the user's browser using WebAssembly. The platform coordinates public multisig setup data between parties but cannot access user funds or private keys.

### Key Features

- **Non-custodial escrow** using 2-of-3 multisig wallets
- **Browser-based cryptography** via monero-ts WebAssembly
- **0.5% maximum fee** per trade
- **Privacy-focused** architecture with no KYC requirements
- **Global trading** with any payment method

## Tech Stack

**Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + React Router
**Backend:** Express + TypeScript + monero-ts + SQLite (better-sqlite3)
**Network:** Currently configured for STAGENET testing

### Network Configuration

Switch between STAGENET and MAINNET by setting the `MONERO_NETWORK` environment variable:

```bash
# .env (server)
MONERO_NETWORK=stagenet  # or mainnet

# client/.env
VITE_MONERO_NETWORK=stagenet  # or mainnet
```

**Network Settings:**
- **STAGENET**: Uses `http://node.monerodevs.org:38089`, requires 2 confirmations
- **MAINNET**: Uses `http://node.sethforprivacy.com:18089`, requires 10 confirmations

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

### Security Model

All private key operations are performed client-side using monero-ts WebAssembly. Keys are generated locally using the browser's cryptographic random number generator and never transmitted to the server.

**Key Generation:**
```javascript
const wallet = await moneroTs.createWalletFull({
  password: "your-password",
  networkType: moneroTs.MoneroNetworkType.MAINNET,
});
```

**Server Communication:**

Only public multisig coordination data is transmitted:
```javascript
{
  preparedHex: "MultisigV1...",
  madeHex: "MultisigxV1...",
  exchangeHex: "MultisigxV1..."
}
```

Private keys, seed phrases, and view keys remain in browser memory and are never sent to the server. The coordination data is derived using one-way cryptographic functions and cannot be used to reconstruct private keys.

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

### Wallet Management

**Convenience Mode:**
- Seed phrase encrypted client-side with user password
- Encrypted seed stored on backend for session recovery
- AES-256 encryption, password never sent to server

**Paranoid Mode:**
- No seed storage on server
- Manual seed backup required
- Session recovery via localStorage only

**Edge Cases:**
- User disconnects: Multisig state saved in database, can resume
- Stale outputs: Auto-refresh and retry
- Non-signing party: Escalate to dispute after timeout, platform arbitrates

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

Users must backup:
1. **25-word seed phrase** - required for wallet recovery
2. **Multisig coordination data** - exported as JSON after setup
3. **localStorage** - optional convenience, not reliable for long-term storage

Recovery options:
- Seed phrase (always works)
- JSON backup file
- localStorage (same device/browser only)

### Trust Model

The platform holds 1 of 3 multisig keys for arbitration. Users trust the platform to:
- Coordinate multisig setup correctly
- Act as neutral arbitrator in disputes
- Not collude with either party

The platform cannot:
- Access user private keys or seed phrases
- Unilaterally move funds (requires 2 of 3 signatures)
- Prevent buyer and seller from recovering funds together

If the platform becomes unavailable, buyer and seller can still sign transactions using their 2 keys.

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
