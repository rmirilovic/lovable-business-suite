import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GoodsReceipt, GoodsReceiptItem } from "@/hooks/useGoodsReceipts";
import { formatDecimal, formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";

interface CompanyData {
  name: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  pib?: string | null;
  mb?: string | null;
}

async function buildGoodsReceiptPdf(
  receipt: GoodsReceipt,
  items: GoodsReceiptItem[],
  company: CompanyData
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF();
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company header
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text(company.name, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  if (company.address) { doc.text(company.address, 14, y); y += 4; }
  if (company.postal_code || company.city) {
    doc.text(`${company.postal_code || ""} ${company.city || ""}`.trim(), 14, y);
    y += 4;
  }
  if (company.pib) { doc.text(`PIB: ${company.pib}`, 14, y); y += 4; }
  if (company.mb) { doc.text(`MB: ${company.mb}`, 14, y); y += 4; }

  // Title
  y += 8;
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text("PRIJEMNICA", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text(receipt.receipt_number, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Info
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Datum: ${format(new Date(receipt.receipt_date), "dd.MM.yyyy.", { locale: sr })}`, 14, y);
  y += 5;
  if (receipt.warehouse) {
    doc.text(`Magacin: ${receipt.warehouse.code} - ${receipt.warehouse.name}`, 14, y);
    y += 5;
  }
  if (receipt.partner) {
    doc.text(`Dobavljač: ${receipt.partner.code} - ${receipt.partner.name}`, 14, y);
    y += 5;
  }
  doc.text(`Status: ${receipt.status === "posted" ? "Proknjiženo" : "Nacrt"}`, 14, y);
  y += 8;

  // Items table
  const tableData = items.map((item, idx) => [
    (idx + 1).toString(),
    item.item_code || item.article?.code || "-",
    item.item_name,
    item.unit,
    formatNumber(item.quantity),
    formatDecimal(item.unit_price, 2),
    formatDecimal(item.quantity * item.unit_price, 2),
  ]);

  const totalValue = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  autoTable(doc, {
    startY: y,
    head: [["#", "Šifra", "Naziv", "JM", "Količina", "Cena", "Vrednost"]],
    body: tableData,
    theme: "grid",
    styles: { font: "Roboto" },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Total
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("UKUPNO:", pageWidth - 75, finalY);
  doc.text(formatDecimal(totalValue, 2), pageWidth - 14, finalY, { align: "right" });

  // Note
  if (receipt.note) {
    const noteY = finalY + 12;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Napomena:", 14, noteY);
    doc.setFont("Roboto", "normal");
    const splitNote = doc.splitTextToSize(receipt.note, pageWidth - 28);
    doc.text(splitNote, 14, noteY + 5);
  }

  return doc;
}

export async function exportGoodsReceiptPdf(
  receipt: GoodsReceipt,
  items: GoodsReceiptItem[],
  company: CompanyData
) {
  const doc = await buildGoodsReceiptPdf(receipt, items, company);
  doc.save(`Prijemnica_${receipt.receipt_number.replace(/\//g, "-")}.pdf`);
}

export async function printGoodsReceipt(
  receipt: GoodsReceipt,
  items: GoodsReceiptItem[],
  company: CompanyData
) {
  const doc = await buildGoodsReceiptPdf(receipt, items, company);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
