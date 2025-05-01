import { encryptionService } from "../encryption.service";
import dotenv from "dotenv";

dotenv.config();

describe("EncryptionService", () => {
  // Set up environment variable for testing
  beforeAll(() => {
    process.env.ENCRYPTION_SECRET = "test-secret-key-1234567890";
  });

  it("should encrypt and decrypt text correctly", () => {
    const originalText = "This is a secret message";

    // Encrypt the text
    const encrypted = encryptionService.encrypt(originalText);

    // Decrypt the text
    const decrypted = encryptionService.decrypt(encrypted);

    // Verify the decrypted text matches the original
    expect(decrypted).toBe(originalText);
  });

  it("should throw error when decrypting invalid data", () => {
    expect(() => {
      encryptionService.decrypt("invalid-base64-string");
    }).toThrow("Failed to decrypt data");
  });

  it("should produce different encrypted outputs for the same input", () => {
    const text = "Same text";
    const encrypted1 = encryptionService.encrypt(text);
    const encrypted2 = encryptionService.encrypt(text);

    expect(encrypted1).not.toBe(encrypted2);
  });
});
