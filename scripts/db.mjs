// Local PostgreSQL for development, no Docker needed.
// Runs a real PostgreSQL server from the embedded-postgres package and keeps
// data in ./.data/postgres. In staging/production point DATABASE_URL at a
// managed Postgres (Neon, Railway, Render, RDS) instead.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import pgPkg from "pg";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
const DB = "agri_hub";
const dataDir = path.resolve(".data/postgres");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  // UTF-8 regardless of the OS code page, so names, emoji and every language store correctly
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) {
  console.log("[db] initialising new cluster in", dataDir);
  await pg.initialise();
}
await pg.start();

const client = new pgPkg.Client({ host: "localhost", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await client.connect();
const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB]);
if (!rowCount) {
  await client.query(`CREATE DATABASE ${DB}`);
  console.log("[db] created database", DB);
}
await client.end();

console.log(`[db] PostgreSQL ready at postgresql://postgres:postgres@localhost:${PORT}/${DB}`);

const stop = async () => {
  console.log("\n[db] stopping…");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// keep the process alive
setInterval(() => {}, 1 << 30);
