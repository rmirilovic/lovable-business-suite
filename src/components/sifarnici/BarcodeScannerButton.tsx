import { useState, useEffect, useRef } from "react";
import { Camera, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Html5Qrcode } from "html5-qrcode";
import { useIsMobile } from "@/hooks/use-mobile";

interface BarcodeScannerButtonProps {
  onScan: (code: string) => void;
}

export function BarcodeScannerButton({ onScan }: BarcodeScannerButtonProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode("barcode-scanner-region");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            if (!mounted) return;
            onScan(decodedText);
            setOpen(false);
          },
          () => {
            // ignore scan failures (no code found in frame)
          }
        );
      } catch (err: any) {
        if (mounted) {
          setError(
            err?.message?.includes("NotAllowedError") || err?.message?.includes("Permission")
              ? "Pristup kameri je odbijen. Dozvolite pristup kameri u podešavanjima pregledača."
              : "Nije moguće pokrenuti kameru. Proverite da li uređaj ima kameru."
          );
        }
      }
    };

    // Small delay to let DOM render the container
    const timeout = setTimeout(startScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan]);

  // Clean up error on close
  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  if (!isMobile) return null;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => setOpen(true)}
        title="Skeniraj barkod"
      >
        <Camera className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Skeniraj barkod</DialogTitle>
          </DialogHeader>

          {error ? (
            <div className="text-sm text-destructive text-center py-8">{error}</div>
          ) : (
            <div className="text-xs text-muted-foreground text-center mb-2">
              Usmerite kameru prema barkodu artikla
            </div>
          )}

          <div
            id="barcode-scanner-region"
            ref={containerRef}
            className="w-full rounded-md overflow-hidden"
            style={{ minHeight: 250 }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
