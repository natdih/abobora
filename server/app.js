import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isVercel = Boolean(process.env.VERCEL);
const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false
    })
  : null;

let databaseReady;

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function shouldUseSsl(url) {
  if (process.env.POSTGRES_SSL === "false") return false;
  return !url.includes("localhost") && !url.includes("127.0.0.1");
}

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizeName(value = "") {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

async function query(text, params) {
  const client = await getDatabase();
  return client.query(text, params);
}

async function getDatabase() {
  if (!pool) {
    throw new Error("DATABASE_URL nao foi configurada.");
  }

  databaseReady ??= initializeDatabase();
  await databaseReady;
  return pool;
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phone_digits TEXT NOT NULL,
      guess INTEGER NOT NULL CHECK (guess > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const competitionCount = await pool.query("SELECT COUNT(*)::int AS total FROM competitions");

  if (competitionCount.rows[0].total === 0) {
    await pool.query("INSERT INTO competitions (name) VALUES ($1)", ["Abobora 2026"]);
  }

  const betCount = await pool.query("SELECT COUNT(*)::int AS total FROM bets");
  const defaultCompetition = await pool.query("SELECT id FROM competitions ORDER BY id LIMIT 1");
  const defaultCompetitionId = defaultCompetition.rows[0]?.id;

  if (betCount.rows[0].total === 0 && defaultCompetitionId) {
    const seedBets = [
      ["Maria Aparecida", "(11) 98888-1001", 523],
      ["Joao Batista", "(11) 97777-2002", 610],
      ["Joao Batista", "(11) 97777-2002", 777],
      ["Ana Clara", "(11) 96666-3003", 498],
      ["Pedro Henrique", "(11) 95555-4004", 650],
      ["Dona Lourdes", "(11) 94444-5005", 555],
      ["Carlos Eduardo", "(11) 93333-6006", 701],
      ["Fernanda Lima", "(11) 92222-7007", 590]
    ];

    for (const [name, phone, guess] of seedBets) {
      await pool.query(
        `
          INSERT INTO bets (competition_id, name, phone, phone_digits, guess)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [defaultCompetitionId, name, phone, digitsOnly(phone), guess]
      );
    }
  }
}

function validateBet(body) {
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const phone = String(body.phone ?? "").trim();
  const phoneDigits = digitsOnly(phone);
  const guess = Number(body.guess);

  if (!name) return { error: "Informe o nome do participante." };
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return { error: "Informe um telefone brasileiro valido." };
  if (!Number.isInteger(guess) || guess <= 0) return { error: "O palpite deve ser um numero inteiro positivo." };

  return { value: { name, phone, phoneDigits, guess } };
}

async function findDuplicate({ competitionId, name, phoneDigits, guess, ignoreId }) {
  const params = [competitionId, normalizeName(name), phoneDigits, guess];
  const ignoreClause = ignoreId ? "AND id != $5" : "";

  if (ignoreId) params.push(ignoreId);

  const result = await query(
    `
      SELECT id FROM bets
      WHERE competition_id = $1
        AND lower(trim(name)) = $2
        AND phone_digits = $3
        AND guess = $4
        ${ignoreClause}
      LIMIT 1
    `,
    params
  );

  return result.rows[0];
}

function serializeBet(row) {
  return {
    id: row.id,
    competitionId: row.competition_id,
    name: row.name,
    phone: row.phone,
    phoneDigits: row.phone_digits,
    guess: row.guess,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  if (!databaseUrl) {
    return res.status(500).json({ ok: false, message: "DATABASE_URL nao foi configurada." });
  }

  await query("SELECT 1");
  res.json({ ok: true, database: "postgres" });
}));

app.get("/api/competitions", asyncRoute(async (_req, res) => {
  const result = await query('SELECT id, name, created_at AS "createdAt" FROM competitions ORDER BY id DESC');
  res.json(result.rows);
}));

app.post("/api/competitions", asyncRoute(async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  if (!name) return res.status(400).json({ message: "Informe o nome da competicao." });

  try {
    const result = await query(
      'INSERT INTO competitions (name) VALUES ($1) RETURNING id, name, created_at AS "createdAt"',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Ja existe uma competicao com esse nome." });
    }

    throw error;
  }
}));

app.get("/api/competitions/:competitionId/bets", asyncRoute(async (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const result = await query(
    "SELECT * FROM bets WHERE competition_id = $1 ORDER BY created_at DESC, id DESC",
    [competitionId]
  );
  res.json(result.rows.map(serializeBet));
}));

app.post("/api/competitions/:competitionId/bets", asyncRoute(async (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const validation = validateBet(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const bet = validation.value;
  if (await findDuplicate({ competitionId, ...bet })) {
    return res.status(409).json({ message: "Esse participante ja registrou esse palpite." });
  }

  const result = await query(
    `
      INSERT INTO bets (competition_id, name, phone, phone_digits, guess)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [competitionId, bet.name, bet.phone, bet.phoneDigits, bet.guess]
  );

  res.status(201).json(serializeBet(result.rows[0]));
}));

app.post("/api/competitions/:competitionId/bets/import", asyncRoute(async (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const imported = [];
  const errors = [];

  for (const [index, row] of rows.entries()) {
    const validation = validateBet(row);
    if (validation.error) {
      errors.push({ line: index + 2, message: validation.error });
      continue;
    }

    const bet = validation.value;
    if (await findDuplicate({ competitionId, ...bet })) {
      errors.push({ line: index + 2, message: "Duplicado: participante ja registrou esse palpite." });
      continue;
    }

    const result = await query(
      `
        INSERT INTO bets (competition_id, name, phone, phone_digits, guess)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [competitionId, bet.name, bet.phone, bet.phoneDigits, bet.guess]
    );
    imported.push(result.rows[0].id);
  }

  res.json({ imported: imported.length, errors });
}));

app.put("/api/bets/:id", asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const current = await query("SELECT * FROM bets WHERE id = $1", [id]);
  if (!current.rows[0]) return res.status(404).json({ message: "Aposta nao encontrada." });

  const validation = validateBet(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const bet = validation.value;
  if (await findDuplicate({ competitionId: current.rows[0].competition_id, ...bet, ignoreId: id })) {
    return res.status(409).json({ message: "Esse participante ja registrou esse palpite." });
  }

  const result = await query(
    `
      UPDATE bets
      SET name = $1, phone = $2, phone_digits = $3, guess = $4, updated_at = now()
      WHERE id = $5
      RETURNING *
    `,
    [bet.name, bet.phone, bet.phoneDigits, bet.guess, id]
  );

  res.json(serializeBet(result.rows[0]));
}));

app.delete("/api/bets/:id", asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await query("DELETE FROM bets WHERE id = $1", [id]);
  res.status(204).end();
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Nao foi possivel concluir a operacao." });
});

const distDir = path.join(rootDir, "dist");
if (!isVercel && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

export default app;
