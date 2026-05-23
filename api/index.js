import express from "express";

const app = express();
const sheetsUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const sheetsSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

app.use(express.json({ limit: "2mb" }));

async function callSheets(action, payload = {}) {
  if (!sheetsUrl) {
    const error = new Error("Configure GOOGLE_SHEETS_WEBHOOK_URL na Vercel.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(sheetsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: sheetsSecret, action, ...payload })
  });

  const text = await response.text();
  if (!text.trim()) {
    const error = new Error("O Apps Script respondeu vazio. Publique uma nova versao do script e confira a URL /exec.");
    error.statusCode = 502;
    throw error;
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    const error = new Error("O Apps Script nao retornou JSON valido. Confira se a URL publicada e do App da Web.");
    error.statusCode = 502;
    throw error;
  }

  if (!response.ok || body.ok === false) {
    const error = new Error(body.message || "Nao foi possivel acessar o Google Planilhas.");
    error.statusCode = body.statusCode || response.status || 500;
    throw error;
  }

  return body;
}

function handleError(error, res) {
  res.status(error.statusCode || 500).json({ message: error.message || "Erro inesperado." });
}

function requireArray(value, message) {
  if (Array.isArray(value)) return value;

  const error = new Error(message);
  error.statusCode = 502;
  throw error;
}

function requireObject(value, message) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;

  const error = new Error(message);
  error.statusCode = 502;
  throw error;
}

app.get("/api/health", async (_req, res) => {
  try {
    await callSheets("health");
    res.json({ ok: true, database: "google-sheets" });
  } catch (error) {
    handleError(error, res);
  }
});

app.get("/api/competitions", async (_req, res) => {
  try {
    const body = await callSheets("listCompetitions");
    res.json(requireArray(body.competitions, "O Apps Script publicado ainda nao tem listCompetitions. Publique uma nova versao com o codigo de GOOGLE_SHEETS.md."));
  } catch (error) {
    handleError(error, res);
  }
});

app.post("/api/competitions", async (req, res) => {
  try {
    const body = await callSheets("createCompetition", { name: req.body.name });
    res.status(201).json(requireObject(body.competition, "O Apps Script publicado ainda nao tem createCompetition."));
  } catch (error) {
    handleError(error, res);
  }
});

app.get("/api/competitions/:competitionId/bets", async (req, res) => {
  try {
    const body = await callSheets("listBets", { competitionId: Number(req.params.competitionId) });
    res.json(requireArray(body.bets, "O Apps Script publicado ainda nao tem listBets. Publique uma nova versao com o codigo de GOOGLE_SHEETS.md."));
  } catch (error) {
    handleError(error, res);
  }
});

app.post("/api/competitions/:competitionId/bets", async (req, res) => {
  try {
    const body = await callSheets("createBet", {
      competitionId: Number(req.params.competitionId),
      bet: req.body
    });
    res.status(201).json(requireObject(body.bet, "O Apps Script publicado ainda nao tem createBet. Publique uma nova versao com o codigo de GOOGLE_SHEETS.md."));
  } catch (error) {
    handleError(error, res);
  }
});

app.post("/api/competitions/:competitionId/bets/import", async (req, res) => {
  try {
    const body = await callSheets("importBets", {
      competitionId: Number(req.params.competitionId),
      rows: Array.isArray(req.body.rows) ? req.body.rows : []
    });
    res.json({
      imported: Number(body.imported || 0),
      errors: requireArray(body.errors, "O Apps Script publicado ainda nao tem importBets.")
    });
  } catch (error) {
    handleError(error, res);
  }
});

app.put("/api/bets/:id", async (req, res) => {
  try {
    const body = await callSheets("updateBet", { id: Number(req.params.id), bet: req.body });
    res.json(requireObject(body.bet, "O Apps Script publicado ainda nao tem updateBet."));
  } catch (error) {
    handleError(error, res);
  }
});

app.delete("/api/bets/:id", async (req, res) => {
  try {
    await callSheets("deleteBet", { id: Number(req.params.id) });
    res.status(204).end();
  } catch (error) {
    handleError(error, res);
  }
});

export default app;
