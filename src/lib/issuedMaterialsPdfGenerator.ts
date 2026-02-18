import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { IssuedMaterialRow } from "@/hooks/useIssuedMaterials";
import { WorkOrder } from "@/hooks/useWorkOrders";
import { formatNumber, formatPrice } from "@/lib/formatting";
import { format } from "date-fns";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";

function fmtDate(d: string | null | undefined) {
  return d ? format(new Date(d), "dd.MM.yyyy.") : "-";
}

async function buildPdf(
  order: WorkOrder,
  rows: IssuedMaterialRow[],
  companyName: string
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF();
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(companyName, pw / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Istrebovani materijal", pw / 2, y, { align: "center" });
  y += 10;

  // Work order info
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Broj RN: ${order.order_number}`, 14, y);
  doc.text(`Datum RN: ${fmtDate(order.order_date)}`, 90, y);
  y += 5;
  doc.text(`Datum lansiranja: ${fmtDate(order.launched_at)}`, 14, y);
  doc.text(`Datum zaključenja: ${fmtDate(order.closed_at)}`, 90, y);
  y += 5;
  doc.text(`Magacin: ${order.warehouse ? `${order.warehouse.code} - ${order.warehouse.name}` : "-"}`, 14, y);
  y += 8;

  const head = [["Šifra", "Naziv materijala", "JM", "Prosečna cena", "Količina", "Vrednost"]];
  const body = rows.map((r) => [
    r.article_code,
    r.article_name,
    r.unit,
    formatNumber(r.avg_price, { minimumFractionDigits: 2 }),
    formatNumber(r.total_qty, { minimumFractionDigits: 3 }),
    formatNumber(r.total_value, { minimumFractionDigits: 2 }),
  ]);

  const totalValue = rows.reduce((s, r) => s + r.total_value, 0);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("UKUPNO:", pw - 75, finalY);
  doc.text(formatNumber(totalValue, { minimumFractionDigits: 2 }), pw - 14, finalY, { align: "right" });

  return doc;
}

export async function exportIssuedMaterialsPdf(
  order: WorkOrder,
  rows: IssuedMaterialRow[],
  companyName: string
) {
  const doc = await buildPdf(order, rows, companyName);
  doc.save(`Istrebovani_materijal_RN_${order.order_number}.pdf`);
}

export async function printIssuedMaterials(
  order: WorkOrder,
  rows: IssuedMaterialRow[],
  companyName: string
) {
  const doc = await buildPdf(order, rows, companyName);
  printPdfBlob(doc.output("blob"));
}

export function exportIssuedMaterialsExcel(
  order: WorkOrder,
  rows: IssuedMaterialRow[],
) {
  const fmtNum = (v: number) => (v ? formatPrice(v) : "-");
  const data = rows.map((r) => ({
    "Šifra": r.article_code,
    "Naziv materijala": r.article_name,
    "JM": r.unit,
    "Prosečna cena": fmtNum(r.avg_price),
    "Količina": formatNumber(r.total_qty, { minimumFractionDigits: 3 }),
    "Vrednost": fmtNum(r.total_value),
  }));
  const total = rows.reduce((s, r) => s + r.total_value, 0);
  data.push({ "Šifra": "", "Naziv materijala": "", "JM": "", "Prosečna cena": "", "Količina": "UKUPNO:", "Vrednost": fmtNum(total) });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Istrebovani materijal");
  XLSX.writeFile(wb, `istrebovani_materijal_RN_${order.order_number}.xlsx`);
}
