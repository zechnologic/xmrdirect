# 🚀 Quick Start Testing Guide

## GET IT RUNNING IN 2 MINUTES

### Step 1: Start the Servers

```bash
# Terminal 1 - Backend (from /xmrdirect root)
cd /Users/znwhite/Documents/development/xmrdirect
npm run dev

# Terminal 2 - Frontend (from /xmrdirect/client)
cd /Users/znwhite/Documents/development/xmrdirect/client
npm run dev
```

**Frontend should be at:** `http://localhost:5173`
**Backend should be at:** `http://localhost:3000`

---

### Step 2: Create Test Accounts

1. Go to `http://localhost:5173`
2. Click "Sign Up"
3. Create **trader1** (password: test123)
4. Logout
5. Create **trader2** (password: test123)

---

### Step 3: Create a Test Trade

**As trader1:**
1. Login
2. Go to "My Offers"
3. Create a sell offer:
   - Type: Sell XMR
   - Payment: Bank Transfer
   - Price: $150/XMR
   - Min: $10, Max: $100
   - Click "Create Offer"

**As trader2 (in private/incognito window):**
1. Login as trader2
2. Go to "Browse Offers"
3. Find trader1's offer
4. Click "Start Trade"
5. Amount: $50
6. Click "Initiate Trade"

---

### Step 4: TEST THE NEW BROWSER WALLET! 🎉

**As trader2 (buyer):**
1. On the Trade Detail page, you should see:
   - **"Browser-Based Wallet Setup"**
   - Progress bar (1 → 2 → 3 → 4)
   - **NO CLI instructions!**

2. Click **"Create New Wallet"** button
   - Enter password: `test123`
   - Check "Store encrypted wallet locally"
   - Click "Create Wallet"

3. **Seed Phrase Backup Screen** should appear:
   - 25 words displayed
   - Click "Show" to reveal
   - Check "I have written down..."
   - Click "Continue to Quiz"

4. **Quiz Verification**:
   - Enter word #3, #7, #15
   - Click "Verify & Continue"

5. **Auto-coordination**:
   - Browser calls `prepareMultisig()` automatically
   - Submits PUBLIC hex to server
   - Shows "Waiting for other party..."

**As trader1 (seller - in another browser/window):**
1. Go to the same trade
2. Click "Create New Wallet"
3. Go through same flow
4. Both parties should now be in "Making" phase

5. Click **"Create Multisig Wallet"** button
   - Browser automatically fetches prepared hexes
   - Calls `makeMultisig()` in browser
   - Submits made hex to server

6. Click **"Exchange Keys"** button
   - Final key exchange happens
   - Multisig address generated!

---

### Step 5: Verify Security (CRITICAL!)

**Open Chrome DevTools (F12) → Network tab:**

1. Filter for: `/multisig/`
2. Check the request payload for `/prepare` endpoint:
   ```json
   {
     "participantId": "user_a",
     "preparedHex": "MultisigV1..." // ✅ PUBLIC data only
   }
   ```

3. **VERIFY**: Look through ALL requests
   - Search for: "seed", "private", "spend"
   - **Should find ZERO matches** ✅

4. **Check localStorage**:
   - Application tab → Local Storage
   - Should see `wallet_[tradeId]` with encrypted data
   - Try decrypting manually - should fail without password ✅

---

## 🧪 WHAT TO TEST

### Basic Wallet Operations
- [ ] Wallet creation works
- [ ] Password validation works
- [ ] Seed phrase displays correctly (25 words)
- [ ] Quiz verification works
- [ ] Wrong quiz answers rejected
- [ ] Loading states show properly

### Multisig Coordination
- [ ] Prepare phase completes
- [ ] Make phase completes
- [ ] Exchange phase completes
- [ ] Multisig address generated
- [ ] Progress indicators update

### Storage & Recovery
- [ ] Wallet saves to localStorage
- [ ] Page refresh → "Unlock Stored Wallet" button appears
- [ ] Correct password unlocks wallet
- [ ] Wrong password shows error
- [ ] Wallet restores to correct state

### Error Handling
- [ ] Wrong password shows clear error
- [ ] Network errors handled gracefully
- [ ] Session expiration handled
- [ ] Browser refresh mid-setup handles correctly

---

## 🐛 COMMON ISSUES & FIXES

### Issue: "wallet not created" error
**Fix:** Make sure WebAssembly had time to load (2-3 seconds)

### Issue: Can't see seed phrase
**Fix:** Click the "👁️ Show" button to unblur

### Issue: Quiz fails with correct words
**Fix:** Check for extra spaces, case-sensitivity

### Issue: Build warnings about externalized modules
**Fix:** This is normal! Vite externalizes Node modules for browser

### Issue: Large bundle size (3.2MB)
**Fix:** This is expected (WebAssembly binaries included)

---

## 📊 SUCCESS CRITERIA

### ✅ Test Passed If:
1. Both users create wallets without CLI
2. Seed phrases displayed and backed up
3. Multisig setup completes automatically
4. Network tab shows NO private keys
5. LocalStorage only has encrypted data
6. Page refresh allows wallet recovery
7. Full trade can be completed

### ❌ Test Failed If:
- Private keys appear in network requests
- Seed phrase not enforced
- Password sent to server
- Wallet state lost on refresh
- Errors crash the app

---

## 🎬 DEMO SCRIPT

"Watch this - no terminal required!"

1. **Click** "Create Wallet" → *2 seconds*
2. **Backup** seed phrase → *30 seconds*
3. **Click** "Finalize Setup" → *5 seconds*
4. **Done!** ✅

"That's it. Fully non-custodial. Private keys never left my browser."

---

## 📝 WHAT TO DOCUMENT

While testing, note:
- Any confusing UI elements
- Unclear error messages
- Steps that take too long
- Missing help text
- Bugs or crashes

---

## 🚨 CRITICAL CHECKS

Before considering this "production ready":

1. **Security Audit** ✅
   - [ ] No private keys in network tab
   - [ ] No private keys in console logs
   - [ ] Encryption working correctly
   - [ ] Password never transmitted

2. **Browser Compatibility** 🚧
   - [ ] Chrome/Edge (Chromium)
   - [ ] Firefox
   - [ ] Safari
   - [ ] Mobile browsers

3. **Error Recovery** 🚧
   - [ ] Network failures handled
   - [ ] Wallet recovery works
   - [ ] Clear error messages

---

## 💬 FEEDBACK

After testing, document:
- What worked well?
- What was confusing?
- What broke?
- What needs improvement?
- Is it better than the CLI version?

---

**Ready?** Start the servers and let's see this baby run! 🚀

**Time to test:** 10-15 minutes
**Expected result:** Mind = Blown 🤯
