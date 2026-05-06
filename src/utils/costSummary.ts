export const SUPPORTED_BASE_CURRENCIES = ["USD", "EUR", "GBP", "CNY"] as const;
export type BaseCurrency = (typeof SUPPORTED_BASE_CURRENCIES)[number];

export const DEFAULT_BASE_CURRENCY: BaseCurrency = "USD";
export const FX_PROVIDER = "frankfurter";
export const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const GLOBAL_KV_COST_BASE_CURRENCY = "cost_base_currency";
export const GLOBAL_KV_COST_FX_CACHE = "cost_fx_cache_v1";
export const GLOBAL_KV_COST_FX_PROVIDER = "cost_fx_provider";

const PRICE_UNIT_TO_CURRENCY: Record<string, BaseCurrency> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "CNY",
};

const CURRENCY_TO_SYMBOL: Record<BaseCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
};

export interface CostNodeRecord {
  id: string;
  customName: string;
  price: number;
  priceUnit: string;
  priceCycle: number;
  expireTime: string;
}

export interface FxSnapshot {
  base: BaseCurrency;
  provider: string;
  fetched_at: string;
  rates: Partial<Record<BaseCurrency, number>>;
}

export interface GroupedCurrencySummary {
  currency: string;
  symbol: string;
  monthlyCost: number;
  remainingValue: number;
  count: number;
  nodeNames: string[];
}

export interface EvaluatedCostNode extends CostNodeRecord {
  currencyCode: BaseCurrency | null;
  monthlyCostBase: number | null;
  remainingValueBase: number | null;
  excludedReason: "unsupported_currency" | "missing_fx" | "expired" | null;
  expired: boolean;
}

export interface CostAggregation {
  unified: boolean;
  totalMonthlyCost: number;
  avgMonthlyCost: number;
  totalRemainingValue: number;
  expiringSoon: number;
  groupedMonthlyTotals: GroupedCurrencySummary[];
  unsupportedNodeNames: string[];
  missingRateNodeNames: string[];
  evaluatedNodes: EvaluatedCostNode[];
}

export interface FrankfurterLatestResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

export function isBaseCurrency(value: string): value is BaseCurrency {
  return (SUPPORTED_BASE_CURRENCIES as readonly string[]).includes(value);
}

export function normalizeBaseCurrency(value: unknown): BaseCurrency | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return isBaseCurrency(normalized) ? normalized : null;
}

export function parseFxProviderTemplate(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }

  // Backward-compatible with draft object-based configs used during local iteration.
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.customUrlTemplate === "string") {
      const trimmed = candidate.customUrlTemplate.trim();
      return trimmed || null;
    }
  }

  return null;
}

export function currencyFromPriceUnit(symbol: string): BaseCurrency | null {
  return PRICE_UNIT_TO_CURRENCY[symbol] ?? null;
}

export function currencySymbol(currency: BaseCurrency): string {
  return CURRENCY_TO_SYMBOL[currency];
}

function replaceTemplateTokens(
  template: string,
  base: string,
  targets: string,
): string {
  return template.split("{base}").join(base).split("{targets}").join(targets);
}

export function supportedCurrenciesForNodes(
  nodes: CostNodeRecord[],
  base: BaseCurrency,
): BaseCurrency[] {
  return Array.from(
    new Set(
      nodes
        .map((node) => currencyFromPriceUnit(node.priceUnit))
        .filter(
          (currency): currency is BaseCurrency =>
            Boolean(currency) && currency !== base,
        ),
    ),
  ).sort();
}

export function buildFrankfurterUrl(
  base: BaseCurrency,
  targets: BaseCurrency[],
): string {
  if (targets.length === 0) {
    return `https://api.frankfurter.dev/v1/latest?from=${base}`;
  }
  return `https://api.frankfurter.dev/v1/latest?from=${base}&to=${targets.join(",")}`;
}

export function isValidCustomFxUrlTemplate(template: string): boolean {
  const trimmed = template.trim();
  if (!trimmed || !trimmed.includes("{base}")) return false;

  try {
    const resolved = replaceTemplateTokens(trimmed, "USD", "EUR,GBP");
    const url = new URL(resolved);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildCustomFxUrl(
  template: string,
  base: BaseCurrency,
  targets: BaseCurrency[],
): string {
  if (!isValidCustomFxUrlTemplate(template)) {
    throw new Error(
      "自定义汇率模板无效，必须是 http/https URL，且至少包含 {base} 占位符。",
    );
  }

  return replaceTemplateTokens(
    template.trim(),
    encodeURIComponent(base),
    targets.map((target) => encodeURIComponent(target)).join("%2C"),
  );
}

export function buildFxUrl(
  base: BaseCurrency,
  targets: BaseCurrency[],
  providerTemplate: string | null,
): string {
  if (providerTemplate) {
    return buildCustomFxUrl(providerTemplate, base, targets);
  }
  return buildFrankfurterUrl(base, targets);
}

export function fxProviderLabel(providerTemplate: string | null): string {
  if (!providerTemplate) return FX_PROVIDER;
  try {
    const resolved = replaceTemplateTokens(
      providerTemplate.trim(),
      "USD",
      "EUR,GBP",
    );
    const url = new URL(resolved);
    return `custom:${url.host}`;
  } catch {
    return "custom";
  }
}

export function parseFxSnapshot(raw: unknown): FxSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const base = normalizeBaseCurrency(candidate.base);
  const fetchedAt =
    typeof candidate.fetched_at === "string" ? candidate.fetched_at : "";
  const provider =
    typeof candidate.provider === "string" ? candidate.provider : "";
  if (!base || !fetchedAt || !provider) return null;

  const parsed = new Date(fetchedAt);
  if (Number.isNaN(parsed.getTime())) return null;

  const ratesRaw = candidate.rates;
  const rates: Partial<Record<BaseCurrency, number>> = {};
  if (ratesRaw && typeof ratesRaw === "object" && !Array.isArray(ratesRaw)) {
    for (const [key, value] of Object.entries(ratesRaw)) {
      if (
        !isBaseCurrency(key) ||
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        continue;
      }
      rates[key] = value;
    }
  }

  return {
    base,
    provider,
    fetched_at: fetchedAt,
    rates,
  };
}

export function fxSnapshotAgeMs(
  snapshot: FxSnapshot,
  now = Date.now(),
): number {
  return Math.max(0, now - new Date(snapshot.fetched_at).getTime());
}

export function isFxSnapshotFresh(
  snapshot: FxSnapshot,
  now = Date.now(),
): boolean {
  return fxSnapshotAgeMs(snapshot, now) <= FX_CACHE_TTL_MS;
}

export function createFxSnapshot(
  base: BaseCurrency,
  response: FrankfurterLatestResponse,
  fetchedAt = new Date().toISOString(),
  provider = FX_PROVIDER,
): FxSnapshot {
  const rates: Partial<Record<BaseCurrency, number>> = {};
  const rawRates = response.rates ?? {};
  for (const currency of SUPPORTED_BASE_CURRENCIES) {
    if (currency === base) {
      rates[currency] = 1;
      continue;
    }
    const rate = rawRates[currency];
    if (typeof rate === "number" && Number.isFinite(rate)) {
      rates[currency] = rate;
    }
  }
  return {
    base,
    provider,
    fetched_at: fetchedAt,
    rates,
  };
}

export function normalizeCycleDays(priceCycle: number): number {
  return Number.isFinite(priceCycle) && priceCycle > 0 ? priceCycle : 30;
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getRemainingDays(
  expireTime: string,
  today = new Date(),
): number | null {
  const expire = parseDateOnly(expireTime);
  if (!expire) return null;
  const normalizedToday = startOfDay(today);
  return Math.round((expire.getTime() - normalizedToday.getTime()) / 86400000);
}

export function getCycleProgress(
  expireTime: string,
  priceCycle: number,
  today = new Date(),
): number {
  const remaining = getRemainingDays(expireTime, today);
  if (remaining === null) return 0;
  const total = normalizeCycleDays(priceCycle);
  if (remaining <= 0) return 0;
  if (remaining >= total) return 100;
  return Math.round((remaining / total) * 100);
}

export function getRemainingValue(
  expireTime: string,
  price: number,
  priceCycle: number,
  today = new Date(),
): number {
  const remaining = getRemainingDays(expireTime, today);
  if (remaining === null || remaining <= 0) return 0;
  const ratio = Math.min(remaining / normalizeCycleDays(priceCycle), 1);
  return price * ratio;
}

function convertToBase(
  amount: number,
  from: BaseCurrency | null,
  base: BaseCurrency,
  snapshot: FxSnapshot | null,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (!from) return null;
  if (from === base) return amount;
  if (!snapshot || snapshot.base !== base) return null;
  const rate = snapshot.rates[from];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return amount / rate;
}

function monthlyOriginalCost(node: CostNodeRecord): number {
  return (node.price / normalizeCycleDays(node.priceCycle)) * 30;
}

export function isExactMonthlyBaseDisplay(
  node: Pick<
    EvaluatedCostNode,
    "monthlyCostBase" | "currencyCode" | "priceCycle"
  >,
  base: BaseCurrency,
): boolean {
  if (node.monthlyCostBase === null) return false;
  if (node.monthlyCostBase === 0) return true;
  return (
    node.currencyCode === base && normalizeCycleDays(node.priceCycle) === 30
  );
}

export function isExactRemainingBaseDisplay(
  node: Pick<EvaluatedCostNode, "remainingValueBase" | "currencyCode">,
  base: BaseCurrency,
): boolean {
  if (node.remainingValueBase === null) return false;
  if (node.remainingValueBase === 0) return true;
  return node.currencyCode === base;
}

export function aggregateCosts(
  nodes: CostNodeRecord[],
  base: BaseCurrency,
  snapshot: FxSnapshot | null,
  today = new Date(),
): CostAggregation {
  const grouped = new Map<string, GroupedCurrencySummary>();
  const evaluatedNodes: EvaluatedCostNode[] = [];
  const unsupportedNodeNames: string[] = [];
  const missingRateNodeNames: string[] = [];

  for (const node of nodes) {
    const currencyCode = currencyFromPriceUnit(node.priceUnit);
    const remainingDays = getRemainingDays(node.expireTime, today);
    const expired = remainingDays !== null && remainingDays < 0;
    const monthlyOriginal = monthlyOriginalCost(node);
    const remainingOriginal = getRemainingValue(
      node.expireTime,
      node.price,
      node.priceCycle,
      today,
    );
    const monthlyCostBase = expired
      ? 0
      : convertToBase(monthlyOriginal, currencyCode, base, snapshot);
    const remainingValueBase = expired
      ? 0
      : convertToBase(remainingOriginal, currencyCode, base, snapshot);

    let excludedReason: EvaluatedCostNode["excludedReason"] = null;
    if (expired) {
      excludedReason = "expired";
    } else if (!currencyCode) {
      excludedReason = "unsupported_currency";
      unsupportedNodeNames.push(node.customName);
    } else if (
      snapshot === null ||
      monthlyCostBase === null ||
      remainingValueBase === null
    ) {
      excludedReason = "missing_fx";
      if (snapshot !== null) {
        missingRateNodeNames.push(node.customName);
      }
    }

    const groupKey = currencyCode ?? node.priceUnit ?? "UNKNOWN";
    const groupSymbol = currencyCode
      ? currencySymbol(currencyCode)
      : node.priceUnit || "?";
    const existing = grouped.get(groupKey) ?? {
      currency: groupKey,
      symbol: groupSymbol,
      monthlyCost: 0,
      remainingValue: 0,
      count: 0,
      nodeNames: [],
    };
    if (!expired) {
      existing.monthlyCost += monthlyOriginal;
    }
    existing.remainingValue += remainingOriginal;
    existing.count += 1;
    existing.nodeNames.push(node.customName);
    grouped.set(groupKey, existing);

    evaluatedNodes.push({
      ...node,
      currencyCode,
      monthlyCostBase,
      remainingValueBase,
      excludedReason,
      expired,
    });
  }

  const convertibleNodes = evaluatedNodes.filter(
    (node) =>
      !node.expired &&
      node.monthlyCostBase !== null &&
      node.remainingValueBase !== null,
  );
  const unified = snapshot !== null;
  const totalMonthlyCost = unified
    ? convertibleNodes.reduce(
        (sum, node) => sum + (node.monthlyCostBase ?? 0),
        0,
      )
    : 0;
  const totalRemainingValue = unified
    ? convertibleNodes.reduce(
        (sum, node) => sum + (node.remainingValueBase ?? 0),
        0,
      )
    : 0;
  const expiringSoon = nodes.filter((node) => {
    const days = getRemainingDays(node.expireTime, today);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const groupedMonthlyTotals = Array.from(grouped.values()).sort(
    (left, right) => left.currency.localeCompare(right.currency),
  );

  return {
    unified,
    totalMonthlyCost,
    avgMonthlyCost:
      unified && convertibleNodes.length
        ? totalMonthlyCost / convertibleNodes.length
        : 0,
    totalRemainingValue,
    expiringSoon,
    groupedMonthlyTotals,
    unsupportedNodeNames,
    missingRateNodeNames,
    evaluatedNodes,
  };
}
