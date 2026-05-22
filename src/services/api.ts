import type { Bet, BetPayload, Competition } from "../types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Não foi possível concluir a operação.");
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  competitions: () => request<Competition[]>("/api/competitions"),
  createCompetition: (name: string) =>
    request<Competition>("/api/competitions", {
      method: "POST",
      body: JSON.stringify({ name })
    }),
  bets: (competitionId: number) => request<Bet[]>(`/api/competitions/${competitionId}/bets`),
  createBet: (competitionId: number, bet: BetPayload) =>
    request<Bet>(`/api/competitions/${competitionId}/bets`, {
      method: "POST",
      body: JSON.stringify(bet)
    }),
  importBets: (competitionId: number, rows: BetPayload[]) =>
    request<{ imported: number; errors: Array<{ line: number; message: string }> }>(
      `/api/competitions/${competitionId}/bets/import`,
      {
        method: "POST",
        body: JSON.stringify({ rows })
      }
    ),
  updateBet: (id: number, bet: BetPayload) =>
    request<Bet>(`/api/bets/${id}`, {
      method: "PUT",
      body: JSON.stringify(bet)
    }),
  deleteBet: (id: number) => request<void>(`/api/bets/${id}`, { method: "DELETE" })
};
