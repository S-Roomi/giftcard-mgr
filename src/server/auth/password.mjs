import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** @param {string} password @param {Buffer} salt @returns {Promise<Buffer>} */
function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** @param {string} password */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

/** @param {string} password @param {string} encoded */
export async function verifyPassword(password, encoded) {
  const parts = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded);
  if (!parts?.[1] || !parts[2]) return false;
  const key = await derive(password, Buffer.from(parts[1], "hex"));
  return timingSafeEqual(key, Buffer.from(parts[2], "hex"));
}
