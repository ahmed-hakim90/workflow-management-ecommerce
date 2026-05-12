"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

const ELEM_ID = "warehouse-awb-html5-reader";

export function AwbBarcodeScanner({
  onDecoded,
  disabled,
}: {
  onDecoded: (value: string) => void;
  disabled?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inst = useRef<Html5Qrcode | null>(null);

  const stop = async () => {
    if (!inst.current) return;
    try {
      await inst.current.stop();
    } catch {
      /* no-op */
    }
    inst.current = null;
    setRunning(false);
  };

  const start = async () => {
    setErr(null);
    if (inst.current) await stop();
    const h = new Html5Qrcode(ELEM_ID, { verbose: false });
    inst.current = h;
    try {
      await h.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (t) => {
          const v = t.trim();
          if (v) {
            onDecoded(v);
            void stop();
          }
        },
        () => {},
      );
      setRunning(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open the camera");
      inst.current = null;
    }
  };

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  return (
    <div className="space-y-2">
      <div
        id={ELEM_ID}
        className="w-full min-h-0 max-w-sm overflow-hidden rounded-[var(--ds-radius-md)] border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)]"
      />
      {err ? (
        <p className="text-sm text-[color:var(--color-error)]">{err}</p>
      ) : null}
      {running ? (
        <Button type="button" variant="secondary" onClick={() => void stop()}>
          Stop camera
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void start()}
          disabled={disabled}
        >
          Open camera (scan barcode)
        </Button>
      )}
    </div>
  );
}
