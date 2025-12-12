// Encrypted wallet storage utilities
// Uses Web Crypto API for encryption

interface WalletData {
  tradeId: string;
  seed?: string;
  walletFile?: string; // Base64 encoded wallet file
  createdAt: number;
}

class WalletStorage {
  private readonly STORAGE_KEY = "xmrdirect_wallets";
  private readonly SALT_KEY = "xmrdirect_salt";

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: 100000,
        hash: "SHA-256",
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encrypt(data: string, password: string): Promise<string> {
    // Generate or retrieve salt
    let salt: Uint8Array;
    const storedSalt = localStorage.getItem(this.SALT_KEY);
    if (storedSalt) {
      salt = new Uint8Array(JSON.parse(storedSalt));
    } else {
      salt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(this.SALT_KEY, JSON.stringify(Array.from(salt)));
    }

    const key = await this.deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decrypt(encryptedData: string, password: string): Promise<string> {
    const storedSalt = localStorage.getItem(this.SALT_KEY);
    if (!storedSalt) {
      throw new Error("Encryption salt not found");
    }

    const salt = new Uint8Array(JSON.parse(storedSalt));
    const key = await this.deriveKey(password, salt);

    const combined = new Uint8Array(
      atob(encryptedData)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }

  /**
   * Store wallet data encrypted with user password
   */
  async storeWallet(
    tradeId: string,
    data: { seed?: string; walletFile?: string },
    password: string
  ): Promise<void> {
    const walletData: WalletData = {
      tradeId,
      ...data,
      createdAt: Date.now(),
    };

    const wallets = await this.getAllWallets(password).catch(() => ({} as Record<string, WalletData>));
    wallets[tradeId] = walletData;

    const encrypted = await this.encrypt(JSON.stringify(wallets), password);
    localStorage.setItem(this.STORAGE_KEY, encrypted);
  }

  /**
   * Retrieve wallet data for a trade
   */
  async getWallet(tradeId: string, password: string): Promise<WalletData | null> {
    const wallets = await this.getAllWallets(password);
    return wallets[tradeId] || null;
  }

  /**
   * Get all stored wallets
   */
  async getAllWallets(password: string): Promise<Record<string, WalletData>> {
    const encrypted = localStorage.getItem(this.STORAGE_KEY);
    if (!encrypted) {
      return {};
    }

    try {
      const decrypted = await this.decrypt(encrypted, password);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error("Failed to decrypt wallet data. Incorrect password?");
    }
  }

  /**
   * Delete wallet data for a trade
   */
  async deleteWallet(tradeId: string, password: string): Promise<void> {
    const wallets = await this.getAllWallets(password);
    delete wallets[tradeId];

    const encrypted = await this.encrypt(JSON.stringify(wallets), password);
    localStorage.setItem(this.STORAGE_KEY, encrypted);
  }

  /**
   * Check if wallets exist
   */
  hasWallets(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  /**
   * Clear all wallet data (use with caution!)
   */
  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.SALT_KEY);
  }
}

export const walletStorage = new WalletStorage();
export default walletStorage;
