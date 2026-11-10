#!/usr/bin/env node
/**
 * Phase 7–10 checks against the local usb-dev stand-in (no physical USB).
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const usbRoot = path.join(repoRoot, "usb-dev");

const usbDevice = require(path.join(repoRoot, "be/utils/usbDevice"));
const usbCrypto = require(path.join(repoRoot, "be/utils/usbCrypto"));
const usbBackup = require(path.join(repoRoot, "be/utils/usbBackup"));
const { startPresenceWatch, stopPresenceWatch } = require(path.join(repoRoot, "electron/usb-manager"));

async function main() {
  const paths = usbDevice.ensureUsbLayout(usbRoot);
  if (fs.existsSync(paths.sqlite)) {
    const safety = path.join(paths.emergency, "pre-phase10.sqlite");
    if (!fs.existsSync(safety)) {
      fs.copyFileSync(paths.sqlite, safety);
    }
  }

  const { key, device } = usbDevice.ensureUsbDevice(usbRoot, { allowInit: true });
  usbDevice.validateUsbRoot(usbRoot);
  assert.equal(device.product, "TATex");

  const orphan = fs.mkdtempSync(path.join(os.tmpdir(), "tatex-orphan-"));
  fs.mkdirSync(path.join(orphan, "config"), { recursive: true });
  fs.copyFileSync(paths.deviceJson, path.join(orphan, "config", "device.json"));
  let missingKeyFailed = false;
  try {
    usbDevice.validateUsbRoot(orphan);
  } catch (error) {
    missingKeyFailed = /missing device.json or device.key/.test(error.message);
  }
  assert.ok(missingKeyFailed, "copied folder without device.key must fail");
  fs.rmSync(orphan, { recursive: true, force: true });

  const roundTripDir = fs.mkdtempSync(path.join(os.tmpdir(), "tatex-enc-"));
  const plain = path.join(roundTripDir, "database.sqlite");
  const enc = path.join(roundTripDir, "database.sqlite.enc");
  const restored = path.join(roundTripDir, "restored.sqlite");
  fs.copyFileSync(paths.sqlite, plain);
  usbCrypto.encryptFile(plain, enc, key);
  usbCrypto.decryptFile(enc, restored, key);
  assert.deepEqual(fs.readFileSync(plain), fs.readFileSync(restored));

  const prisma = spawnSync(
    process.execPath,
    [
      "-e",
      `
        process.env.DATABASE_URL = "file:${restored.replace(/\\/g, "/")}";
        const { PrismaClient } = require("./be/node_modules/@prisma/client");
        const prisma = new PrismaClient();
        prisma.user.findUnique({ where: { email: "karandhanwani20@gmail.com" } })
          .then((user) => {
            console.log(user ? "owner-ok" : "owner-missing");
            return prisma.$disconnect();
          })
          .catch((err) => { console.error(err); process.exit(1); });
      `,
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (prisma.status !== 0) {
    throw new Error(`Prisma open after decrypt failed: ${prisma.stderr || prisma.stdout}`);
  }
  assert.match(prisma.stdout, /owner-ok|owner-missing/);

  const daily = usbBackup.createBackup(usbRoot, "daily");
  const weekly = usbBackup.createBackup(usbRoot, "weekly");
  const emergency = usbBackup.createBackup(usbRoot, "emergency");
  assert.ok(daily && fs.existsSync(daily));
  assert.ok(weekly && fs.existsSync(weekly));
  assert.ok(emergency && fs.existsSync(emergency));

  const watchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tatex-watch-"));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("usb watch did not fire")), 4000);
    startPresenceWatch(
      watchRoot,
      (reason) => {
        clearTimeout(timer);
        stopPresenceWatch();
        if (reason !== "usb-root-missing") {
          reject(new Error(`unexpected reason ${reason}`));
          return;
        }
        resolve();
      },
      200
    );
    fs.rmSync(watchRoot, { recursive: true, force: true });
  });

  const required = ["app", "data", "backups/daily", "backups/weekly", "backups/emergency", "config", "logs", "security"];
  for (const relative of required) {
    assert.ok(fs.existsSync(path.join(usbRoot, relative)), `missing ${relative}`);
  }
  assert.ok(fs.existsSync(paths.deviceJson));
  assert.ok(fs.existsSync(paths.deviceKey));

  fs.rmSync(roundTripDir, { recursive: true, force: true });
  console.log("Phase 7–10 local checks passed");
  console.log(`USB_ROOT=${usbRoot}`);
  console.log(`deviceId=${device.deviceId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
