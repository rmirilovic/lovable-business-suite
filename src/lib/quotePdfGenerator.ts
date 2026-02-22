import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { printPdfBlob } from "@/lib/printPdf";
import { Quote, QuoteItem } from "@/hooks/useQuotes";
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
  quote_note_1?: string | null;
  quote_note_2?: string | null;
  logo_url?: string | null;
  logo_text?: string | null;
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

async function buildQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  company: CompanyData,
  partner: PartnerData,
  approverName?: string | null,
  creatorName?: string | null
): Promise<jsPDF> {
  // Initialize fonts with UTF-8 support for Serbian characters
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
      // Scale logo to max 25mm height, preserving aspect ratio
      const maxH = 25;
      const maxW = 40;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const imgW = img.width * ratio;
      const imgH = img.height * ratio;
      doc.addImage(img, "PNG", 14, yPos, imgW, imgH);
      
      // Logo text next to image - larger font to match logo height
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
    // Fallback: just logo_text or company name
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

  // Document Title
  yPos += 10;
  doc.setFontSize(18);
  doc.setFont("Roboto", "bold");
  doc.text("PONUDA", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.text(quote.quote_number, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Quote info and Customer in two columns
  const colWidth = (pageWidth - 28) / 2;
  
  // Left column - Quote details
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("Detalji ponude:", 14, yPos);
  yPos += 5;
  
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(`Datum: ${format(new Date(quote.quote_date), "dd.MM.yyyy.", { locale: sr })}`, 14, yPos);
  yPos += 4;
  
  if (quote.valid_until) {
    doc.text(`Važi do: ${format(new Date(quote.valid_until), "dd.MM.yyyy.", { locale: sr })}`, 14, yPos);
    yPos += 4;
  }

  // Right column - Customer details (use quote snapshot data, fallback to partner)
  const rightColX = 14 + colWidth + 10;
  const rightColMaxWidth = colWidth - 5; // Max width for text wrapping
  let rightYPos = yPos - 9;
  
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text("Kupac:", rightColX, rightYPos);
  rightYPos += 5;
  
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  
  // Partner code
  doc.text(partner.code, rightColX, rightYPos);
  rightYPos += 4;
  
  // Partner name - allow multiple lines
  const displayName = quote.partner_name || partner.name;
  const nameLines = doc.splitTextToSize(displayName, rightColMaxWidth);
  doc.text(nameLines, rightColX, rightYPos);
  rightYPos += nameLines.length * 4;
  
  const displayAddress = quote.partner_address || partner.address;
  if (displayAddress) {
    doc.text(displayAddress, rightColX, rightYPos);
    rightYPos += 4;
  }
  
  const displayPostalCode = quote.partner_postal_code || partner.postal_code;
  const displayCity = quote.partner_city || partner.city;
  if (displayPostalCode || displayCity) {
    doc.text(`${displayPostalCode || ""} ${displayCity || ""}`.trim(), rightColX, rightYPos);
    rightYPos += 4;
  }
  
  const displayPib = quote.partner_pib || partner.pib;
  if (displayPib) {
    doc.text(`PIB: ${displayPib}`, rightColX, rightYPos);
    rightYPos += 4;
  }
  
  const displayMb = quote.partner_mb || partner.mb;
  if (displayMb) {
    doc.text(`MB: ${displayMb}`, rightColX, rightYPos);
    rightYPos += 4;
  }

  yPos = Math.max(yPos, rightYPos) + 10;

  // Header note (short note before items table)
  if (quote.header_note) {
    doc.setFontSize(9);
    doc.setFont("Roboto", "normal");
    doc.text(quote.header_note, 14, yPos);
    yPos += 6;
  }

  // Items table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.item_code || "-",
    item.item_name,
    item.unit,
    formatDecimal(item.quantity),
    formatDecimal(item.unit_price),
    item.discount_percent > 0 ? `${formatDecimal(item.discount_percent)}%` : "-",
    formatDecimal(item.line_subtotal),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["#", "Šifra", "Naziv", "JM", "Kol.", "Cena", "Rab.", "Iznos bez PDV"]],
    body: tableData,
    theme: "grid",
    styles: {
      font: "Roboto",
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 25 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 11, halign: "right" },
      7: { cellWidth: 25, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals
  const totalsX = pageWidth - 14;
  let totalsY = finalY;

  // Compute totals from items to avoid relying on potentially stale/pending persisted totals.
  // This guarantees the PDF totals match the item table.
  const computedSubtotal = items.reduce((sum, it) => sum + (Number(it.line_subtotal) || 0), 0);
  const computedVat = items.reduce((sum, it) => sum + (Number(it.line_vat) || 0), 0);
  const computedTotal = items.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0);

  const subtotalForPdf = items.length ? computedSubtotal : quote.subtotal;
  const vatForPdf = items.length ? computedVat : quote.vat_amount;
  const totalForPdf = items.length ? computedTotal : quote.total_amount;

  // Helper to format numbers with 2 decimals for PDF (using dot as decimal, comma as thousands)
  const formatPdfNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "0,00";
    return value.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  
  doc.text("Osnovica:", totalsX - 50, totalsY);
  doc.text(`${formatPdfNumber(subtotalForPdf)}`, totalsX, totalsY, { align: "right" });
  totalsY += 5;
  
  doc.text("PDV:", totalsX - 50, totalsY);
  doc.text(`${formatPdfNumber(vatForPdf)}`, totalsX, totalsY, { align: "right" });
  totalsY += 6;
  
  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.text("UKUPNO:", totalsX - 50, totalsY);
  doc.text(`${formatPdfNumber(totalForPdf)}`, totalsX, totalsY, { align: "right" });

  // Notes
  if (quote.note) {
    totalsY += 15;
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Napomena:", 14, totalsY);
    totalsY += 5;
    doc.setFont("Roboto", "normal");
    
    const splitNote = doc.splitTextToSize(quote.note, pageWidth - 28);
    doc.text(splitNote, 14, totalsY);
    totalsY += splitNote.length * 4;
  }

  // Company notes
  if (company.quote_note_1) {
    totalsY += 10;
    doc.setFontSize(8);
    doc.setFont("Roboto", "normal");
    const splitNote1 = doc.splitTextToSize(company.quote_note_1, pageWidth - 28);
    doc.text(splitNote1, 14, totalsY);
    totalsY += splitNote1.length * 3;
  }

  if (company.quote_note_2) {
    totalsY += 3;
    const splitNote2 = doc.splitTextToSize(company.quote_note_2, pageWidth - 28);
    doc.text(splitNote2, 14, totalsY);
    totalsY += splitNote2.length * 3;
  }

  // Signature section - two columns: "Ponudu sastavio" (left) and "Ponudu odobrio" (right)
  totalsY += 20;
  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");

  const sigLeftX = 14;
  const sigRightX = pageWidth - 60;

  // Left: Ponudu sastavio
  doc.text("Ponudu sastavio:", sigLeftX, totalsY);
  doc.setFont("Roboto", "bold");
  doc.text(creatorName || "________________", sigLeftX, totalsY + 8);
  doc.setDrawColor(0, 0, 0);
  doc.line(sigLeftX, totalsY + 12, sigLeftX + 60, totalsY + 12);

  // Right: Ponudu odobrio
  doc.setFont("Roboto", "normal");
  doc.text("Ponudu odobrio:", sigRightX, totalsY);
  doc.setFont("Roboto", "bold");
  doc.text(approverName || "________________", sigRightX, totalsY + 8);
  doc.line(sigRightX - 10, totalsY + 12, sigRightX + 50, totalsY + 12);

  return doc;
}

export async function generateQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  company: CompanyData,
  partner: PartnerData,
  approverName?: string | null,
  creatorName?: string | null
) {
  const doc = await buildQuotePdf(quote, items, company, partner, approverName, creatorName);
  doc.save(`Ponuda_${quote.quote_number.replace(/\//g, "-")}.pdf`);
}

export async function printQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  company: CompanyData,
  partner: PartnerData,
  approverName?: string | null,
  creatorName?: string | null
) {
  const doc = await buildQuotePdf(quote, items, company, partner, approverName, creatorName);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
