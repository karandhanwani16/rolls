#!/usr/bin/env node
/**
 * Copy be/ into build/backend for Electron extraResource.
 * Omits .env, tests, and installs a lean production node_modules
 * (no Puppeteer browser download) so packaging fits in CI memory.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const src = path.join(__dirname, "..", "be");
const dest = path.join(__dirname, "..", "build", "backend");

const HEAVY_PACKAGE_DIRS = [
  "puppeteer",
  "puppeteer-core",
  "@puppeteer",
  "chromium-bidi",
  "@tootallnate",
];

function shouldSkip(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  if (!normalized) {
    return false;
  }
  if (normalized === ".env" || normalized.startsWith(".env.")) {
    return true;
  }
  if (normalized === ".git" || normalized.startsWith(".git/")) {
    return true;
  }
  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) {
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
  if (normalized === "dev.db" || normalized.endsWith(".db") || normalized.endsWith(".db-journal")) {
    return true;
  }
  return false;
}

function rmIfExists(target) {
  fs.rmSync(target, { recursive: true, force: true });
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

for (const name of fs.readdirSync(dest)) {
  if (name === ".env" || name.startsWith(".env.")) {
    fs.rmSync(path.join(dest, name), { force: true });
  }
}

if (!fs.existsSync(path.join(dest, "package-lock.json"))) {
  throw new Error("be/package-lock.json is required to stage a lean backend");
}

console.log("Installing production backend dependencies into build/backend...");
execSync("npm ci --omit=dev", {
  stdio: "inherit",
  cwd: dest,
  env: {
    ...process.env,
    PUPPETEER_SKIP_DOWNLOAD: "1",
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: "1",
    DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  },
});

// Drop Puppeteer stack — too large for CI packaging; PDF routes lazy-load it.
for (const dir of HEAVY_PACKAGE_DIRS) {
  rmIfExists(path.join(dest, "node_modules", dir));
}

execSync("npx prisma generate", {
  stdio: "inherit",
  cwd: dest,
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  },
});

try {
  execSync("npm rebuild bcrypt", { stdio: "inherit", cwd: dest });
} catch (error) {
  console.warn("bcrypt rebuild warning:", error.message);
}

const required = [
  "index.js",
  "package.json",
  "utils/usbBackup.js",
  "utils/usbCrypto.js",
  "utils/usbDevice.js",
  "config/database.js",
  "prisma/schema.prisma",
  "node_modules/@prisma/client",
  "node_modules/.prisma/client",
  "node_modules/bcrypt",
  "node_modules/express",
];
const missing = required.filter((rel) => !fs.existsSync(path.join(dest, rel)));
if (missing.length) {
  throw new Error(`Staged backend is incomplete (missing ${missing.join(", ")})`);
}
if (fs.existsSync(path.join(dest, ".env"))) {
  throw new Error("Refusing to package be/.env");
}

console.log(`Staged backend at ${dest}`);
