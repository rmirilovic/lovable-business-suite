import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MaterialRequisition, MaterialRequisitionItem } from "@/hooks/useMaterialRequisitions";
import { formatNumber } from "@/lib/formatting";
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

async function buildRequisitionPdf(
  req: MaterialRequisition,
  items: MaterialRequisitionItem[],
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
  doc.text("TREBOVANJE MATERIJALA", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text(req.requisition_number, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Info
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Datum: ${format(new Date(req.requisition_date), "dd.MM.yyyy.", { locale: sr })}`, 14, y);
  y += 5;
  if (req.warehouse) {
    doc.text(`Magacin: ${req.warehouse.code} - ${req.warehouse.name}`, 14, y);
    y += 5;
  }
  if (req.work_order) {
    doc.text(`Radni nalog: ${req.work_order.order_number}`, 14, y);
    y += 5;
  }
  doc.text(`Status: ${req.status === "posted" ? "Proknjižen" : "Nacrt"}`, 14, y);
  y += 8;

  // Items table
  const tableData = items.map((item, idx) => [
    (idx + 1).toString(),
    item.article_code,
    item.article_name,
    item.unit,
    formatNumber(item.quantity, { minimumFractionDigits: 3 }),
    formatNumber(item.unit_price, { minimumFractionDigits: 2 }),
    formatNumber(item.item_value, { minimumFractionDigits: 2 }),
  ]);

  const totalValue = items.reduce((s, i) => s + (i.item_value || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [["#", "Šifra", "Naziv materijala", "JM", "Količina", "Cena", "Vrednost"]],
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

  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // Total
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("UKUPNO:", pageWidth - 75, finalY);
  doc.text(formatNumber(totalValue, { minimumFractionDigits: 2 }), pageWidth - 14, finalY, { align: "right" });

  // Note
  if (req.note) {
    finalY += 12;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Napomena:", 14, finalY);
    doc.setFont("Roboto", "normal");
    const splitNote = doc.splitTextToSize(req.note, pageWidth - 28);
    doc.text(splitNote, 14, finalY + 5);
    finalY += 5 + splitNote.length * 4;
  }

  // Signatures
  finalY += 15;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");

  const sigWidth = (pageWidth - 28) / 2;
  // Left - Izdao
  doc.text("Materijal izdao:", 14, finalY);
  doc.line(14, finalY + 12, 14 + sigWidth - 10, finalY + 12);
  if (req.issued_by) {
    doc.text(req.issued_by, 14, finalY + 17);
  }

  // Right - Primio
  const rightX = 14 + sigWidth + 10;
  doc.text("Materijal primio:", rightX, finalY);
  doc.line(rightX, finalY + 12, rightX + sigWidth - 10, finalY + 12);
  if (req.received_by) {
    doc.text(req.received_by, rightX, finalY + 17);
  }

  return doc;
}

export async function exportRequisitionPdf(
  req: MaterialRequisition,
  items: MaterialRequisitionItem[],
  company: CompanyData
) {
  const doc = await buildRequisitionPdf(req, items, company);
  doc.save(`Trebovanje_${req.requisition_number}.pdf`);
}

export async function printRequisition(
  req: MaterialRequisition,
  items: MaterialRequisitionItem[],
  company: CompanyData
) {
  const doc = await buildRequisitionPdf(req, items, company);
  printPdfBlob(doc.output("blob"));
}
