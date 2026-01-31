import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ServicePurchaseInvoice,
  ServicePurchaseInvoiceItem,
} from "@/hooks/useServicePurchaseInvoices";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";

interface CompanyData {
  name: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  pib?: string | null;
  mb?: string | null;
  phone?: string | null;
  email?: string | null;
}

// Helper to format numbers with 2 decimals for PDF (Serbian locale)
const formatPdfNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "0,00";
  return value.toLocaleString("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export async function generateServicePurchaseInvoicePdf(
  invoice: ServicePurchaseInvoice,
  items: ServicePurchaseInvoiceItem[],
  company: CompanyData,
  options?: { print?: boolean }
) {
  // Initialize fonts with UTF-8 support for Serbian characters
  await initializePdfFonts();

  const doc = new jsPDF();
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Company Header (our company - receiver)
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text(company.name, 14, yPos);
  yPos += 6;

  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");

  if (company.address) {
    doc.text(company.address, 14, yPos);
    yPos += 4;
  }

  if (company.postal_code || company.city) {
    doc.text(
      `${company.postal_code || ""} ${company.city || ""}`.trim(),
      14,
      yPos
    );
    yPos += 4;
  }

  if (company.pib) {
    doc.text(`PIB: ${company.pib}`, 14, yPos);
    yPos += 4;
  }

  if (company.mb) {
    doc.text(`MB: ${company.mb}`, 14, yPos);
    yPos += 4;
  }

  // Document Title
  yPos += 10;
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text("ULAZNA FAKTURA ZA USLUGE", pageWidth / 2, yPos, { align: "center" });
  yPos += 7;

  doc.setFontSize(11);
  doc.text(invoice.internal_number, pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // Invoice info and Supplier in two columns
  const colWidth = (pageWidth - 28) / 2;

  // Left column - Invoice details
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("Podaci o fakturi:", 14, yPos);
  yPos += 5;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(
    `Broj fakture dobavljača: ${invoice.supplier_invoice_number}`,
    14,
    yPos
  );
  yPos += 4;

  doc.text(
    `Datum fakture: ${format(new Date(invoice.invoice_date), "dd.MM.yyyy.", { locale: sr })}`,
    14,
    yPos
  );
  yPos += 4;

  doc.text(
    `Datum prijema: ${format(new Date(invoice.receipt_date), "dd.MM.yyyy.", { locale: sr })}`,
    14,
    yPos
  );
  yPos += 4;

  if (invoice.due_date) {
    doc.text(
      `Datum valute: ${format(new Date(invoice.due_date), "dd.MM.yyyy.", { locale: sr })}`,
      14,
      yPos
    );
    yPos += 4;
  }

  if (invoice.payment_reference) {
    doc.text(`Poziv na broj: ${invoice.payment_reference}`, 14, yPos);
    yPos += 4;
  }

  // Right column - Supplier details
  const rightColX = 14 + colWidth + 10;
  const rightColMaxWidth = colWidth - 5;
  let rightYPos = yPos - 20;

  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("Dobavljač:", rightColX, rightYPos);
  rightYPos += 5;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);

  // Supplier name - allow multiple lines
  const displayName = invoice.supplier_name || invoice.partner?.name || "";
  const nameLines = doc.splitTextToSize(displayName, rightColMaxWidth);
  doc.text(nameLines, rightColX, rightYPos);
  rightYPos += nameLines.length * 4;

  if (invoice.supplier_address) {
    doc.text(invoice.supplier_address, rightColX, rightYPos);
    rightYPos += 4;
  }

  if (invoice.supplier_postal_code || invoice.supplier_city) {
    doc.text(
      `${invoice.supplier_postal_code || ""} ${invoice.supplier_city || ""}`.trim(),
      rightColX,
      rightYPos
    );
    rightYPos += 4;
  }

  if (invoice.supplier_pib) {
    doc.text(`PIB: ${invoice.supplier_pib}`, rightColX, rightYPos);
    rightYPos += 4;
  }

  if (invoice.supplier_mb) {
    doc.text(`MB: ${invoice.supplier_mb}`, rightColX, rightYPos);
    rightYPos += 4;
  }

  doc.text(
    `U sistemu PDV-a: ${invoice.supplier_is_in_pdv ? "Da" : "Ne"}`,
    rightColX,
    rightYPos
  );
  rightYPos += 4;

  if (invoice.supplier_bank_account) {
    doc.text(`Tekući račun: ${invoice.supplier_bank_account}`, rightColX, rightYPos);
    rightYPos += 4;
  }

  yPos = Math.max(yPos, rightYPos) + 8;

  // Items table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.item_code || "-",
    item.item_name,
    item.org_unit?.code || "-",
    formatPdfNumber(item.quantity),
    formatPdfNumber(item.unit_price),
    `${formatPdfNumber(item.vat_rate)}%`,
    item.is_vat_deductible ? "Da" : "Ne",
    formatPdfNumber(item.line_subtotal),
    formatPdfNumber(item.line_vat),
    formatPdfNumber(item.line_total),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        "#",
        "Šifra",
        "Naziv",
        "MT",
        "Kol.",
        "Cena sa PDV",
        "PDV%",
        "Odb.",
        "Osnovica",
        "PDV",
        "Ukupno",
      ],
    ],
    body: tableData,
    theme: "grid",
    styles: {
      font: "Roboto",
      fontSize: 7,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 14 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 12, halign: "right" },
      7: { cellWidth: 10, halign: "center" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 14, halign: "right" },
      10: { cellWidth: 18, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals - compute from items
  const computedSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.line_subtotal) || 0),
    0
  );
  const computedVat = items.reduce(
    (sum, it) => sum + (Number(it.line_vat) || 0),
    0
  );
  const computedTotal = items.reduce(
    (sum, it) => sum + (Number(it.line_total) || 0),
    0
  );

  const subtotalForPdf = items.length ? computedSubtotal : invoice.subtotal;
  const vatForPdf = items.length ? computedVat : invoice.vat_amount;
  const totalForPdf = items.length ? computedTotal : invoice.total_amount;

  const totalsX = pageWidth - 14;
  let totalsY = finalY;

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");

  doc.text("Osnovica:", totalsX - 50, totalsY);
  doc.text(`${formatPdfNumber(subtotalForPdf)}`, totalsX, totalsY, {
    align: "right",
  });
  totalsY += 5;

  doc.text("PDV:", totalsX - 50, totalsY);
  doc.text(`${formatPdfNumber(vatForPdf)}`, totalsX, totalsY, {
    align: "right",
  });
  totalsY += 6;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.text("UKUPNO:", totalsX - 50, totalsY);
  doc.text(`${formatPdfNumber(totalForPdf)}`, totalsX, totalsY, {
    align: "right",
  });

  // External note
  if (invoice.note) {
    totalsY += 12;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Napomena:", 14, totalsY);
    totalsY += 5;
    doc.setFont("Roboto", "normal");

    const splitNote = doc.splitTextToSize(invoice.note, pageWidth - 28);
    doc.text(splitNote, 14, totalsY);
    totalsY += splitNote.length * 4;
  }

  // Internal note
  if (invoice.internal_note) {
    totalsY += 8;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Interna napomena:", 14, totalsY);
    totalsY += 5;
    doc.setFont("Roboto", "normal");

    const splitInternalNote = doc.splitTextToSize(
      invoice.internal_note,
      pageWidth - 28
    );
    doc.text(splitInternalNote, 14, totalsY);
  }

  // Save or print
  if (options?.print) {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(
      `Ulazna_faktura_usluge_${invoice.internal_number.replace(/\//g, "-")}.pdf`
    );
  }
}
