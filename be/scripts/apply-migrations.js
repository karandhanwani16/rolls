#!/usr/bin/env node
/**
 * Apply Prisma SQLite migrations to the local USB_ROOT database file.
 *
 *   cd be && node scripts/apply-migrations.js
 *
 * Invokes Prisma's JS entry with the current Node/Electron binary so this
 * works when spawned via ELECTRON_RUN_AS_NODE (no system `node` required).
 */

require("dotenv").config();

const { spawn } = require("child_process");
const path = require("path");
const {
  applyDatabaseEnv,
  describeDatabaseTarget,
} = require("../config/database");

const databaseUrl = applyDatabaseEnv();
if (!databaseUrl) {
  console.error("DATABASE_URL or DATABASE_PATH is required");
  process.exit(1);
}

console.log(`Applying SQLite migrations to ${describeDatabaseTarget(databaseUrl)}`);

function resolveNodeBin() {
  if (process.env.ELECTRON_RUN_AS_NODE === "1") {
    return process.execPath;
  }
  return process.env.npm_node_execpath || process.execPath || "node";
}

const prismaJs = path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js");
const child = spawn(resolveNodeBin(), [prismaJs, "migrate", "deploy"], {
  cwd: path.join(__dirname, ".."),
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Failed to run prisma migrate deploy:", error);
  process.exit(1);
});

child.on("exit", async (code) => {
  if (code) {
    process.exit(code);
    return;
  }

  try {
    const { ensureDefaultOwner } = require("../prisma/seed");
    const prisma = require("../prisma/client");
    await ensureDefaultOwner(prisma);
    await prisma.$disconnect();
  } catch (error) {
    console.error("Default owner seed failed:", error.message);
  }

  process.exit(0);
});
