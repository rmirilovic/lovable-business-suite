import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, RefreshCw, Plus, Trash2, FileCode, FileDown, FileSpreadsheet, Printer, CheckCircle, Undo2, History, Pencil, Eye } from "lucide-react";
import { PartnerCardButton } from "@/components/shared/PartnerCardDialog";
import { AdvanceInvoice, AdvanceInvoiceItem, useAdvanceInvoiceItems, useAdvanceInvoices } from "@/hooks/useAdvanceInvoices";
import { AdvanceInvoiceHeaderDialog } from "@/components/prodaja/AdvanceInvoiceHeaderDialog";
import { formatDate, formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { generateInvoiceXml, downloadInvoiceXml } from "@/lib/invoiceXmlGenerator";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { generateInvoicePdf, printInvoicePdf } from "@/lib/invoicePdfGenerator";
import { exportInvoiceToExcel } from "@/lib/invoiceExcelExport";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižen", variant: "default" },
  cancelled: { label: "Storniran", variant: "destructive" },
};

export default function AdvanceInvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompany, selectedYear, user } = useAuth();
  const { hasAccess } = usePermissions();

  const prefetched = (location.state as any)?.prefetched as AdvanceInvoice | undefined;
  const hasMatch = !!prefetched && prefetched.id === id;

  const [doc, setDoc] = useState<AdvanceInvoice | null>(hasMatch ? prefetched : null);
  const [isLoading, setIsLoading] = useState(!hasMatch);
   const [postDialogOpen, setPostDialogOpen] = useState(false);
   const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
   const [historyOpen, setHistoryOpen] = useState(false);
   const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
   const { updateTotals, updateAdvanceInvoice } = useAdvanceInvoices();
  const { items, addItem, updateItem, deleteItem } = useAdvanceInvoiceItems(id || null);
   const { bankAccounts } = useBankAccounts(selectedCompany?.id);
   const { units } = useOrganizationalUnits(selectedCompany?.id);

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

  const handlePost = async () => {
    if (!doc || !user?.id) return;
    try {
      const { error } = await supabase.rpc("post_advance_invoice", {
        _invoice_id: doc.id,
        _user_id: user.id,
      });
      if (error) throw error;
      toast.success("Faktura za avans je proknjižena i kreiran je nalog za knjiženje");
      setPostDialogOpen(false);
      fetchDoc();
    } catch (err: any) {
      toast.error(`Greška pri knjiženju: ${err.message}`);
    }
  };

  const handleUnpost = async () => {
    if (!doc) return;
    try {
      const { error } = await supabase.rpc("unpost_advance_invoice", {
        _invoice_id: doc.id,
      });
      if (error) throw error;
      toast.success("Knjiženje je poništeno, dokument je vraćen u nacrt");
      setUnpostDialogOpen(false);
      fetchDoc();
    } catch (err: any) {
      toast.error(`Greška pri poništavanju: ${err.message}`);
    }
  };

  const fetchDataForExport = async () => {
    if (!doc || !selectedCompany) return null;
    const [itemsRes, companyRes] = await Promise.all([
      supabase.from("advance_invoice_items").select("*").eq("advance_invoice_id", doc.id).order("item_order"),
      supabase.from("companies").select("*").eq("id", selectedCompany.id).single(),
    ]);
    if (itemsRes.error || !itemsRes.data) { toast.error("Greška pri učitavanju stavki"); return null; }
    if (companyRes.error) { toast.error("Greška pri učitavanju firme"); return null; }
    const co = companyRes.data;
    const defaultBank = bankAccounts.find((b) => b.is_default && b.is_active) || bankAccounts.find((b) => b.is_active);
    // Map to invoice-like for shared generators
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
    return {
      invoiceLike,
      itemsLike,
      company: {
        name: co.name, address: co.address, city: co.city, postal_code: co.postal_code,
        pib: co.pib, mb: co.mb, phone: co.phone, email: co.email,
        invoice_note_1: co.invoice_note_1, invoice_note_2: co.invoice_note_2,
        logo_url: co.logo_url, logo_text: co.logo_text, responsible_person_name: co.responsible_person_name,
      },
      partner: {
        name: doc.partner?.name || doc.partner_name || "", code: doc.partner?.code || "",
        address: doc.partner?.address, city: doc.partner?.city,
        postal_code: doc.partner?.postal_code, pib: doc.partner?.pib, mb: doc.partner?.mb,
      },
      bankAccountText: defaultBank ? `${defaultBank.account_number} (${defaultBank.bank_name})` : null,
      bankAccount: defaultBank ? { account_number: defaultBank.account_number, bank_name: defaultBank.bank_name } : null,
    };
  };

  const handleExportXml = async () => {
    const data = await fetchDataForExport();
    if (!data) return;
    const xml = generateInvoiceXml({
      invoice: data.invoiceLike,
      items: data.itemsLike,
      company: { name: data.company.name, pib: data.company.pib, mb: data.company.mb, address: data.company.address, city: data.company.city, postal_code: data.company.postal_code, municipality: null, municipality_code: null, email: data.company.email, phone: data.company.phone, responsible_person_name: data.company.responsible_person_name },
      bankAccount: data.bankAccount,
    });
    downloadInvoiceXml(xml, doc!.advance_number, "386");
    toast.success("eFaktura XML exportovan");
  };

  const handleExportPdf = async () => {
    const data = await fetchDataForExport();
    if (!data || !doc) return;
    await generateInvoicePdf(data.invoiceLike, data.itemsLike, data.company, data.partner, data.bankAccountText, null);
    toast.success("PDF je uspešno exportovan");
  };

  const handlePrint = async () => {
    const data = await fetchDataForExport();
    if (!data || !doc) return;
    await printInvoicePdf(data.invoiceLike, data.itemsLike, data.company, data.partner, data.bankAccountText, null);
  };

  const handleExportExcel = async () => {
    if (!doc) return;
    const { data: itemsData, error } = await supabase
      .from("advance_invoice_items").select("*").eq("advance_invoice_id", doc.id).order("item_order");
    if (error || !itemsData) { toast.error("Greška pri učitavanju stavki"); return; }
    const itemsLike = itemsData.map((i: any) => ({
      ...i, item_name: i.description, item_code: null, discount_percent: 0,
    }));
    const invoiceLike: any = { ...doc, invoice_number: doc.advance_number, invoice_date: doc.advance_date };
    exportInvoiceToExcel(invoiceLike, itemsLike);
    toast.success("Excel je uspešno exportovan");
  };

  if (isLoading || !selectedCompany || !selectedYear) {
    return <MainLayout title="Učitavanje..."><div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></MainLayout>;
  }

  if (!doc) {
     return <MainLayout title="Dokument nije pronađen"><div className="text-center py-12"><p className="text-muted-foreground mb-4">Dokument nije pronađen.</p><Button onClick={() => navigate("/prodaja/avansni-racuni")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button></div></MainLayout>;
  }

  const isDraft = doc.status === "draft";
  const isPosted = doc.status === "posted";
  const status = STATUS_BADGES[doc.status] || STATUS_BADGES.draft;
  const subtotal = items.reduce((s, i) => s + i.line_subtotal, 0);
  const vatAmount = items.reduce((s, i) => s + i.line_vat, 0);
  const totalAmount = items.reduce((s, i) => s + i.line_total, 0);
  const canUnpost = hasAccess("prodaja.fakture", "admin");

  return (
    <MainLayout title={`Faktura za avans: ${doc.advance_number}`}>
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={() => navigate("/prodaja/avansni-racuni")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button>
             <h1 className="text-xl font-semibold">{doc.advance_number}</h1>
             <Badge variant={status.variant}>{status.label}</Badge>
           </div>
           <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena"><History className="w-4 h-4" /></Button>
             <Button variant="ghost" size="sm" onClick={() => fetchDoc()} title="Osveži"><RefreshCw className="w-4 h-4" /></Button>
             <Button variant="outline" size="sm" onClick={handleExportPdf} title="PDF"><FileDown className="w-4 h-4 mr-2" />PDF</Button>
             <Button variant="outline" size="sm" onClick={handleExportExcel} title="Excel"><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
             <Button variant="outline" size="sm" onClick={handlePrint} title="Štampa"><Printer className="w-4 h-4 mr-2" />Štampa</Button>
             <Button variant="outline" size="sm" onClick={handleExportXml} title="eFaktura XML"><FileCode className="w-4 h-4 mr-2" />eFaktura XML</Button>
             {isDraft && (
               <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                 <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
               </Button>
             )}
             {isDraft && (
               <Button size="sm" onClick={() => setPostDialogOpen(true)}>
                 <CheckCircle className="h-4 w-4 mr-2" />Proknjiži
               </Button>
             )}
             {isPosted && canUnpost && (
               <Button variant="destructive" size="sm" className="border" onClick={() => setUnpostDialogOpen(true)}>
                 <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
               </Button>
             )}
           </div>
         </div>

         {/* Header info */}
         <div className="space-y-4 bg-muted/30 p-4 rounded-lg text-sm">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-muted-foreground">Datum fakture</div><div className="font-medium">{formatDate(doc.advance_date)}</div></div>
            <div><div className="text-muted-foreground">Datum valute</div><div className="font-medium">{doc.due_date ? formatDate(doc.due_date) : "-"}</div></div>
            <div><div className="text-muted-foreground">Org. jedinica</div><div className="font-medium">{doc.org_unit_id ? units.find((u) => u.id === doc.org_unit_id)?.name || "-" : "-"}</div></div>
            <div><div className="text-muted-foreground">Fakturu sastavio</div><div className="font-medium">{doc.composed_by || "-"}</div></div>
           </div>

           {/* Partner info */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <div className="text-muted-foreground">Kupac</div>
              <div className="font-medium">
                {doc.partner?.code && <span className="text-muted-foreground mr-1">[{doc.partner.code}]</span>}
                {doc.partner_name ?? doc.partner?.name}
              </div>
              {(doc.partner_address ?? doc.partner?.address) && (
                <div className="text-xs text-muted-foreground">
                  {doc.partner_address ?? doc.partner?.address}
                  {(doc.partner_city ?? doc.partner?.city) && `, ${doc.partner_postal_code ?? doc.partner?.postal_code ?? ""} ${doc.partner_city ?? doc.partner?.city}`}
                </div>
               )}
               {doc.partner_id && (
                 <div className="mt-1">
                   <PartnerCardButton partnerId={doc.partner_id} partnerName={doc.partner?.name || doc.partner_name || "Kupac"} />
                 </div>
               )}
             </div>
            <div><div className="text-muted-foreground">PIB</div><div className="font-medium">{doc.partner_pib ?? doc.partner?.pib ?? "-"}</div></div>
            <div><div className="text-muted-foreground">Matični broj</div><div className="font-medium">{doc.partner_mb ?? doc.partner?.mb ?? "-"}</div></div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-muted-foreground">Tekući račun</div><div className="font-medium">{doc.bank_account_id ? (() => { const ba = bankAccounts.find((b) => b.id === doc.bank_account_id); return ba ? `${ba.account_number} (${ba.bank_name})` : "-"; })() : "-"}</div></div>
            <div><div className="text-muted-foreground">Datum uplate</div><div className="font-medium">{doc.payment_date ? formatDate(doc.payment_date) : "-"}</div></div>
            <div><div className="text-muted-foreground">Poziv na broj</div><div className="font-medium">{doc.payment_reference || "-"}</div></div>
            <div><div className="text-muted-foreground">Ugovor/referenca</div><div className="font-medium">{doc.contract_reference || "-"}</div></div>
           </div>
         </div>

         {/* PDV category */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
           <div>
             <div className="text-muted-foreground">PDV kategorija</div>
             <div className="font-medium">
               {(doc as any).tax_category_code === "S" && "S - Standardna stopa"}
               {(doc as any).tax_category_code === "E" && "E - Oslobođeno PDV-a"}
               {(doc as any).tax_category_code === "O" && "O - Van sistema PDV-a"}
               {(doc as any).tax_category_code === "AE" && "AE - Obrnuti obračun"}
               {!(doc as any).tax_category_code && "S - Standardna stopa"}
             </div>
           </div>
           {(doc as any).tax_category_code && (doc as any).tax_category_code !== "S" && (doc as any).tax_exemption_reason && (
             <div className="col-span-2">
               <div className="text-muted-foreground">Osnov oslobođenja</div>
               <div className="font-medium">{(doc as any).tax_exemption_reason}</div>
             </div>
           )}
         </div>

         {/* Notes */}
         {(doc.note || doc.internal_note || doc.header_note) && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
             {doc.header_note && (
               <div><div className="text-muted-foreground mb-1">Napomena u zaglavlju</div><div className="bg-muted p-2 rounded-md">{doc.header_note}</div></div>
             )}
             {doc.note && (
               <div><div className="text-muted-foreground mb-1">Napomena za kupca</div><div className="bg-muted p-2 rounded-md">{doc.note}</div></div>
             )}
             {doc.internal_note && (
               <div><div className="text-muted-foreground mb-1">Interna napomena</div><div className="bg-muted p-2 rounded-md">{doc.internal_note}</div></div>
             )}
           </div>
         )}

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
                   <TableHead className="w-[80px]">PDV %</TableHead>
                   <TableHead className="text-right w-[120px]">Osnovica</TableHead>
                   <TableHead className="text-right w-[100px]">PDV</TableHead>
                   <TableHead className="w-[140px]">Iznos sa PDV</TableHead>
                   {isDraft && <TableHead className="w-10"></TableHead>}
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {items.length === 0 ? (
                   <TableRow><TableCell colSpan={isDraft ? 7 : 6} className="text-center py-8 text-muted-foreground">Nema stavki</TableCell></TableRow>
                 ) : items.map((item, idx) => (
                   <TableRow key={item.id}>
                     <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                     <TableCell>
                       {isDraft ? (
                         <Input value={item.description} className="h-8 text-sm" onChange={(e) => updateItem.mutate({ id: item.id, description: e.target.value, unit: item.unit, quantity: 1, unit_price: item.unit_price, vat_rate: item.vat_rate, line_total: item.line_total })} />
                       ) : item.description}
                     </TableCell>
                     <TableCell>
                       {isDraft ? (
                         <Select value={String(item.vat_rate)} onValueChange={(v) => updateItem.mutate({ id: item.id, description: item.description, unit: item.unit, quantity: 1, unit_price: item.unit_price, vat_rate: Number(v), line_total: item.line_total })}>
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
                     <TableCell>
                       {isDraft ? (
                         <LocaleNumberInput value={String(item.line_total)} onChange={(v) => updateItem.mutate({ id: item.id, description: item.description, unit: item.unit, quantity: 1, unit_price: item.unit_price, vat_rate: item.vat_rate, line_total: parseLocaleNumber(v) })} className="h-8 text-sm w-[120px] text-right" />
                       ) : formatPrice(item.line_total)}
                     </TableCell>
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

      {/* Post dialog */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
             <AlertDialogTitle>Proknjiženje fakture za avans</AlertDialogTitle>
             <AlertDialogDescription>
               Da li ste sigurni da želite da proknjižite fakturu za avans{" "}
               <strong>{doc.advance_number}</strong>?
              Proknjižen dokument se više ne može menjati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpost dialog */}
      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje fakture za avans{" "}
              <strong>{doc.advance_number}</strong>?
              Nalog za knjiženje će biti obrisan, a dokument vraćen u nacrt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Poništi knjiženje</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       {doc && (
         <DocumentHistoryDialog
           open={historyOpen}
           onOpenChange={setHistoryOpen}
           documentId={doc.id}
           documentName={doc.advance_number}
           documentType="advance_invoice"
         />
       )}

       {doc && (
         <AdvanceInvoiceHeaderDialog
           open={headerDialogOpen}
           onOpenChange={setHeaderDialogOpen}
           doc={doc}
           readOnly={!isDraft}
           isLoading={updateAdvanceInvoice.isPending}
           onSave={async (data) => {
             await updateAdvanceInvoice.mutateAsync({ id: doc.id, ...data });
             setHeaderDialogOpen(false);
             fetchDoc(false);
           }}
         />
       )}
    </MainLayout>
  );
}
