export type Competition = {
  id: number;
  name: string;
  createdAt: string;
};

export type Bet = {
  id: number;
  competitionId: number;
  name: string;
  phone: string;
  phoneDigits: string;
  guess: number;
  createdAt: string;
  updatedAt: string;
};

export type BetPayload = {
  name: string;
  phone: string;
  guess: number;
};

export type ResultEntry = Bet & {
  difference: number;
  position: number;
};

export type Toast = {
  id: number;
  type: "success" | "error" | "info";
  message: string;
};
