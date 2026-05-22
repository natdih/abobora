import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "app.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone_digits TEXT NOT NULL,
    guess INTEGER NOT NULL CHECK (guess > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
  );
`);

const getCompetitionCount = db.prepare("SELECT COUNT(*) AS total FROM competitions");
const getBetCount = db.prepare("SELECT COUNT(*) AS total FROM bets");
const insertCompetition = db.prepare("INSERT INTO competitions (name) VALUES (?)");
const insertBet = db.prepare(`
  INSERT INTO bets (competition_id, name, phone, phone_digits, guess, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

if (getCompetitionCount.get().total === 0) {
  insertCompetition.run("Abóbora 2026");
}

const defaultCompetition = db.prepare("SELECT id FROM competitions ORDER BY id LIMIT 1").get();

if (getBetCount.get().total === 0 && defaultCompetition) {
  [
    ["Maria Aparecida", "(11) 98888-1001", 523],
    ["João Batista", "(11) 97777-2002", 610],
    ["João Batista", "(11) 97777-2002", 777],
    ["Ana Clara", "(11) 96666-3003", 498],
    ["Pedro Henrique", "(11) 95555-4004", 650],
    ["Dona Lourdes", "(11) 94444-5005", 555],
    ["Carlos Eduardo", "(11) 93333-6006", 701],
    ["Fernanda Lima", "(11) 92222-7007", 590]
  ].forEach(([name, phone, guess]) => {
    insertBet.run(defaultCompetition.id, name, phone, digitsOnly(phone), guess);
  });
}

const app = express();
const port = process.env.PORT || 3333;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizeName(value = "") {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function validateBet(body) {
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const phone = String(body.phone ?? "").trim();
  const phoneDigits = digitsOnly(phone);
  const guess = Number(body.guess);

  if (!name) return { error: "Informe o nome do participante." };
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return { error: "Informe um telefone brasileiro válido." };
  if (!Number.isInteger(guess) || guess <= 0) return { error: "O palpite deve ser um número inteiro positivo." };

  return { value: { name, phone, phoneDigits, guess } };
}

function findDuplicate({ competitionId, name, phoneDigits, guess, ignoreId }) {
  const sql = `
    SELECT id FROM bets
    WHERE competition_id = ?
      AND lower(trim(name)) = ?
      AND phone_digits = ?
      AND guess = ?
      ${ignoreId ? "AND id != ?" : ""}
    LIMIT 1
  `;
  const params = ignoreId
    ? [competitionId, normalizeName(name), phoneDigits, guess, ignoreId]
    : [competitionId, normalizeName(name), phoneDigits, guess];
  return db.prepare(sql).get(...params);
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/competitions", (_req, res) => {
  const rows = db.prepare("SELECT id, name, created_at AS createdAt FROM competitions ORDER BY id DESC").all();
  res.json(rows);
});

app.post("/api/competitions", (req, res) => {
  const name = String(req.body.name ?? "").trim();
  if (!name) return res.status(400).json({ message: "Informe o nome da competição." });

  try {
    const result = insertCompetition.run(name);
    const row = db.prepare("SELECT id, name, created_at AS createdAt FROM competitions WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch {
    res.status(409).json({ message: "Já existe uma competição com esse nome." });
  }
});

app.get("/api/competitions/:competitionId/bets", (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const rows = db.prepare("SELECT * FROM bets WHERE competition_id = ? ORDER BY created_at DESC, id DESC").all(competitionId);
  res.json(rows.map(serializeBet));
});

app.post("/api/competitions/:competitionId/bets", (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const validation = validateBet(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const bet = validation.value;
  if (findDuplicate({ competitionId, ...bet })) {
    return res.status(409).json({ message: "Esse participante já registrou esse palpite." });
  }

  const result = insertBet.run(competitionId, bet.name, bet.phone, bet.phoneDigits, bet.guess);
  const row = db.prepare("SELECT * FROM bets WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(serializeBet(row));
});

app.post("/api/competitions/:competitionId/bets/import", (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const imported = [];
  const errors = [];

  rows.forEach((row, index) => {
    const validation = validateBet(row);
    if (validation.error) {
      errors.push({ line: index + 2, message: validation.error });
      return;
    }

    const bet = validation.value;
    if (findDuplicate({ competitionId, ...bet })) {
      errors.push({ line: index + 2, message: "Duplicado: participante já registrou esse palpite." });
      return;
    }

    const result = insertBet.run(competitionId, bet.name, bet.phone, bet.phoneDigits, bet.guess);
    imported.push(result.lastInsertRowid);
  });

  res.json({ imported: imported.length, errors });
});

app.put("/api/bets/:id", (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare("SELECT * FROM bets WHERE id = ?").get(id);
  if (!current) return res.status(404).json({ message: "Aposta não encontrada." });

  const validation = validateBet(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const bet = validation.value;
  if (findDuplicate({ competitionId: current.competition_id, ...bet, ignoreId: id })) {
    return res.status(409).json({ message: "Esse participante já registrou esse palpite." });
  }

  db.prepare(`
    UPDATE bets
    SET name = ?, phone = ?, phone_digits = ?, guess = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(bet.name, bet.phone, bet.phoneDigits, bet.guess, id);

  const row = db.prepare("SELECT * FROM bets WHERE id = ?").get(id);
  res.json(serializeBet(row));
});

app.delete("/api/bets/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM bets WHERE id = ?").run(id);
  res.status(204).end();
});

const distDir = path.join(rootDir, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
