const { spawn } = require("child_process");
const { getBackendNetworkSettings } = require("../lib/backend-api-settings");

const port = process.argv[2] || process.env.PORT || "3000";
const proxyUrl = getBackendNetworkSettings().proxyUrl;
const env = { ...process.env };

if (proxyUrl) {
  env.HTTP_PROXY = proxyUrl;
  env.HTTPS_PROXY = proxyUrl;
  env.ALL_PROXY = proxyUrl;
  env.NO_PROXY = env.NO_PROXY || "localhost,127.0.0.1,::1";
  console.log(`[backend] Node proxy enabled: ${proxyUrl}`);
} else {
  console.log("[backend] Node proxy disabled. Set network.proxyUrl in backend-api-settings.js if your upstream API needs a local proxy.");
}

const args = ["--use-env-proxy", "server.js", port];
const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
