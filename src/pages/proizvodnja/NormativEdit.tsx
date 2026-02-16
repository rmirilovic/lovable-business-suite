import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMaterialNorm,
  useMaterialNormVariants,
  MaterialNormVariant,
} from "@/hooks/useMaterialNorms";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { NormItemsEditor } from "@/components/proizvodnja/NormItemsEditor";

export default function NormativEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  const { data: norm, isLoading: normLoading } = useMaterialNorm(id);
  const { variants, isLoading: variantsLoading, invalidate: invalidateVariants } =
    useMaterialNormVariants(id);

  const [activeVariant, setActiveVariant] = useState<string>("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // Set first variant as active when loaded
  if (!activeVariant && variants.length > 0) {
    setActiveVariant(variants[0].id);
  }

  const handleAddVariant = async () => {
    if (!id || !companyId) return;
    const nextNum = variants.length > 0 ? Math.max(...variants.map((v) => v.variant_number)) + 1 : 1;
    const { data, error } = await supabase
      .from("material_norm_variants")
      .insert({
        norm_id: id,
        company_id: companyId,
        variant_number: nextNum,
        variant_name: `Varijanta ${nextNum}`,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Greška: " + error.message);
    } else {
      toast.success("Varijanta dodana");
      invalidateVariants();
      if (data) setActiveVariant(data.id);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (variants.length <= 1) {
      toast.error("Mora postojati barem jedna varijanta");
      return;
    }
    if (!confirm("Obrisati ovu varijantu?")) return;

    const { error } = await supabase.from("material_norm_variants").delete().eq("id", variantId);
    if (error) {
      toast.error("Greška: " + error.message);
    } else {
      toast.success("Varijanta obrisana");
      if (activeVariant === variantId) setActiveVariant("");
      invalidateVariants();
    }
  };

  const handleRenameVariant = async (variant: MaterialNormVariant) => {
    if (!newName.trim()) {
      setEditingName(null);
      return;
    }
    const { error } = await supabase
      .from("material_norm_variants")
      .update({ variant_name: newName.trim() })
      .eq("id", variant.id);

    if (error) toast.error("Greška: " + error.message);
    else invalidateVariants();
    setEditingName(null);
  };

  if (normLoading || variantsLoading) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="py-8 text-center text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }

  if (!norm) {
    return (
      <MainLayout title="Normativ nije pronađen">
        <div className="py-8 text-center text-muted-foreground">Normativ nije pronađen</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Normativ: ${norm.article_code} - ${norm.article_name}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/proizvodnja/normativi")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              Normativ: {norm.article_code} - {norm.article_name}
            </h1>
            <p className="text-sm text-muted-foreground">JM: {norm.article_unit}</p>
          </div>
        </div>

        {/* Variants tabs */}
        <div className="flex items-center gap-2">
          <Tabs
            value={activeVariant}
            onValueChange={setActiveVariant}
            className="flex-1"
          >
            <div className="flex items-center gap-2">
              <TabsList>
                {variants.map((v) => (
                  <TabsTrigger key={v.id} value={v.id} className="relative group">
                    {editingName === v.id ? (
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={() => handleRenameVariant(v)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameVariant(v);
                          if (e.key === "Escape") setEditingName(null);
                        }}
                        className="h-6 w-32 text-xs"
                        autoFocus
                        autoComplete="off"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => {
                          setEditingName(v.id);
                          setNewName(v.variant_name);
                        }}
                        title="Dupli klik za preimenovanje"
                      >
                        {v.variant_name}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button variant="outline" size="sm" onClick={handleAddVariant}>
                <Plus className="w-3 h-3 mr-1" />
                Varijanta
              </Button>
              {variants.length > 1 && activeVariant && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteVariant(activeVariant)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Obriši
                </Button>
              )}
            </div>

            {variants.map((v) => (
              <TabsContent key={v.id} value={v.id}>
                <NormItemsEditor
                  variantId={v.id}
                  companyId={companyId!}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
