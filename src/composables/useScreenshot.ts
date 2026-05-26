import { domToCanvas } from "modern-screenshot";

export interface ScreenshotModule {
  el: HTMLElement;
  label: string;
}

export async function captureModules(
  modules: ScreenshotModule[],
): Promise<void> {
  const scale = 2;
  const padding = 16;
  const gap = 12;
  const isDark = document.documentElement.classList.contains("dark");
  const bg = isDark ? "#09090b" : "#ffffff";

  const canvases = await Promise.all(
    modules.map((m) => domToCanvas(m.el, { scale })),
  );

  const MAX_CONTENT_WIDTH = 1000 * scale; // 1000 逻辑像素 × devicePixelRatio(scale)
  const contentWidth = Math.min(
    Math.max(...canvases.map((c) => c.width)),
    MAX_CONTENT_WIDTH,
  );
  const scaledHeights = canvases.map((c) =>
    Math.round((c.height * contentWidth) / c.width),
  );

  const totalWidth = contentWidth + padding * 2;
  const totalHeight =
    scaledHeights.reduce((sum, h) => sum + h, 0) +
    gap * (canvases.length - 1) +
    padding * 2;

  const out = document.createElement("canvas");
  out.width = totalWidth;
  out.height = totalHeight;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  let y = padding;
  for (let i = 0; i < canvases.length; i++) {
    ctx.drawImage(canvases[i]!, padding, y, contentWidth, scaledHeights[i]!);
    y += scaledHeights[i]! + gap;
  }

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ping-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
