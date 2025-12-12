import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db: DatabaseType = new Database(path.join(__dirname, "../../xmrdirect.db"));

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    encrypted_wallet TEXT,
    total_trades INTEGER DEFAULT 0,
    completed_trades INTEGER DEFAULT 0,
    disputed_trades INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

  CREATE TABLE IF NOT EXISTS multisig_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    total_participants INTEGER NOT NULL,

    -- Service wallet data
    service_wallet_path TEXT,
    service_address TEXT,
    service_prepared_hex TEXT,
    service_made_hex TEXT,

    -- User A data
    user_a_prepared_hex TEXT,
    user_a_made_hex TEXT,

    -- User B data
    user_b_prepared_hex TEXT,
    user_b_made_hex TEXT,

    -- Key exchange tracking
    exchange_round INTEGER DEFAULT 0,
    service_exchange_hexes TEXT,
    user_a_exchange_hexes TEXT,
    user_b_exchange_hexes TEXT,

    -- Previous round exchange hexes (for multi-round exchanges)
    service_exchange_hexes_prev TEXT,
    user_a_exchange_hexes_prev TEXT,
    user_b_exchange_hexes_prev TEXT,

    -- Final multisig address (shared by all participants)
    multisig_address TEXT,

    -- Blockchain height when wallet was created (for fast sync)
    creation_height INTEGER,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_status ON multisig_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_created ON multisig_sessions(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON multisig_sessions(user_id);

  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    offer_type TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    description TEXT,
    price_per_xmr REAL NOT NULL,
    currency TEXT NOT NULL,
    min_limit REAL NOT NULL,
    max_limit REAL NOT NULL,
    country_code TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);
  CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active);
  CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(offer_type);

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    amount REAL NOT NULL,
    xmr_amount REAL NOT NULL,
    status TEXT NOT NULL,
    multisig_session_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (multisig_session_id) REFERENCES multisig_sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_trades_offer_id ON trades(offer_id);
  CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON trades(buyer_id);
  CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON trades(seller_id);
  CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL,
    initiator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    admin_notes TEXT,
    resolution TEXT,
    resolved_by TEXT,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (trade_id) REFERENCES trades(id),
    FOREIGN KEY (initiator_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_disputes_trade_id ON disputes(trade_id);
  CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

  CREATE TABLE IF NOT EXISTS platform_fees (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL,
    amount_xmr REAL NOT NULL,
    fee_percentage REAL NOT NULL,
    collected_at INTEGER NOT NULL,
    FOREIGN KEY (trade_id) REFERENCES trades(id)
  );

  CREATE INDEX IF NOT EXISTS idx_fees_trade_id ON platform_fees(trade_id);
  CREATE INDEX IF NOT EXISTS idx_fees_collected_at ON platform_fees(collected_at);
`);

// Migration: Add reputation fields to existing users table if they don't exist
try {
  db.exec(`
    ALTER TABLE users ADD COLUMN total_trades INTEGER DEFAULT 0;
  `);
  console.log("Migration: Added total_trades column to users table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE users ADD COLUMN completed_trades INTEGER DEFAULT 0;
  `);
  console.log("Migration: Added completed_trades column to users table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE users ADD COLUMN disputed_trades INTEGER DEFAULT 0;
  `);
  console.log("Migration: Added disputed_trades column to users table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE users ADD COLUMN encrypted_wallet TEXT;
  `);
  console.log("Migration: Added encrypted_wallet column to users table");
} catch (e) {
  // Column already exists, ignore
}

// Migration: Ensure exchange hex columns exist in multisig_sessions
try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN service_exchange_hexes TEXT;
  `);
  console.log("Migration: Added service_exchange_hexes column to multisig_sessions table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN user_a_exchange_hexes TEXT;
  `);
  console.log("Migration: Added user_a_exchange_hexes column to multisig_sessions table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN user_b_exchange_hexes TEXT;
  `);
  console.log("Migration: Added user_b_exchange_hexes column to multisig_sessions table");
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add previous round exchange hex columns for multi-round support
try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN service_exchange_hexes_prev TEXT;
  `);
  console.log("Migration: Added service_exchange_hexes_prev column to multisig_sessions table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN user_a_exchange_hexes_prev TEXT;
  `);
  console.log("Migration: Added user_a_exchange_hexes_prev column to multisig_sessions table");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN user_b_exchange_hexes_prev TEXT;
  `);
  console.log("Migration: Added user_b_exchange_hexes_prev column to multisig_sessions table");
} catch (e) {
  // Column already exists, ignore
}

// Migration: Add creation_height column for fast wallet syncing
try {
  db.exec(`
    ALTER TABLE multisig_sessions ADD COLUMN creation_height INTEGER;
  `);
  console.log("Migration: Added creation_height column to multisig_sessions table");

  // Set default creation height for existing sessions
  db.exec(`
    UPDATE multisig_sessions
    SET creation_height = 3561511
    WHERE creation_height IS NULL;
  `);
  console.log("Migration: Set default creation_height for existing sessions");
} catch (e) {
  // Column already exists, ignore
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  encrypted_wallet?: string; // JSON string of { encrypted, iv, salt }
  total_trades: number;
  completed_trades: number;
  disputed_trades: number;
  created_at: number;
  updated_at: number;
}

export interface Offer {
  id: string;
  user_id: string;
  offer_type: "buy" | "sell";
  payment_method: string;
  description?: string;
  price_per_xmr: number;
  currency: string;
  min_limit: number;
  max_limit: number;
  country_code?: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface MultisigSession {
  id: string;
  user_id: string;
  status: "preparing" | "making" | "exchanging" | "ready";
  threshold: number;
  total_participants: number;
  service_wallet_path?: string;
  service_address?: string;
  service_prepared_hex?: string;
  service_made_hex?: string;
  user_a_id?: string;
  user_a_prepared_hex?: string;
  user_a_made_hex?: string;
  user_b_id?: string;
  user_b_prepared_hex?: string;
  user_b_made_hex?: string;
  exchange_round: number;
  service_exchange_hexes?: string | null;
  user_a_exchange_hexes?: string | null;
  user_b_exchange_hexes?: string | null;
  service_exchange_hexes_prev?: string | null;
  user_a_exchange_hexes_prev?: string | null;
  user_b_exchange_hexes_prev?: string | null;
  multisig_address?: string;
  creation_height?: number;
  created_at: number;
  updated_at: number;
}

export interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  xmr_amount: number;
  status: "pending" | "funded" | "payment_sent" | "payment_confirmed" | "releasing" | "completed" | "disputed" | "cancelled";
  multisig_session_id?: string;
  created_at: number;
  updated_at: number;
}

export interface Dispute {
  id: string;
  trade_id: string;
  initiator_id: string;
  reason: string;
  status: "open" | "investigating" | "resolved";
  admin_notes?: string;
  resolution?: string;
  resolved_by?: string;
  resolved_at?: number;
  created_at: number;
  updated_at: number;
}

export interface PlatformFee {
  id: string;
  trade_id: string;
  amount_xmr: number;
  fee_percentage: number;
  collected_at: number;
}

export const createSession = (
  id: string,
  userId: string,
  threshold: number,
  totalParticipants: number
): MultisigSession => {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO multisig_sessions (
      id, user_id, status, threshold, total_participants, exchange_round, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, "preparing", threshold, totalParticipants, 0, now, now);

  return getSession(id)!;
};

export const getSession = (id: string): MultisigSession | undefined => {
  const stmt = db.prepare("SELECT * FROM multisig_sessions WHERE id = ?");
  return stmt.get(id) as MultisigSession | undefined;
};

export const updateSession = (
  id: string,
  updates: Partial<MultisigSession>
): void => {
  console.log('[updateSession] Called with:', { id, updates });

  // Filter out undefined values (but keep null to explicitly clear fields), and the id field
  const keys = Object.keys(updates).filter(
    (key) => {
      const value = updates[key as keyof MultisigSession];
      return key !== "id" && value !== undefined;
    }
  );

  console.log('[updateSession] Filtered keys:', keys);

  // If no fields to update, just update the timestamp
  if (keys.length === 0) {
    const stmt = db.prepare(`
      UPDATE multisig_sessions
      SET updated_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
    return;
  }

  const fields = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => (updates as any)[key]);

  console.log('[updateSession] SQL:', `SET ${fields}, updated_at = ? WHERE id = ?`);
  console.log('[updateSession] Values:', values, Date.now(), id);

  const stmt = db.prepare(`
    UPDATE multisig_sessions
    SET ${fields}, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(...values, Date.now(), id);
};

export const getAllSessions = (): MultisigSession[] => {
  const stmt = db.prepare(
    "SELECT * FROM multisig_sessions ORDER BY created_at DESC"
  );
  return stmt.all() as MultisigSession[];
};

export const getSessionsByUserId = (userId: string): MultisigSession[] => {
  const stmt = db.prepare(
    "SELECT * FROM multisig_sessions WHERE user_id = ? ORDER BY created_at DESC"
  );
  return stmt.all(userId) as MultisigSession[];
};

// User functions
export const createUser = (
  id: string,
  username: string,
  passwordHash: string
): User => {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, username, passwordHash, now, now);
  return getUserById(id)!;
};

export const getUserByUsername = (username: string): User | undefined => {
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
  return stmt.get(username) as User | undefined;
};

export const getUserById = (id: string): User | undefined => {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(id) as User | undefined;
};

// Encrypted wallet functions
export const storeEncryptedWallet = (
  userId: string,
  encryptedWallet: string // JSON string of { encrypted, iv, salt }
): void => {
  const stmt = db.prepare(`
    UPDATE users
    SET encrypted_wallet = ?,
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(encryptedWallet, Date.now(), userId);
};

export const getEncryptedWallet = (userId: string): string | null => {
  const user = getUserById(userId);
  return user?.encrypted_wallet || null;
};

// Offer functions
export const createOffer = (
  id: string,
  userId: string,
  offerType: "buy" | "sell",
  paymentMethod: string,
  pricePerXmr: number,
  currency: string,
  minLimit: number,
  maxLimit: number,
  description?: string,
  countryCode?: string
): Offer => {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO offers (
      id, user_id, offer_type, payment_method, description,
      price_per_xmr, currency, min_limit, max_limit, country_code,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    userId,
    offerType,
    paymentMethod,
    description || null,
    pricePerXmr,
    currency,
    minLimit,
    maxLimit,
    countryCode || null,
    1,
    now,
    now
  );

  return getOfferById(id)!;
};

export const getOfferById = (id: string): Offer | undefined => {
  const stmt = db.prepare("SELECT * FROM offers WHERE id = ?");
  return stmt.get(id) as Offer | undefined;
};

export const getAllActiveOffers = (): Offer[] => {
  const stmt = db.prepare(
    "SELECT * FROM offers WHERE is_active = 1 ORDER BY created_at DESC"
  );
  return stmt.all() as Offer[];
};

export const getOffersByUserId = (userId: string): Offer[] => {
  const stmt = db.prepare(
    "SELECT * FROM offers WHERE user_id = ? ORDER BY created_at DESC"
  );
  return stmt.all(userId) as Offer[];
};

export const updateOffer = (
  id: string,
  updates: Partial<Offer>
): void => {
  const keys = Object.keys(updates).filter(
    (key) => key !== "id" && updates[key as keyof Offer] !== undefined
  );

  if (keys.length === 0) {
    const stmt = db.prepare(`
      UPDATE offers
      SET updated_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
    return;
  }

  const fields = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => (updates as any)[key]);

  const stmt = db.prepare(`
    UPDATE offers
    SET ${fields}, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(...values, Date.now(), id);
};

export const deleteOffer = (id: string): void => {
  const stmt = db.prepare("UPDATE offers SET is_active = 0 WHERE id = ?");
  stmt.run(id);
};

// Trade functions
export const createTrade = (
  id: string,
  offerId: string,
  buyerId: string,
  sellerId: string,
  amount: number,
  xmrAmount: number
): Trade => {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO trades (
      id, offer_id, buyer_id, seller_id, amount, xmr_amount,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    offerId,
    buyerId,
    sellerId,
    amount,
    xmrAmount,
    "pending",
    now,
    now
  );

  return getTradeById(id)!;
};

export const getTradeById = (id: string): Trade | undefined => {
  const stmt = db.prepare("SELECT * FROM trades WHERE id = ?");
  return stmt.get(id) as Trade | undefined;
};

export const getTradesByUserId = (userId: string): Trade[] => {
  const stmt = db.prepare(`
    SELECT * FROM trades
    WHERE buyer_id = ? OR seller_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(userId, userId) as Trade[];
};

export const getTradesByOfferId = (offerId: string): Trade[] => {
  const stmt = db.prepare(
    "SELECT * FROM trades WHERE offer_id = ? ORDER BY created_at DESC"
  );
  return stmt.all(offerId) as Trade[];
};

export const updateTrade = (
  id: string,
  updates: Partial<Trade>
): void => {
  const keys = Object.keys(updates).filter(
    (key) => key !== "id" && updates[key as keyof Trade] !== undefined
  );

  if (keys.length === 0) {
    const stmt = db.prepare(`
      UPDATE trades
      SET updated_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
    return;
  }

  const fields = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => (updates as any)[key]);

  const stmt = db.prepare(`
    UPDATE trades
    SET ${fields}, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(...values, Date.now(), id);
};

// Dispute functions
export const createDispute = (
  id: string,
  tradeId: string,
  initiatorId: string,
  reason: string
): Dispute => {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO disputes (
      id, trade_id, initiator_id, reason, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, tradeId, initiatorId, reason, "open", now, now);
  return getDisputeById(id)!;
};

export const getDisputeById = (id: string): Dispute | undefined => {
  const stmt = db.prepare("SELECT * FROM disputes WHERE id = ?");
  return stmt.get(id) as Dispute | undefined;
};

export const getDisputeByTradeId = (tradeId: string): Dispute | undefined => {
  const stmt = db.prepare("SELECT * FROM disputes WHERE trade_id = ? ORDER BY created_at DESC LIMIT 1");
  return stmt.get(tradeId) as Dispute | undefined;
};

export const getAllDisputes = (status?: string): Dispute[] => {
  if (status) {
    const stmt = db.prepare("SELECT * FROM disputes WHERE status = ? ORDER BY created_at DESC");
    return stmt.all(status) as Dispute[];
  }
  const stmt = db.prepare("SELECT * FROM disputes ORDER BY created_at DESC");
  return stmt.all() as Dispute[];
};

export const updateDispute = (
  id: string,
  updates: Partial<Dispute>
): void => {
  const keys = Object.keys(updates).filter(
    (key) => key !== "id" && updates[key as keyof Dispute] !== undefined
  );

  if (keys.length === 0) {
    const stmt = db.prepare(`
      UPDATE disputes
      SET updated_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
    return;
  }

  const fields = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => (updates as any)[key]);

  const stmt = db.prepare(`
    UPDATE disputes
    SET ${fields}, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(...values, Date.now(), id);
};

// Platform fee functions
export const recordPlatformFee = (
  id: string,
  tradeId: string,
  amountXmr: number,
  feePercentage: number
): PlatformFee => {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO platform_fees (
      id, trade_id, amount_xmr, fee_percentage, collected_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, tradeId, amountXmr, feePercentage, now);
  return getPlatformFeeById(id)!;
};

export const getPlatformFeeById = (id: string): PlatformFee | undefined => {
  const stmt = db.prepare("SELECT * FROM platform_fees WHERE id = ?");
  return stmt.get(id) as PlatformFee | undefined;
};

export const getPlatformFeeByTradeId = (tradeId: string): PlatformFee | undefined => {
  const stmt = db.prepare("SELECT * FROM platform_fees WHERE trade_id = ?");
  return stmt.get(tradeId) as PlatformFee | undefined;
};

export const getTotalFeesCollected = (): number => {
  const stmt = db.prepare("SELECT SUM(amount_xmr) as total FROM platform_fees");
  const result = stmt.get() as { total: number | null };
  return result.total || 0;
};

// Reputation functions
export const calculateUserReputation = (userId: string): {
  total_trades: number;
  completed_trades: number;
  disputed_trades: number;
  success_rate: number;
} => {
  // Count all trades where user was buyer or seller
  const totalStmt = db.prepare(`
    SELECT COUNT(*) as count FROM trades
    WHERE (buyer_id = ? OR seller_id = ?)
    AND status NOT IN ('cancelled')
  `);
  const totalResult = totalStmt.get(userId, userId) as { count: number };
  const total_trades = totalResult.count;

  // Count completed trades
  const completedStmt = db.prepare(`
    SELECT COUNT(*) as count FROM trades
    WHERE (buyer_id = ? OR seller_id = ?)
    AND status = 'completed'
  `);
  const completedResult = completedStmt.get(userId, userId) as { count: number };
  const completed_trades = completedResult.count;

  // Count disputed trades
  const disputedStmt = db.prepare(`
    SELECT COUNT(*) as count FROM trades
    WHERE (buyer_id = ? OR seller_id = ?)
    AND status = 'disputed'
  `);
  const disputedResult = disputedStmt.get(userId, userId) as { count: number };
  const disputed_trades = disputedResult.count;

  // Calculate success rate
  const success_rate = total_trades > 0 ? (completed_trades / total_trades) * 100 : 0;

  return {
    total_trades,
    completed_trades,
    disputed_trades,
    success_rate,
  };
};

export const updateUserReputation = (userId: string): void => {
  const reputation = calculateUserReputation(userId);

  const stmt = db.prepare(`
    UPDATE users
    SET total_trades = ?,
        completed_trades = ?,
        disputed_trades = ?,
        updated_at = ?
    WHERE id = ?
  `);

  stmt.run(
    reputation.total_trades,
    reputation.completed_trades,
    reputation.disputed_trades,
    Date.now(),
    userId
  );
};

export const getUserReputation = (userId: string): {
  total_trades: number;
  completed_trades: number;
  disputed_trades: number;
  success_rate: number;
} => {
  const user = getUserById(userId);

  if (!user) {
    return {
      total_trades: 0,
      completed_trades: 0,
      disputed_trades: 0,
      success_rate: 0,
    };
  }

  const success_rate = user.total_trades > 0
    ? (user.completed_trades / user.total_trades) * 100
    : 0;

  return {
    total_trades: user.total_trades,
    completed_trades: user.completed_trades,
    disputed_trades: user.disputed_trades,
    success_rate,
  };
};

// Recalculate reputation for all users (useful for initial migration)
export const recalculateAllUserReputations = (): void => {
  const allUsers = db.prepare("SELECT id FROM users").all() as { id: string }[];

  for (const user of allUsers) {
    updateUserReputation(user.id);
  }

  console.log(`Recalculated reputation for ${allUsers.length} users`);
};

export default db;
