export type KeepChoice = "old" | "new";

export function mergeThemeConfigJson(
  newConfigText: string,
  oldConfigText: string,
  keepUserPrefs: KeepChoice,
  keepSiteTokens: KeepChoice,
): string {
  let newConfig: Record<string, unknown> = {};
  let oldConfig: Record<string, unknown> = {};
  try {
    if (newConfigText)
      newConfig = JSON.parse(newConfigText) as Record<string, unknown>;
  } catch (e) {
    console.warn("mergeThemeConfigJson: failed to parse newConfigText", e);
  }
  try {
    if (oldConfigText)
      oldConfig = JSON.parse(oldConfigText) as Record<string, unknown>;
  } catch (e) {
    console.warn("mergeThemeConfigJson: failed to parse oldConfigText", e);
  }

  if (keepUserPrefs === "old" && oldConfig.user_preferences !== undefined) {
    newConfig.user_preferences = oldConfig.user_preferences;
  }
  if (keepSiteTokens === "old" && oldConfig.site_tokens !== undefined) {
    newConfig.site_tokens = oldConfig.site_tokens;
  }
  return JSON.stringify(newConfig, null, 2);
}
