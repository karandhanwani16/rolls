#!/usr/bin/env node
/**
 * Restore a USB backup into USB_ROOT/data/.
 *
 *   cd be && node scripts/restore-backup.js --kind daily --file <name> --force
 *
 * USB_ROOT defaults to ../usb-dev (the local stand-in). Does not overwrite
 * the working database unless --force is passed.
 */

require("dotenv").config();

const path = require("path");
const { applyDatabaseEnv } = require("../config/database");
const { ensureUsbDevice, usbPaths } = require("../utils/usbDevice");
const { restoreBackup, decryptRestoredDatabase } = require("../utils/usbBackup");

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    return "";
  }
  return process.argv[index + 1];
}

applyDatabaseEnv();

const usbRoot = process.env.USB_ROOT || path.resolve(__dirname, "..", "..", "usb-dev");
const kind = arg("--kind") || "emergency";
const filename = arg("--file");
const force = process.argv.includes("--force");

if (!filename) {
  console.error("Usage: node scripts/restore-backup.js --kind daily|weekly|emergency --file <name> [--force]");
  process.exit(1);
}

const { key } = ensureUsbDevice(usbRoot, { allowInit: false });
const result = restoreBackup(usbRoot, kind, filename, { force });
decryptRestoredDatabase(usbRoot, key);

const paths = usbPaths(usbRoot);
console.log(`Restored ${result.restoredFrom}`);
console.log(`Working database: ${paths.sqlite}`);
console.log("Start the app to open Prisma against the restored file.");
