"use server";

import crypto from "crypto";

type AdmissionVerificationPayload = {
  ticket: string;
  birthDate: string;
  candidateName?: string;
};

const CJK_BASE = 0x4e00;
const CJK_END = 0x9fff;

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

function packChineseName(name: string) {
  const chars = Array.from(name.trim());
  if (chars.length > 4) {
    throw new Error("Candidate name must be 4 Chinese characters or fewer");
  }

  let bits = 0n;
  let bitLength = 0;
  for (const char of chars) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || codePoint < CJK_BASE || codePoint > CJK_END) {
      throw new Error("Candidate name contains unsupported characters");
    }
    bits = (bits << 15n) | BigInt(codePoint - CJK_BASE);
    bitLength += 15;
  }

  bits <<= BigInt(64 - bitLength);
  const bytes = Buffer.alloc(8);
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = Number(bits & 0xffn);
    bits >>= 8n;
  }

  return {
    length: chars.length,
    bytes,
  };
}

function base64UrlEncode(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hmac(secretKey: string, ...values: Buffer[]) {
  const digest = crypto.createHmac("sha256", secretKey);
  for (const value of values) {
    digest.update(value);
  }
  return digest.digest();
}

export async function isTestEnvironment(): Promise<boolean> {
  return ["1", "true", "yes", "on"].includes((process.env.TEST ?? "").toLowerCase());
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

  // 使用密钥的 SHA-256 摘要生成 32 字节 AES 密钥。
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const name = packChineseName(candidateName);

  const payload = Buffer.alloc(20);
  payload[0] = (3 << 4) | (ticket.length === 14 ? 0b1000 : 0) | name.length;
  packDigits(ticket.padStart(14, "0"), 14).copy(payload, 1);
  packDigits(birthDate, 8).copy(payload, 8);
  name.bytes.copy(payload, 12);

  const nonce = hmac(secretKey, Buffer.from("admission-v3-nonce"), payload).subarray(0, 2);
  const iv = hmac(secretKey, Buffer.from("admission-v3-iv"), nonce).subarray(0, 16);
  const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);

  return base64UrlEncode(Buffer.concat([nonce, ciphertext]));
}
