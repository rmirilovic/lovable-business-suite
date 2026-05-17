import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { LEGAL_STATUS_LABELS, PAYMENT_PRIORITY_LABELS, type Partner, type PartnerGroup } from "@/hooks/usePartners";

export type PartnerColumnKey =
  | "code" | "name" | "legal_status" | "group" | "tip" | "is_in_pdv"
  | "pib" | "mb" | "activity_code" | "jbkjs"
  | "address" | "postal_code" | "city" | "country"
  | "phone" | "email" | "website"
  | "responsible_person" | "assigned_to"
  | "payment_priority" | "is_active";

export interface PartnerColumnDef {
  key: PartnerColumnKey;
  label: string;
  defaultVisible: boolean;
  /** Vrednost za prikaz/export */
  value: (p: Partner, groups: PartnerGroup[]) => string;
}

export const PARTNER_COLUMNS: PartnerColumnDef[] = [
  { key: "code", label: "Šifra", defaultVisible: true, value: (p) => p.code ?? "" },
  { key: "name", label: "Naziv", defaultVisible: true, value: (p) => p.name ?? "" },
  { key: "legal_status", label: "Pravni status", defaultVisible: true, value: (p) => LEGAL_STATUS_LABELS[p.legal_status] ?? "" },
  { key: "group", label: "Grupa", defaultVisible: true, value: (p, groups) => {
      const g = groups.find((x) => x.id === p.group_id);
      return g ? `${g.code} - ${g.name}` : "";
    } },
  { key: "tip", label: "Tip", defaultVisible: true, value: (p) => {
      const parts: string[] = [];
      if (p.is_customer) parts.push("Kupac");
      if (p.is_supplier) parts.push("Dobavljač");
      return parts.join(", ");
    } },
  { key: "is_in_pdv", label: "PDV", defaultVisible: true, value: (p) => p.is_in_pdv ? "Da" : "Ne" },
  { key: "pib", label: "PIB", defaultVisible: true, value: (p) => p.pib ?? "" },
  { key: "mb", label: "Matični broj", defaultVisible: false, value: (p) => p.mb ?? "" },
  { key: "activity_code", label: "Šifra delatnosti", defaultVisible: false, value: (p) => p.activity_code ?? "" },
  { key: "jbkjs", label: "JBKJS", defaultVisible: false, value: (p) => p.jbkjs ?? "" },
  { key: "address", label: "Adresa", defaultVisible: false, value: (p) => p.address ?? "" },
  { key: "postal_code", label: "Poštanski broj", defaultVisible: false, value: (p) => p.postal_code ?? "" },
  { key: "city", label: "Mesto", defaultVisible: true, value: (p) => p.city ?? "" },
  { key: "country", label: "Država", defaultVisible: false, value: (p) => p.country ?? "" },
  { key: "phone", label: "Telefon", defaultVisible: true, value: (p) => p.phone ?? "" },
  { key: "email", label: "E-mail", defaultVisible: false, value: (p) => p.email ?? "" },
  { key: "website", label: "Web adresa", defaultVisible: false, value: (p) => p.website ?? "" },
  { key: "responsible_person", label: "Odgovorno lice", defaultVisible: false, value: (p) => p.responsible_person ?? "" },
  { key: "assigned_to", label: "Zadužen", defaultVisible: false, value: (p) => p.assigned_to ?? "" },
  { key: "payment_priority", label: "Prioritet plaćanja", defaultVisible: false, value: (p) => p.payment_priority ? (PAYMENT_PRIORITY_LABELS[p.payment_priority] ?? "") : "" },
  { key: "is_active", label: "Aktivan", defaultVisible: true, value: (p) => p.is_active ? "Da" : "Ne" },
];

export const DEFAULT_VISIBLE_PARTNER_COLUMNS: PartnerColumnKey[] =
  PARTNER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

// ── Excel: uvek SVI Osnovni podaci ──────────────────────────────────────────
export function exportPartneriToExcel(partners: Partner[], groups: PartnerGroup[]) {
  const data = partners.map((p) => {
    const row: Record<string, string> = {};
    for (const col of PARTNER_COLUMNS) {
      row[col.label] = col.value(p, groups);
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data, {
    header: PARTNER_COLUMNS.map((c) => c.label),
  });
  ws["!cols"] = PARTNER_COLUMNS.map((c) => ({
    wch: Math.max(c.label.length + 2, 14),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Partneri");
  XLSX.writeFile(wb, "Partneri.xlsx");
}

// ── PDF / Štampa: samo izabrane kolone ──────────────────────────────────────
async function buildPartneriPdf(
  partners: Partner[],
  groups: PartnerGroup[],
  visibleColumns: PartnerColumnKey[],
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Šifarnik partnera", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Ukupno partnera: ${partners.length}`, 14, y);
  y += 6;

  const cols = PARTNER_COLUMNS.filter((c) => visibleColumns.includes(c.key));
  const head = [cols.map((c) => c.label)];
  const body = partners.map((p) => cols.map((c) => c.value(p, groups)));

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
  });

  return doc;
}

export async function exportPartneriToPdf(
  partners: Partner[],
  groups: PartnerGroup[],
  visibleColumns: PartnerColumnKey[],
) {
  const doc = await buildPartneriPdf(partners, groups, visibleColumns);
  doc.save("Partneri.pdf");
}

export async function printPartneri(
  partners: Partner[],
  groups: PartnerGroup[],
  visibleColumns: PartnerColumnKey[],
) {
  const doc = await buildPartneriPdf(partners, groups, visibleColumns);
  printPdfBlob(doc.output("blob"));
}
