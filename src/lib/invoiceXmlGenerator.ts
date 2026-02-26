/**
 * Serbian eFaktura UBL 2.1 XML Generator
 * Generates XML conforming to the Serbian Electronic Invoice (SEF) standard.
 */

import { Invoice, InvoiceItem } from "@/hooks/useInvoices";

interface CompanyData {
  name: string;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  municipality: string | null;
  municipality_code: string | null;
  email: string | null;
  phone: string | null;
  responsible_person_name: string | null;
}

interface BankAccountData {
  account_number: string;
  bank_name: string;
}

interface InvoiceXmlData {
  invoice: Invoice;
  items: InvoiceItem[];
  company: CompanyData;
  bankAccount: BankAccountData | null;
}

// UBL invoice type code descriptions
const INVOICE_TYPE_NAMES: Record<string, string> = {
  "380": "Faktura",
  "381": "Knjižno odobrenje",
  "386": "Avansni račun",
};

// Tax category descriptions
const TAX_CATEGORY_NAMES: Record<string, string> = {
  S: "Standardna stopa",
  E: "Oslobođeno PDV-a",
  O: "Van sistema PDV-a",
  AE: "Obrnuto obračunavanje",
};

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function formatDate(dateStr: string): string {
  // Ensure YYYY-MM-DD format
  return dateStr.substring(0, 10);
}

/**
 * Groups invoice items by tax category and rate for TaxTotal section
 */
function groupTaxes(items: InvoiceItem[]): Array<{
  taxCategoryCode: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  exemptionReason: string | null;
}> {
  const map = new Map<string, {
    taxCategoryCode: string;
    taxRate: number;
    taxableAmount: number;
    taxAmount: number;
    exemptionReason: string | null;
  }>();

  for (const item of items) {
    const catCode = (item as any).tax_category_code || "S";
    const key = `${catCode}-${item.vat_rate}`;
    const existing = map.get(key);
    if (existing) {
      existing.taxableAmount += item.line_subtotal;
      existing.taxAmount += item.line_vat;
    } else {
      map.set(key, {
        taxCategoryCode: catCode,
        taxRate: item.vat_rate,
        taxableAmount: item.line_subtotal,
        taxAmount: item.line_vat,
        exemptionReason: (item as any).tax_exemption_reason || null,
      });
    }
  }

  return Array.from(map.values());
}

export function generateInvoiceXml(data: InvoiceXmlData): string {
  const { invoice, items, company, bankAccount } = data;
  const currency = (invoice as any).currency || "RSD";
  const invoiceTypeCode = (invoice as any).invoice_type_code || "380";
  const paymentMeansCode = (invoice as any).payment_means_code || "30";
  const partnerCountryCode = (invoice as any).partner_country_code || "RS";
  const partnerJbkjs = (invoice as any).partner_jbkjs || null;

  const taxGroups = groupTaxes(items);

  const lines: string[] = [];

  // XML declaration and root element
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"`);
  lines.push(`  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`);
  lines.push(`  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"`);
  lines.push(`  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`);

  // Customization and profile
  lines.push(`  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:minfin.gov.rs:srbdt:2021</cbc:CustomizationID>`);
  lines.push(`  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>`);
  lines.push(`  <cbc:IssueDate>${formatDate(invoice.invoice_date)}</cbc:IssueDate>`);
  
  if (invoice.due_date) {
    lines.push(`  <cbc:DueDate>${formatDate(invoice.due_date)}</cbc:DueDate>`);
  }

  lines.push(`  <cbc:InvoiceTypeCode>${escapeXml(invoiceTypeCode)}</cbc:InvoiceTypeCode>`);

  // Notes
  if (invoice.note) {
    lines.push(`  <cbc:Note>${escapeXml(invoice.note)}</cbc:Note>`);
  }

  lines.push(`  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>`);

  // Invoice period (using invoice date)
  lines.push(`  <cac:InvoicePeriod>`);
  lines.push(`    <cbc:StartDate>${formatDate(invoice.invoice_date)}</cbc:StartDate>`);
  lines.push(`    <cbc:EndDate>${formatDate(invoice.invoice_date)}</cbc:EndDate>`);
  lines.push(`  </cac:InvoicePeriod>`);

  // Supplier (AccountingSupplierParty)
  lines.push(`  <cac:AccountingSupplierParty>`);
  lines.push(`    <cac:Party>`);
  if (company.mb) {
    lines.push(`      <cbc:EndpointID schemeID="0088">${escapeXml(company.pib)}</cbc:EndpointID>`);
  }
  lines.push(`      <cac:PartyName>`);
  lines.push(`        <cbc:Name>${escapeXml(company.name)}</cbc:Name>`);
  lines.push(`      </cac:PartyName>`);
  lines.push(`      <cac:PostalAddress>`);
  if (company.address) {
    lines.push(`        <cbc:StreetName>${escapeXml(company.address)}</cbc:StreetName>`);
  }
  if (company.city) {
    lines.push(`        <cbc:CityName>${escapeXml(company.city)}</cbc:CityName>`);
  }
  if (company.postal_code) {
    lines.push(`        <cbc:PostalZone>${escapeXml(company.postal_code)}</cbc:PostalZone>`);
  }
  lines.push(`        <cac:Country>`);
  lines.push(`          <cbc:IdentificationCode>RS</cbc:IdentificationCode>`);
  lines.push(`        </cac:Country>`);
  lines.push(`      </cac:PostalAddress>`);
  if (company.pib) {
    lines.push(`      <cac:PartyTaxScheme>`);
    lines.push(`        <cbc:CompanyID>RS${escapeXml(company.pib)}</cbc:CompanyID>`);
    lines.push(`        <cac:TaxScheme>`);
    lines.push(`          <cbc:ID>VAT</cbc:ID>`);
    lines.push(`        </cac:TaxScheme>`);
    lines.push(`      </cac:PartyTaxScheme>`);
  }
  lines.push(`      <cac:PartyLegalEntity>`);
  lines.push(`        <cbc:RegistrationName>${escapeXml(company.name)}</cbc:RegistrationName>`);
  if (company.mb) {
    lines.push(`        <cbc:CompanyID>${escapeXml(company.mb)}</cbc:CompanyID>`);
  }
  lines.push(`      </cac:PartyLegalEntity>`);
  if (company.email || company.phone) {
    lines.push(`      <cac:Contact>`);
    if (company.email) {
      lines.push(`        <cbc:ElectronicMail>${escapeXml(company.email)}</cbc:ElectronicMail>`);
    }
    if (company.phone) {
      lines.push(`        <cbc:Telephone>${escapeXml(company.phone)}</cbc:Telephone>`);
    }
    lines.push(`      </cac:Contact>`);
  }
  lines.push(`    </cac:Party>`);
  lines.push(`  </cac:AccountingSupplierParty>`);

  // Buyer (AccountingCustomerParty)
  const buyerName = invoice.partner_name ?? invoice.partner?.name ?? "";
  const buyerAddress = invoice.partner_address ?? invoice.partner?.address ?? "";
  const buyerCity = invoice.partner_city ?? invoice.partner?.city ?? "";
  const buyerPostalCode = invoice.partner_postal_code ?? invoice.partner?.postal_code ?? "";
  const buyerPib = invoice.partner_pib ?? invoice.partner?.pib ?? "";
  const buyerMb = invoice.partner_mb ?? invoice.partner?.mb ?? "";

  lines.push(`  <cac:AccountingCustomerParty>`);
  lines.push(`    <cac:Party>`);
  if (buyerPib) {
    lines.push(`      <cbc:EndpointID schemeID="0088">${escapeXml(buyerPib)}</cbc:EndpointID>`);
  }
  lines.push(`      <cac:PartyName>`);
  lines.push(`        <cbc:Name>${escapeXml(buyerName)}</cbc:Name>`);
  lines.push(`      </cac:PartyName>`);
  lines.push(`      <cac:PostalAddress>`);
  if (buyerAddress) {
    lines.push(`        <cbc:StreetName>${escapeXml(buyerAddress)}</cbc:StreetName>`);
  }
  if (buyerCity) {
    lines.push(`        <cbc:CityName>${escapeXml(buyerCity)}</cbc:CityName>`);
  }
  if (buyerPostalCode) {
    lines.push(`        <cbc:PostalZone>${escapeXml(buyerPostalCode)}</cbc:PostalZone>`);
  }
  lines.push(`        <cac:Country>`);
  lines.push(`          <cbc:IdentificationCode>${escapeXml(partnerCountryCode)}</cbc:IdentificationCode>`);
  lines.push(`        </cac:Country>`);
  lines.push(`      </cac:PostalAddress>`);
  if (buyerPib && partnerCountryCode === "RS") {
    lines.push(`      <cac:PartyTaxScheme>`);
    lines.push(`        <cbc:CompanyID>RS${escapeXml(buyerPib)}</cbc:CompanyID>`);
    lines.push(`        <cac:TaxScheme>`);
    lines.push(`          <cbc:ID>VAT</cbc:ID>`);
    lines.push(`        </cac:TaxScheme>`);
    lines.push(`      </cac:PartyTaxScheme>`);
  }
  lines.push(`      <cac:PartyLegalEntity>`);
  lines.push(`        <cbc:RegistrationName>${escapeXml(buyerName)}</cbc:RegistrationName>`);
  if (buyerMb) {
    lines.push(`        <cbc:CompanyID>${escapeXml(buyerMb)}</cbc:CompanyID>`);
  }
  lines.push(`      </cac:PartyLegalEntity>`);
  // JBKJS for B2G
  if (partnerJbkjs) {
    lines.push(`      <cac:PartyIdentification>`);
    lines.push(`        <cbc:ID schemeID="0002">${escapeXml(partnerJbkjs)}</cbc:ID>`);
    lines.push(`      </cac:PartyIdentification>`);
  }
  lines.push(`    </cac:Party>`);
  lines.push(`  </cac:AccountingCustomerParty>`);

  // Payment means
  lines.push(`  <cac:PaymentMeans>`);
  lines.push(`    <cbc:PaymentMeansCode>${escapeXml(paymentMeansCode)}</cbc:PaymentMeansCode>`);
  if (bankAccount) {
    lines.push(`    <cac:PayeeFinancialAccount>`);
    lines.push(`      <cbc:ID>${escapeXml(bankAccount.account_number)}</cbc:ID>`);
    lines.push(`      <cbc:Name>${escapeXml(bankAccount.bank_name)}</cbc:Name>`);
    lines.push(`    </cac:PayeeFinancialAccount>`);
  }
  lines.push(`  </cac:PaymentMeans>`);

  // Tax Total
  lines.push(`  <cac:TaxTotal>`);
  lines.push(`    <cbc:TaxAmount currencyID="${escapeXml(currency)}">${formatAmount(invoice.vat_amount)}</cbc:TaxAmount>`);
  for (const tg of taxGroups) {
    lines.push(`    <cac:TaxSubtotal>`);
    lines.push(`      <cbc:TaxableAmount currencyID="${escapeXml(currency)}">${formatAmount(tg.taxableAmount)}</cbc:TaxableAmount>`);
    lines.push(`      <cbc:TaxAmount currencyID="${escapeXml(currency)}">${formatAmount(tg.taxAmount)}</cbc:TaxAmount>`);
    lines.push(`      <cac:TaxCategory>`);
    lines.push(`        <cbc:ID>${escapeXml(tg.taxCategoryCode)}</cbc:ID>`);
    lines.push(`        <cbc:Percent>${formatAmount(tg.taxRate)}</cbc:Percent>`);
    if (tg.exemptionReason) {
      lines.push(`        <cbc:TaxExemptionReasonCode>${escapeXml(tg.exemptionReason)}</cbc:TaxExemptionReasonCode>`);
      lines.push(`        <cbc:TaxExemptionReason>${escapeXml(tg.exemptionReason)}</cbc:TaxExemptionReason>`);
    }
    lines.push(`        <cac:TaxScheme>`);
    lines.push(`          <cbc:ID>VAT</cbc:ID>`);
    lines.push(`        </cac:TaxScheme>`);
    lines.push(`      </cac:TaxCategory>`);
    lines.push(`    </cac:TaxSubtotal>`);
  }
  lines.push(`  </cac:TaxTotal>`);

  // Legal Monetary Total
  lines.push(`  <cac:LegalMonetaryTotal>`);
  lines.push(`    <cbc:LineExtensionAmount currencyID="${escapeXml(currency)}">${formatAmount(invoice.subtotal)}</cbc:LineExtensionAmount>`);
  lines.push(`    <cbc:TaxExclusiveAmount currencyID="${escapeXml(currency)}">${formatAmount(invoice.subtotal)}</cbc:TaxExclusiveAmount>`);
  lines.push(`    <cbc:TaxInclusiveAmount currencyID="${escapeXml(currency)}">${formatAmount(invoice.total_amount)}</cbc:TaxInclusiveAmount>`);
  lines.push(`    <cbc:PayableAmount currencyID="${escapeXml(currency)}">${formatAmount(invoice.total_amount)}</cbc:PayableAmount>`);
  lines.push(`  </cac:LegalMonetaryTotal>`);

  // Invoice Lines
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const catCode = (item as any).tax_category_code || "S";
    const exemptionReason = (item as any).tax_exemption_reason || null;

    lines.push(`  <cac:InvoiceLine>`);
    lines.push(`    <cbc:ID>${i + 1}</cbc:ID>`);
    lines.push(`    <cbc:InvoicedQuantity unitCode="${escapeXml(item.unit)}">${formatAmount(item.quantity)}</cbc:InvoicedQuantity>`);
    lines.push(`    <cbc:LineExtensionAmount currencyID="${escapeXml(currency)}">${formatAmount(item.line_subtotal)}</cbc:LineExtensionAmount>`);

    // Discount
    if (item.discount_percent > 0) {
      lines.push(`    <cac:AllowanceCharge>`);
      lines.push(`      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>`);
      lines.push(`      <cbc:MultiplierFactorNumeric>${formatAmount(item.discount_percent)}</cbc:MultiplierFactorNumeric>`);
      const discountAmount = item.quantity * item.unit_price * (item.discount_percent / 100);
      lines.push(`      <cbc:Amount currencyID="${escapeXml(currency)}">${formatAmount(discountAmount)}</cbc:Amount>`);
      lines.push(`      <cbc:BaseAmount currencyID="${escapeXml(currency)}">${formatAmount(item.quantity * item.unit_price)}</cbc:BaseAmount>`);
      lines.push(`    </cac:AllowanceCharge>`);
    }

    // Item tax
    lines.push(`    <cac:Item>`);
    if (item.description) {
      lines.push(`      <cbc:Description>${escapeXml(item.description)}</cbc:Description>`);
    }
    lines.push(`      <cbc:Name>${escapeXml(item.item_name)}</cbc:Name>`);
    if (item.item_code) {
      lines.push(`      <cac:SellersItemIdentification>`);
      lines.push(`        <cbc:ID>${escapeXml(item.item_code)}</cbc:ID>`);
      lines.push(`      </cac:SellersItemIdentification>`);
    }
    lines.push(`      <cac:ClassifiedTaxCategory>`);
    lines.push(`        <cbc:ID>${escapeXml(catCode)}</cbc:ID>`);
    lines.push(`        <cbc:Percent>${formatAmount(item.vat_rate)}</cbc:Percent>`);
    if (exemptionReason) {
      lines.push(`        <cbc:TaxExemptionReasonCode>${escapeXml(exemptionReason)}</cbc:TaxExemptionReasonCode>`);
    }
    lines.push(`        <cac:TaxScheme>`);
    lines.push(`          <cbc:ID>VAT</cbc:ID>`);
    lines.push(`        </cac:TaxScheme>`);
    lines.push(`      </cac:ClassifiedTaxCategory>`);
    lines.push(`    </cac:Item>`);

    // Price
    lines.push(`    <cac:Price>`);
    lines.push(`      <cbc:PriceAmount currencyID="${escapeXml(currency)}">${formatAmount(item.unit_price)}</cbc:PriceAmount>`);
    lines.push(`    </cac:Price>`);

    lines.push(`  </cac:InvoiceLine>`);
  }

  lines.push(`</Invoice>`);

  return lines.join("\n");
}

/**
 * Download the generated XML as a file
 */
export function downloadInvoiceXml(xml: string, invoiceNumber: string): void {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Clean invoice number for filename
  const cleanName = invoiceNumber.replace(/[/\\?%*:|"<>]/g, "-");
  a.download = `eFaktura-${cleanName}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
