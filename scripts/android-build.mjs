import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const release = process.argv[2] === "release";
if (release)
  for (const key of [
    "BILL_KEYSTORE",
    "BILL_STORE_PASSWORD",
    "BILL_KEY_ALIAS",
    "BILL_KEY_PASSWORD",
  ])
    if (!process.env[key]) {
      console.error(`Missing ${key}. See README.md signing setup.`);
      process.exit(1);
    }
function run(command, args, cwd = root) {
  const r = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run("npm", ["ci"]);
run("npm", ["run", "check"]);
run(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  ["--no-daemon", release ? "assembleRelease" : "assembleDebug"],
  fileURLToPath(new URL("../android/", import.meta.url)),
);
console.log(
  `Bill APK: android/app/build/outputs/apk/${release ? "release/app-release.apk" : "debug/app-debug.apk"}`,
);
