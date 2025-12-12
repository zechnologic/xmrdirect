import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SALT_ROUNDS = 10;

async function resetDatabase() {
  console.log("Starting database reset...");

  // Connect to database
  const db = new Database(path.join(__dirname, "xmrdirect.db"));

  try {
    // Delete all data from tables in correct order (respecting foreign key constraints)
    console.log("Clearing all data from tables...");

    db.exec("DELETE FROM platform_fees");
    console.log("  ✓ Cleared platform_fees");

    db.exec("DELETE FROM disputes");
    console.log("  ✓ Cleared disputes");

    db.exec("DELETE FROM trades");
    console.log("  ✓ Cleared trades");

    db.exec("DELETE FROM offers");
    console.log("  ✓ Cleared offers");

    db.exec("DELETE FROM multisig_sessions");
    console.log("  ✓ Cleared multisig_sessions");

    db.exec("DELETE FROM users");
    console.log("  ✓ Cleared users");

    console.log("\nInserting trader accounts...");

    // Create trader1
    const trader1Id = randomBytes(16).toString("hex");
    const trader1Password = "password123"; // Default password
    const trader1Hash = await bcrypt.hash(trader1Password, SALT_ROUNDS);
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, total_trades, completed_trades, disputed_trades, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trader1Id, "trader1", trader1Hash, 0, 0, 0, now, now);

    console.log(`  ✓ Created trader1 (password: ${trader1Password})`);

    // Create trader2
    const trader2Id = randomBytes(16).toString("hex");
    const trader2Password = "password123"; // Default password
    const trader2Hash = await bcrypt.hash(trader2Password, SALT_ROUNDS);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, total_trades, completed_trades, disputed_trades, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trader2Id, "trader2", trader2Hash, 0, 0, 0, now, now);

    console.log(`  ✓ Created trader2 (password: ${trader2Password})`);

    console.log("\nCreating offer...");

    // Create offer from trader1
    const offerId = randomBytes(16).toString("hex");
    db.prepare(`
      INSERT INTO offers (
        id, user_id, offer_type, payment_method, description,
        price_per_xmr, currency, min_limit, max_limit, country_code,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      offerId,
      trader1Id,
      "sell", // trader1 is selling XMR
      "cash_by_mail",
      "Secure cash by mail transaction. Fast shipping, tracked delivery.",
      400, // 400 USD per XMR
      "USD",
      50, // min limit: $50
      5000, // max limit: $5000
      "US", // United States
      1, // active
      now,
      now
    );

    console.log(`  ✓ Created offer from trader1 (400 USD per XMR, cash by mail)`);

    console.log("\n✅ Database reset complete!");
    console.log("\nAccounts created:");
    console.log("  - Username: trader1, Password: password123");
    console.log("  - Username: trader2, Password: password123");
    console.log("\nOffer created:");
    console.log("  - Seller: trader1");
    console.log("  - Payment: Cash by mail");
    console.log("  - Price: 400 USD per XMR");
    console.log("  - Limits: $50 - $5000");

  } catch (error) {
    console.error("❌ Error resetting database:", error);
    throw error;
  } finally {
    db.close();
  }
}

// Run the reset
resetDatabase().catch(console.error);
