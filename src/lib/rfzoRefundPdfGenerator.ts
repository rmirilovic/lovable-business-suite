import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { setupSerbianFont } from "./pdfFonts";
import { formatPrice, formatDate } from "./formatting";

interface RefundItem {
  employee_number: string;
  employee_name: string;
  jmbg: string;
  absence_start: string;
  absence_end: string;
  work_days: number;
  compensation_rate: number;
  average_salary: number;
  daily_amount: number;
  total_amount: number;
  gross_salary: number;
  pio_employee: number;
  health_employee: number;
  unemployment: number;
  income_tax: number;
  pio_employer: number;
  health_employer: number;
}

interface RefundPdfOptions {
  companyName: string;
  companyPib: string;
  companyMb: string;
  companyAddress: string;
  periodMonth: number;
  periodYear: number;
  items: RefundItem[];
}

const MONTH_NAMES = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];

export function generateRfzoRefundPdf(options: RefundPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setupSerbianFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  // Header
  doc.setFontSize(11);
  doc.text("РЕПУБЛИЧКИ ФОНД ЗА ЗДРАВСТВЕНО ОСИГУРАЊЕ", pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.text("Филијала: ___________________________", margin, 22);

  doc.setFontSize(13);
  doc.text("ЗАХТЕВ ЗА РЕФУНДАЦИЈУ НАКНАДЕ ЗАРАДЕ", pageWidth / 2, 32, { align: "center" });
  doc.setFontSize(9);
  doc.text(`за ${MONTH_NAMES[options.periodMonth - 1]} ${options.periodYear}. године`, pageWidth / 2, 38, { align: "center" });

  // Company info
  let y = 44;
  doc.text(`Послодавац: ${options.companyName}`, margin, y);
  doc.text(`ПИБ: ${options.companyPib}`, pageWidth / 2, y);
  y += 5;
  doc.text(`МБ: ${options.companyMb}`, margin, y);
  doc.text(`Адреса: ${options.companyAddress}`, pageWidth / 2, y);
  y += 8;

  // Table
  const tableHeaders = [
    "Р.б.",
    "Шифра",
    "Презиме и име",
    "ЈМБГ",
    "Од",
    "До",
    "Рад. дана",
    "% накн.",
    "Просечна\nзарада",
    "Дневни\nизнос",
    "Укупно\nнакнада",
    "Бруто",
    "ПИО зап.",
    "Здр. зап.",
    "Незап.",
    "Порез",
    "ПИО посл.",
    "Здр. посл.",
  ];

  const tableData = options.items.map((item, idx) => [
    String(idx + 1),
    item.employee_number,
    item.employee_name,
    item.jmbg || "",
    formatDate(item.absence_start),
    formatDate(item.absence_end),
    String(item.work_days),
    `${item.compensation_rate}%`,
    formatPrice(item.average_salary),
    formatPrice(item.daily_amount),
    formatPrice(item.total_amount),
    formatPrice(item.gross_salary),
    formatPrice(item.pio_employee),
    formatPrice(item.health_employee),
    formatPrice(item.unemployment),
    formatPrice(item.income_tax),
    formatPrice(item.pio_employer),
    formatPrice(item.health_employer),
  ]);

  // Totals row
  const totalRow = [
    "", "", "УКУПНО:", "", "", "", "",  "",
    "",
    "",
    formatPrice(options.items.reduce((s, i) => s + i.total_amount, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.gross_salary, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.pio_employee, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.health_employee, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.unemployment, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.income_tax, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.pio_employer, 0)),
    formatPrice(options.items.reduce((s, i) => s + i.health_employer, 0)),
  ];
  tableData.push(totalRow);

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableData,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 1, font: "DejaVuSans" },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontSize: 6, halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 12 },
      2: { cellWidth: 30 },
      3: { cellWidth: 22 },
      4: { cellWidth: 16 },
      5: { cellWidth: 16 },
      6: { halign: "center", cellWidth: 12 },
      7: { halign: "center", cellWidth: 12 },
      8: { halign: "right", cellWidth: 18 },
      9: { halign: "right", cellWidth: 16 },
      10: { halign: "right", cellWidth: 18 },
      11: { halign: "right", cellWidth: 18 },
      12: { halign: "right", cellWidth: 16 },
      13: { halign: "right", cellWidth: 16 },
      14: { halign: "right", cellWidth: 14 },
      15: { halign: "right", cellWidth: 16 },
      16: { halign: "right", cellWidth: 16 },
      17: { halign: "right", cellWidth: 16 },
    },
    margin: { left: margin, right: margin },
  });

  // Footer signatures
  const finalY = (doc as any).lastAutoTable?.finalY || 170;
  const sigY = finalY + 15;
  doc.setFontSize(8);
  doc.text("М.П.", margin + 20, sigY);
  doc.text("Одговорно лице послодавца", margin + 60, sigY);
  doc.text("_______________________________", margin + 55, sigY + 5);
  doc.text("Датум подношења: _______________", pageWidth - 80, sigY);

  return doc;
}
