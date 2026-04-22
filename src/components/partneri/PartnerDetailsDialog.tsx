import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Partner,
  PartnerInsert,
  usePartners,
  usePartnerGroups,
  LEGAL_STATUS_LABELS,
  PAYMENT_PRIORITY_LABELS,
} from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import { PartnerBankAccountsTab } from "./PartnerBankAccountsTab";
import { PartnerContactsTab } from "./PartnerContactsTab";
import { Search, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PartnerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: Partner | null;
  mode: "create" | "edit";
  readOnly?: boolean;
}

const defaultFormData: Omit<PartnerInsert, "company_id"> = {
  code: "",
  name: "",
  legal_status: 1,
  address: "",
  postal_code: "",
  city: "",
  country: "Srbija",
  email: "",
  group_id: null,
  pib: "",
  mb: "",
  activity_code: "",
  jbkjs: "",
  website: "",
  responsible_person: "",
  phone: "",
  is_customer: true,
  is_supplier: false,
  is_in_pdv: true,
  assigned_to: "",
  note: "",
  other_data: "",
  is_active: true,
  payment_priority: 3,
};

export function PartnerDetailsDialog({
  open,
  onOpenChange,
  partner,
  mode,
  readOnly = false,
}: PartnerDetailsDialogProps) {
  const { selectedCompany } = useAuth();
  const { createPartner, updatePartner, isCreating, isUpdating } = usePartners();
  const { groups } = usePartnerGroups();
  
  const [formData, setFormData] = useState(defaultFormData);
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (mode === "edit" && partner) {
      setFormData({
        code: partner.code,
        name: partner.name,
        legal_status: partner.legal_status,
        address: partner.address || "",
        postal_code: partner.postal_code || "",
        city: partner.city || "",
        country: partner.country || "Srbija",
        email: partner.email || "",
        group_id: partner.group_id,
        pib: partner.pib || "",
        mb: partner.mb || "",
        activity_code: partner.activity_code || "",
        jbkjs: partner.jbkjs || "",
        website: partner.website || "",
        responsible_person: partner.responsible_person || "",
        phone: partner.phone || "",
        is_customer: partner.is_customer,
        is_supplier: partner.is_supplier,
        is_in_pdv: partner.is_in_pdv,
        assigned_to: partner.assigned_to || "",
        note: partner.note || "",
        other_data: partner.other_data || "",
        is_active: partner.is_active,
        payment_priority: partner.payment_priority,
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [mode, partner, open]);

  // Auto-set country based on legal status
  useEffect(() => {
    if ([1, 2, 3].includes(formData.legal_status)) {
      // Serbian legal statuses - set country to Serbia
      setFormData((prev) => ({ ...prev, country: "Srbija" }));
    } else if (formData.legal_status === 4) {
      // Ino partner - clear country (not from Serbia)
      setFormData((prev) => ({ ...prev, country: "" }));
    }
  }, [formData.legal_status]);

  const handleSubmit = async () => {
    if (!selectedCompany) return;
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Šifra i naziv su obavezni");
      return;
    }

    try {
      if (mode === "create") {
        await createPartner({
          ...formData,
          company_id: selectedCompany.id,
          group_id: formData.group_id || null,
        });
      } else if (partner) {
        await updatePartner({
          id: partner.id,
          updates: {
            ...formData,
            group_id: formData.group_id || null,
          },
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleAprLookup = async () => {
    const pibValue = formData.pib?.trim().replace(/\D/g, "");
    const mbValue = formData.mb?.trim().replace(/\D/g, "");
    
    let searchValue: string;
    let searchType: "pib" | "mb";
    
    if (pibValue && pibValue.length === 9) {
      searchValue = pibValue;
      searchType = "pib";
    } else if (mbValue && mbValue.length === 8) {
      searchValue = mbValue;
      searchType = "mb";
    } else {
      toast.error("Unesite validan PIB (9 cifara) ili Matični broj (8 cifara)");
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("apr-lookup", {
        body: { searchValue, searchType },
      });

      if (error) {
        console.error("NBS lookup error:", error);
        toast.error("Greška pri povezivanju sa NBS servisom. Unesite podatke ručno.");
        return;
      }

      // Even if not fully successful, try to use any partial data returned
      const apiData = data?.data;
      
      if (data?.success && apiData) {
        // Count how many fields were populated
        const populatedFields: string[] = [];
        const missingFields: string[] = [];
        
        const checkField = (value: string | undefined, fieldName: string) => {
          if (value && value.trim()) {
            populatedFields.push(fieldName);
            return true;
          }
          missingFields.push(fieldName);
          return false;
        };
        
        checkField(apiData.name, "Naziv");
        checkField(apiData.address, "Adresa");
        checkField(apiData.city, "Mesto");
        checkField(apiData.postalCode, "Poštanski broj");
        checkField(apiData.activityCode, "Šifra delatnosti");
        
        // Update form with whatever data we got
        setFormData((prev) => ({
          ...prev,
          name: apiData.name || prev.name,
          pib: apiData.pib || prev.pib,
          mb: apiData.mb || prev.mb,
          address: apiData.address || prev.address,
          city: apiData.city || prev.city,
          postal_code: apiData.postalCode || prev.postal_code,
          activity_code: apiData.activityCode || prev.activity_code,
        }));

        if (missingFields.length === 0) {
          // All fields populated
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Podaci uspešno preuzeti iz NBS registra</span>
            </div>
          );
        } else if (populatedFields.length > 0) {
          // Partial data - show info toast
          toast.info(
            <div className="space-y-1">
              <div className="font-medium">Delimični podaci preuzeti</div>
              <div className="text-sm text-muted-foreground">
                Popunjeno: {populatedFields.join(", ")}
              </div>
              <div className="text-sm text-muted-foreground">
                Dopunite ručno: {missingFields.join(", ")}
              </div>
            </div>,
            { duration: 6000 }
          );
        } else {
          // No useful data found
          toast.warning("NBS registar nije vratio podatke. Unesite podatke ručno.");
        }
      } else {
        // API returned error - show message and let user enter manually
        toast.warning(
          <div className="space-y-1">
            <div className="font-medium">Pretraga nije uspela</div>
            <div className="text-sm text-muted-foreground">
              {data?.error || "Subjekt nije pronađen"}. Unesite podatke ručno.
            </div>
          </div>,
          { duration: 5000 }
        );
      }
    } catch (error) {
      console.error("NBS lookup error:", error);
      toast.warning("NBS servis nije dostupan. Unesite podatke ručno.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] sm:w-full max-h-[95vh] sm:max-h-[90vh] p-4 sm:p-6 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg pr-8 break-words">
            {mode === "create"
              ? "Novi partner"
              : readOnly
                ? `Pregled partnera: ${partner?.name}`
                : `Izmena partnera: ${partner?.name}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="osnovni" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="osnovni" className="text-xs sm:text-sm py-2">Osnovni podaci</TabsTrigger>
            <TabsTrigger value="dodatni" className="text-xs sm:text-sm py-2">Dodatni podaci</TabsTrigger>
            <TabsTrigger value="racuni" disabled={mode === "create"} className="text-xs sm:text-sm py-2">
              Tekući računi
            </TabsTrigger>
            <TabsTrigger value="kontakti" disabled={mode === "create"} className="text-xs sm:text-sm py-2">
              Kontakti
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="osnovni" className="mt-4 h-full min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col">
              <ScrollArea className="h-full min-h-0 pr-2 sm:pr-4">
                <div className="space-y-4 pb-4">
              {/* Code and Name */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="code">Šifra *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => updateField("code", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="name">Naziv *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Legal status and Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label>Pravni status</Label>
                  <Select
                    value={String(formData.legal_status)}
                    onValueChange={(val) => updateField("legal_status", Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEGAL_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grupa</Label>
                  <Select
                    value={formData.group_id || "none"}
                    onValueChange={(val) =>
                      updateField("group_id", val === "none" ? null : val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bez grupe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Bez grupe</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.code} - {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:items-end sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_customer"
                      checked={formData.is_customer}
                      onCheckedChange={(checked) =>
                        updateField("is_customer", checked === true)
                      }
                    />
                    <Label htmlFor="is_customer">Kupac</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_supplier"
                      checked={formData.is_supplier}
                      onCheckedChange={(checked) =>
                        updateField("is_supplier", checked === true)
                      }
                    />
                    <Label htmlFor="is_supplier">Dobavljač</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_in_pdv"
                      checked={formData.is_in_pdv}
                      onCheckedChange={(checked) =>
                        updateField("is_in_pdv", checked === true)
                      }
                    />
                    <Label htmlFor="is_in_pdv">U sistemu PDV-a</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        updateField("is_active", checked === true)
                      }
                    />
                    <Label htmlFor="is_active">Aktivan</Label>
                  </div>
                </div>
              </div>

              {/* Payment Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <Label>Prioritet plaćanja</Label>
                  <Select
                    value={formData.payment_priority ? String(formData.payment_priority) : "none"}
                    onValueChange={(val) =>
                      updateField("payment_priority", val === "none" ? null : Number(val))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nije definisan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nije definisan</SelectItem>
                      {Object.entries(PAYMENT_PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* PIB, MB, Activity code, JBKJS with APR lookup */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="pib">PIB</Label>
                  <Input
                    id="pib"
                    value={formData.pib}
                    onChange={(e) => updateField("pib", e.target.value)}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label htmlFor="mb">Matični broj</Label>
                  <Input
                    id="mb"
                    value={formData.mb}
                    onChange={(e) => updateField("mb", e.target.value)}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label htmlFor="activity_code">Šifra delatnosti</Label>
                  <Input
                    id="activity_code"
                    value={formData.activity_code}
                    onChange={(e) => updateField("activity_code", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="jbkjs">JBKJS</Label>
                  <Input
                    id="jbkjs"
                    value={formData.jbkjs}
                    onChange={(e) => updateField("jbkjs", e.target.value.slice(0, 31))}
                    maxLength={31}
                    autoComplete="off"
                  />
                </div>
                <div className="col-span-2 lg:col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAprLookup}
                    disabled={isLookingUp}
                    className="w-full"
                  >
                    {isLookingUp ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    NBS pretraga
                  </Button>
                </div>
              </div>

              {/* Address */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="col-span-2">
                  <Label htmlFor="address">Adresa</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">PB</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                      updateField("postal_code", val);
                    }}
                    maxLength={10}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Mesto</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="country">Država</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    disabled={[1, 2, 3].includes(formData.legal_status)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    autoComplete="off"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    autoComplete="off"
                    inputMode="email"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Web adresa</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="www.example.com"
                    autoComplete="off"
                    inputMode="url"
                  />
                </div>
              </div>

              {/* Responsible person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="responsible_person">Odgovorno lice</Label>
                  <Input
                    id="responsible_person"
                    value={formData.responsible_person}
                    onChange={(e) => updateField("responsible_person", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="assigned_to">Zadužen</Label>
                  <Input
                    id="assigned_to"
                    value={formData.assigned_to}
                    onChange={(e) =>
                      updateField("assigned_to", e.target.value.slice(0, 63))
                    }
                    maxLength={63}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Active status */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    updateField("is_active", checked === true)
                  }
                />
                <Label htmlFor="is_active">Aktivan</Label>
              </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dodatni" className="mt-4 h-full min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col">
              <ScrollArea className="h-full min-h-0 pr-2 sm:pr-4">
                <div className="space-y-4 pb-4">
              <div>
                <Label htmlFor="note">Napomena</Label>
                <Input
                  id="note"
                  value={formData.note}
                  onChange={(e) => updateField("note", e.target.value.slice(0, 63))}
                  maxLength={63}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.note?.length || 0}/63 karaktera
                </p>
              </div>

              <div>
                <Label htmlFor="other_data">Ostali podaci</Label>
                <Textarea
                  id="other_data"
                  value={formData.other_data}
                  onChange={(e) =>
                    updateField("other_data", e.target.value.slice(0, 511))
                  }
                  maxLength={511}
                  rows={5}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.other_data?.length || 0}/511 karaktera
                </p>
              </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="racuni" className="mt-4 h-full min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="h-full min-h-0 overflow-y-auto pr-2 sm:pr-4">
                {partner && <PartnerBankAccountsTab partnerId={partner.id} />}
              </div>
            </TabsContent>

            <TabsContent value="kontakti" className="mt-4 h-full min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="h-full min-h-0 overflow-y-auto pr-2 sm:pr-4">
                {partner && <PartnerContactsTab partnerId={partner.id} />}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {readOnly ? "Zatvori" : "Odustani"}
          </Button>
          {!readOnly && (
            <Button onClick={handleSubmit} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "create" ? "Kreiraj" : "Sačuvaj"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
