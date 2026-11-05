import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "@/lib/env";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateOtp(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String(randomInt(0, 10));
  return s;
}

export function hashOtp(phone: string, code: string): string {
  return sha256(`${phone}:${code}:${sessionSecret()}`);
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
