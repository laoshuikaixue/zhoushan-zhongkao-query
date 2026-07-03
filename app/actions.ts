"use server";

import crypto from "crypto";

export async function encryptAdmissionData(ticket: string): Promise<string> {
  if (!ticket || typeof ticket !== "string") {
    throw new Error("Invalid ticket number");
  }
  
  const secretKey = process.env.ENCRYPTION_KEY || "default_super_secret_key_12345";
  
  // Create 32-byte key using SHA-256 from secret key
  const key = crypto.createHash("sha256").update(secretKey).digest();
  
  // AES-256-ECB mode (no IV needed)
  const cipher = crypto.createCipheriv("aes-256-ecb", key, null);
  
  let encrypted = cipher.update(ticket, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  return encrypted;
}
