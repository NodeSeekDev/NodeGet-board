import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateCosts,
  buildCustomFxUrl,
  buildFxUrl,
  buildFrankfurterUrl,
  createFxSnapshot,
  DEFAULT_BASE_CURRENCY,
  fxProviderLabel,
  getRemainingDays,
  getRemainingValue,
  GLOBAL_KV_COST_BASE_CURRENCY,
  GLOBAL_KV_COST_FX_CACHE,
  GLOBAL_KV_COST_FX_PROVIDER,
  isExactMonthlyBaseDisplay,
  isExactRemainingBaseDisplay,
  isFxSnapshotFresh,
  isValidCustomFxUrlTemplate,
  parseFxProviderTemplate,
  SUPPORTED_BASE_CURRENCIES,
  type CostNodeRecord,
} from "../src/utils/costSummary.ts";

const TODAY = new Date(2026, 4, 3);

test("exports stable global kv keys and supported currencies", () => {
  assert.equal(GLOBAL_KV_COST_BASE_CURRENCY, "cost_base_currency");
  assert.equal(GLOBAL_KV_COST_FX_CACHE, "cost_fx_cache_v1");
  assert.equal(GLOBAL_KV_COST_FX_PROVIDER, "cost_fx_provider");
  assert.deepEqual(SUPPORTED_BASE_CURRENCIES, ["USD", "EUR", "GBP", "CNY"]);
  assert.equal(DEFAULT_BASE_CURRENCY, "USD");
});

test("buildFrankfurterUrl builds a stable request", () => {
  assert.equal(
    buildFrankfurterUrl("USD", ["EUR", "GBP", "CNY"]),
    "https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP,CNY",
  );
});

test("custom fx provider template is optional and falls back to Frankfurter", () => {
  assert.equal(parseFxProviderTemplate(null), null);
  assert.equal(parseFxProviderTemplate(""), null);
  assert.equal(
    buildFxUrl("USD", ["EUR"], null),
    "https://api.frankfurter.dev/v1/latest?from=USD&to=EUR",
  );
  assert.equal(fxProviderLabel(null), "frankfurter");
});

test("custom fx provider template can be read from a plain string kv value", () => {
  const template = "https://rates.example.com/latest?base={base}&symbols={targets}";
  assert.equal(parseFxProviderTemplate(template), template);
  assert.equal(isValidCustomFxUrlTemplate(template), true);
  assert.equal(
    buildCustomFxUrl(template, "USD", ["EUR", "GBP"]),
    "https://rates.example.com/latest?base=USD&symbols=EUR%2CGBP",
  );
  assert.equal(
    buildFxUrl("USD", ["EUR", "GBP"], template),
    "https://rates.example.com/latest?base=USD&symbols=EUR%2CGBP",
  );
  assert.equal(fxProviderLabel(template), "custom:rates.example.com");
});

test("remaining day/value calculations are date-only and cycle aware", () => {
  assert.equal(getRemainingDays("2026-05-18", TODAY), 15);
  assert.equal(getRemainingDays("2026-05-02", TODAY), -1);
  assert.equal(getRemainingDays("", TODAY), null);
  assert.equal(getRemainingValue("2026-05-18", 30, 30, TODAY), 15);
});

test("aggregateCosts normalizes mixed currencies and mixed billing cycles into monthly base totals", () => {
  const nodes: CostNodeRecord[] = [
    {
      id: "usd",
      name: "usd-node",
      price: 30,
      priceUnit: "$",
      priceCycle: 30,
      expireTime: "2026-05-18",
    },
    {
      id: "eur",
      name: "eur-node",
      price: 36.5,
      priceUnit: "€",
      priceCycle: 365,
      expireTime: "2026-05-13",
    },
    {
      id: "gbp",
      name: "gbp-node",
      price: 109.5,
      priceUnit: "£",
      priceCycle: 1095,
      expireTime: "2026-06-02",
    },
    {
      id: "cny",
      name: "cny-node",
      price: 72,
      priceUnit: "¥",
      priceCycle: 30,
      expireTime: "2026-05-08",
    },
  ];

  const fx = createFxSnapshot(
    "USD",
    { rates: { EUR: 0.8, GBP: 0.5, CNY: 7.2 } },
    "2026-05-03T00:00:00.000Z",
  );
  const stats = aggregateCosts(nodes, "USD", fx, TODAY);

  assert.equal(stats.unified, true);
  assert.equal(stats.expiringSoon, 4);
  assert.equal(stats.unsupportedNodeNames.length, 0);
  assert.equal(stats.missingRateNodeNames.length, 0);
  assert.equal(Number(stats.totalMonthlyCost.toFixed(2)), 49.75);
  assert.equal(Number(stats.avgMonthlyCost.toFixed(2)), 12.44);
  assert.equal(Number(stats.totalRemainingValue.toFixed(2)), 23.92);
});

test("aggregateCosts excludes unsupported currencies from unified totals and reports them", () => {
  const nodes: CostNodeRecord[] = [
    {
      id: "supported",
      name: "supported-node",
      price: 30,
      priceUnit: "$",
      priceCycle: 30,
      expireTime: "2026-05-18",
    },
    {
      id: "unsupported",
      name: "unsupported-node",
      price: 100,
      priceUnit: "₽",
      priceCycle: 30,
      expireTime: "2026-05-18",
    },
  ];

  const fx = createFxSnapshot(
    "USD",
    { rates: { EUR: 0.8, GBP: 0.5, CNY: 7.2 } },
    "2026-05-03T00:00:00.000Z",
  );
  const stats = aggregateCosts(nodes, "USD", fx, TODAY);

  assert.equal(Number(stats.totalMonthlyCost.toFixed(2)), 30);
  assert.deepEqual(stats.unsupportedNodeNames, ["unsupported-node"]);
  assert.equal(stats.groupedMonthlyTotals.length, 2);
});

test("aggregateCosts falls back to grouped currency summaries when fx snapshot is unavailable", () => {
  const nodes: CostNodeRecord[] = [
    {
      id: "usd",
      name: "usd-node",
      price: 30,
      priceUnit: "$",
      priceCycle: 30,
      expireTime: "2026-05-18",
    },
    {
      id: "eur",
      name: "eur-node",
      price: 36.5,
      priceUnit: "€",
      priceCycle: 365,
      expireTime: "2026-05-13",
    },
  ];

  const stats = aggregateCosts(nodes, "USD", null, TODAY);

  assert.equal(stats.unified, false);
  assert.equal(stats.totalMonthlyCost, 0);
  assert.equal(stats.totalRemainingValue, 0);
  assert.equal(stats.missingRateNodeNames.length, 0);
  assert.deepEqual(
    stats.groupedMonthlyTotals.map((group) => [
      group.currency,
      Number(group.monthlyCost.toFixed(2)),
    ]),
    [
      ["EUR", 3],
      ["USD", 30],
    ],
  );
});

test("aggregateCosts excludes expired nodes from monthly totals while keeping remaining value at zero", () => {
  const nodes: CostNodeRecord[] = [
    {
      id: "active",
      name: "active-node",
      price: 30,
      priceUnit: "$",
      priceCycle: 30,
      expireTime: "2026-05-18",
    },
    {
      id: "expired",
      name: "expired-node",
      price: 30,
      priceUnit: "$",
      priceCycle: 30,
      expireTime: "2026-05-02",
    },
  ];

  const fx = createFxSnapshot(
    "USD",
    { rates: { EUR: 0.8, GBP: 0.5, CNY: 7.2 } },
    "2026-05-03T00:00:00.000Z",
  );
  const stats = aggregateCosts(nodes, "USD", fx, TODAY);

  assert.equal(Number(stats.totalMonthlyCost.toFixed(2)), 30);
  assert.equal(Number(stats.avgMonthlyCost.toFixed(2)), 30);
  assert.equal(Number(stats.totalRemainingValue.toFixed(2)), 15);

  const expiredNode = stats.evaluatedNodes.find((node) => node.id === "expired");
  assert.ok(expiredNode);
  assert.equal(expiredNode.expired, true);
  assert.equal(expiredNode.monthlyCostBase, 0);
  assert.equal(expiredNode.remainingValueBase, 0);
});

test("expired unsupported nodes do not surface unsupported currency warnings", () => {
  const nodes: CostNodeRecord[] = [
    {
      id: "expired-unsupported",
      name: "expired-unsupported",
      price: 100,
      priceUnit: "₽",
      priceCycle: 30,
      expireTime: "2026-05-02",
    },
  ];

  const stats = aggregateCosts(nodes, "USD", null, TODAY);

  assert.deepEqual(stats.unsupportedNodeNames, []);
  assert.deepEqual(stats.missingRateNodeNames, []);
  assert.equal(stats.groupedMonthlyTotals[0]?.monthlyCost, 0);
});

test("base display uses exact marker for same-currency monthly price or zero value", () => {
  const monthlyExactNode = {
    monthlyCostBase: 16.21,
    remainingValueBase: 8.11,
    currencyCode: "USD" as const,
    priceCycle: 30,
  };
  const monthlyApproxNode = {
    monthlyCostBase: 16.21,
    remainingValueBase: 8.11,
    currencyCode: "USD" as const,
    priceCycle: 365,
  };
  const zeroConvertedNode = {
    monthlyCostBase: 0,
    remainingValueBase: 0,
    currencyCode: "EUR" as const,
    priceCycle: 365,
  };

  assert.equal(isExactMonthlyBaseDisplay(monthlyExactNode, "USD"), true);
  assert.equal(isExactMonthlyBaseDisplay(monthlyApproxNode, "USD"), false);
  assert.equal(isExactMonthlyBaseDisplay(zeroConvertedNode, "USD"), true);
  assert.equal(isExactRemainingBaseDisplay(monthlyExactNode, "USD"), true);
  assert.equal(isExactRemainingBaseDisplay(monthlyApproxNode, "USD"), true);
  assert.equal(isExactRemainingBaseDisplay(zeroConvertedNode, "USD"), true);
});

test("fx snapshot freshness uses a 24h ttl", () => {
  const fresh = createFxSnapshot(
    "USD",
    { rates: { EUR: 0.8 } },
    "2026-05-03T00:00:00.000Z",
  );
  assert.equal(isFxSnapshotFresh(fresh, new Date("2026-05-03T12:00:00.000Z").getTime()), true);
  assert.equal(isFxSnapshotFresh(fresh, new Date("2026-05-04T12:00:01.000Z").getTime()), false);
});
