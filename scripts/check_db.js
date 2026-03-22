const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'db_output.txt');
const log = [];
function addLog(msg) { log.push(msg); fs.writeFileSync(logFile, log.join('\n'), 'utf8'); }

addLog('Script started');

// Manual .env loader
const envPath = path.join(__dirname, '..', '.env');
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  addLog('.env file found, length: ' + envContent.length);
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
} catch (e) { addLog('.env error: ' + e.message); }

const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  addLog('DATABASE_URL set: ' + !!url);
  if (!url) {
    addLog('ERROR: DATABASE_URL is not set');
    return;
  }
  addLog('DATABASE_URL prefix: ' + url.substring(0, 30) + '...');

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    addLog('Connected OK');

    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    addLog('Tables before: ' + JSON.stringify(res.rows));

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "duration" INTEGER NOT NULL,
        "sport" TEXT NOT NULL,
        "distance" DOUBLE PRECISION,
        "avgHr" INTEGER,
        "maxHr" INTEGER,
        "calories" INTEGER,
        "trimp" DOUBLE PRECISION,
        "laps" JSONB,
        "rawData" JSONB,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "Session_date_idx" ON "Session"("date");
    `);
    addLog('CREATE TABLE done');

    const res2 = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    addLog('Tables after: ' + JSON.stringify(res2.rows));
  } catch (err) {
    addLog('DB error: ' + err.message);
  } finally {
    await client.end();
    addLog('DONE');
  }
}

main().catch(err => addLog('Uncaught: ' + err.message));
