"use server";

import crypto from "crypto";

type AdmissionVerificationPayload = {
  ticket: string;
  birthDate: string;
  candidateName?: string;
};

function packDigits(value: string, digits: number) {
  if (!new RegExp(`^\\d{${digits}}$`).test(value)) {
    throw new Error(`Expected ${digits} digits`);
  }

  const bytes = Buffer.alloc(digits / 2);
  for (let i = 0; i < digits; i += 2) {
    bytes[i / 2] = (Number(value[i]) << 4) | Number(value[i + 1]);
  }
  return bytes;
}

export async function encryptAdmissionData({
  ticket,
  birthDate,
  candidateName = "",
}: AdmissionVerificationPayload): Promise<string> {
  if (!/^\d{13,14}$/.test(ticket)) {
    throw new Error("Invalid ticket number");
  }
  if (!/^\d{8}$/.test(birthDate)) {
    throw new Error("Invalid birth date");
  }

  const secretKey = process.env.ENCRYPTION_KEY || "default_super_secret_key_12345";

  // Create 32-byte key using SHA-256 from secret key
  const key = crypto.createHash("sha256").update(secretKey).digest();

  const block = Buffer.alloc(16);
  block[0] = 1;
  block[1] = ticket.length;
  packDigits(ticket.padStart(14, "0"), 14).copy(block, 2);
  packDigits(birthDate, 8).copy(block, 9);
  crypto
    .createHmac("sha256", secretKey)
    .update(candidateName.trim())
    .digest()
    .copy(block, 13, 0, 3);

  // AES-256-ECB with a fixed 16-byte binary payload keeps Base64 output at 24 chars.
  const cipher = crypto.createCipheriv("aes-256-ecb", key, null);
  cipher.setAutoPadding(false);

  return Buffer.concat([cipher.update(block), cipher.final()]).toString("base64");
}
