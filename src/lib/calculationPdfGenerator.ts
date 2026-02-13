import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PurchasePriceCalculation,
  CalculationItem,
  CalculationAdditionalCost,
} from "@/hooks/usePurchasePriceCalculations";
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
}

function printPdfBlob(blob: Blob) {
  const blobUrl = URL.createObjectURL(blob);
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "none";
  printFrame.src = blobUrl;
  printFrame.onload = () => {
    setTimeout(() => { printFrame.contentWindow?.print(); }, 100);
  };
  document.body.appendChild(printFrame);
  setTimeout(() => {
    document.body.removeChild(printFrame);
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}

async function buildCalculationPdf(
  calculation: PurchasePriceCalculation,
  items: CalculationItem[],
  costs: CalculationAdditionalCost[],
  company: CompanyData
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Company header
  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text(company.name, 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  if (company.address) { doc.text(company.address, 14, y); y += 4; }
  if (company.pib) { doc.text(`PIB: ${company.pib}`, 14, y); y += 4; }

  // Title
  y += 4;
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("KALKULACIJA NABAVNE CENE", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text(calculation.calculation_number, pageWidth / 2, y, { align: "center" });
  y += 9;

  // Info row
  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  const receiptNum = (calculation.goods_receipt as any)?.receipt_number || "—";
  const partnerName = (calculation.goods_receipt as any)?.partner?.name || "—";
  const warehouseInfo = (calculation.goods_receipt as any)?.warehouse
    ? `${(calculation.goods_receipt as any).warehouse.code} - ${(calculation.goods_receipt as any).warehouse.name}`
    : "—";
  doc.text(
    `Datum: ${format(new Date(calculation.calculation_date), "dd.MM.yyyy.", { locale: sr })}  |  Prijemnica: ${receiptNum}  |  Dobavljač: ${partnerName}  |  Magacin: ${warehouseInfo}`,
    14, y
  );
  y += 4;
  doc.text(`Status: ${calculation.status === "posted" ? "Proknjiženo" : "Nacrt"}`, 14, y);
  y += 6;

  // Additional costs summary
  if (costs.length > 0) {
    doc.setFontSize(9);
    doc.setFont("Roboto", "bold");
    doc.text("Zavisni troškovi nabavke:", 14, y);
    y += 4;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    for (const cost of costs) {
      const method = cost.distribution_method === "by_value" ? "po vrednosti" : "po količini";
      doc.text(`• ${cost.description} — ${formatDecimal(cost.amount, 2)} (${method})`, 18, y);
      y += 4;
    }
    y += 2;
  }

  // Items table
  const tableData = items.map((item, idx) => [
    (idx + 1).toString(),
    item.item_code || "-",
    item.item_name,
    item.unit,
    formatDecimal(item.quantity, 0),
    formatDecimal(item.purchase_price, 2),
    formatDecimal(item.purchase_value, 2),
    formatDecimal(item.allocated_costs, 2),
    formatDecimal(item.cost_price, 2),
    formatDecimal(item.cost_value, 2),
    formatDecimal(item.markup_percent, 2) + "%",
    formatDecimal(item.markup_amount, 2),
    formatDecimal(item.selling_price, 2),
    formatDecimal(item.selling_value, 2),
  ]);

  // Totals row
  const totals = items.reduce(
    (acc, i) => ({
      purchaseValue: acc.purchaseValue + i.purchase_value,
      allocatedCosts: acc.allocatedCosts + i.allocated_costs,
      costValue: acc.costValue + i.cost_value,
      markupValue: acc.markupValue + i.markup_amount * i.quantity,
      sellingValue: acc.sellingValue + i.selling_value,
    }),
    { purchaseValue: 0, allocatedCosts: 0, costValue: 0, markupValue: 0, sellingValue: 0 }
  );

  tableData.push([
    "", "", "UKUPNO", "", "",
    "",
    formatDecimal(totals.purchaseValue, 2),
    formatDecimal(totals.allocatedCosts, 2),
    "",
    formatDecimal(totals.costValue, 2),
    "",
    formatDecimal(totals.markupValue, 2),
    "",
    formatDecimal(totals.sellingValue, 2),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Šifra", "Naziv", "JM", "Kol.", "Nab.cena", "Nab.vred.", "Zav.troš.", "C.košt.", "V.košt.", "Marža%", "Marža izn.", "Pr.cena", "Pr.vred."]],
    body: tableData,
    theme: "grid",
    styles: { font: "Roboto", fontSize: 7 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 16 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 22, halign: "right" },
      10: { cellWidth: 16, halign: "right" },
      11: { cellWidth: 18, halign: "right" },
      12: { cellWidth: 18, halign: "right" },
      13: { cellWidth: 22, halign: "right" },
    },
    margin: { left: 10, right: 10 },
    didParseCell: (data) => {
      // Bold totals row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Summary cards
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");

  const summaryItems = [
    ["Nabavna vrednost", formatDecimal(calculation.total_purchase_value, 2)],
    ["Zavisni troškovi", formatDecimal(calculation.total_additional_costs, 2)],
    ["Vrednost koštanja", formatDecimal(calculation.total_cost_value, 2)],
    ["Razlika u ceni", formatDecimal(calculation.total_markup_value, 2)],
    ["Prodajna vrednost", formatDecimal(calculation.total_selling_value, 2)],
  ];

  let sx = 14;
  for (const [label, value] of summaryItems) {
    doc.setFont("Roboto", "normal");
    doc.text(label + ":", sx, finalY);
    doc.setFont("Roboto", "bold");
    doc.text(value, sx, finalY + 5);
    sx += 50;
  }

  return doc;
}

export async function exportCalculationPdf(
  calculation: PurchasePriceCalculation,
  items: CalculationItem[],
  costs: CalculationAdditionalCost[],
  company: CompanyData
) {
  const doc = await buildCalculationPdf(calculation, items, costs, company);
  doc.save(`Kalkulacija_${calculation.calculation_number.replace(/\//g, "-")}.pdf`);
}

export async function printCalculation(
  calculation: PurchasePriceCalculation,
  items: CalculationItem[],
  costs: CalculationAdditionalCost[],
  company: CompanyData
) {
  const doc = await buildCalculationPdf(calculation, items, costs, company);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
