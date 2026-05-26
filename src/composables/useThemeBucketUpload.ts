import { useStaticBucketFile } from "@/composables/useStaticBucketFile";
import { mergeThemeConfigJson, type KeepChoice } from "@/utils/themeConfig";
import { base64ToBuf, bufToBase64 } from "@/utils/base64";

export type KeepPolicy = {
  userPrefs: KeepChoice;
  siteTokens: KeepChoice;
  css: KeepChoice;
  js: KeepChoice;
};

export const DEFAULT_KEEP_POLICY: KeepPolicy = {
  userPrefs: "old",
  siteTokens: "old",
  css: "old",
  js: "old",
};

export type UploadEntry = { path: string; base64: string };

const FIXED_CUSTOM_FILES = ["custom.css", "custom.js"] as const;

export function useThemeBucketUpload() {
  const sbf = useStaticBucketFile();

  const uploadToBucket = async (options: {
    bucketName: string;
    files: UploadEntry[];
    isUpdate: boolean;
    keepPolicy: KeepPolicy;
    onProgress?: (current: number, total: number) => void;
  }): Promise<{ failedCount: number }> => {
    const { bucketName, isUpdate, keepPolicy: kp, onProgress } = options;
    const files: UploadEntry[] = options.files.map((f) => ({ ...f }));

    let oldConfigText = "";
    let oldCss = "";
    let oldJs = "";
    if (isUpdate) {
      const needConfig = kp.userPrefs === "old" || kp.siteTokens === "old";
      const [configResult, cssResult, jsResult] = await Promise.all([
        needConfig
          ? sbf.readTextFile(bucketName, "config.json")
          : Promise.resolve(""),
        kp.css === "old"
          ? sbf.readTextFile(bucketName, "custom.css")
          : Promise.resolve(""),
        kp.js === "old"
          ? sbf.readTextFile(bucketName, "custom.js")
          : Promise.resolve(""),
      ]);
      oldConfigText = configResult;
      oldCss = cssResult;
      oldJs = jsResult;
    }

    const manifestEntry = files.find(
      (f) => f.path === "nodeget-theme-files.json",
    );
    if (manifestEntry) {
      try {
        const text = new TextDecoder().decode(
          base64ToBuf(manifestEntry.base64),
        );
        const list: unknown = JSON.parse(text);
        if (Array.isArray(list)) {
          const paths = list.map((item) =>
            typeof item === "string"
              ? item
              : ((item as { path?: string }).path ?? ""),
          );
          const toAdd = FIXED_CUSTOM_FILES.filter((f) => !paths.includes(f));
          if (toAdd.length > 0) {
            const isObjectFormat =
              list.length > 0 &&
              typeof list[0] === "object" &&
              list[0] !== null;
            const toAddItems: unknown[] = isObjectFormat
              ? toAdd.map((f) => ({ path: f }))
              : [...toAdd];
            manifestEntry.base64 = bufToBase64(
              new TextEncoder().encode(
                JSON.stringify(Array.from(new Set([...list, ...toAddItems]))),
              ),
            );
          }
        }
      } catch {
        // manifest 解析失败，保持原样
      }
    }

    let failedCount = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        await sbf.uploadFile(bucketName, files[i]!.path, files[i]!.base64);
      } catch {
        failedCount++;
      }
      onProgress?.(i + 1, files.length);
    }

    if (isUpdate) {
      if (kp.userPrefs === "old" || kp.siteTokens === "old") {
        const newConfigText = await sbf.readTextFile(bucketName, "config.json");
        if (newConfigText) {
          await sbf.saveTextFile(
            bucketName,
            "config.json",
            mergeThemeConfigJson(
              newConfigText,
              oldConfigText,
              kp.userPrefs,
              kp.siteTokens,
            ),
          );
        }
      }
      if (kp.css === "old" && oldCss) {
        await sbf.saveTextFile(bucketName, "custom.css", oldCss);
      }
      if (kp.js === "old" && oldJs) {
        await sbf.saveTextFile(bucketName, "custom.js", oldJs);
      }
    }

    return { failedCount };
  };

  return { uploadToBucket };
}
