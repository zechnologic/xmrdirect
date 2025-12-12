# Browser-Based Wallet Implementation Plan

**Goal:** Convert from CLI-based wallet operations to fully browser-based key generation and multisig coordination (LocalMonero model).

---

## 🏗️ Architecture Overview

### Current State (CLI-based)
- Users run `monero-wallet-cli` locally
- Users manually copy-paste hex strings into web forms
- Server coordinates multisig setup
- Still non-custodial but poor UX

### Target State (Browser-based)
- Users click buttons → browser handles everything
- monero-ts WebAssembly runs in browser
- Keys generated locally, never sent to server
- Server only relays PUBLIC multisig hex data
- Same non-custodial security, 100x better UX

---

## 📋 Implementation Steps

### Phase 1: Browser Wallet Service (Foundation)
**Files to create:**
- `client/src/services/moneroWallet.ts` - WebAssembly wallet wrapper
- `client/src/hooks/useMoneroWallet.ts` - React hook for wallet state

**Tasks:**
1. Initialize monero-ts WebAssembly in browser
2. Handle async WASM module loading
3. Create wallet generation functions
4. Implement multisig operations (prepare/make/exchange)
5. Add wallet encryption for localStorage/IndexedDB

**Key functions:**
```typescript
// client/src/services/moneroWallet.ts
export class BrowserMoneroWallet {
  async initialize(): Promise<void>
  async createWallet(password: string): Promise<WalletInfo>
  async prepareMultisig(): Promise<string>  // Returns preparedHex
  async makeMultisig(otherHexes: string[], threshold: number): Promise<string>
  async exchangeMultisigKeys(otherHexes: string[]): Promise<string>
  async signTransaction(txHex: string): Promise<string>
  encryptAndStore(password: string): Promise<void>
  async restoreFromSeed(seed: string, password: string): Promise<void>
}
```

---

### Phase 2: React Integration
**Files to modify:**
- `client/src/components/WalletSetupGuide.tsx` - Replace CLI instructions with buttons
- `client/src/page/TradeDetail.tsx` - Integrate wallet operations

**New UI Flow:**
```
[Create Wallet] button
  ↓
[Show 25-word seed - MUST backup!]
  ↓
[Confirm backup] checkbox
  ↓
[Prepare Multisig] button (calls prepareMultisig(), submits hex to server)
  ↓
Waiting screen (polls server for other party)
  ↓
[Finalize Multisig] button (completes setup)
  ↓
✅ Escrow Ready!
```

**Key changes:**
- Remove all CLI command displays
- Add loading states during WASM operations
- Show clear progress indicators
- Handle errors gracefully

---

### Phase 3: Backend Adjustments
**Files to review:**
- `server/src/routes/multisig.ts` - Already correctly relays hex data
- No major changes needed - backend already just coordinates

**Validation:**
- Ensure server NEVER receives private keys
- Verify only public hex strings are stored in DB
- Add logging to prove non-custodial model

---

### Phase 4: Wallet Storage & Recovery
**Storage options:**

1. **Memory Only (Most Paranoid)**
   - Wallet exists only during session
   - User must backup seed phrase
   - Lost if page refreshes

2. **Encrypted localStorage (Recommended)**
   - Encrypt seed with user password
   - Store encrypted blob in localStorage
   - Quick recovery on same device
   - Password never sent to server

3. **Encrypted IndexedDB (Future)**
   - More storage space
   - Better for multiple trades
   - Same encryption model

**Implementation:**
```typescript
// Encrypt wallet data client-side
const encryptedData = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  walletData
);

// Store locally
localStorage.setItem(`wallet_${tradeId}`, JSON.stringify({
  encrypted: encryptedData,
  iv,
  salt
}));

// Password never leaves browser
```

---

### Phase 5: Testing & Validation

**Test scenarios:**
1. ✅ New user creates wallet → seed displayed → backup confirmed
2. ✅ Wallet encrypted and stored locally
3. ✅ Page refresh → wallet restored with password
4. ✅ Multisig coordination → only public hex sent to server
5. ✅ Network tab inspection → no private keys in requests
6. ✅ LocalStorage inspection → only encrypted data present
7. ✅ Two users complete full trade flow
8. ✅ Seed phrase recovery works

**Security audit:**
- Review all network requests (no private keys)
- Audit encryption implementation
- Verify WASM integrity
- Test on multiple browsers

---

## 🚨 Critical Security Considerations

### What Goes to Server (✅ Safe)
```javascript
POST /multisig/:id/prepare
{
  participantId: "user_a",
  preparedHex: "MultisigV1..."  // PUBLIC coordination data
}
```

### What NEVER Goes to Server (🔒 Private)
```javascript
// These stay in browser memory:
wallet.getSeed()              // 25-word seed
wallet.getPrivateSpendKey()   // Private spend key
wallet.getPrivateViewKey()    // Private view key
password                      // User's encryption password
```

---

## 📦 Dependencies

### Already Installed
- `monero-ts` (v0.11.7) - WebAssembly Monero library

### May Need
- `@types/crypto` - If using Web Crypto API types
- Vite WASM plugin configuration

---

## 🎯 Success Criteria

- [ ] User can create wallet with button click (no CLI)
- [ ] Seed phrase displayed with backup confirmation
- [ ] Multisig setup works end-to-end in browser
- [ ] Wallet encrypted and stored locally
- [ ] Password-based recovery works
- [ ] Network inspector shows NO private keys transmitted
- [ ] Works on Chrome, Firefox, Safari
- [ ] Performance acceptable (<5s for wallet operations)

---

## 🚀 Deployment Considerations

### Vite Configuration
```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['monero-ts'] // Don't pre-bundle WASM
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})
```

### WASM Loading
- Ensure WASM files served with correct MIME type
- Handle async initialization properly
- Show loading screen during WASM startup

---

## 📝 Documentation Updates

After implementation:
- Update README with "Getting Started" for users
- Add developer docs for wallet service
- Document encryption scheme
- Add FAQ: "Is this really non-custodial?"

---

## ⏱️ Estimated Timeline

- Phase 1: Browser Wallet Service - **4-6 hours**
- Phase 2: React Integration - **3-4 hours**
- Phase 3: Backend Review - **1 hour**
- Phase 4: Storage & Recovery - **2-3 hours**
- Phase 5: Testing & Security - **3-4 hours**

**Total: ~13-18 hours of development**

This is a major refactor but worth it for the UX improvement and clarity of the non-custodial model.
