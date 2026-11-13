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

module.exports = {
  packagerConfig: {
    name: "T. A. TEX",
    executableName: "TATex",
    asar: true,
    prune: true,
    extraResource: [BACKEND_RESOURCE],
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
      config.packagerConfig.extraResource = [BACKEND_RESOURCE];
    },
    async postPackage(_config, packageResult) {
      const outputs = packageResult.outputPaths || [];
      for (const outPath of outputs) {
        const packagedBackend = path.join(outPath, "resources", "backend", "utils", "usbBackup.js");
        if (!fs.existsSync(packagedBackend)) {
          throw new Error(
            `Packaged app is missing ${packagedBackend}. USB copy must include resources\\backend.`
          );
        }
      }
    },
  },
};
