import { Color, PerspectiveCamera, Vector2, type Camera, type Scene, type WebGLRenderer } from "three";

export interface ScreenshotOptions {
  /** Output size in px. Defaults to the canvas CSS size × `scale`. */
  width?: number;
  height?: number;
  /** Used when width/height are not given. Default 2. */
  scale?: number;
  /** Default "image/png". */
  mimeType?: "image/png" | "image/jpeg" | "image/webp";
  /** 0..1 for jpeg/webp. */
  quality?: number;
  /** Solid background; null/undefined keeps transparency (PNG/WebP). JPEG defaults to white. */
  background?: string | null;
  /** Upper bound for the longest side (also capped by the GPU). Default 4096. */
  maxSize?: number;
}

/**
 * Render the scene once at the requested resolution and return it as a Blob.
 * The drawing buffer is resized, rendered and read in the same task (so it works without
 * preserveDrawingBuffer), then restored.
 */
export function captureScreenshot(gl: WebGLRenderer, scene: Scene, camera: Camera, opts: ScreenshotOptions = {}): Promise<Blob> {
  const canvas = gl.domElement;
  const prevSize = gl.getSize(new Vector2());
  const prevDpr = gl.getPixelRatio();
  const prevClear = gl.getClearColor(new Color());
  const prevAlpha = gl.getClearAlpha();
  const mime = opts.mimeType ?? "image/png";

  const scale = opts.scale ?? 2;
  let w = Math.round(opts.width ?? prevSize.x * scale);
  let h = Math.round(opts.height ?? prevSize.y * scale);
  const gpuMax = Math.min(gl.capabilities.maxTextureSize || 4096, opts.maxSize ?? 4096);
  const k = Math.min(1, gpuMax / Math.max(w, h));
  w = Math.max(1, Math.floor(w * k));
  h = Math.max(1, Math.floor(h * k));

  const persp = camera instanceof PerspectiveCamera ? camera : null;
  const prevAspect = persp?.aspect ?? 1;

  let blobPromise: Promise<Blob>;
  try {
    gl.setPixelRatio(1);
    gl.setSize(w, h, false);
    if (persp) {
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
    }
    const bg = opts.background ?? (mime === "image/jpeg" ? "#ffffff" : null);
    if (bg) gl.setClearColor(new Color(bg), 1);
    else gl.setClearColor(prevClear, 0);
    gl.render(scene, camera);
    blobPromise = new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Screenshot failed"))), mime, opts.quality);
    });
  } finally {
    gl.setClearColor(prevClear, prevAlpha);
    gl.setPixelRatio(prevDpr);
    gl.setSize(prevSize.x, prevSize.y, false);
    if (persp) {
      persp.aspect = prevAspect;
      persp.updateProjectionMatrix();
    }
    gl.render(scene, camera);
  }
  return blobPromise;
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
