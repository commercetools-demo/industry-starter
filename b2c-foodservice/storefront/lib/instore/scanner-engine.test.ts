import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CameraError, NATIVE_FORMATS, classifyCameraError, createScannerEngine, nativeDetector, type DetectorLike } from '@/lib/instore/scanner-engine';

const track = () => ({ stop: vi.fn() });
const fakeStream = () => {
  const t = track();
  return { stream: { getTracks: () => [t] } as unknown as MediaStream, t };
};
const fakeVideo = () => ({ srcObject: null as unknown, readyState: 4, play: vi.fn(async () => undefined) }) as unknown as HTMLVideoElement;

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['PermissionDeniedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'none'],
    ['DevicesNotFoundError', 'none'],
    ['OverconstrainedError', 'none'],
    ['NotReadableError', 'error'],
    ['AbortError', 'error'],
    ['', 'error'],
  ])('%s is %s', (name, kind) => {
    expect(classifyCameraError({ name })).toBe(kind);
  });
  it('anything that is not an error object is a generic error', () => {
    expect(classifyCameraError(null)).toBe('error');
    expect(classifyCameraError('x')).toBe('error');
  });
});

describe('nativeDetector', () => {
  it('is null when the browser has no BarcodeDetector', async () => {
    expect(await nativeDetector({})).toBeNull();
  });

  it('asks only for the formats it supports and we read', async () => {
    const seen: unknown[] = [];
    class D {
      static getSupportedFormats = async () => ['qr_code', 'code_128', 'aztec', 'pdf417'];
      constructor(o?: { formats?: string[] }) {
        seen.push(o);
      }
      detect = async () => [];
    }
    expect(await nativeDetector({ BarcodeDetector: D })).toBeInstanceOf(D);
    expect(seen).toEqual([{ formats: ['code_128', 'qr_code'] }]);
  });

  it('is null (the library is used) when none of our formats is supported, or the probe throws', async () => {
    class None {
      static getSupportedFormats = async () => ['pdf417'];
      detect = async () => [];
    }
    class Boom {
      static getSupportedFormats = async (): Promise<string[]> => {
        throw new Error('no');
      };
      detect = async () => [];
    }
    expect(await nativeDetector({ BarcodeDetector: None })).toBeNull();
    expect(await nativeDetector({ BarcodeDetector: Boom })).toBeNull();
  });

  it('code 128 and QR are among the formats (Q-R-7)', () => {
    expect(NATIVE_FORMATS).toEqual(expect.arrayContaining(['code_128', 'qr_code', 'ean_13']));
  });
});

describe('createScannerEngine: camera failures', () => {
  it('no mediaDevices is "none"', async () => {
    const engine = createScannerEngine({ mediaDevices: undefined });
    // `navigator.mediaDevices` does not exist in jsdom
    await expect(engine.start(fakeVideo(), () => undefined)).rejects.toMatchObject({ name: 'CameraError', kind: 'none' });
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'none'],
    ['NotReadableError', 'error'],
  ])('a %s from getUserMedia is %s', async (name, kind) => {
    const engine = createScannerEngine({ mediaDevices: { getUserMedia: async () => Promise.reject(Object.assign(new Error(name), { name })) } });
    const e = await engine.start(fakeVideo(), () => undefined).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CameraError);
    expect((e as CameraError).kind).toBe(kind);
  });

  it('asks for the rear camera and no audio', async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn(async () => stream);
    await createScannerEngine({ mediaDevices: { getUserMedia }, detector: async () => ({ detect: async () => [] }) }).start(fakeVideo(), () => undefined);
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  });
});

describe('createScannerEngine: native BarcodeDetector', () => {
  it('reads codes from the video, reports them, and stops the camera', async () => {
    vi.useFakeTimers();
    const { stream, t } = fakeStream();
    const detect = vi.fn<DetectorLike['detect']>(async () => [{ rawValue: 'MCF-POD-EMBER-50' }]);
    const video = fakeVideo();
    const onText = vi.fn();
    const session = await createScannerEngine({ mediaDevices: { getUserMedia: async () => stream }, detector: async () => ({ detect }) }).start(video, onText);
    expect(session.decoder).toBe('native');
    expect(video.srcObject).toBe(stream);
    await vi.advanceTimersByTimeAsync(400);
    expect(onText).toHaveBeenCalledWith('MCF-POD-EMBER-50');
    const reads = detect.mock.calls.length;
    session.stop();
    session.stop();
    expect(t.stop).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(detect.mock.calls.length).toBe(reads);
    vi.useRealTimers();
  });

  it('a frame that cannot be read is skipped, not fatal', async () => {
    vi.useFakeTimers();
    const { stream } = fakeStream();
    const detect = vi.fn<DetectorLike['detect']>().mockRejectedValueOnce(new Error('bad frame')).mockResolvedValue([{ rawValue: 'MCF-1' }]);
    const onText = vi.fn();
    const session = await createScannerEngine({ mediaDevices: { getUserMedia: async () => stream }, detector: async () => ({ detect }) }).start(fakeVideo(), onText);
    await vi.advanceTimersByTimeAsync(600);
    expect(onText).toHaveBeenCalledWith('MCF-1');
    session.stop();
    vi.useRealTimers();
  });
});

describe('createScannerEngine: zxing fallback', () => {
  it('Safari and Firefox: the library is loaded then, decodes the same stream, and stops the camera', async () => {
    const { stream, t } = fakeStream();
    const stopControls = vi.fn();
    let callback: ((r: { getText(): string } | undefined) => void) | undefined;
    const decodeFromStream = vi.fn(async (_s: MediaStream, _v: HTMLVideoElement, cb: typeof callback) => {
      callback = cb;
      return { stop: stopControls };
    });
    const ctor = vi.fn();
    const loadZxing = vi.fn(async () => ({ BrowserMultiFormatReader: class { constructor(...a: unknown[]) { ctor(...a); } decodeFromStream = decodeFromStream } }) as never);
    const onText = vi.fn();
    const session = await createScannerEngine({ mediaDevices: { getUserMedia: async () => stream }, detector: async () => null, loadZxing }).start(fakeVideo(), onText);
    expect(session.decoder).toBe('zxing');
    expect(loadZxing).toHaveBeenCalledTimes(1);
    expect(decodeFromStream).toHaveBeenCalledWith(stream, expect.anything(), expect.any(Function));
    callback?.({ getText: () => 'MCF-POD-CASA-10' });
    callback?.(undefined);
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith('MCF-POD-CASA-10');
    session.stop();
    expect(stopControls).toHaveBeenCalled();
    expect(t.stop).toHaveBeenCalled();
    callback?.({ getText: () => 'AFTER-STOP' });
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('a library that fails to load releases the camera and reports a generic error', async () => {
    const { stream, t } = fakeStream();
    const e = await createScannerEngine({
      mediaDevices: { getUserMedia: async () => stream },
      detector: async () => null,
      loadZxing: async () => Promise.reject(new Error('chunk failed')),
    })
      .start(fakeVideo(), () => undefined)
      .catch((x: unknown) => x);
    expect((e as CameraError).kind).toBe('error');
    expect(t.stop).toHaveBeenCalled();
  });
});

describe('The barcode library is not in the main bundle', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      if (n === 'node_modules' || n === '.next') return [];
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
    });

  it('no source file imports @zxing statically; the engine loads it with import()', () => {
    const offenders: string[] = [];
    for (const f of [...files('lib'), ...files('components'), ...files('app'), ...files('hooks')]) {
      const text = readFileSync(f, 'utf8');
      if (/^\s*import[^;]*from\s+['"]@zxing\//m.test(text) || /require\(['"]@zxing/.test(text)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
    const engine = readFileSync('lib/instore/scanner-engine.ts', 'utf8');
    expect(engine).toMatch(/import\('@zxing\/browser'\)/);
    expect(engine).toMatch(/import\('@zxing\/library'\)/);
  });

  it('the dialog itself is loaded lazily by the scanner provider', () => {
    expect(readFileSync('components/instore/scan/scanner-context.tsx', 'utf8')).toMatch(/lazy\(\(\) => import\('@\/components\/instore\/scan\/ScanDialog'\)\)/);
  });

  it('the versions are pinned exactly', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@zxing/browser']).toBe('0.2.1');
    expect(pkg.dependencies['@zxing/library']).toBe('0.23.0');
  });
});
