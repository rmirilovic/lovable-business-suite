import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import JsBarcode from "jsbarcode";

interface BarcodeArticle {
  id: string;
  code: string;
  name: string;
}

interface BarcodesPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: BarcodeArticle[];
}

function BarcodeLabel({ article }: { article: BarcodeArticle }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const code = article.code.trim();
    // Use EAN13 if code is exactly 12 or 13 digits, otherwise Code128
    const isEan13 = /^\d{12,13}$/.test(code);
    try {
      JsBarcode(svgRef.current, isEan13 ? code.slice(0, 12) : code, {
        format: isEan13 ? "EAN13" : "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 5,
        textMargin: 4,
      });
    } catch {
      // Fallback to Code128 if EAN13 fails
      try {
        JsBarcode(svgRef.current, code, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 5,
          textMargin: 4,
        });
      } catch {
        // If all fails, show error text
      }
    }
  }, [article.code]);

  return (
    <div className="barcode-label" style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 12px",
      border: "1px dashed hsl(var(--border))",
      borderRadius: "4px",
      width: "220px",
      pageBreakInside: "avoid",
    }}>
      <div style={{
        fontSize: "11px",
        fontWeight: 600,
        textAlign: "center",
        maxWidth: "200px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        marginBottom: "4px",
      }}>
        {article.name}
      </div>
      <svg ref={svgRef} />
    </div>
  );
}

export function BarcodesPrintDialog({
  open,
  onOpenChange,
  articles,
}: BarcodesPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Barkodovi</title>
          <style>
            @page { margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .grid {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              justify-content: flex-start;
            }
            .barcode-label {
              display: inline-flex;
              flex-direction: column;
              align-items: center;
              padding: 8px 12px;
              border: 1px dashed #ccc;
              border-radius: 4px;
              width: 220px;
              page-break-inside: avoid;
            }
            .label-name {
              font-size: 11px;
              font-weight: 600;
              text-align: center;
              max-width: 200px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          <div class="grid">
    `);

    articles.forEach((article) => {
      const canvas = document.createElement("canvas");
      const code = article.code.trim();
      const isEan13 = /^\d{12,13}$/.test(code);
      try {
        JsBarcode(canvas, isEan13 ? code.slice(0, 12) : code, {
          format: isEan13 ? "EAN13" : "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 5,
          textMargin: 4,
        });
      } catch {
        try {
          JsBarcode(canvas, code, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            margin: 5,
            textMargin: 4,
          });
        } catch {
          return;
        }
      }

      const dataUrl = canvas.toDataURL("image/png");
      printWindow.document.write(`
        <div class="barcode-label">
          <div class="label-name">${article.name.replace(/</g, "&lt;")}</div>
          <img src="${dataUrl}" />
        </div>
      `);
    });

    printWindow.document.write(`
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.addEventListener("load", () => printWindow.print());
    setTimeout(() => {
      try { printWindow.print(); } catch {}
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Štampa barkodova ({articles.length} artikala)</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="flex-1 overflow-auto p-4">
          <div className="flex flex-wrap gap-3 justify-start">
            {articles.map((article) => (
              <BarcodeLabel key={article.id} article={article} />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Štampaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
