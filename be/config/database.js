const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_USB_ROOT = path.join(REPO_ROOT, "usb-dev");

/**
 * Single place that decides how this process talks to the database.
 *
 * Cloud demo (Vercel + Render + Aiven MySQL):
 *   Set DATABASE_URL=mysql://... and leave USB_ROOT / DATABASE_PATH unset.
 *
 * USB / Electron (SQLite) — after demo, switch schema provider back to sqlite:
 *   Set DATABASE_PATH or USB_ROOT; those win over a leftover server URL.
 *
 * Precedence:
 *   1. DATABASE_PATH (filesystem path or file: URL) → SQLite file
 *   2. USB_ROOT → {USB_ROOT}/data/database.sqlite
 *   3. DATABASE_URL if mysql:// / postgresql:// → use as-is (Render / Aiven)
 *   4. DATABASE_URL if file: → SQLite file
 *   5. Default → <repo>/usb-dev/data/database.sqlite
 */
function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeServerUrl(value) {
  return /^(mysql|postgresql|postgres|mongodb|sqlserver|prisma):\/\//i.test(value);
}

function resolveConfiguredPath(raw) {
  const trimmed = trimEnv(raw);
  if (!trimmed) {
    return "";
  }
  const withoutScheme = trimmed.startsWith("file:") ? trimmed.slice("file:".length) : trimmed;
  if (path.isAbsolute(withoutScheme)) {
    return path.normalize(withoutScheme);
  }
  return path.resolve(REPO_ROOT, withoutScheme);
}

function defaultDatabasePath(usbRoot) {
  return path.join(usbRoot, "data", "database.sqlite");
}

function resolveUsbRoot(env = process.env) {
  const configured = resolveConfiguredPath(env.USB_ROOT);
  return configured || DEFAULT_USB_ROOT;
}

function resolveDatabasePath(env = process.env) {
  const configured = trimEnv(env.DATABASE_PATH);
  if (configured && !looksLikeServerUrl(configured)) {
    return resolveConfiguredPath(configured);
  }
  return defaultDatabasePath(resolveUsbRoot(env));
}

function databaseUrlFromPath(databasePath) {
  return `file:${resolveConfiguredPath(databasePath)}`;
}

function resolveDatabaseUrl(env = process.env) {
  const databasePath = trimEnv(env.DATABASE_PATH);
  if (databasePath && !looksLikeServerUrl(databasePath)) {
    return databaseUrlFromPath(databasePath);
  }

  const usbRoot = trimEnv(env.USB_ROOT);
  if (usbRoot) {
    return databaseUrlFromPath(defaultDatabasePath(resolveUsbRoot(env)));
  }

  const databaseUrl = trimEnv(env.DATABASE_URL);
  if (databaseUrl) {
    if (looksLikeServerUrl(databaseUrl)) {
      return databaseUrl;
    }
    return databaseUrl.startsWith("file:")
      ? databaseUrlFromPath(databaseUrl)
      : databaseUrlFromPath(databaseUrl);
  }

  return databaseUrlFromPath(defaultDatabasePath(DEFAULT_USB_ROOT));
}

function sqliteFilePathFromUrl(url) {
  if (!url || !url.startsWith("file:")) {
    return "";
  }
  return url.slice("file:".length);
}

function ensureDatabaseDir(env = process.env) {
  const url = resolveDatabaseUrl(env);
  if (looksLikeServerUrl(url)) {
    return "";
  }
  const filePath = sqliteFilePathFromUrl(url) || resolveDatabasePath(env);
  if (filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  return filePath;
}

function applyDatabaseEnv(env = process.env) {
  const url = resolveDatabaseUrl(env);
  const filePath = sqliteFilePathFromUrl(url);

  env.DATABASE_URL = url;
  if (filePath) {
    env.DATABASE_PATH = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    env.USB_ROOT = resolveUsbRoot(env);
  }

  return url;
}

function describeDatabaseTarget(url = resolveDatabaseUrl()) {
  if (!url) {
    return "unset";
  }
  if (url.startsWith("file:")) {
    return url;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "custom";
  }
}

module.exports = {
  DEFAULT_USB_ROOT,
  applyDatabaseEnv,
  describeDatabaseTarget,
  ensureDatabaseDir,
  looksLikeServerUrl,
  resolveDatabasePath,
  resolveDatabaseUrl,
  resolveUsbRoot,
};
