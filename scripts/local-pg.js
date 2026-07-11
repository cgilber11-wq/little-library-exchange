/**
 * Start a persistent local Postgres without Docker (embedded-postgres).
 * Usage: node scripts/local-pg.js start|stop|status
 */
const path = require("path");
const fs = require("fs");
const EmbeddedPostgres = require("embedded-postgres").default;

const DATA_DIR = path.join(__dirname, "..", "data", "pg");
const PID_FILE = path.join(DATA_DIR, "lle-embedded.pid.json");
const PORT = Number(process.env.LLE_PG_PORT || 54329);
const USER = "lle";
const PASSWORD = "lle";
const APP_DB = "little_library_exchange";
const TEST_DB = "little_library_exchange_test";

function connectionUrl(database = APP_DB) {
  return `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${database}?schema=public`;
}

function makePg() {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });
}

async function ensureDatabases(pg) {
  for (const name of [APP_DB, TEST_DB]) {
    try {
      await pg.createDatabase(name);
      console.log(`Created database ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg)) {
        // ok
      } else {
        // Some versions throw differently when DB exists — try connecting.
        console.log(`Database ${name}: ${msg}`);
      }
    }
  }
}

async function start() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const pg = makePg();

  const clusterInitialized = fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  if (!clusterInitialized) {
    console.log("Initializing Postgres cluster…");
    await pg.initialise();
  }

  console.log(`Starting Postgres on port ${PORT}…`);
  await pg.start();
  await ensureDatabases(pg);

  fs.writeFileSync(
    PID_FILE,
    JSON.stringify({ port: PORT, startedAt: new Date().toISOString(), databaseUrl: connectionUrl() }, null, 2),
  );

  console.log("Postgres is ready.");
  console.log(`DATABASE_URL=${connectionUrl()}`);
  console.log(`TEST_DATABASE_URL=${connectionUrl(TEST_DB)}`);
  console.log("Leave this process running, or use: npm run db:up (background via scripts).");
}

async function stop() {
  const pg = makePg();
  try {
    await pg.stop();
    console.log("Postgres stopped.");
  } catch (e) {
    console.log(e instanceof Error ? e.message : String(e));
  }
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
}

async function status() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("No pid file — Postgres may not be running via local-pg.");
    process.exitCode = 1;
    return;
  }
  console.log(fs.readFileSync(PID_FILE, "utf8"));
}

async function main() {
  const cmd = process.argv[2] || "start";
  if (cmd === "start") await start();
  else if (cmd === "stop") await stop();
  else if (cmd === "status") await status();
  else {
    console.error("Usage: node scripts/local-pg.js start|stop|status");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
