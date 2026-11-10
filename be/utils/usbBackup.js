const fs = require("fs");
const path = require("path");
const { usbPaths } = require("./usbDevice");
const { decryptFile } = require("./usbCrypto");

const KEEP = {
  daily: 7,
  weekly: 4,
  emergency: 5,
};

function stamp(kind) {
  const now = new Date();
  if (kind === "weekly") {
    const year = now.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((now - start) / 86400000) + start.getUTCDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  return now.toISOString().replace(/[:.]/g, "-");
}

function listBackups(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sqlite") || name.endsWith(".enc"))
    .map((name) => ({
      name,
      full: path.join(dir, name),
      mtime: fs.statSync(path.join(dir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

function rotate(dir, keep) {
  const files = listBackups(dir);
  for (const extra of files.slice(keep)) {
    fs.unlinkSync(extra.full);
  }
}

function copyBackup(sourcePath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
}

function preferredSource(paths) {
  if (fs.existsSync(paths.encrypted)) {
    return { file: paths.encrypted, ext: ".enc" };
  }
  if (fs.existsSync(paths.sqlite)) {
    return { file: paths.sqlite, ext: ".sqlite" };
  }
  return null;
}

function createBackup(usbRoot, kind = "emergency") {
  if (!KEEP[kind]) {
    throw new Error(`Unknown backup kind: ${kind}`);
  }
  const paths = usbPaths(usbRoot);
  const source = preferredSource(paths);
  if (!source) {
    return null;
  }

  const destDir = paths[kind];
  fs.mkdirSync(destDir, { recursive: true });

  if (kind === "daily") {
    const day = new Date().toISOString().slice(0, 10);
    const existing = listBackups(destDir).find((item) => item.name.includes(day));
    if (existing) {
      return existing.full;
    }
  }
  if (kind === "weekly") {
    const week = stamp("weekly");
    const existing = listBackups(destDir).find((item) => item.name.includes(week));
    if (existing) {
      return existing.full;
    }
  }

  const dest = path.join(destDir, `database-${stamp(kind)}${source.ext}`);
  copyBackup(source.file, dest);
  rotate(destDir, KEEP[kind]);
  return dest;
}

function restoreBackup(usbRoot, kind, filename, { force = false } = {}) {
  if (!KEEP[kind]) {
    throw new Error(`Unknown backup kind: ${kind}`);
  }
  const paths = usbPaths(usbRoot);
  const source = path.join(paths[kind], filename);
  if (!fs.existsSync(source)) {
    throw new Error(`Backup not found: ${kind}/${filename}`);
  }

  const workingExists = fs.existsSync(paths.sqlite) || fs.existsSync(paths.encrypted);
  if (workingExists && !force) {
    throw new Error("Refusing to overwrite the working database without { force: true }");
  }

  if (source.endsWith(".enc")) {
    fs.copyFileSync(source, paths.encrypted);
  } else {
    fs.copyFileSync(source, paths.sqlite);
    if (fs.existsSync(paths.encrypted)) {
      fs.unlinkSync(paths.encrypted);
    }
  }

  return {
    restoredFrom: source,
    sqlite: paths.sqlite,
    encrypted: paths.encrypted,
  };
}

function decryptRestoredDatabase(usbRoot, key) {
  const paths = usbPaths(usbRoot);
  if (fs.existsSync(paths.encrypted)) {
    decryptFile(paths.encrypted, paths.sqlite, key);
  }
  return paths.sqlite;
}

module.exports = {
  KEEP,
  createBackup,
  decryptRestoredDatabase,
  listBackups,
  restoreBackup,
};
