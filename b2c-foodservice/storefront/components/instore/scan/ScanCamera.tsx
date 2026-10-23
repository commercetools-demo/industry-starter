'use client';

import { useEffect, useRef } from 'react';
import { CameraError, createScannerEngine, type ScannerEngine } from '@/lib/instore/scanner-engine';
import type { CameraState } from '@/lib/instore/scan-state';

/**
 * The camera preview and its decoder (workstream R). Starting the camera is the only side effect here: it asks for permission,
 * reports `starting`, then `on` or the reason it did not start (`denied`, `none`, `error`), and releases the camera when it
 * unmounts or `attempt` changes (a retry). Decoded text goes to `onText`; this component never looks anything up.
 */
export default function ScanCamera({
  engine, attempt, onCamera, onText, label,
}: {
  engine?: ScannerEngine | undefined;
  /** Change it to start again after a failure. */
  attempt: number;
  onCamera: (state: Exclude<CameraState, 'off'>) => void;
  onText: (text: string) => void;
  label: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  // The callbacks change on every render of the dialog; the effect must not restart the camera for that.
  const cameraRef = useRef(onCamera);
  const textRef = useRef(onText);
  useEffect(() => {
    cameraRef.current = onCamera;
    textRef.current = onText;
  });

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let cancelled = false;
    let session: { stop(): void } | null = null;
    cameraRef.current('starting');
    (engine ?? createScannerEngine())
      .start(el, (text) => textRef.current(text))
      .then((s) => {
        if (cancelled) {
          s.stop();
          return;
        }
        session = s;
        cameraRef.current('on');
      })
      .catch((e: unknown) => {
        if (!cancelled) cameraRef.current(e instanceof CameraError ? e.kind : 'error');
      });
    return () => {
      cancelled = true;
      session?.stop();
    };
  }, [engine, attempt]);

  return (
    <video
      ref={video}
      playsInline
      muted
      autoPlay
      aria-label={label}
      data-testid="scan-video"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
