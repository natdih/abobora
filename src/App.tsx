import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileDown,
  FileSpreadsheet,
  Flame,
  Moon,
  Pencil,
  Printer,
  Search,
  Sun,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import { api } from "./services/api";
import type { Bet, BetPayload, Competition, ResultEntry } from "./types";
import { cn, digitsOnly, downloadBlob, formatDateTime, formatPhone } from "./utils/format";
import { Button } from "./components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/Card";
import { Input } from "./components/ui/Input";
import { ToastHost } from "./components/ToastHost";
import { useToasts } from "./hooks/useToasts";
import { useTheme } from "./hooks/useTheme";

type SortKey = "createdAt" | "name" | "guess";
type SortDir = "asc" | "desc";
type ExportRow = {
  ID: number;
  Nome: string;
  Telefone: string;
  Palpite: number;
  "Data/Hora": string;
};
type BetForm = {
  name: string;
  phone: string;
  guesses: string;
};

const pageSize = 8;

function emptyForm(): BetForm {
  return { name: "", phone: "", guesses: "" };
}

function parseGuesses(value: string) {
  const invalidTokens: string[] = [];
  const guesses = value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (!/^\d+$/.test(item) || Number(item) <= 0) {
        invalidTokens.push(item);
        return null;
      }
      return Number(item);
    })
    .filter((item): item is number => item !== null);

  return { guesses, invalidTokens };
}

function statsFor(bets: Bet[]) {
  const guesses = bets.map((bet) => bet.guess);
  return {
    total: bets.length,
    maxGuess: guesses.length ? Math.max(...guesses) : 0,
    minGuess: guesses.length ? Math.min(...guesses) : 0,
    last: [...bets].sort((a, b) => b.id - a.id)[0]
  };
}

function buildRanking(bets: Bet[], realValue: number): ResultEntry[] {
  const ranked = bets
    .map((bet) => ({ ...bet, difference: Math.abs(bet.guess - realValue), position: 0 }))
    .sort((a, b) => a.difference - b.difference || a.guess - b.guess || a.id - b.id);

  let lastDifference = -1;
  let position = 0;
  return ranked.map((entry, index) => {
    if (entry.difference !== lastDifference) {
      position = index + 1;
      lastDifference = entry.difference;
    }
    return { ...entry, position };
  });
}

function App() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [form, setForm] = useState<BetForm>(emptyForm());
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [realValue, setRealValue] = useState("");
  const [ranking, setRanking] = useState<ResultEntry[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Bet | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const guessRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { toasts, pushToast } = useToasts();
  const { dark, setDark } = useTheme();

  async function loadAll() {
    setLoading(true);
    const loadedCompetitions = await api.competitions();
    setCompetitions(loadedCompetitions);
    const nextId = competitionId ?? loadedCompetitions[0]?.id ?? null;
    setCompetitionId(nextId);
    if (nextId) setBets(await api.bets(nextId));
    setLoading(false);
  }

  async function refreshBets(nextCompetitionId = competitionId) {
    if (!nextCompetitionId) return;
    setBets(await api.bets(nextCompetitionId));
  }

  useEffect(() => {
    loadAll().catch((error) => pushToast("error", error.message));
  }, []);

  useEffect(() => {
    if (competitionId) refreshBets(competitionId).catch((error) => pushToast("error", error.message));
  }, [competitionId]);

  useEffect(() => {
    const backup = {
      generatedAt: new Date().toISOString(),
      competition: competitions.find((item) => item.id === competitionId)?.name,
      bets
    };
    localStorage.setItem("sementes-backup-json", JSON.stringify(backup));
  }, [bets, competitions, competitionId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        newPerson();
      }
      if (event.key === "Escape" && document.activeElement === guessRef.current) {
        setForm((current) => ({ ...current, guesses: "" }));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const dashboard = useMemo(() => statsFor(bets), [bets]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = bets.filter((bet) => {
      if (!term) return true;
      return (
        bet.name.toLowerCase().includes(term) ||
        bet.phoneDigits.includes(digitsOnly(term)) ||
        String(bet.guess).includes(term)
      );
    });

    rows.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      const left = sortKey === "name" ? a.name : sortKey === "guess" ? a.guess : new Date(a.createdAt).getTime();
      const right = sortKey === "name" ? b.name : sortKey === "guess" ? b.guess : new Date(b.createdAt).getTime();
      return left > right ? direction : left < right ? -direction : 0;
    });

    return rows;
  }, [bets, query, sortDir, sortKey]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  function updateForm(field: keyof BetForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: field === "guesses" ? value.replace(/[^\d,;\s]/g, "") : value
    }));
  }

  async function saveBet() {
    if (!competitionId) return;
    try {
      const { guesses, invalidTokens } = parseGuesses(form.guesses);
      if (invalidTokens.length) {
        pushToast("error", `Revise estes palpites: ${invalidTokens.join(", ")}.`);
        return;
      }
      if (!guesses.length) {
        pushToast("error", "Informe pelo menos um palpite.");
        return;
      }
      const repeatedInField = guesses.find((guess, index) => guesses.indexOf(guess) !== index);
      if (repeatedInField) {
        pushToast("error", `O palpite ${repeatedInField} foi digitado mais de uma vez.`);
        return;
      }

      const basePayload = { name: form.name, phone: formatPhone(form.phone) };
      if (editingBet) {
        if (guesses.length > 1) {
          pushToast("error", "Na edição, informe apenas um palpite.");
          return;
        }
        await api.updateBet(editingBet.id, { ...basePayload, guess: guesses[0] });
        setEditingBet(null);
        setForm(emptyForm());
        nameRef.current?.focus();
        pushToast("success", "Aposta atualizada com sucesso.");
      } else {
        const saved: number[] = [];
        const failed: string[] = [];
        for (const guess of guesses) {
          try {
            await api.createBet(competitionId, { ...basePayload, guess });
            saved.push(guess);
          } catch (error) {
            failed.push(`${guess}: ${error instanceof Error ? error.message : "erro ao salvar"}`);
          }
        }
        setForm(emptyForm());
        nameRef.current?.focus();
        if (saved.length) {
          pushToast("success", `${saved.length} aposta${saved.length > 1 ? "s" : ""} salva${saved.length > 1 ? "s" : ""}.`);
        }
        if (failed.length) {
          pushToast("error", `Não salvas: ${failed.join(" | ")}`);
        }
      }
      await refreshBets();
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Erro ao salvar aposta.");
    }
  }

  function newPerson() {
    setEditingBet(null);
    setForm(emptyForm());
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }

  function startEdit(bet: Bet) {
    setEditingBet(bet);
    setForm({ name: bet.name, phone: bet.phone, guesses: String(bet.guess) });
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }

  async function removeBet(bet: Bet) {
    if (!window.confirm(`Excluir a aposta de ${bet.name} (${bet.guess})?`)) return;
    await api.deleteBet(bet.id);
    await refreshBets();
    pushToast("success", "Aposta excluída.");
  }

  function calculateResult() {
    const value = Number(realValue);
    if (!Number.isInteger(value) || value <= 0) {
      pushToast("error", "Informe a quantidade real de sementes.");
      return;
    }
    const nextRanking = buildRanking(bets, value);
    setRanking(nextRanking);
    setCelebrating(nextRanking.some((entry) => entry.difference === 0));
    window.setTimeout(() => setCelebrating(false), 2200);
  }

  function exportCsv() {
    const header = ["ID", "Nome", "Telefone", "Palpite", "Data/Hora"];
    const rows = bets.map((bet) => [bet.id, bet.name, bet.phone, bet.guess, formatDateTime(bet.createdAt)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    downloadBlob(csv, "apostas-sementes.csv", "text/csv;charset=utf-8");
  }

  async function exportXlsx() {
    const rows: ExportRow[] = bets.map((bet) => ({
      ID: bet.id,
      Nome: bet.name,
      Telefone: bet.phone,
      Palpite: bet.guess,
      "Data/Hora": formatDateTime(bet.createdAt)
    }));
    const file = await writeXlsxFile(rows, {
      columns: [
        { header: "ID", cell: (row: ExportRow) => row.ID, width: 10 },
        { header: "Nome", cell: (row: ExportRow) => row.Nome, width: 28 },
        { header: "Telefone", cell: (row: ExportRow) => row.Telefone, width: 18 },
        { header: "Palpite", cell: (row: ExportRow) => row.Palpite, width: 12 },
        { header: "Data/Hora", cell: (row: ExportRow) => row["Data/Hora"], width: 20 }
      ]
    });
    await file.toFile("apostas-sementes.xlsx");
  }

  async function importXlsx(file: File) {
    const rows = await readSheet(file);
    const [headers = [], ...dataRows] = rows;
    const normalizedHeaders = headers.map((header: unknown) => String(header ?? "").trim().toLowerCase());
    const findColumn = (...names: string[]) => normalizedHeaders.findIndex((header: string) => names.includes(header));
    const nameIndex = findColumn("nome", "participante");
    const phoneIndex = findColumn("telefone", "celular");
    const guessIndex = findColumn("palpite", "sementes", "quantidade");

    const payload = dataRows.map((row: unknown[]) => ({
      name: String(row[nameIndex] ?? "").trim(),
      phone: String(row[phoneIndex] ?? "").trim(),
      guess: Number(row[guessIndex])
    }));

    if (!competitionId) return;
    const result = await api.importBets(competitionId, payload);
    await refreshBets();
    pushToast(
      result.errors.length ? "info" : "success",
      `${result.imported} apostas importadas. ${result.errors.length ? `${result.errors.length} linhas ignoradas.` : ""}`
    );
  }

  const selectedPersonBets = selectedPerson
    ? bets.filter((bet) => bet.name.toLowerCase() === selectedPerson.name.toLowerCase() && bet.phoneDigits === selectedPerson.phoneDigits)
    : [];
  const currentCompetition = competitions.find((competition) => competition.id === competitionId);

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5 lg:px-8">
      <ToastHost toasts={toasts} />
      {celebrating && <Confetti />}

      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-card/80 p-4 shadow-soft backdrop-blur sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <Flame className="h-4 w-4" /> Festa junina
            </div>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl">Quantas sementes tem na abóbora?</h1>
            <p className="mt-1 text-muted-foreground">Atendimento rápido para registrar palpites e revelar vencedores.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Button variant="secondary" size="icon" title="Alternar tema" onClick={() => setDark(!dark)}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <section className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <p className="text-sm font-semibold text-muted-foreground">Competição</p>
          <strong className="text-xl">{currentCompetition?.name ?? "Abóbora 2026"}</strong>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(520px,0.95fr)_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{editingBet ? "Editar aposta" : "Cadastro rápido"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveBet();
                }}
              >
                <label className="grid gap-1 font-semibold">
                  Nome completo
                  <Input ref={nameRef} value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
                </label>
                <label className="grid gap-1 font-semibold">
                  Telefone
                  <Input
                    value={form.phone}
                    onChange={(event) => updateForm("phone", formatPhone(event.target.value))}
                    inputMode="tel"
                    required
                  />
                </label>
                <label className="grid gap-1 font-semibold">
                  Palpite(s)
                  <Input
                    ref={guessRef}
                    value={form.guesses}
                    onChange={(event) => updateForm("guesses", event.target.value)}
                    inputMode="text"
                    placeholder={editingBet ? "Quantidade de sementes" : "Ex.: 523, 610; 777"}
                    required
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" type="submit">{editingBet ? "Salvar edição" : "Salvar aposta"}</Button>
                  <Button size="lg" type="button" variant="secondary" onClick={newPerson}>Nova pessoa</Button>
                </div>
                <p className="text-sm text-muted-foreground">Separe vários palpites por vírgula ou ponto e vírgula. Enter salva e limpa o cadastro. Esc limpa os palpites.</p>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <Dashboard stats={dashboard} />
            <ResultsPanel realValue={realValue} setRealValue={setRealValue} ranking={ranking} calculateResult={calculateResult} />
          </div>
        </section>

        <section className="grid gap-5">
          <BetsTable
            bets={paginated}
            filteredCount={filtered.length}
            totalCount={bets.length}
            page={page}
            pageCount={pageCount}
            query={query}
            sortKey={sortKey}
            sortDir={sortDir}
            setPage={setPage}
            setQuery={setQuery}
            setSortKey={setSortKey}
            setSortDir={setSortDir}
            onEdit={startEdit}
            onDelete={removeBet}
            onPerson={setSelectedPerson}
          />
          <Card className="no-print">
            <CardHeader>
              <CardTitle>Arquivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Button variant="secondary" onClick={exportCsv}><FileDown className="h-4 w-4" /> Exportar CSV</Button>
                <Button variant="secondary" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4" /> Exportar Excel</Button>
                <Button variant="secondary" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Importar Excel</Button>
                <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir relatório</Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadBlob(localStorage.getItem("sementes-backup-json") ?? "{}", "backup-sementes.json", "application/json")}
                >
                  <Download className="h-4 w-4" /> Baixar backup JSON
                </Button>
                <input
                  ref={importRef}
                  className="hidden"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importXlsx(file).catch((error) => pushToast("error", error.message));
                    event.target.value = "";
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {selectedPerson && (
        <PersonModal bet={selectedPerson} bets={selectedPersonBets} onClose={() => setSelectedPerson(null)} />
      )}

      {loading && <div className="fixed inset-0 grid place-items-center bg-background/70 font-bold">Carregando...</div>}
    </main>
  );
}

function Dashboard({ stats }: { stats: ReturnType<typeof statsFor> }) {
  const cards = [
    ["Total de apostas", stats.total],
    ["Maior palpite", stats.maxGuess || "-"],
    ["Menor palpite", stats.minGuess || "-"]
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map(([label, value]) => (
        <Card key={label} className="p-4">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <strong className="mt-1 block text-2xl">{value}</strong>
        </Card>
      ))}
      <Card className="p-4 sm:col-span-3">
        <p className="text-sm font-semibold text-muted-foreground">Última aposta registrada</p>
        <strong className="mt-1 block text-lg">
          {stats.last ? `${stats.last.name} - ${stats.last.guess} sementes` : "Nenhuma aposta ainda"}
        </strong>
      </Card>
    </div>
  );
}

function ResultsPanel({
  realValue,
  setRealValue,
  ranking,
  calculateResult
}: {
  realValue: string;
  setRealValue: (value: string) => void;
  ranking: ResultEntry[];
  calculateResult: () => void;
}) {
  const exact = ranking.filter((entry) => entry.difference === 0);
  const top = ranking.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Resultado</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input value={realValue} onChange={(event) => setRealValue(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Quantidade real de sementes" />
          <Button onClick={calculateResult}>Calcular resultado</Button>
        </div>
        {ranking.length > 0 && (
          <div className="grid gap-3">
            <div className={cn("rounded-md border p-3", exact.length ? "border-yellow-400 bg-yellow-50 text-yellow-950" : "border-border bg-muted")}>
              <strong>{exact.length ? "Acertou exatamente" : "Mais perto"}</strong>
              <p>{exact.length ? exact.map((entry) => entry.name).join(", ") : `${ranking[0].name} ficou a ${ranking[0].difference} sementes.`}</p>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr><th className="p-2">Pos.</th><th>Nome</th><th>Telefone</th><th>Palpite</th><th>Diferença</th></tr>
                </thead>
                <tbody>
                  {top.map((entry) => (
                    <tr key={entry.id} className={cn("border-t border-border", entry.position === 1 && "bg-yellow-100/70 dark:bg-yellow-900/20", entry.position === 2 && "bg-slate-200/70 dark:bg-slate-700/30", entry.position === 3 && "bg-orange-100/80 dark:bg-orange-900/20")}>
                      <td className="p-2 font-black">{entry.position}</td>
                      <td className="font-semibold">{entry.name}</td>
                      <td>{entry.phone}</td>
                      <td>{entry.guess}</td>
                      <td>{entry.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BetsTable(props: {
  bets: Bet[];
  filteredCount: number;
  totalCount: number;
  page: number;
  pageCount: number;
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
  setPage: (page: number) => void;
  setQuery: (query: string) => void;
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: SortDir) => void;
  onEdit: (bet: Bet) => void;
  onDelete: (bet: Bet) => void;
  onPerson: (bet: Bet) => void;
}) {
  function sort(key: SortKey) {
    if (props.sortKey === key) props.setSortDir(props.sortDir === "asc" ? "desc" : "asc");
    props.setSortKey(key);
  }

  return (
    <Card>
      <CardHeader className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <CardTitle>Lista de apostas</CardTitle>
          <p className="text-sm text-muted-foreground">{props.filteredCount} exibidas de {props.totalCount} apostas</p>
        </div>
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" value={props.query} placeholder="Buscar nome, telefone ou palpite" onChange={(event) => { props.setQuery(event.target.value); props.setPage(1); }} />
        </label>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2">#</th>
                <th><button onClick={() => sort("name")} className="font-bold">Nome</button></th>
                <th>Telefone</th>
                <th><button onClick={() => sort("guess")} className="font-bold">Palpite</button></th>
                <th><button onClick={() => sort("createdAt")} className="font-bold">Data</button></th>
                <th className="no-print">Ações</th>
              </tr>
            </thead>
            <tbody>
              {props.bets.map((bet) => (
                <tr key={bet.id} className="border-t border-border">
                  <td className="p-2 font-black">{bet.id}</td>
                  <td>
                    <button className="inline-flex items-center gap-2 font-semibold text-primary" onClick={() => props.onPerson(bet)}>
                      <UserRound className="h-4 w-4" /> {bet.name}
                    </button>
                  </td>
                  <td>{bet.phone}</td>
                  <td className="font-black">{bet.guess}</td>
                  <td>{formatDateTime(bet.createdAt)}</td>
                  <td className="flex gap-1 py-2 no-print">
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => props.onEdit(bet)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => props.onDelete(bet)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between no-print">
          <Button variant="secondary" disabled={props.page === 1} onClick={() => props.setPage(props.page - 1)}>Anterior</Button>
          <span className="font-semibold">Página {props.page} de {props.pageCount}</span>
          <Button variant="secondary" disabled={props.page === props.pageCount} onClick={() => props.setPage(props.page + 1)}>Próxima</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonModal({ bet, bets, onClose }: { bet: Bet; bets: Bet[]; onClose: () => void }) {
  const guesses = bets.map((item) => item.guess);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{bet.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{bet.phone}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted p-3"><strong>{bets.length}</strong><p className="text-xs">apostas</p></div>
            <div className="rounded-md bg-muted p-3"><strong>{Math.min(...guesses)}</strong><p className="text-xs">menor</p></div>
            <div className="rounded-md bg-muted p-3"><strong>{Math.max(...guesses)}</strong><p className="text-xs">maior</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {bets.map((item) => <span key={item.id} className="rounded-md bg-primary px-3 py-2 font-black text-primary-foreground">{item.guess}</span>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Confetti() {
  const colors = ["#f97316", "#facc15", "#22c55e", "#ef4444", "#38bdf8"];
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: 36 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${(index * 29) % 100}%`,
            background: colors[index % colors.length],
            animationDelay: `${(index % 9) * 0.08}s`
          }}
        />
      ))}
    </div>
  );
}

export default App;


