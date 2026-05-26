import { unzip } from "fflate";
import { bufToBase64 } from "@/utils/base64";

export type FileEntry = { path: string; base64: string };

export function parseZipFile(arrayBuffer: ArrayBuffer): Promise<FileEntry[]> {
  return new Promise((resolve, reject) => {
    unzip(new Uint8Array(arrayBuffer), (err, data) => {
      if (err) return reject(err);
      const entries = Object.entries(data);
      const topDirs = new Set(entries.map(([p]) => p.split("/")[0]));
      const firstDir = topDirs.size === 1 ? ([...topDirs][0] ?? "") : "";
      const hasTopDir =
        firstDir !== "" &&
        entries.every(
          ([p]) => p === firstDir + "/" || p.startsWith(firstDir + "/"),
        );
      const files: FileEntry[] = [];
      for (const [path, content] of entries) {
        if (path.endsWith("/")) continue;
        const finalPath = hasTopDir ? path.slice(firstDir.length + 1) : path;
        if (!finalPath) continue;
        files.push({ path: finalPath, base64: bufToBase64(content) });
      }
      resolve(files);
    });
  });
}

export async function parseFolderFiles(files: File[]): Promise<FileEntry[]> {
  const result: FileEntry[] = [];
  for (const file of files) {
    const pathParts = file.webkitRelativePath.split("/").slice(1);
    const path = pathParts.join("/");
    if (!path) continue;
    const buf = await file.arrayBuffer();
    result.push({ path, base64: bufToBase64(buf) });
  }
  return result;
}
