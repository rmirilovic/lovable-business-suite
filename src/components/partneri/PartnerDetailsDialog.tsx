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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Partner,
  PartnerInsert,
  usePartners,
  usePartnerGroups,
  LEGAL_STATUS_LABELS,
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
}

const defaultFormData: Omit<PartnerInsert, "company_id"> = {
  code: "",
  name: "",
  legal_status: 1,
  address: "",
  postal_code: "",
  city: "",
  country: "Republika Srbija",
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
  assigned_to: "",
  note: "",
  other_data: "",
  is_active: true,
};

export function PartnerDetailsDialog({
  open,
  onOpenChange,
  partner,
  mode,
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
        country: partner.country || "Republika Srbija",
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
        assigned_to: partner.assigned_to || "",
        note: partner.note || "",
        other_data: partner.other_data || "",
        is_active: partner.is_active,
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [mode, partner, open]);

  // Auto-set country for Serbian legal statuses
  useEffect(() => {
    if ([1, 2, 3].includes(formData.legal_status)) {
      setFormData((prev) => ({ ...prev, country: "Republika Srbija" }));
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
        console.error("APR lookup error:", error);
        toast.error("Greška pri povezivanju sa APR servisom");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Subjekt nije pronađen u APR registru");
        return;
      }

      const aprData = data.data;
      
      // Update form with APR data
      setFormData((prev) => ({
        ...prev,
        name: aprData.name || prev.name,
        pib: aprData.pib || prev.pib,
        mb: aprData.mb || prev.mb,
        address: aprData.address || prev.address,
        city: aprData.city || prev.city,
        postal_code: aprData.postalCode || prev.postal_code,
        activity_code: aprData.activityCode || prev.activity_code,
      }));

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span>Podaci uspešno preuzeti iz APR registra</span>
        </div>
      );
    } catch (error) {
      console.error("APR lookup error:", error);
      toast.error("Greška pri pretrazi APR registra");
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
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novi partner" : `Izmena partnera: ${partner?.name}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="osnovni" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="osnovni">Osnovni podaci</TabsTrigger>
            <TabsTrigger value="dodatni">Dodatni podaci</TabsTrigger>
            <TabsTrigger value="racuni" disabled={mode === "create"}>
              Tekući računi
            </TabsTrigger>
            <TabsTrigger value="kontakti" disabled={mode === "create"}>
              Kontakti
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] pr-4">
            <TabsContent value="osnovni" className="space-y-4 mt-4">
              {/* Code and Name */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="code">Šifra *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => updateField("code", e.target.value)}
                    disabled={mode === "edit"}
                  />
                </div>
                <div className="col-span-3">
                  <Label htmlFor="name">Naziv *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>
              </div>

              {/* Legal status and Type */}
              <div className="grid grid-cols-3 gap-4">
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
                <div className="flex items-end gap-4">
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
              </div>

              {/* PIB, MB, Activity code with APR lookup */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="pib">PIB</Label>
                  <Input
                    id="pib"
                    value={formData.pib}
                    onChange={(e) => updateField("pib", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="mb">Matični broj</Label>
                  <Input
                    id="mb"
                    value={formData.mb}
                    onChange={(e) => updateField("mb", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="activity_code">Šifra delatnosti</Label>
                  <Input
                    id="activity_code"
                    value={formData.activity_code}
                    onChange={(e) => updateField("activity_code", e.target.value)}
                  />
                </div>
                <div className="flex items-end">
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
                    APR pretraga
                  </Button>
                </div>
              </div>

              {/* JBKJS - only for legal_status 3 */}
              {formData.legal_status === 3 && (
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="jbkjs">JBKJS</Label>
                    <Input
                      id="jbkjs"
                      value={formData.jbkjs}
                      onChange={(e) => updateField("jbkjs", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="address">Adresa</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
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
                  />
                </div>
                <div>
                  <Label htmlFor="city">Mesto</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="country">Država</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    disabled={[1, 2, 3].includes(formData.legal_status)}
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Web adresa</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="www.example.com"
                  />
                </div>
              </div>

              {/* Responsible person */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="responsible_person">Odgovorno lice</Label>
                  <Input
                    id="responsible_person"
                    value={formData.responsible_person}
                    onChange={(e) => updateField("responsible_person", e.target.value)}
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
            </TabsContent>

            <TabsContent value="dodatni" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="note">Napomena</Label>
                <Input
                  id="note"
                  value={formData.note}
                  onChange={(e) => updateField("note", e.target.value.slice(0, 63))}
                  maxLength={63}
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
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.other_data?.length || 0}/511 karaktera
                </p>
              </div>
            </TabsContent>

            <TabsContent value="racuni" className="mt-4">
              {partner && <PartnerBankAccountsTab partnerId={partner.id} />}
            </TabsContent>

            <TabsContent value="kontakti" className="mt-4">
              {partner && <PartnerContactsTab partnerId={partner.id} />}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Odustani
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "create" ? "Kreiraj" : "Sačuvaj"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
