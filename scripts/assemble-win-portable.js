#!/usr/bin/env node
/**
 * Assemble a portable Windows Electron app without electron-forge/packager.
 * Forge "Finalizing package" OOMs on GitHub windows-latest (~7GB RAM).
 *
 * Expects:
 *   - fe/dist built
 *   - build/backend staged (scripts/stage-packaged-backend.js)
 *   - root npm install (for electron version)
 *
 * Output:
 *   out/T. A. TEX-win32-x64/TATex.exe
 *   out/T. A. TEX-win32-x64/resources/app/...
 *   out/T. A. TEX-win32-x64/resources/backend/...
 *   out/T. A. TEX-win32-x64/resources/node/node.exe
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");
const http = require("http");
const { createWriteStream } = require("fs");
const { pipeline } = require("stream/promises");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "out", "T. A. TEX-win32-x64");
const BACKEND_SRC = path.join(ROOT, "build", "backend");
const FE_DIST = path.join(ROOT, "fe", "dist");
const CACHE_DIR = path.join(ROOT, "build", "electron-cache");

function readElectronVersion() {
  const electronPkg = path.join(ROOT, "node_modules", "electron", "package.json");
  if (!fs.existsSync(electronPkg)) {
    throw new Error("Install root deps first (missing node_modules/electron)");
  }
  return JSON.parse(fs.readFileSync(electronPkg, "utf8")).version;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "ta-tex-assemble" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const out = createWriteStream(dest);
      pipeline(res, out).then(resolve, reject);
    });
    req.on("error", reject);
  });
}

function unzip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(
        /'/g,
        "''"
      )}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" }
    );
    return;
  }
  execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
}

function assertExists(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${label}: ${p}`);
  }
}

async function main() {
  assertExists(FE_DIST, "fe/dist (run npm run build:fe)");
  assertExists(path.join(BACKEND_SRC, "utils", "usbBackup.js"), "build/backend");
  assertExists(path.join(ROOT, "electron", "main.js"), "electron/main.js");

  const version = readElectronVersion();
  const zipName = `electron-v${version}-win32-x64.zip`;
  const zipUrl = `https://github.com/electron/electron/releases/download/v${version}/${zipName}`;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const zipPath = path.join(CACHE_DIR, zipName);

  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1_000_000) {
    console.log(`Downloading ${zipUrl}`);
    await download(zipUrl, zipPath);
  } else {
    console.log(`Using cached ${zipPath}`);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(OUT_DIR), { recursive: true });
  console.log(`Extracting Electron → ${OUT_DIR}`);
  unzip(zipPath, OUT_DIR);

  const electronExe = path.join(OUT_DIR, "electron.exe");
  const tatexExe = path.join(OUT_DIR, "TATex.exe");
  assertExists(electronExe, "electron.exe");
  fs.renameSync(electronExe, tatexExe);

  const appDir = path.join(OUT_DIR, "resources", "app");
  fs.mkdirSync(appDir, { recursive: true });

  // Minimal app payload (no root node_modules — Electron provides the runtime).
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const appPkg = {
    name: rootPkg.name,
    productName: rootPkg.productName,
    version: rootPkg.version,
    description: rootPkg.description,
    author: rootPkg.author,
    main: "electron/main.js",
  };
  fs.writeFileSync(path.join(appDir, "package.json"), `${JSON.stringify(appPkg, null, 2)}\n`);

  fs.cpSync(path.join(ROOT, "electron"), path.join(appDir, "electron"), { recursive: true });
  fs.mkdirSync(path.join(appDir, "fe"), { recursive: true });
  fs.cpSync(FE_DIST, path.join(appDir, "fe", "dist"), { recursive: true });

  const backendDest = path.join(OUT_DIR, "resources", "backend");
  console.log(`Copying backend → ${backendDest}`);
  fs.cpSync(BACKEND_SRC, backendDest, { recursive: true });

  // Bundle real Node for backend (bcrypt native addon matches Node ABI, not Electron).
  const nodeVersion = process.version.replace(/^v/, "");
  const nodeZipName = `node-v${nodeVersion}-win-x64.zip`;
  const nodeZipUrl = `https://nodejs.org/dist/v${nodeVersion}/${nodeZipName}`;
  const nodeZipPath = path.join(CACHE_DIR, nodeZipName);
  const nodeExtractDir = path.join(CACHE_DIR, `node-v${nodeVersion}-win-x64`);

  if (!fs.existsSync(nodeZipPath) || fs.statSync(nodeZipPath).size < 1_000_000) {
    console.log(`Downloading ${nodeZipUrl}`);
    await download(nodeZipUrl, nodeZipPath);
  } else {
    console.log(`Using cached ${nodeZipPath}`);
  }

  fs.rmSync(nodeExtractDir, { recursive: true, force: true });
  console.log(`Extracting Node → ${nodeExtractDir}`);
  unzip(nodeZipPath, CACHE_DIR);

  const extractedNode =
    [
      path.join(nodeExtractDir, "node.exe"),
      path.join(CACHE_DIR, `node-v${nodeVersion}-win-x64`, "node.exe"),
    ].find((candidate) => fs.existsSync(candidate)) || "";

  if (!extractedNode) {
    throw new Error(`node.exe not found after extracting ${nodeZipName}`);
  }

  const nodeDestDir = path.join(OUT_DIR, "resources", "node");
  fs.mkdirSync(nodeDestDir, { recursive: true });
  fs.copyFileSync(extractedNode, path.join(nodeDestDir, "node.exe"));

  assertExists(tatexExe, "TATex.exe");
  assertExists(path.join(appDir, "electron", "main.js"), "resources/app/electron/main.js");
  assertExists(path.join(appDir, "fe", "dist", "index.html"), "resources/app/fe/dist/index.html");
  assertExists(path.join(backendDest, "index.js"), "resources/backend/index.js");
  assertExists(path.join(backendDest, "utils", "usbBackup.js"), "resources/backend/utils/usbBackup.js");
  assertExists(path.join(nodeDestDir, "node.exe"), "resources/node/node.exe");

  if (fs.existsSync(path.join(backendDest, "node_modules", "puppeteer"))) {
    throw new Error("puppeteer should not be in staged backend");
  }

  console.log(`Portable app ready: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
