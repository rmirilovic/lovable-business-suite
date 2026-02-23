import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { printPdfBlob } from "@/lib/printPdf";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";
import { sr } from "date-fns/locale";

interface OrderData {
  order_number: string;
  order_date: string;
  delivery_deadline?: string | null;
  delivery_address?: string | null;
  delivery_method?: string | null;
  payment_method?: string | null;
  contact_person?: string | null;
  ordered_by?: string | null;
  composed_by?: string | null;
  note?: string | null;
  status: string;
  partner?: { code: string; name: string } | null;
  warehouse?: { code: string; name: string } | null;
}

interface OrderItem {
  item_code: string;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
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

async function buildOrderPdf(order: OrderData, items: OrderItem[], company: CompanyData): Promise<jsPDF> {
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
  doc.text("NALOG ZA ISPORUKU", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text(order.order_number, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Info grid
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  const left = 14;
  const right = pageWidth / 2 + 10;

  doc.text(`Datum: ${format(new Date(order.order_date), "dd.MM.yyyy.", { locale: sr })}`, left, y);
  if (order.delivery_deadline) {
    doc.text(`Rok isporuke: ${format(new Date(order.delivery_deadline), "dd.MM.yyyy.", { locale: sr })}`, right, y);
  }
  y += 5;

  if (order.partner) {
    doc.setFont("Roboto", "bold");
    doc.text("Kupac:", left, y);
    doc.setFont("Roboto", "normal");
    doc.text(`${order.partner.code} - ${order.partner.name}`, left + 15, y);
    y += 5;
  }

  if (order.delivery_address) { doc.text(`Adresa isporuke: ${order.delivery_address}`, left, y); y += 5; }
  if (order.warehouse) { doc.text(`Magacin: ${order.warehouse.code} - ${order.warehouse.name}`, left, y); y += 5; }
  if (order.delivery_method) { doc.text(`Način isporuke: ${order.delivery_method}`, left, y); y += 5; }
  if (order.payment_method) { doc.text(`Način plaćanja: ${order.payment_method}`, left, y); y += 5; }
  if (order.contact_person) { doc.text(`Kontakt: ${order.contact_person}`, left, y); y += 5; }
  if (order.ordered_by) { doc.text(`Robu poručio: ${order.ordered_by}`, left, y); y += 5; }
  y += 5;

  // Items table
  const hasPrice = items.some((i) => (i.unit_price ?? 0) > 0);
  const head = hasPrice
    ? [["#", "Šifra", "Naziv", "JM", "Količina", "Cena", "Iznos"]]
    : [["#", "Šifra", "Naziv", "JM", "Količina"]];

  const body = items.map((item, i) =>
    hasPrice
      ? [
          (i + 1).toString(),
          item.item_code || "-",
          item.item_name,
          item.unit,
          formatDecimal(item.quantity),
          formatDecimal(item.unit_price || 0),
          formatDecimal(item.line_total || 0),
        ]
      : [
          (i + 1).toString(),
          item.item_code || "-",
          item.item_name,
          item.unit,
          formatDecimal(item.quantity),
        ]
  );

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: "bold" },
    columnStyles: hasPrice
      ? { 0: { cellWidth: 10, halign: "center" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } }
      : { 0: { cellWidth: 10, halign: "center" }, 4: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Total if prices exist
  if (hasPrice) {
    const total = items.reduce((s, i) => s + (i.line_total || 0), 0);
    doc.setFontSize(10);
    doc.setFont("Roboto", "bold");
    doc.text(`Ukupno za fakturisanje: ${formatDecimal(total)}`, pageWidth - 14, finalY, { align: "right" });
    finalY += 10;
  }

  // Note
  if (order.note) {
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Napomena:", 14, finalY);
    finalY += 5;
    doc.setFont("Roboto", "normal");
    const lines = doc.splitTextToSize(order.note, pageWidth - 28);
    doc.text(lines, 14, finalY);
    finalY += lines.length * 4;
  }

  // Signature
  finalY += 15;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text("Sastavio:", 14, finalY);
  doc.setFont("Roboto", "bold");
  doc.text(order.composed_by || "________________", 14, finalY + 7);
  doc.line(14, finalY + 10, 74, finalY + 10);

  return doc;
}

export async function generateDeliveryOrderPdf(order: OrderData, items: OrderItem[], company: CompanyData) {
  const doc = await buildOrderPdf(order, items, company);
  doc.save(`Nalog_${order.order_number.replace(/\//g, "-")}.pdf`);
}

export async function printDeliveryOrderPdf(order: OrderData, items: OrderItem[], company: CompanyData) {
  const doc = await buildOrderPdf(order, items, company);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
