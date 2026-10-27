#!/usr/bin/env node
/**
 * Repeatable SQL / RLS test run for supabase/migrations — no Docker, no
 * Supabase CLI, never touches a real project.
 *
 * It creates a THROWAWAY PostgreSQL cluster in a temp folder on a free
 * port, loads Supabase stand-ins (supabase/tests/stubs.sql), and checks:
 *
 *   1. chain      all migrations apply in order (with before/after-NNNN.sql
 *                 fixtures, e.g. the 0009 backfill), then every
 *                 supabase/verify/*.sql passes
 *   2. rollback   each supabase/rollback/NNNN_rollback.sql in reverse order:
 *                 the rolled-back migration's checks now fail, the earlier
 *                 ones still pass; then everything re-applies and passes
 *                 again (after-NNNN.sql re-checked: no drift)
 *   3. atomicity  for each migration with supabase/tests/conflict-NNNN.sql:
 *                 a forced failure part way through leaves the schema
 *                 exactly as it was
 *
 * PostgreSQL binaries: $PG_BIN, else PATH, else the default Windows /
 * Debian install locations. Usage:  npm run test:sql   (exit code 0 = pass)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dir = (...parts) => join(ROOT, ...parts);
const isWindows = process.platform === "win32";
const exe = (name) => (isWindows ? `${name}.exe` : name);

/* ------------------------------ setup ------------------------------ */

function findPgBin() {
  const candidates = [
    process.env.PG_BIN,
    ...(process.env.PATH ?? "").split(isWindows ? ";" : ":"),
    "C:\\Program Files\\PostgreSQL\\17\\bin",
    "/usr/lib/postgresql/17/bin",
    "/opt/homebrew/opt/postgresql@17/bin",
  ].filter(Boolean);
  const found = candidates.find((d) => existsSync(join(d, exe("initdb"))) && existsSync(join(d, exe("psql"))));
  if (!found) {
    console.error("PostgreSQL 15+ binaries (initdb, pg_ctl, psql) not found. Set PG_BIN to their folder.");
    process.exit(2);
  }
  return found;
}

const PG_BIN = findPgBin();
const bin = (name) => join(PG_BIN, exe(name));

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...options });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

const migrations = readdirSync(dir("supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
const id = (file) => file.slice(0, 4);
const exists = (...parts) => existsSync(dir(...parts));
const verifyFile = (mid) => dir("supabase", "verify", `${mid}_verify.sql`);
const withRollback = migrations.map(id).filter((mid) => exists("supabase", "rollback", `${mid}_rollback.sql`));

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg, detail = "") => {
  failures++;
  console.log(`  ✗ ${msg}${detail ? `\n      ${detail.trim().split("\n").slice(-3).join("\n      ")}` : ""}`);
};

/* ---------------------------- cluster ---------------------------- */

const workDir = mkdtempSync(join(tmpdir(), "gridline-sql-"));
const dataDir = join(workDir, "data");
const port = await freePort();

const init = run(bin("initdb"), ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-sync"]);
if (init.status !== 0) {
  console.error(init.stderr);
  process.exit(2);
}
// Connections go over TCP (127.0.0.1:port). On Linux/macOS the server also
// creates a Unix socket, by default in /var/run/postgresql, which a normal
// user (e.g. the GitHub Actions runner) can't write — so put it in workDir.
// Windows builds don't use that setting.
const serverOptions = [
  `-p ${port}`,
  "-c listen_addresses=127.0.0.1",
  "-c fsync=off",
  ...(isWindows ? [] : [`-c unix_socket_directories='${workDir}'`]),
].join(" ");
const serverLog = join(workDir, "server.log");

// The server inherits pg_ctl's stdio; capturing it would make spawnSync wait
// for the server to exit (it hangs on Windows). It logs to a file instead.
const start = run(
  bin("pg_ctl"),
  ["-D", dataDir, "-o", serverOptions, "-l", serverLog, "-w", "start"],
  { stdio: "ignore" },
);
if (start.status !== 0) {
  console.error(`pg_ctl start failed (exit ${start.status ?? start.error?.message}). Server log (${serverLog}):`);
  console.error(existsSync(serverLog) ? readFileSync(serverLog, "utf8") : "(no server log was written)");
  rmSync(workDir, { recursive: true, force: true });
  process.exit(2);
}

function cleanup() {
  run(bin("pg_ctl"), ["-D", dataDir, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
  rmSync(workDir, { recursive: true, force: true });
}
process.on("exit", cleanup);

/** psql against one database; returns { ok, out } with ON_ERROR_STOP. */
function psql(db, args) {
  const result = run(bin("psql"), [
    "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", db,
    "-v", "ON_ERROR_STOP=1", "-X", "-q", ...args,
  ]);
  return { ok: result.status === 0, out: `${result.stdout}\n${result.stderr}` };
}
const sqlFile = (db, path) => psql(db, ["-f", path]);
const sql = (db, text) => psql(db, ["-At", "-c", text]);

let dbCounter = 0;
function newDatabase() {
  const name = `t${++dbCounter}`;
  const created = sql("postgres", `create database ${name}`);
  if (!created.ok) throw new Error(created.out);
  const stubs = sqlFile(name, dir("supabase", "tests", "stubs.sql"));
  if (!stubs.ok) throw new Error(stubs.out);
  return name;
}

/** Apply one migration with its optional before/after fixtures. */
function applyMigration(db, file, { fixtures = true } = {}) {
  const mid = id(file);
  if (fixtures && exists("supabase", "tests", `before-${mid}.sql`)) {
    const before = sqlFile(db, dir("supabase", "tests", `before-${mid}.sql`));
    if (!before.ok) return { ok: false, out: before.out };
  }
  const applied = sqlFile(db, dir("supabase", "migrations", file));
  if (!applied.ok) return applied;
  if (exists("supabase", "tests", `after-${mid}.sql`)) {
    const after = sqlFile(db, dir("supabase", "tests", `after-${mid}.sql`));
    if (!after.ok) return { ok: false, out: after.out };
  }
  return applied;
}

function verify(db, mid) {
  const result = sqlFile(db, verifyFile(mid));
  return { ok: result.ok && result.out.includes("CHECKS PASSED"), out: result.out };
}

/** Schema fingerprint: functions, policies, columns, constraints, tables. */
function fingerprint(db) {
  const result = sql(
    db,
    `select md5(string_agg(x, '|' order by x)) from (
       select 'f:' || p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(array_to_string(p.proconfig, ','), '') as x
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'storage', 'auth')
       union all select 'p:' || tablename || ':' || policyname || ':' || coalesce(qual, '') || coalesce(with_check, '') from pg_policies
       union all select 'c:' || table_name || '.' || column_name || ':' || data_type from information_schema.columns where table_schema = 'public'
       union all select 'k:' || conrelid::regclass::text || ':' || conname from pg_constraint where connamespace = 'public'::regnamespace
       union all select 'b:' || id || ':' || coalesce(file_size_limit::text, '') || coalesce(array_to_string(allowed_mime_types, ','), '') from storage.buckets
     ) s`,
  );
  return result.out.trim();
}

/* ----------------------------- tests ----------------------------- */

console.log(`SQL tests — PostgreSQL ${run(bin("postgres"), ["--version"]).stdout.trim()} (throwaway cluster, port ${port})`);
console.log(`Migrations: ${migrations.map(id).join(" → ")}\n`);

// 1. Full chain + every verify script.
console.log("1. Apply all migrations, then every verify script");
const chain = newDatabase();
let chainOk = true;
for (const file of migrations) {
  const result = applyMigration(chain, file);
  if (result.ok) ok(`applied ${file}`);
  else {
    fail(`applying ${file}`, result.out);
    chainOk = false;
    break;
  }
}
const verifiable = migrations.map(id).filter((mid) => existsSync(verifyFile(mid)));
if (chainOk) {
  for (const mid of verifiable) {
    const result = verify(chain, mid);
    if (result.ok) ok(`${mid}_verify.sql passed`);
    else fail(`${mid}_verify.sql`, result.out);
  }
}

// 2. Rollback chain (reverse), then re-apply.
console.log("\n2. Roll back in reverse order, then re-apply");
if (chainOk) {
  for (const mid of [...withRollback].reverse()) {
    const rolled = sqlFile(chain, dir("supabase", "rollback", `${mid}_rollback.sql`));
    if (!rolled.ok) {
      fail(`${mid}_rollback.sql`, rolled.out);
      continue;
    }
    const nowFails = !verify(chain, mid).ok;
    const earlier = verifiable.filter((v) => v < mid);
    const earlierBroken = earlier.filter((v) => !verify(chain, v).ok);
    if (nowFails && earlierBroken.length === 0) {
      ok(`rolled back ${mid}: its checks fail as expected; ${earlier.length ? earlier.join(", ") + " still pass" : "nothing earlier to check"}`);
    } else {
      fail(`rolled back ${mid}`, nowFails ? `earlier checks broke: ${earlierBroken.join(", ")}` : `${mid}_verify.sql still passes after rollback`);
    }
  }
  for (const file of migrations.filter((f) => withRollback.includes(id(f)))) {
    const result = applyMigration(chain, file, { fixtures: false });
    if (result.ok) ok(`re-applied ${file}`);
    else fail(`re-applying ${file}`, result.out);
  }
  const broken = verifiable.filter((v) => !verify(chain, v).ok);
  if (broken.length === 0) ok("every verify script passes again after re-applying");
  else fail("verify after re-apply", broken.join(", "));
}

// 3. Atomicity: a forced failure part way through changes nothing.
console.log("\n3. Forced failure part way through a migration changes nothing");
for (const file of migrations) {
  const mid = id(file);
  if (!exists("supabase", "tests", `conflict-${mid}.sql`)) continue;
  const db = newDatabase();
  for (const earlier of migrations.filter((f) => id(f) < mid)) applyMigration(db, earlier);
  if (exists("supabase", "tests", `before-${mid}.sql`)) sqlFile(db, dir("supabase", "tests", `before-${mid}.sql`));
  sqlFile(db, dir("supabase", "tests", `conflict-${mid}.sql`));
  const before = fingerprint(db);
  const attempt = sqlFile(db, dir("supabase", "migrations", file));
  const after = fingerprint(db);
  if (!attempt.ok && before === after) ok(`${file}: failed as forced and left the schema untouched`);
  else fail(`${file} atomicity`, attempt.ok ? "the forced failure did not happen" : "schema changed despite the failure");
}

console.log(failures ? `\n${failures} SQL check(s) FAILED` : "\nAll SQL checks passed");
process.exitCode = failures ? 1 : 0;
