import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X } from "lucide-react";
import { Quote } from "@/hooks/useQuotes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface QuotePartnerEditorProps {
  quote: Quote;
  isEditable: boolean;
}

interface PartnerData {
  partner_name: string;
  partner_address: string;
  partner_city: string;
  partner_postal_code: string;
  partner_pib: string;
  partner_mb: string;
}

export function QuotePartnerEditor({ quote, isEditable }: QuotePartnerEditorProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<PartnerData>({
    partner_name: quote.partner_name || "",
    partner_address: quote.partner_address || "",
    partner_city: quote.partner_city || "",
    partner_postal_code: quote.partner_postal_code || "",
    partner_pib: quote.partner_pib || "",
    partner_mb: quote.partner_mb || "",
  });

  useEffect(() => {
    setFormData({
      partner_name: quote.partner_name || "",
      partner_address: quote.partner_address || "",
      partner_city: quote.partner_city || "",
      partner_postal_code: quote.partner_postal_code || "",
      partner_pib: quote.partner_pib || "",
      partner_mb: quote.partner_mb || "",
    });
  }, [quote]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          partner_name: formData.partner_name || null,
          partner_address: formData.partner_address || null,
          partner_city: formData.partner_city || null,
          partner_postal_code: formData.partner_postal_code || null,
          partner_pib: formData.partner_pib || null,
          partner_mb: formData.partner_mb || null,
        })
        .eq("id", quote.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Podaci kupca su ažurirani");
      setIsEditing(false);
    } catch (error: any) {
      toast.error(`Greška: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      partner_name: quote.partner_name || "",
      partner_address: quote.partner_address || "",
      partner_city: quote.partner_city || "",
      partner_postal_code: quote.partner_postal_code || "",
      partner_pib: quote.partner_pib || "",
      partner_mb: quote.partner_mb || "",
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Podaci kupca na ponudi</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
              <X className="w-4 h-4 mr-1" />
              Otkaži
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="partner_name" className="text-xs">Naziv</Label>
            <Input
              id="partner_name"
              value={formData.partner_name}
              onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
              className="h-8"
              autoComplete="off"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="partner_address" className="text-xs">Adresa</Label>
            <Input
              id="partner_address"
              value={formData.partner_address}
              onChange={(e) => setFormData({ ...formData, partner_address: e.target.value })}
              className="h-8"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="partner_postal_code" className="text-xs">Poštanski broj</Label>
            <Input
              id="partner_postal_code"
              value={formData.partner_postal_code}
              onChange={(e) => setFormData({ ...formData, partner_postal_code: e.target.value })}
              className="h-8"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="partner_city" className="text-xs">Mesto</Label>
            <Input
              id="partner_city"
              value={formData.partner_city}
              onChange={(e) => setFormData({ ...formData, partner_city: e.target.value })}
              className="h-8"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="partner_pib" className="text-xs">PIB</Label>
            <Input
              id="partner_pib"
              value={formData.partner_pib}
              onChange={(e) => setFormData({ ...formData, partner_pib: e.target.value })}
              className="h-8"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="partner_mb" className="text-xs">Matični broj</Label>
            <Input
              id="partner_mb"
              value={formData.partner_mb}
              onChange={(e) => setFormData({ ...formData, partner_mb: e.target.value })}
              className="h-8"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kupac</p>
        {isEditable && (
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
            <Pencil className="w-3 h-3 mr-1" />
            Izmeni
          </Button>
        )}
      </div>
      <p className="font-medium">
        {quote.partner?.code} - {quote.partner_name || quote.partner?.name}
      </p>
      {(quote.partner_address || quote.partner_city) && (
        <p className="text-sm text-muted-foreground">
          {quote.partner_address}
          {quote.partner_address && quote.partner_city && ", "}
          {quote.partner_postal_code && `${quote.partner_postal_code} `}
          {quote.partner_city}
        </p>
      )}
      {(quote.partner_pib || quote.partner_mb) && (
        <p className="text-sm text-muted-foreground">
          {quote.partner_pib && `PIB: ${quote.partner_pib}`}
          {quote.partner_pib && quote.partner_mb && " | "}
          {quote.partner_mb && `MB: ${quote.partner_mb}`}
        </p>
      )}
    </div>
  );
}
