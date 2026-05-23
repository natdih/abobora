# Google Planilhas como banco online

Esta versao permite hospedar o site na Vercel e usar o Google Planilhas como banco central. Assim, varias pessoas podem acessar o mesmo link e cadastrar apostas sem deixar um notebook ligado.

## 1. Preparar a planilha

Crie uma planilha no Google Planilhas. O script cria automaticamente as abas:

```text
Competicoes
Apostas
```

## 2. Colar o Apps Script

Na planilha, acesse:

```text
Extensoes > Apps Script
```

Apague o conteudo do arquivo `Codigo.gs` e cole somente este codigo:

```javascript
const SECRET = "abobora-2026";
const COMPETITIONS_SHEET = "Competicoes";
const BETS_SHEET = "Apostas";

const COMPETITION_HEADERS = ["ID", "Nome", "Criada em"];
const BET_HEADERS = [
  "ID",
  "Status",
  "Acao",
  "Competicao ID",
  "Competicao",
  "Nome",
  "Telefone",
  "Telefone Digitos",
  "Palpite",
  "Criada em",
  "Atualizada em",
  "Sincronizada em"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");

    if (SECRET && payload.secret !== SECRET) {
      return jsonResponse({ ok: false, statusCode: 403, message: "Segredo invalido." });
    }

    ensureSheets();

    switch (payload.action) {
      case "health":
        return jsonResponse({ ok: true });
      case "listCompetitions":
        return jsonResponse({ ok: true, competitions: listCompetitions() });
      case "createCompetition":
        return jsonResponse({ ok: true, competition: createCompetition(payload.name) });
      case "listBets":
        return jsonResponse({ ok: true, bets: listBets(payload.competitionId) });
      case "createBet":
        return jsonResponse({ ok: true, bet: createBet(payload.competitionId, payload.bet) });
      case "importBets":
        return jsonResponse(importBets(payload.competitionId, payload.rows || []));
      case "updateBet":
        return jsonResponse({ ok: true, bet: updateBet(payload.id, payload.bet) });
      case "deleteBet":
        deleteBet(payload.id);
        return jsonResponse({ ok: true });
      case "created":
      case "imported":
        return jsonResponse({ ok: true, bet: upsertSyncedBet(payload.action, payload.bet) });
      case "updated":
        return jsonResponse({ ok: true, bet: upsertSyncedBet("updated", payload.bet) });
      case "deleted":
        markSyncedBetDeleted(payload.bet);
        return jsonResponse({ ok: true });
      default:
        return jsonResponse({ ok: false, statusCode: 400, message: "Acao invalida." });
    }
  } catch (error) {
    return jsonResponse({ ok: false, statusCode: error.statusCode || 500, message: error.message });
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const competitions = getOrCreateSheet(spreadsheet, COMPETITIONS_SHEET, COMPETITION_HEADERS);
  getOrCreateSheet(spreadsheet, BETS_SHEET, BET_HEADERS);

  if (competitions.getLastRow() < 2) {
    competitions.appendRow([1, "Abobora 2026", new Date()]);
  }
}

function getOrCreateSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function listCompetitions() {
  return readRows(COMPETITIONS_SHEET).map(function(row) {
    return {
      id: Number(row["ID"]),
      name: String(row["Nome"] || ""),
      createdAt: iso(row["Criada em"])
    };
  }).sort(function(a, b) {
    return b.id - a.id;
  });
}

function createCompetition(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw httpError(400, "Informe o nome da competicao.");

  const existing = listCompetitions().find(function(item) {
    return item.name.toLowerCase() === cleanName.toLowerCase();
  });
  if (existing) throw httpError(409, "Ja existe uma competicao com esse nome.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMPETITIONS_SHEET);
  const competition = {
    id: nextId(COMPETITIONS_SHEET),
    name: cleanName,
    createdAt: new Date()
  };
  sheet.appendRow([competition.id, competition.name, competition.createdAt]);

  return {
    id: competition.id,
    name: competition.name,
    createdAt: iso(competition.createdAt)
  };
}

function listBets(competitionId) {
  const targetCompetitionId = Number(competitionId);
  return readRows(BETS_SHEET)
    .filter(function(row) {
      return String(row["Status"]) !== "Removida" && Number(row["Competicao ID"]) === targetCompetitionId;
    })
    .map(rowToBet)
    .sort(function(a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id;
    });
}

function createBet(competitionId, bet) {
  const competition = findCompetition(competitionId);
  const valid = validateBet(bet);

  if (findDuplicate(Number(competitionId), valid, null)) {
    throw httpError(409, "Esse participante ja registrou esse palpite.");
  }

  const now = new Date();
  const newBet = {
    id: nextId(BETS_SHEET),
    status: "Ativa",
    action: "created",
    competitionId: competition.id,
    competitionName: competition.name,
    name: valid.name,
    phone: valid.phone,
    phoneDigits: valid.phoneDigits,
    guess: valid.guess,
    createdAt: now,
    updatedAt: now,
    syncedAt: now
  };

  appendBetRow(newBet);
  return serializeBet(newBet);
}

function importBets(competitionId, rows) {
  const imported = [];
  const errors = [];

  rows.forEach(function(row, index) {
    try {
      imported.push(createBet(competitionId, row).id);
    } catch (error) {
      errors.push({ line: index + 2, message: error.message });
    }
  });

  return { ok: true, imported: imported.length, errors: errors };
}

function updateBet(id, bet) {
  const found = findBetRow(id);
  if (!found) throw httpError(404, "Aposta nao encontrada.");

  const current = rowToBet(found.row);
  const valid = validateBet(bet);

  if (findDuplicate(current.competitionId, valid, Number(id))) {
    throw httpError(409, "Esse participante ja registrou esse palpite.");
  }

  const updated = {
    id: current.id,
    status: "Ativa",
    action: "updated",
    competitionId: current.competitionId,
    competitionName: current.competitionName,
    name: valid.name,
    phone: valid.phone,
    phoneDigits: valid.phoneDigits,
    guess: valid.guess,
    createdAt: current.createdAt,
    updatedAt: new Date(),
    syncedAt: new Date()
  };

  writeBetRow(found.index, updated);
  return serializeBet(updated);
}

function deleteBet(id) {
  const found = findBetRow(id);
  if (!found) return;

  const current = rowToBet(found.row);
  writeBetRow(found.index, {
    id: current.id,
    status: "Removida",
    action: "deleted",
    competitionId: current.competitionId,
    competitionName: current.competitionName,
    name: current.name,
    phone: current.phone,
    phoneDigits: current.phoneDigits,
    guess: current.guess,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    syncedAt: new Date()
  });
}

function upsertSyncedBet(action, bet) {
  if (!bet || !bet.id) throw httpError(400, "Aposta invalida.");

  ensureSyncedCompetition(bet);

  const found = findAnyBetRow(bet.id);
  const syncedBet = {
    id: Number(bet.id),
    status: "Ativa",
    action: action,
    competitionId: Number(bet.competitionId),
    competitionName: String(bet.competitionName || bet.competitionId || ""),
    name: String(bet.name || ""),
    phone: String(bet.phone || ""),
    phoneDigits: String(bet.phoneDigits || digitsOnly(bet.phone)),
    guess: Number(bet.guess),
    createdAt: bet.createdAt || new Date(),
    updatedAt: bet.updatedAt || new Date(),
    syncedAt: new Date()
  };

  if (found) {
    writeBetRow(found.index, syncedBet);
  } else {
    appendBetRow(syncedBet);
  }

  return serializeBet(syncedBet);
}

function markSyncedBetDeleted(bet) {
  if (!bet || !bet.id) return;

  const found = findAnyBetRow(bet.id);
  if (!found) return;

  const current = rowToBet(found.row);
  writeBetRow(found.index, {
    id: current.id,
    status: "Removida",
    action: "deleted",
    competitionId: current.competitionId,
    competitionName: current.competitionName,
    name: current.name,
    phone: current.phone,
    phoneDigits: current.phoneDigits,
    guess: current.guess,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    syncedAt: new Date()
  });
}

function ensureSyncedCompetition(bet) {
  const id = Number(bet.competitionId);
  if (!id || findCompetitionById(id)) return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMPETITIONS_SHEET);
  sheet.appendRow([id, String(bet.competitionName || "Competicao " + id), new Date()]);
}

function validateBet(body) {
  const name = String((body && body.name) || "").trim().replace(/\s+/g, " ");
  const phone = String((body && body.phone) || "").trim();
  const phoneDigits = digitsOnly(phone);
  const guess = Number(body && body.guess);

  if (!name) throw httpError(400, "Informe o nome do participante.");
  if (phoneDigits.length < 10 || phoneDigits.length > 11) throw httpError(400, "Informe um telefone brasileiro valido.");
  if (!Number.isInteger(guess) || guess <= 0) throw httpError(400, "O palpite deve ser um numero inteiro positivo.");

  return { name: name, phone: phone, phoneDigits: phoneDigits, guess: guess };
}

function findDuplicate(competitionId, bet, ignoreId) {
  const normalized = normalizeName(bet.name);
  return readRows(BETS_SHEET).some(function(row) {
    return String(row["Status"]) !== "Removida" &&
      Number(row["Competicao ID"]) === Number(competitionId) &&
      normalizeName(row["Nome"]) === normalized &&
      String(row["Telefone Digitos"]) === bet.phoneDigits &&
      Number(row["Palpite"]) === bet.guess &&
      Number(row["ID"]) !== Number(ignoreId);
  });
}

function findCompetition(id) {
  const competition = findCompetitionById(id);
  if (!competition) throw httpError(404, "Competicao nao encontrada.");
  return competition;
}

function findCompetitionById(id) {
  return listCompetitions().find(function(item) {
    return item.id === Number(id);
  });
}

function findBetRow(id) {
  const found = findAnyBetRow(id);
  if (!found || String(found.row["Status"]) === "Removida") return null;
  return found;
}

function findAnyBetRow(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BETS_SHEET);
  const rows = readRows(BETS_SHEET);

  for (let index = 0; index < rows.length; index += 1) {
    if (Number(rows[index]["ID"]) === Number(id)) {
      return { index: index + 2, row: rows[index], sheet: sheet };
    }
  }

  return null;
}

function readRows(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(header) {
    return String(header);
  });

  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ""; });
  }).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function nextId(sheetName) {
  const ids = readRows(sheetName).map(function(row) {
    return Number(row["ID"]) || 0;
  });
  return ids.length ? Math.max.apply(null, ids) + 1 : 1;
}

function appendBetRow(bet) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BETS_SHEET);
  sheet.appendRow(betToRow(bet));
}

function writeBetRow(rowNumber, bet) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BETS_SHEET);
  sheet.getRange(rowNumber, 1, 1, BET_HEADERS.length).setValues([betToRow(bet)]);
}

function betToRow(bet) {
  return [
    bet.id,
    bet.status,
    bet.action,
    bet.competitionId,
    bet.competitionName,
    bet.name,
    bet.phone,
    bet.phoneDigits,
    bet.guess,
    bet.createdAt,
    bet.updatedAt,
    bet.syncedAt
  ];
}

function rowToBet(row) {
  return {
    id: Number(row["ID"]),
    status: String(row["Status"]),
    action: String(row["Acao"]),
    competitionId: Number(row["Competicao ID"]),
    competitionName: String(row["Competicao"] || ""),
    name: String(row["Nome"] || ""),
    phone: String(row["Telefone"] || ""),
    phoneDigits: String(row["Telefone Digitos"] || ""),
    guess: Number(row["Palpite"]),
    createdAt: iso(row["Criada em"]),
    updatedAt: iso(row["Atualizada em"])
  };
}

function serializeBet(bet) {
  return {
    id: Number(bet.id),
    competitionId: Number(bet.competitionId),
    competitionName: String(bet.competitionName || ""),
    name: String(bet.name || ""),
    phone: String(bet.phone || ""),
    phoneDigits: String(bet.phoneDigits || ""),
    guess: Number(bet.guess),
    createdAt: iso(bet.createdAt),
    updatedAt: iso(bet.updatedAt)
  };
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function iso(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }
  return String(value);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Clique em salvar.

## 3. Publicar o Apps Script

No Apps Script:

1. Clique em `Implantar > Nova implantacao`.
2. Tipo: `App da Web`.
3. Executar como: `Eu`.
4. Quem pode acessar: `Qualquer pessoa`.
5. Clique em `Implantar`.
6. Copie a URL do app da Web.

Quando editar o script depois, use `Implantar > Gerenciar implantacoes > Editar > Nova versao`. Se voce apenas salvar e nao criar nova versao, a URL publicada continua usando o codigo antigo.

Se voce ja testou a versao antiga deste script, apague a aba `Apostas` antes do primeiro teste da versao nova. Ela sera criada de novo com as colunas certas.

## 4. Configurar na Vercel

No projeto da Vercel, cadastre estas variaveis em `Settings > Environment Variables`:

```text
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/SEU_ID/exec
GOOGLE_SHEETS_WEBHOOK_SECRET=abobora-2026
```

Depois faca um novo deploy.

## Como funciona

O site hospedado na Vercel chama a rota `/api`. Essa rota roda no servidor da Vercel, conversa com o Apps Script e o Apps Script le/escreve na planilha. O segredo fica na Vercel, nao aparece no navegador.
