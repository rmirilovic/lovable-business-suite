import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { printPdfBlob } from "@/lib/printPdf";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";
import { sr } from "date-fns/locale";

interface NoteData {
  delivery_number: string;
  delivery_date: string;
  delivery_address?: string | null;
  delivery_method?: string | null;
  issued_by?: string | null;
  received_by?: string | null;
  note?: string | null;
  status: string;
  partner?: { code: string; name: string } | null;
  warehouse?: { code: string; name: string } | null;
}

interface NoteItem {
  item_code: string;
  item_name: string;
  unit: string;
  quantity: number;
}

interface CompanyData {
  name: string;
  address?: string | null;
  city?: string | null;
  pib?: string | null;
  mb?: string | null;
  logo_url?: string | null;
  logo_text?: string | null;
}

async function buildNotePdf(note: NoteData, items: NoteItem[], company: CompanyData): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF();
  configurePdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company header
  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text(company.name, 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  if (company.address) { doc.text(company.address, 14, y); y += 4; }
  if (company.city) { doc.text(company.city, 14, y); y += 4; }
  if (company.pib) { doc.text(`PIB: ${company.pib}`, 14, y); y += 4; }

  // Title
  y += 8;
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text("OTPREMNICA", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text(note.delivery_number, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Info
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  const left = 14;

  doc.text(`Datum: ${format(new Date(note.delivery_date), "dd.MM.yyyy.", { locale: sr })}`, left, y);
  y += 5;

  if (note.partner) {
    doc.setFont("Roboto", "bold");
    doc.text("Kupac:", left, y);
    doc.setFont("Roboto", "normal");
    doc.text(`${note.partner.code} - ${note.partner.name}`, left + 15, y);
    y += 5;
  }

  if (note.delivery_address) { doc.text(`Adresa otpreme: ${note.delivery_address}`, left, y); y += 5; }
  if (note.warehouse) { doc.text(`Magacin: ${note.warehouse.code} - ${note.warehouse.name}`, left, y); y += 5; }
  if (note.delivery_method) { doc.text(`Način otpreme: ${note.delivery_method}`, left, y); y += 5; }
  y += 5;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["#", "Šifra", "Naziv", "JM", "Količina"]],
    body: items.map((item, i) => [
      (i + 1).toString(),
      item.item_code || "-",
      item.item_name,
      item.unit,
      formatDecimal(item.quantity),
    ]),
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      4: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Note
  if (note.note) {
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Napomena:", 14, finalY);
    finalY += 5;
    doc.setFont("Roboto", "normal");
    const lines = doc.splitTextToSize(note.note, pageWidth - 28);
    doc.text(lines, 14, finalY);
    finalY += lines.length * 4;
  }

  // Signatures
  finalY += 15;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");

  doc.text("Robu izdao:", 14, finalY);
  doc.setFont("Roboto", "bold");
  doc.text(note.issued_by || "________________", 14, finalY + 7);
  doc.line(14, finalY + 10, 74, finalY + 10);

  doc.setFont("Roboto", "normal");
  doc.text("Robu primio:", pageWidth - 74, finalY);
  doc.setFont("Roboto", "bold");
  doc.text(note.received_by || "________________", pageWidth - 74, finalY + 7);
  doc.line(pageWidth - 74, finalY + 10, pageWidth - 14, finalY + 10);

  return doc;
}

export async function generateDeliveryNotePdf(note: NoteData, items: NoteItem[], company: CompanyData) {
  const doc = await buildNotePdf(note, items, company);
  doc.save(`Otpremnica_${note.delivery_number.replace(/\//g, "-")}.pdf`);
}

export async function printDeliveryNotePdf(note: NoteData, items: NoteItem[], company: CompanyData) {
  const doc = await buildNotePdf(note, items, company);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
