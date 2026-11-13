const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { MakerZIP } = require("@electron-forge/maker-zip");

const BACKEND_RESOURCE = path.resolve(__dirname, "build", "backend");

function ignorePath(file) {
  const normalized = `/${file.replace(/\\/g, "/")}`.replace(/^\/+/, "/");
  if (!normalized || normalized === "/") {
    return false;
  }

  if (normalized === "/package.json") {
    return false;
  }
  if (normalized === "/electron" || normalized.startsWith("/electron/")) {
    return false;
  }
  // Only the built frontend — never fe/src or fe/node_modules (OOM on CI).
  if (normalized === "/fe/dist" || normalized.startsWith("/fe/dist/")) {
    return false;
  }

  return true;
}

function copyBackendIntoPackage(outPath) {
  const resourcesDir = path.join(outPath, "resources");
  const destBackend = path.join(resourcesDir, "backend");
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.rmSync(destBackend, { recursive: true, force: true });

  console.log(`Copying staged backend → ${destBackend}`);
  // Plain filesystem copy (not asar / not Forge extraResource) — avoids CI heap OOM.
  fs.cpSync(BACKEND_RESOURCE, destBackend, { recursive: true });

  const marker = path.join(destBackend, "utils", "usbBackup.js");
  if (!fs.existsSync(marker)) {
    throw new Error(
      `Packaged app is missing ${marker}. USB copy must include resources\\backend.`
    );
  }
}

module.exports = {
  packagerConfig: {
    name: "T. A. TEX",
    executableName: "TATex",
    asar: true,
    prune: true,
    // Backend is attached in postPackage — do NOT use extraResource (OOM on CI).
    extraResource: [],
    ignore: ignorePath,
  },
  rebuildConfig: {},
  // Zip only: USB needs the portable folder, not a Squirrel Setup.exe.
  // Instantiating MakerZIP with win32 avoids Forge dropping Windows targets.
  makers: [new MakerZIP({}, ["darwin", "mas", "win32", "linux"])],
  hooks: {
    async prePackage(config) {
      execSync("npm run build:fe", { stdio: "inherit", cwd: __dirname });
      execSync("npx prisma generate", {
        stdio: "inherit",
        cwd: path.join(__dirname, "be"),
      });
      execSync("node scripts/stage-packaged-backend.js", {
        stdio: "inherit",
        cwd: __dirname,
      });
      if (!fs.existsSync(path.join(BACKEND_RESOURCE, "utils", "usbBackup.js"))) {
        throw new Error(`Missing staged backend at ${BACKEND_RESOURCE}`);
      }
      // Keep packager free of the backend tree.
      config.packagerConfig.extraResource = [];
    },
    async postPackage(_config, packageResult) {
      const outputs = packageResult.outputPaths || [];
      if (!outputs.length) {
        throw new Error("electron-forge package produced no output paths");
      }
      for (const outPath of outputs) {
        copyBackendIntoPackage(outPath);
      }
    },
  },
};
