import "server-only";

export type TriumphExchangeRates = {
  baseCurrency: "USD";
  rates: {
    USD: number;
    NGN: number;
    GBP: number;
  };
  updatedAt: string;
};

const EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/USD";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getTriumphExchangeRates(): Promise<TriumphExchangeRates> {
  const response = await fetch(EXCHANGE_RATE_URL, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Exchange-rate provider responded with HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.rates)) {
    throw new Error("Exchange-rate provider returned an invalid response");
  }

  const { rates } = payload;
  const usdRate = rates.USD;
  const ngnRate = rates.NGN;
  const gbpRate = rates.GBP;

  if (
    payload.result !== "success" ||
    payload.base_code !== "USD" ||
    typeof payload.time_last_update_utc !== "string" ||
    typeof usdRate !== "number" ||
    !Number.isFinite(usdRate) ||
    usdRate <= 0 ||
    typeof ngnRate !== "number" ||
    !Number.isFinite(ngnRate) ||
    ngnRate <= 0 ||
    typeof gbpRate !== "number" ||
    !Number.isFinite(gbpRate) ||
    gbpRate <= 0
  ) {
    throw new Error("Exchange-rate provider returned incomplete or invalid USD rates");
  }

  return {
    baseCurrency: "USD",
    rates: { USD: usdRate, NGN: ngnRate, GBP: gbpRate },
    updatedAt: payload.time_last_update_utc,
  };
}
