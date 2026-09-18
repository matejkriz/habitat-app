import { spawn } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { createEmulator } from "@workos/emulate";
import { previousSchoolDay } from "./e2e-date.mjs";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env.local");
const convexState = resolve(root, ".convex");
const convexTsconfig = resolve(root, "convex/tsconfig.json");
const hadEnvFile = existsSync(envFile);
const originalEnvFile = hadEnvFile ? readFileSync(envFile) : null;
const hadConvexState = existsSync(convexState);
const hadConvexTsconfig = existsSync(convexTsconfig);
const originalConvexTsconfig = hadConvexTsconfig
  ? readFileSync(convexTsconfig)
  : null;
const children = [];
let workos;
let cleaningUp = false;

const testEnv = {
  ...process.env,
  CI: "true",
  CONVEX_DISABLE_TELEMETRY: "1",
  CONVEX_URL: "http://127.0.0.1:3210",
  DEV_PERSONA_SWITCHER: "true",
  E2E_BASE_URL: "http://127.0.0.1:3000",
  E2E_DATE: previousSchoolDay(),
  E2E_LOCAL: "true",
  E2E_TEST_DATABASE: "true",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://127.0.0.1:3000/callback",
  NODE_ENV: "production",
  NO_UPDATE_NOTIFIER: "1",
  PUSH_INTERNAL_SECRET: "local-e2e-internal-secret-not-for-production",
  WORKOS_API_HOSTNAME: "127.0.0.1",
  WORKOS_API_HTTPS: "false",
  WORKOS_API_KEY: "sk_test_default",
  WORKOS_API_PORT: "4100",
  WORKOS_CLIENT_ID: "client_local_backend",
  WORKOS_COOKIE_PASSWORD: "local-e2e-cookie-password-not-for-production",
  WORKOS_EMULATE_DISABLE_UPDATE_CHECK: "1",
};

function executable(relativePath) {
  return resolve(root, relativePath);
}

function start(name, args, environment = testEnv, options = {}) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const entry = { child, name, output: "", stream: options.stream !== false };
  const record = (chunk, target) => {
    entry.output = `${entry.output}${chunk}`.slice(-30_000);
    if (entry.stream) target.write(`[${name}] ${chunk}`);
  };
  child.stdout.on("data", (chunk) => record(chunk, process.stdout));
  child.stderr.on("data", (chunk) => record(chunk, process.stderr));
  children.push(entry);
  return child;
}

function run(name, args, environment = testEnv) {
  return new Promise((resolveRun, rejectRun) => {
    const child = start(name, args, environment);
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      const index = children.findIndex((entry) => entry.child === child);
      if (index >= 0) children.splice(index, 1);
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(
          new Error(`${name} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`),
        );
      }
    });
  });
}

async function waitFor(check, description, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(
    `Timed out waiting for ${description}.${lastError ? ` ${lastError}` : ""}`,
  );
}

async function waitForHttp(url, description) {
  await waitFor(async () => {
    const response = await fetch(url, { redirect: "manual" });
    return response.status < 500;
  }, description);
}

async function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  for (const { child } of children.reverse()) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
  await workos?.close();
  if (originalEnvFile) writeFileSync(envFile, originalEnvFile);
  else if (!hadEnvFile) rmSync(envFile, { force: true });
  if (!hadConvexState) rmSync(convexState, { force: true, recursive: true });
  if (originalConvexTsconfig) {
    writeFileSync(convexTsconfig, originalConvexTsconfig);
  } else if (!hadConvexTsconfig) {
    rmSync(convexTsconfig, { force: true });
  }
}

process.once("SIGINT", () => void cleanup().finally(() => process.exit(130)));
process.once("SIGTERM", () => void cleanup().finally(() => process.exit(143)));

async function main() {
  if (process.env.CI !== "true") {
    throw new Error("This isolated runner is reserved for CI (CI=true).");
  }

  workos = await createEmulator({
    hostname: "127.0.0.1",
    interactiveAuth: true,
    port: 4100,
    seed: {
      users: [
        {
          email: "dev@habitatzbraslav.cz",
          email_verified: true,
          first_name: "E2E",
          id: "user_habitat_e2e_developer",
          last_name: "Developer",
        },
      ],
    },
  });
  console.log(`[workos] Ready at ${workos.url}`);

  const convexEnv = {
    ...testEnv,
    CONVEX_AGENT_MODE: "anonymous",
    CONVEX_DEPLOYMENT: "",
    CONVEX_DEPLOY_KEY: "",
    CONVEX_SELF_HOSTED_ADMIN_KEY: "",
    CONVEX_SELF_HOSTED_URL: "",
  };
  const convex = start("convex", [
    executable("node_modules/convex/bin/main.js"),
    "dev",
    "--codegen",
    "disable",
    "--local-cloud-port",
    "3210",
    "--local-site-port",
    "3211",
    "--tail-logs",
    "disable",
    "--typecheck",
    "disable",
  ], convexEnv);

  await waitFor(
    () =>
      convex.exitCode === null &&
      existsSync(envFile) &&
      readFileSync(envFile, "utf8").includes("http://127.0.0.1:3210"),
    "the local Convex deployment configuration",
    180_000,
  );
  await waitForHttp("http://127.0.0.1:3210/version", "the local Convex backend");

  await run("convex-env", [
    executable("node_modules/convex/bin/main.js"),
    "env",
    "set",
    "PUSH_INTERNAL_SECRET",
    testEnv.PUSH_INTERNAL_SECRET,
  ]);
  await run("convex-seed", [
    executable("node_modules/convex/bin/main.js"),
    "run",
    "seed:development",
    "{}",
    "--push",
    "--typecheck",
    "disable",
  ]);

  await run("next-build", [
    executable("node_modules/next/dist/bin/next"),
    "build",
    "--webpack",
  ]);
  const next = start("next", [
    executable("node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ], testEnv, { stream: false });
  await waitFor(
    async () => {
      if (next.exitCode !== null) throw new Error("Next.js stopped early.");
      const response = await fetch("http://127.0.0.1:3000/login", {
        redirect: "manual",
      });
      return response.status < 500;
    },
    "the Next.js application",
  );

  await run("playwright", [
    executable("node_modules/@playwright/test/cli.js"),
    "test",
  ]);
}

try {
  await main();
} catch (error) {
  for (const entry of children.filter(({ stream }) => !stream)) {
    process.stderr.write(`\n[${entry.name}] recent output:\n${entry.output}\n`);
  }
  throw error;
} finally {
  await cleanup();
}
