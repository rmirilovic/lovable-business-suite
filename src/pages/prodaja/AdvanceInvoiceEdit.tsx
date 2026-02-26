import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, RefreshCw, Plus, Trash2, FileCode } from "lucide-react";
import { AdvanceInvoice, AdvanceInvoiceItem, useAdvanceInvoiceItems, useAdvanceInvoices } from "@/hooks/useAdvanceInvoices";
import { formatDate, formatPrice } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { generateInvoiceXml, downloadInvoiceXml } from "@/lib/invoiceXmlGenerator";
import { useBankAccounts } from "@/hooks/useBankAccounts";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižen", variant: "default" },
  cancelled: { label: "Storniran", variant: "destructive" },
};

export default function AdvanceInvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompany, selectedYear } = useAuth();

  const prefetched = (location.state as any)?.prefetched as AdvanceInvoice | undefined;
  const hasMatch = !!prefetched && prefetched.id === id;

  const [doc, setDoc] = useState<AdvanceInvoice | null>(hasMatch ? prefetched : null);
  const [isLoading, setIsLoading] = useState(!hasMatch);
  const { updateTotals } = useAdvanceInvoices();
  const { items, addItem, updateItem, deleteItem } = useAdvanceInvoiceItems(id || null);
  const { bankAccounts } = useBankAccounts(selectedCompany?.id);

  const fetchDoc = async (showLoader = true) => {
    if (!id) return;
    if (showLoader) setIsLoading(true);
    const { data, error } = await supabase
      .from("advance_invoices")
      .select(`*, partner:partners(id, name, code, address, city, postal_code, pib, mb)`)
      .eq("id", id)
      .single();
    if (error) { toast.error("Greška pri učitavanju"); navigate("/prodaja/avansni-racuni"); return; }
    setDoc(data as AdvanceInvoice);
    setIsLoading(false);
  };

  useEffect(() => { fetchDoc(!hasMatch); }, [id]);

  // Recalculate totals when items change
  useEffect(() => {
    if (!id || !items.length) return;
    const subtotal = items.reduce((s, i) => s + i.line_subtotal, 0);
    const vat = items.reduce((s, i) => s + i.line_vat, 0);
    const total = items.reduce((s, i) => s + i.line_total, 0);
    updateTotals.mutate({ id, subtotal, vat_amount: vat, total_amount: total });
  }, [items]);

  const handleAddItem = async () => {
    if (!id) return;
    await addItem.mutateAsync({
      advance_invoice_id: id,
      description: "Avans po ugovoru",
      unit: "kom",
      quantity: 1,
      unit_price: 0,
      vat_rate: 20,
    });
  };

  const handleExportXml = async () => {
    if (!doc || !selectedCompany) return;
    const [itemsRes, companyRes] = await Promise.all([
      supabase.from("advance_invoice_items").select("*").eq("advance_invoice_id", doc.id).order("item_order"),
      supabase.from("companies").select("*").eq("id", selectedCompany.id).single(),
    ]);
    if (itemsRes.error || !itemsRes.data?.length) { toast.error("Nema stavki za export"); return; }
    if (companyRes.error) { toast.error("Greška pri učitavanju firme"); return; }
    const co = companyRes.data;
    const defaultBank = bankAccounts.find((b) => b.is_default && b.is_active) || bankAccounts.find((b) => b.is_active);
    // Map advance invoice to invoice-like object for XML generator
    const invoiceLike: any = {
      ...doc,
      invoice_number: doc.advance_number,
      invoice_date: doc.advance_date,
      invoice_type_code: "386",
    };
    const itemsLike = itemsRes.data.map((i: any) => ({
      ...i,
      item_name: i.description,
      item_code: null,
      discount_percent: 0,
    }));
    const xml = generateInvoiceXml({
      invoice: invoiceLike,
      items: itemsLike,
      company: { name: co.name, pib: co.pib, mb: co.mb, address: co.address, city: co.city, postal_code: co.postal_code, municipality: co.municipality, municipality_code: co.municipality_code, email: co.email, phone: co.phone, responsible_person_name: co.responsible_person_name },
      bankAccount: defaultBank ? { account_number: defaultBank.account_number, bank_name: defaultBank.bank_name } : null,
    });
    downloadInvoiceXml(xml, doc.advance_number);
    toast.success("eFaktura XML exportovan");
  };

  if (isLoading || !selectedCompany || !selectedYear) {
    return <MainLayout title="Učitavanje..."><div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></MainLayout>;
  }

  if (!doc) {
    return <MainLayout title="Dokument nije pronađen"><div className="text-center py-12"><p className="text-muted-foreground mb-4">Dokument nije pronađen.</p><Button onClick={() => navigate("/prodaja/avansni-racuni")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button></div></MainLayout>;
  }

  const isDraft = doc.status === "draft";
  const status = STATUS_BADGES[doc.status] || STATUS_BADGES.draft;
  const subtotal = items.reduce((s, i) => s + i.line_subtotal, 0);
  const vatAmount = items.reduce((s, i) => s + i.line_vat, 0);
  const totalAmount = items.reduce((s, i) => s + i.line_total, 0);

  return (
    <MainLayout title={`Avansni račun: ${doc.advance_number}`}>
      <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/avansni-racuni")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button>
            <h1 className="text-xl font-semibold">{doc.advance_number}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => fetchDoc()} title="Osveži"><RefreshCw className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleExportXml} title="eFaktura XML"><FileCode className="w-4 h-4 mr-2" />eFaktura XML</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div><div className="text-muted-foreground">Datum</div><div className="font-medium">{formatDate(doc.advance_date)}</div></div>
          <div><div className="text-muted-foreground">Datum valute</div><div className="font-medium">{doc.due_date ? formatDate(doc.due_date) : "-"}</div></div>
          <div className="col-span-2"><div className="text-muted-foreground">Kupac</div><div className="font-medium">{doc.partner_name ?? doc.partner?.name}</div></div>
        </div>

        {doc.note && <div className="text-sm"><span className="text-muted-foreground">Napomena:</span> {doc.note}</div>}

        <Separator />

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Stavke</h2>
            {isDraft && <Button size="sm" variant="outline" onClick={handleAddItem}><Plus className="w-4 h-4 mr-2" />Dodaj stavku</Button>}
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[250px]">Opis</TableHead>
                  <TableHead className="w-[80px]">Kol.</TableHead>
                  <TableHead className="w-[120px]">Cena</TableHead>
                  <TableHead className="w-[80px]">PDV %</TableHead>
                  <TableHead className="text-right w-[120px]">Osnovica</TableHead>
                  <TableHead className="text-right w-[100px]">PDV</TableHead>
                  <TableHead className="text-right w-[120px]">Ukupno</TableHead>
                  {isDraft && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={isDraft ? 9 : 8} className="text-center py-8 text-muted-foreground">Nema stavki</TableCell></TableRow>
                ) : items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      {isDraft ? (
                        <Input value={item.description} className="h-8 text-sm" onChange={(e) => updateItem.mutate({ id: item.id, description: e.target.value, unit: item.unit, quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate })} />
                      ) : item.description}
                    </TableCell>
                    <TableCell>
                      {isDraft ? (
                        <LocaleNumberInput value={String(item.quantity)} onChange={(v) => updateItem.mutate({ id: item.id, description: item.description, unit: item.unit, quantity: Number(v), unit_price: item.unit_price, vat_rate: item.vat_rate })} className="h-8 text-sm w-[70px]" />
                      ) : item.quantity}
                    </TableCell>
                    <TableCell>
                      {isDraft ? (
                        <LocaleNumberInput value={String(item.unit_price)} onChange={(v) => updateItem.mutate({ id: item.id, description: item.description, unit: item.unit, quantity: item.quantity, unit_price: Number(v), vat_rate: item.vat_rate })} className="h-8 text-sm w-[100px]" />
                      ) : formatPrice(item.unit_price)}
                    </TableCell>
                    <TableCell>
                      {isDraft ? (
                        <Select value={String(item.vat_rate)} onValueChange={(v) => updateItem.mutate({ id: item.id, description: item.description, unit: item.unit, quantity: item.quantity, unit_price: item.unit_price, vat_rate: Number(v) })}>
                          <SelectTrigger className="h-8 text-sm w-[70px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="20">20%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="0">0%</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : `${item.vat_rate}%`}
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(item.line_subtotal)}</TableCell>
                    <TableCell className="text-right">{formatPrice(item.line_vat)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(item.line_total)}</TableCell>
                    {isDraft && (
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem.mutate(item.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Osnovica:</span><span className="font-medium">{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PDV:</span><span className="font-medium">{formatPrice(vatAmount)}</span></div>
            <Separator />
            <div className="flex justify-between text-base"><span className="font-medium">Ukupno:</span><span className="font-bold">{formatPrice(totalAmount)}</span></div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
