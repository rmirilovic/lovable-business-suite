import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMaterialNorm,
  useMaterialNormVariants,
  useMaterialNormItems,
  MaterialNormVariant,
} from "@/hooks/useMaterialNorms";
import { useClassifications } from "@/hooks/useClassifications";
import { ClassificationBadge } from "@/components/sifarnici/ClassificationBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, CheckCircle, Undo2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { NormItemsEditor } from "@/components/proizvodnja/NormItemsEditor";
import { formatDate } from "@/lib/formatting";
import { Badge } from "@/components/ui/badge";
import { exportNormToExcel, exportNormToPdf, printNorm } from "@/lib/normExportUtils";

export default function NormativEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  const { data: norm, isLoading: normLoading } = useMaterialNorm(id);
  const { variants, isLoading: variantsLoading, invalidate: invalidateVariants } =
    useMaterialNormVariants(id);
  const { classifications } = useClassifications(companyId);

  const [activeVariant, setActiveVariant] = useState<string>("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // Set first variant as active when loaded
  if (!activeVariant && variants.length > 0) {
    setActiveVariant(variants[0].id);
  }

  const activeVariantObj = variants.find((v) => v.id === activeVariant);
  const isActiveApproved = activeVariantObj?.status === "approved";
  const isActiveDraft = activeVariantObj?.status === "draft";
  const { items: activeItems } = useMaterialNormItems(activeVariant || undefined);

  const getExportMeta = () => {
    if (!norm || !activeVariantObj) return null;
    return { norm, variant: activeVariantObj, items: activeItems };
  };

  const handleExcelExport = () => {
    const meta = getExportMeta();
    if (meta) exportNormToExcel(meta);
  };

  const handlePdfExport = async () => {
    const meta = getExportMeta();
    if (meta) await exportNormToPdf(meta);
  };

  const handlePrint = async () => {
    const meta = getExportMeta();
    if (meta) await printNorm(meta);
  };

  const handleApproveVariant = async () => {
    if (!activeVariant) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("material_norm_variants")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
      .eq("id", activeVariant);
    if (error) toast.error("Greška: " + error.message);
    else { toast.success("Varijanta odobrena"); invalidateVariants(); }
  };

  const handleUnapproveVariant = async () => {
    if (!activeVariant) return;
    if (!confirm("Da li ste sigurni da želite da poništite odobravanje?")) return;
    const { error } = await supabase
      .from("material_norm_variants")
      .update({ status: "draft", approved_at: null, approved_by: null })
      .eq("id", activeVariant);
    if (error) toast.error("Greška: " + error.message);
    else { toast.success("Odobravanje poništeno"); invalidateVariants(); }
  };

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
    const v = variants.find((v) => v.id === variantId);
    if (v?.status === "approved") {
      toast.error("Nije moguće obrisati odobrenu varijantu");
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
          <div className="flex-1">
            <h1 className="text-xl font-bold">
              Normativ: {norm.article_code} - {norm.article_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground mt-1">
              <span>JM: <span className="text-foreground font-medium">{norm.article_unit}</span></span>
              {norm.article_kg_po_jm != null && norm.article_kg_po_jm > 0 && (
                <span>Masa kg/JM: <span className="text-foreground font-medium">{norm.article_kg_po_jm}</span></span>
              )}
              {norm.article_kol_mas != null && norm.article_kol_mas > 0 && (
                <span>Količina za masu: <span className="text-foreground font-medium">{norm.article_kol_mas}</span></span>
              )}
              <span>Klasifikacija: <ClassificationBadge code={norm.article_group} classifications={classifications} /></span>
              <span>Kreiran: <span className="text-foreground font-medium">{formatDate(norm.created_at)}</span></span>
              {norm.updated_at !== norm.created_at && (
                <span>Izmenjen: <span className="text-foreground font-medium">{formatDate(norm.updated_at)}</span></span>
              )}
            </div>
          </div>
        </div>

        {/* Variants tabs */}
        <div className="flex items-center gap-2">
          <Tabs
            value={activeVariant}
            onValueChange={setActiveVariant}
            className="flex-1"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <TabsList>
                {variants.map((v) => (
                  <TabsTrigger key={v.id} value={v.id} className="relative group gap-1.5">
                    {editingName === v.id && v.status !== "approved" ? (
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
                          if (v.status === "approved") return;
                          setEditingName(v.id);
                          setNewName(v.variant_name);
                        }}
                        title={v.status === "approved" ? undefined : "Dupli klik za preimenovanje"}
                      >
                        {v.variant_name}
                      </span>
                    )}
                    {v.status === "approved" && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">Odobrena</Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button variant="outline" size="sm" onClick={handleAddVariant}>
                <Plus className="w-3 h-3 mr-1" />
                Varijanta
              </Button>
              {activeVariant && isActiveDraft && (
                <Button onClick={handleApproveVariant} variant="default" size="sm">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Odobri varijantu
                </Button>
              )}
              {activeVariant && isActiveApproved && (
                <Button onClick={handleUnapproveVariant} variant="outline" size="sm">
                  <Undo2 className="w-4 h-4 mr-1" />
                  Poništi odobrenje
                </Button>
              )}
              {!isActiveApproved && variants.length > 1 && activeVariant && (
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
              {/* Export buttons */}
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={activeItems.length === 0}>
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdfExport} disabled={activeItems.length === 0}>
                  <FileText className="w-3 h-3 mr-1" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={activeItems.length === 0}>
                  <Printer className="w-3 h-3 mr-1" />
                  Štampa
                </Button>
              </div>
            </div>

            {variants.map((v) => (
              <TabsContent key={v.id} value={v.id}>
                <NormItemsEditor
                  variantId={v.id}
                  companyId={companyId!}
                  readOnly={v.status === "approved"}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
