import crypto from "crypto";

class EncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;
  private readonly ivLength = 12; // GCM recommended IV length
  private readonly saltLength = 16;
  private readonly tagLength = 16;
  private readonly keyLength = 32;

  constructor() {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error(
        "ENCRYPTION_SECRET is not defined in environment variables"
      );
    }

    // Derive a key from the secret using PBKDF2
    this.key = crypto.pbkdf2Sync(
      secret,
      "salt", // You can make this configurable if needed
      100000, // Number of iterations
      this.keyLength,
      "sha256"
    );
  }

  encrypt(text: string): string {
    try {
      // Generate a random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the text
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Get the auth tag
      const authTag = cipher.getAuthTag();

      // Combine IV, encrypted text, and auth tag
      const result = Buffer.concat([
        iv,
        Buffer.from(encrypted, "hex"),
        authTag,
      ]);

      return result.toString("base64");
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error("Failed to encrypt data");
    }
  }

  decrypt(encryptedData: string): string {
    try {
      // Convert from base64
      const buffer = Buffer.from(encryptedData, "base64");

      // Extract IV, encrypted text, and auth tag
      const iv = buffer.slice(0, this.ivLength);
      const encryptedText = buffer.slice(this.ivLength, -this.tagLength);
      const authTag = buffer.slice(-this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the text
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    } catch (error) {
      console.error("Decryption error:", error);
      throw new Error("Failed to decrypt data");
    }
  }
}

// Export a singleton instance
export const encryptionService = new EncryptionService();
