"use server";

import crypto from "crypto";

type AdmissionVerificationPayload = {
  ticket: string;
  birthDate: string;
  candidateName?: string;
  graduationSchool?: string;
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

function packCJKString(text: string, maxChars: number, totalBytes: number) {
  const chars = Array.from(text.trim());
  if (chars.length > maxChars) {
    throw new Error(`Text must be ${maxChars} Chinese characters or fewer`);
  }

  let bits = BigInt(0);
  let bitLength = 0;
  for (const char of chars) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || codePoint < CJK_BASE || codePoint > CJK_END) {
      throw new Error("Text contains unsupported characters");
    }
    bits = (bits << BigInt(15)) | BigInt(codePoint - CJK_BASE);
    bitLength += 15;
  }

  bits <<= BigInt(totalBytes * 8 - bitLength);
  const bytes = Buffer.alloc(totalBytes);
  for (let i = totalBytes - 1; i >= 0; i -= 1) {
    bytes[i] = Number(bits & BigInt(0xff));
    bits >>= BigInt(8);
  }

  return { length: chars.length, bytes };
}

function packChineseName(name: string) {
  return packCJKString(name, 6, 12);
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
  graduationSchool = "",
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
  const school = packCJKString(graduationSchool, 8, 15);

  const payload = Buffer.alloc(40);
  payload[0] = (5 << 4) | (ticket.length === 14 ? 0b1000 : 0) | name.length;
  payload[1] = school.length;
  packDigits(ticket.padStart(14, "0"), 14).copy(payload, 2);
  packDigits(birthDate, 8).copy(payload, 9);
  name.bytes.copy(payload, 13);
  school.bytes.copy(payload, 25);

  const nonce = hmac(secretKey, Buffer.from("admission-v5-nonce"), payload).subarray(0, 2);
  const iv = hmac(secretKey, Buffer.from("admission-v5-iv"), nonce).subarray(0, 16);
  const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);

  return base64UrlEncode(Buffer.concat([nonce, ciphertext]));
}
