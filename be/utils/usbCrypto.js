const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MAGIC = Buffer.from("TATEX1");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_BYTES = 32;

function assertKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new Error("USB device key must be 32 bytes");
  }
}

function encryptBuffer(plaintext, key) {
  assertKey(key);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, encrypted]);
}

function decryptBuffer(payload, key) {
  assertKey(key);
  if (!Buffer.isBuffer(payload) || payload.length < MAGIC.length + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted database payload is too short");
  }
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Encrypted database payload is not a T. A. TEX vault");
  }
  const iv = payload.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
  const tag = payload.subarray(
    MAGIC.length + IV_LENGTH,
    MAGIC.length + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = payload.subarray(MAGIC.length + IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function encryptFile(plainPath, encPath, key) {
  const plaintext = fs.readFileSync(plainPath);
  fs.mkdirSync(path.dirname(encPath), { recursive: true });
  fs.writeFileSync(encPath, encryptBuffer(plaintext, key));
}

function decryptFile(encPath, plainPath, key) {
  const payload = fs.readFileSync(encPath);
  const plaintext = decryptBuffer(payload, key);
  fs.mkdirSync(path.dirname(plainPath), { recursive: true });
  fs.writeFileSync(plainPath, plaintext);
}

module.exports = {
  KEY_BYTES,
  MAGIC,
  decryptBuffer,
  decryptFile,
  encryptBuffer,
  encryptFile,
};
