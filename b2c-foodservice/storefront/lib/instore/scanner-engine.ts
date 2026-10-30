/**
 * Camera and barcode decoding for the scanner dialog (workstream R, D-045). Client only (no `server-only`, no commercetools).
 *
 * Decoder choice: the browser's own `BarcodeDetector` when it exists and supports at least one of our formats (Chrome on Android
 * and recent desktop Chrome); otherwise `@zxing/browser`, loaded with `import()` the first time a camera starts, so it is in no
 * page's main bundle. Both read the same `MediaStream`, shown in a `<video>`.
 *
 * Nothing here talks to the server. The decoded text goes to `normaliseScan` (lib/instore/scan.ts) before anything is looked up.
 */

export type CameraFailure = 'denied' | 'none' | 'error';

/** Why the camera did not start, in the three ways the dialog tells a shopper apart. */
export class CameraError extends Error {
  constructor(readonly kind: CameraFailure, options?: { cause?: unknown }) {
    super(kind, options);
    this.name = 'CameraError';
  }
}

/** `getUserMedia` rejections: a refusal, no device, or anything else (camera in use, hardware fault, insecure page). */
export function classifyCameraError(e: unknown): CameraFailure {
  const name = (e as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'none';
  return 'error';
}

/** Formats a product barcode or label can use. Code 128 and QR are the usual choices for a text SKU (Q-R-7). */
export const NATIVE_FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'qr_code', 'data_matrix'] as const;

/** The part of the BarcodeDetector API used here (lib.dom does not ship it). */
export interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
export interface DetectorConstructor {
  new (options?: { formats?: string[] }): DetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** A native detector for our formats, or null when the browser has none (the library is used then). */
export async function nativeDetector(win: { BarcodeDetector?: DetectorConstructor } = window as unknown as { BarcodeDetector?: DetectorConstructor }): Promise<DetectorLike | null> {
  const Ctor = win.BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : [...NATIVE_FORMATS];
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
    return formats.length > 0 ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

export interface ScannerSession {
  /** Stops decoding and releases the camera. Safe to call twice. */
  stop(): void;
  /** Which decoder is reading (for diagnostics and tests). */
  decoder: 'native' | 'zxing';
}

export interface ScannerEngine {
  /** Starts the camera into `video` and calls `onText` with every decoded string (the same code many times a second). Rejects with CameraError. */
  start(video: HTMLVideoElement, onText: (text: string) => void): Promise<ScannerSession>;
}

const POLL_MS = 150;

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** The real engine. `deps` are the seams the tests use. */
export function createScannerEngine(deps: {
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'> | undefined;
  detector?: () => Promise<DetectorLike | null>;
  loadZxing?: () => Promise<typeof import('@zxing/browser')>;
} = {}): ScannerEngine {
  return {
    async start(video, onText) {
      const media = deps.mediaDevices ?? (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);
      if (!media?.getUserMedia) throw new CameraError('none');
      let stream: MediaStream;
      try {
        stream = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        throw new CameraError(classifyCameraError(e), { cause: e });
      }

      let stopped = false;
      const detector = await (deps.detector ?? nativeDetector)();
      try {
        if (detector) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          const tick = async () => {
            if (stopped) return;
            try {
              if (video.readyState >= 2) {
                const found = await detector.detect(video);
                const text = found[0]?.rawValue;
                if (text) onText(text);
              }
            } catch {
              // a frame that cannot be read is skipped
            }
            if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
          };
          let timer = setTimeout(() => void tick(), 0);
          return {
            decoder: 'native' as const,
            stop() {
              stopped = true;
              clearTimeout(timer);
              stopStream(stream);
              video.srcObject = null;
            },
          };
        }

        // The library is fetched now, not with the page: it is only needed by a browser without BarcodeDetector.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          (deps.loadZxing ?? (() => import('@zxing/browser')))(),
          import('@zxing/library'),
        ]);
        const hints = new Map<unknown, unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX]],
        ]);
        const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: POLL_MS });
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result && !stopped) onText(result.getText());
        });
        return {
          decoder: 'zxing' as const,
          stop() {
            stopped = true;
            controls.stop();
            stopStream(stream);
          },
        };
      } catch (e) {
        stopStream(stream);
        throw new CameraError('error', { cause: e });
      }
    },
  };
}
