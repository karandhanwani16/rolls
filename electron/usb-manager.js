const fs = require("fs");
const http = require("http");
const path = require("path");

const DEFAULT_POLL_MS = 1000;

let watchTimer = null;
let server = null;
let goneNotified = false;

function usbRootExists(usbRoot) {
  try {
    return Boolean(usbRoot) && fs.existsSync(usbRoot) && fs.statSync(usbRoot).isDirectory();
  } catch {
    return false;
  }
}

function startPresenceWatch(usbRoot, onRemoved, pollMs = DEFAULT_POLL_MS) {
  stopPresenceWatch();
  goneNotified = false;

  watchTimer = setInterval(() => {
    if (goneNotified) {
      return;
    }
    if (!usbRootExists(usbRoot)) {
      goneNotified = true;
      onRemoved("usb-root-missing");
      return;
    }

    const shutdownFile = path.join(usbRoot, "config", "shutdown.request");
    if (fs.existsSync(shutdownFile)) {
      goneNotified = true;
      try {
        fs.unlinkSync(shutdownFile);
      } catch {
        // ignore
      }
      onRemoved("shutdown-request");
    }
  }, pollMs);

  if (typeof watchTimer.unref === "function") {
    watchTimer.unref();
  }

  return watchTimer;
}

function stopPresenceWatch() {
  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
}

function startShutdownServer(port, onShutdown) {
  stopShutdownServer();

  server = http.createServer((req, res) => {
    const host = req.socket.remoteAddress;
    const local =
      host === "127.0.0.1" ||
      host === "::1" ||
      host === ":ffff:127.0.0.1";

    if (!local) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    if (req.method === "POST" && (req.url === "/shutdown" || req.url === "/internal/shutdown")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      onShutdown("monitor-http");
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  server.listen(port, "127.0.0.1");
  return server;
}

function stopShutdownServer() {
  if (server) {
    server.close();
    server = null;
  }
}

function startUsbWatch({ usbRoot, port, onRemoved, pollMs }) {
  startPresenceWatch(usbRoot, onRemoved, pollMs);
  if (port) {
    try {
      startShutdownServer(port, onRemoved);
    } catch (error) {
      console.error("USB shutdown HTTP server failed:", error.message);
    }
  }
  return {
    stop() {
      stopPresenceWatch();
      stopShutdownServer();
    },
  };
}

function stopUsbWatch() {
  stopPresenceWatch();
  stopShutdownServer();
}

module.exports = {
  startPresenceWatch,
  startShutdownServer,
  startUsbWatch,
  stopPresenceWatch,
  stopShutdownServer,
  stopUsbWatch,
  usbRootExists,
};
