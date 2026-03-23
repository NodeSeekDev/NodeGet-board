const COUNTRY_NAME_FALLBACK: Record<string, { zh: string; en: string }> = {
  "Hong Kong": { zh: "香港", en: "Hong Kong" },
  Macao: { zh: "澳门", en: "Macao" },
  Taiwan: { zh: "台湾", en: "Taiwan" },
  China: { zh: "中国大陆", en: "China" },
  Japan: { zh: "日本", en: "Japan" },
  "South Korea": { zh: "韩国", en: "South Korea" },
  Singapore: { zh: "新加坡", en: "Singapore" },
  Malaysia: { zh: "马来西亚", en: "Malaysia" },
  Thailand: { zh: "泰国", en: "Thailand" },
  Vietnam: { zh: "越南", en: "Vietnam" },
  Philippines: { zh: "菲律宾", en: "Philippines" },
  Indonesia: { zh: "印度尼西亚", en: "Indonesia" },
  India: { zh: "印度", en: "India" },
  "United States of America": { zh: "美国", en: "United States of America" },
  Canada: { zh: "加拿大", en: "Canada" },
  Mexico: { zh: "墨西哥", en: "Mexico" },
  Brazil: { zh: "巴西", en: "Brazil" },
  Argentina: { zh: "阿根廷", en: "Argentina" },
  "United Kingdom": { zh: "英国", en: "United Kingdom" },
  Germany: { zh: "德国", en: "Germany" },
  France: { zh: "法国", en: "France" },
  Netherlands: { zh: "荷兰", en: "Netherlands" },
  Russia: { zh: "俄罗斯", en: "Russia" },
  Turkey: { zh: "土耳其", en: "Turkey" },
  Australia: { zh: "澳大利亚", en: "Australia" },
  "South Africa": { zh: "南非", en: "South Africa" },
};

export function getDisplayCountryName(
  countryName: string,
  locale: string | undefined,
) {
  const normalizedLocale = locale?.toLowerCase() ?? "zh-cn";
  const preferredLanguage = normalizedLocale.startsWith("zh") ? "zh" : "en";
  const fallback = COUNTRY_NAME_FALLBACK[countryName];
  if (fallback) return fallback[preferredLanguage];
  return countryName;
}
