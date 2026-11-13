#!/usr/bin/env node
/**
 * Copy be/ into build/backend for Electron extraResource.
 * Omits .env (JWT is generated at runtime; never ship DB passwords).
 */

const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "be");
const dest = path.join(__dirname, "..", "build", "backend");

function shouldSkip(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  if (!normalized) {
    return false;
  }
  // Never ship secrets; match .env, .env.local, .env.production, etc.
  if (normalized === ".env" || normalized.startsWith(".env.")) {
    return true;
  }
  if (normalized === ".git" || normalized.startsWith(".git/")) {
    return true;
  }
  if (normalized === "tests" || normalized.startsWith("tests/")) {
    return true;
  }
  if (normalized === "backups" || normalized.startsWith("backups/")) {
    return true;
  }
  if (normalized.startsWith("prisma/migrations-mysql")) {
    return true;
  }
  if (normalized.includes(".DS_Store")) {
    return true;
  }
  return false;
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, {
  recursive: true,
  filter: (from) => {
    const relative = path.relative(src, from);
    return !shouldSkip(relative);
  },
});

// fs.cpSync filter can miss dotfiles on some Windows/Node combos — strip after copy.
for (const name of fs.readdirSync(dest)) {
  if (name === ".env" || name.startsWith(".env.")) {
    fs.rmSync(path.join(dest, name), { force: true });
  }
}
if (fs.existsSync(path.join(dest, ".env"))) {
  throw new Error("Refusing to package be/.env");
}

const required = [
  "index.js",
  "package.json",
  "utils/usbBackup.js",
  "utils/usbCrypto.js",
  "utils/usbDevice.js",
  "config/database.js",
  "prisma/schema.prisma",
];
const missing = required.filter((rel) => !fs.existsSync(path.join(dest, rel)));
if (missing.length) {
  throw new Error(`Staged backend is incomplete (missing ${missing.join(", ")})`);
}

console.log(`Staged backend at ${dest}`);
