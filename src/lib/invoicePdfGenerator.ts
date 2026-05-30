import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { printPdfBlob } from "@/lib/printPdf";
import { Invoice, InvoiceItem } from "@/hooks/useInvoices";
import { formatDecimal } from "@/lib/formatting";
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
  invoice_note_1?: string | null;
  invoice_note_2?: string | null;
  logo_url?: string | null;
  logo_text?: string | null;
  responsible_person_name?: string | null;
}

interface PartnerData {
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  pib?: string | null;
  mb?: string | null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

const formatPdfNumber = (value: number | null | undefined, lang: "sr" | "en" = "sr"): string => {
  if (value === null || value === undefined || isNaN(value)) return lang === "en" ? "0.00" : "0,00";
  const locale = lang === "en" ? "en-US" : "sr-RS";
  return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TAX_CATEGORY_LABELS_SR: Record<string, string> = {
  S: "Standardna stopa",
  E: "Oslobođeno PDV-a",
  O: "Van sistema PDV-a",
  AE: "Obrnuti obračun PDV-a",
};

const TAX_CATEGORY_LABELS_EN: Record<string, string> = {
  S: "Standard rate",
  E: "VAT exempt",
  O: "Outside VAT system",
  AE: "Reverse charge VAT",
};

type Lang = "sr" | "en";

const L = (lang: Lang) => ({
  invoice: lang === "en" ? "INVOICE" : "FAKTURA",
  invoiceDetails: lang === "en" ? "Invoice details:" : "Detalji fakture:",
  invoiceDate: lang === "en" ? "Invoice date" : "Datum fakture",
  dueDate: lang === "en" ? "Due date" : "Datum valute",
  deliveryDate: lang === "en" ? "Delivery date" : "Datum prometa",
  deliveryPlace: lang === "en" ? "Place of delivery" : "Mesto prometa",
  deliveryNote: lang === "en" ? "Delivery note" : "Otpremnica",
  currency: lang === "en" ? "Currency" : "Valuta",
  exchangeRate: lang === "en" ? "NBS middle exchange rate" : "Srednji kurs NBS",
  jci: lang === "en" ? "Customs declaration (JCI)" : "JCI",
  of: lang === "en" ? "of" : "od",
  incoterms: lang === "en" ? "Delivery (Incoterms)" : "Isporuka (Incoterms)",
  customer: lang === "en" ? "Customer:" : "Kupac:",
  pib: lang === "en" ? "VAT ID" : "PIB",
  mb: lang === "en" ? "Reg. No." : "MB",
  bankAccount: lang === "en" ? "Bank account" : "Broj tekućeg računa",
  tableHead: lang === "en"
    ? ["#", "Description", "UoM", "Qty", "Price", "Disc.", "VAT%", "Net", "VAT", "Total"]
    : ["#", "Naziv", "JM", "Kol.", "Cena", "Rab.", "PDV%", "Osnovica", "PDV iznos", "Ukupno"],
  subtotal: lang === "en" ? "Subtotal:" : "Osnovica:",
  vat: lang === "en" ? "VAT:" : "PDV:",
  total: lang === "en" ? "TOTAL:" : "UKUPNO:",
  advance: lang === "en" ? "Advance" : "Avans",
  amountToPay: lang === "en" ? "AMOUNT TO PAY:" : "IZNOS ZA UPLATU:",
  rsdEquiv: lang === "en" ? "RSD equivalent (at rate" : "RSD ekvivalent (po kursu",
  taxExempt: lang === "en" ? "Tax exemption" : "Poresko oslobođenje",
  notes: lang === "en" ? "Notes:" : "Napomena:",
  composedBy: lang === "en" ? "Prepared by:" : "Fakturu sastavio:",
  authorizedPerson: lang === "en" ? "Authorized person:" : "Ovlašćeno lice:",
});

async function buildInvoicePdf(
  invoice: Invoice,
  items: InvoiceItem[],
  company: CompanyData,
  partner: PartnerData,
  bankAccountText?: string | null,
  deliveryNoteNumber?: string | null,
  advanceInfo?: { number: string; amount: number },
  lang: Lang = "sr"
): Promise<jsPDF> {
  const t = L(lang);
  const dateFmt = (d: Date | string) => format(new Date(d), lang === "en" ? "dd/MM/yyyy" : "dd.MM.yyyy.", lang === "en" ? undefined : { locale: sr });
  await initializePdfFonts();

  const doc = new jsPDF();
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Company Header - Logo + Logo Text
  let logoLoaded = false;
  if (company.logo_url) {
    try {
      const img = await loadImage(company.logo_url);
      const maxH = 25;
      const maxW = 40;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const imgW = img.width * ratio;
      const imgH = img.height * ratio;
      doc.addImage(img, "PNG", 14, yPos, imgW, imgH);

      if (company.logo_text) {
        const textX = 14 + imgW + 5;
        const textMaxW = pageWidth - textX - 14;
        doc.setFontSize(11);
        doc.setFont("Roboto", "normal");
        const lines = doc.splitTextToSize(company.logo_text, textMaxW);
        doc.text(lines, textX, yPos + 4);
      }

      yPos += Math.max(imgH, company.logo_text ? 20 : 0) + 5;
      logoLoaded = true;
    } catch (e) {
      console.warn("Failed to load company logo for PDF:", e);
    }
  }

  if (!logoLoaded) {
    if (company.logo_text) {
      doc.setFontSize(9);
      doc.setFont("Roboto", "normal");
      const lines = doc.splitTextToSize(company.logo_text, pageWidth - 28);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 4 + 2;
    } else {
      doc.setFontSize(16);
      doc.setFont("Roboto", "bold");
      doc.text(company.name, 14, yPos);
      yPos += 7;
    }
  }

  // Bank account
  if (bankAccountText) {
    yPos += 4;
    doc.setFontSize(9);
    doc.setFont("Roboto", "normal");
    doc.text(`${t.bankAccount}: ${bankAccountText}`, pageWidth - 14, yPos, { align: "right" });
    yPos += 4;
  }

  // Document Title
  yPos += 10;
  doc.setFontSize(18);
  doc.setFont("Roboto", "bold");
  doc.text(t.invoice, pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(12);
  doc.text(invoice.invoice_number, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Invoice info and Customer in two columns
  const colWidth = (pageWidth - 28) / 2;

  // Left column - Invoice details
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text(t.invoiceDetails, 14, yPos);
  yPos += 5;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(`${t.invoiceDate}: ${dateFmt(invoice.invoice_date)}`, 14, yPos);
  yPos += 4;

  if (invoice.due_date) {
    doc.text(`${t.dueDate}: ${dateFmt(invoice.due_date)}`, 14, yPos);
    yPos += 4;
  }

  if ((invoice as any).datum_prometa) {
    doc.text(`${t.deliveryDate}: ${dateFmt((invoice as any).datum_prometa)}`, 14, yPos);
    yPos += 4;
  }

  if ((invoice as any).mesto_prometa) {
    doc.text(`${t.deliveryPlace}: ${(invoice as any).mesto_prometa}`, 14, yPos);
    yPos += 4;
  }

  if (deliveryNoteNumber) {
    doc.text(`${t.deliveryNote}: ${deliveryNoteNumber}`, 14, yPos);
    yPos += 4;
  }

  // Ino faktura — valuta, kurs, JCI
  const isForeign = invoice.currency && invoice.currency !== "RSD";
  if (isForeign) {
    doc.setFont("Roboto", "bold");
    doc.text(`${t.currency}: ${invoice.currency}`, 14, yPos);
    doc.setFont("Roboto", "normal");
    yPos += 4;
    if (invoice.exchange_rate && invoice.exchange_rate !== 1) {
      doc.text(`${t.exchangeRate}: 1 ${invoice.currency} = ${formatPdfNumber(invoice.exchange_rate, lang)} RSD`, 14, yPos);
      yPos += 4;
    }
    if ((invoice as any).jci_number) {
      const jciDate = (invoice as any).jci_date
        ? ` ${t.of} ${dateFmt((invoice as any).jci_date)}`
        : "";
      doc.text(`${t.jci}: ${(invoice as any).jci_number}${jciDate}`, 14, yPos);
      yPos += 4;
    }
    if ((invoice as any).delivery_terms) {
      doc.text(`${t.incoterms}: ${(invoice as any).delivery_terms}`, 14, yPos);
      yPos += 4;
    }
  }




  // Right column - Customer details
  const rightColX = 14 + colWidth + 10;
  const rightColMaxWidth = colWidth - 5;
  let rightYPos = yPos - 13;

  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text(t.customer, rightColX, rightYPos);
  rightYPos += 5;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);

  doc.text(partner.code, rightColX, rightYPos);
  rightYPos += 4;

  const displayName = invoice.partner_name || partner.name;
  const nameLines = doc.splitTextToSize(displayName, rightColMaxWidth);
  doc.text(nameLines, rightColX, rightYPos);
  rightYPos += nameLines.length * 4;

  const displayAddress = invoice.partner_address || partner.address;
  if (displayAddress) {
    doc.text(displayAddress, rightColX, rightYPos);
    rightYPos += 4;
  }

  const displayPostalCode = invoice.partner_postal_code || partner.postal_code;
  const displayCity = invoice.partner_city || partner.city;
  if (displayPostalCode || displayCity) {
    doc.text(`${displayPostalCode || ""} ${displayCity || ""}`.trim(), rightColX, rightYPos);
    rightYPos += 4;
  }

  const displayPib = invoice.partner_pib || partner.pib;
  if (displayPib) {
    doc.text(`${t.pib}: ${displayPib}`, rightColX, rightYPos);
    rightYPos += 4;
  }

  const displayMb = invoice.partner_mb || partner.mb;
  if (displayMb) {
    doc.text(`${t.mb}: ${displayMb}`, rightColX, rightYPos);
    rightYPos += 4;
  }

  yPos = Math.max(yPos, rightYPos) + 10;

  // Header note
  if (invoice.header_note) {
    doc.setFontSize(9);
    doc.setFont("Roboto", "normal");
    doc.text(invoice.header_note, 14, yPos);
    yPos += 6;
  }

  // Items table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.item_name,
    item.unit,
    formatDecimal(item.quantity),
    formatDecimal(item.unit_price),
    item.discount_percent > 0 ? `${formatDecimal(item.discount_percent)}%` : "-",
    `${item.vat_rate}%`,
    formatDecimal(item.line_subtotal),
    formatDecimal(item.line_vat),
    formatDecimal(item.line_total),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [t.tableHead],
    body: tableData,
    theme: "grid",
    styles: { font: "Roboto" },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 11, halign: "right" },
      6: { cellWidth: 12, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 22, halign: "right" },
      9: { cellWidth: 22, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  let totalsY = (doc as any).lastAutoTable.finalY + 10;

  // Totals
  const totalsX = pageWidth - 14;
  const labelsX = totalsX - 70;
  const computedSubtotal = items.reduce((sum, it) => sum + (Number(it.line_subtotal) || 0), 0);
  const computedVat = items.reduce((sum, it) => sum + (Number(it.line_vat) || 0), 0);
  const computedTotal = items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0);

  const subtotalForPdf = items.length ? computedSubtotal : invoice.subtotal;
  const vatForPdf = items.length ? computedVat : invoice.vat_amount;
  const totalForPdf = items.length ? computedTotal : invoice.total_amount;

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");

  doc.text(t.subtotal, labelsX, totalsY);
  doc.text(formatPdfNumber(subtotalForPdf, lang), totalsX, totalsY, { align: "right" });
  totalsY += 5;

  doc.text(t.vat, labelsX, totalsY);
  doc.text(formatPdfNumber(vatForPdf, lang), totalsX, totalsY, { align: "right" });
  totalsY += 6;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.text(t.total, labelsX, totalsY);
  doc.text(formatPdfNumber(totalForPdf, lang), totalsX, totalsY, { align: "right" });

  // Advance invoice deduction + Amount to pay
  if (advanceInfo && advanceInfo.amount > 0) {
    totalsY += 7;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(`${t.advance} (${lang === "en" ? "AI" : "AF"} ${advanceInfo.number}):`, labelsX, totalsY);
    doc.text(`- ${formatPdfNumber(advanceInfo.amount, lang)}`, totalsX, totalsY, { align: "right" });
    totalsY += 6;
    doc.setFont("Roboto", "bold");
    doc.setFontSize(12);
    doc.text(t.amountToPay, labelsX, totalsY);
    doc.text(formatPdfNumber((totalForPdf || 0) - advanceInfo.amount, lang), totalsX, totalsY, { align: "right" });
  }

  // RSD ekvivalent za ino fakture
  if (isForeign && invoice.exchange_rate && invoice.exchange_rate !== 1) {
    totalsY += 7;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    const rsdTotal = (totalForPdf || 0) * invoice.exchange_rate;
    doc.text(`${t.rsdEquiv} ${formatPdfNumber(invoice.exchange_rate, lang)}):`, labelsX, totalsY);
    doc.text(`${formatPdfNumber(rsdTotal, lang)} RSD`, totalsX, totalsY, { align: "right" });
  }

  // Tax exemption note
  const taxCat = invoice.tax_category_code || "S";
  if (taxCat !== "S") {
    totalsY += 10;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    const labels = lang === "en" ? TAX_CATEGORY_LABELS_EN : TAX_CATEGORY_LABELS_SR;
    const label = labels[taxCat] || taxCat;
    let exemptionText = `${t.taxExempt}: ${label}`;
    if (invoice.tax_exemption_reason) {
      exemptionText += ` — ${invoice.tax_exemption_reason}`;
    }
    doc.text(exemptionText, 14, totalsY);
    totalsY += 5;
  }

  // Notes
  if (invoice.note) {
    totalsY += 5;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text(t.notes, 14, totalsY);
    totalsY += 4;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    const splitNote = doc.splitTextToSize(invoice.note, pageWidth - 28);
    const prevLH = (doc as any).getLineHeightFactor?.() ?? 1.15;
    doc.setLineHeightFactor(1.1);
    doc.text(splitNote, 14, totalsY);
    doc.setLineHeightFactor(prevLH);
    totalsY += splitNote.length * 3.2;
  }

  // Company notes
  if (company.invoice_note_1) {
    totalsY += 7;
    doc.setFontSize(7);
    doc.setFont("Roboto", "normal");
    const splitNote1 = doc.splitTextToSize(company.invoice_note_1, pageWidth - 28);
    const prevLH = (doc as any).getLineHeightFactor?.() ?? 1.15;
    doc.setLineHeightFactor(1.1);
    doc.text(splitNote1, pageWidth / 2, totalsY, { align: "center" });
    doc.setLineHeightFactor(prevLH);
    totalsY += splitNote1.length * 2.8;
  }

  if (company.invoice_note_2) {
    totalsY += 2;
    doc.setFontSize(7);
    doc.setFont("Roboto", "normal");
    const splitNote2 = doc.splitTextToSize(company.invoice_note_2, pageWidth - 28);
    const prevLH = (doc as any).getLineHeightFactor?.() ?? 1.15;
    doc.setLineHeightFactor(1.1);
    doc.text(splitNote2, 14, totalsY);
    doc.setLineHeightFactor(prevLH);
    totalsY += splitNote2.length * 2.8;
  }

  // Signature section
  totalsY += 20;
  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");

  const sigLeftX = 14;
  const sigRightX = pageWidth - 60;

  doc.text("Fakturu sastavio:", sigLeftX, totalsY);
  doc.setFont("Roboto", "bold");
  doc.text(invoice.composed_by || "________________", sigLeftX, totalsY + 8);
  doc.setDrawColor(0, 0, 0);
  doc.line(sigLeftX, totalsY + 12, sigLeftX + 60, totalsY + 12);

  doc.setFont("Roboto", "normal");
  doc.text("Ovlašćeno lice:", sigRightX, totalsY);
  doc.setFont("Roboto", "bold");
  doc.text(company.responsible_person_name || "________________", sigRightX, totalsY + 8);
  doc.line(sigRightX - 10, totalsY + 12, sigRightX + 50, totalsY + 12);

  return doc;
}

export async function generateInvoicePdf(
  invoice: Invoice,
  items: InvoiceItem[],
  company: CompanyData,
  partner: PartnerData,
  bankAccountText?: string | null,
  deliveryNoteNumber?: string | null,
  advanceInfo?: { number: string; amount: number }
) {
  const doc = await buildInvoicePdf(invoice, items, company, partner, bankAccountText, deliveryNoteNumber, advanceInfo);
  doc.save(`Faktura_${invoice.invoice_number.replace(/\//g, "-")}.pdf`);
}

export async function printInvoicePdf(
  invoice: Invoice,
  items: InvoiceItem[],
  company: CompanyData,
  partner: PartnerData,
  bankAccountText?: string | null,
  deliveryNoteNumber?: string | null,
  advanceInfo?: { number: string; amount: number }
) {
  const doc = await buildInvoicePdf(invoice, items, company, partner, bankAccountText, deliveryNoteNumber, advanceInfo);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
