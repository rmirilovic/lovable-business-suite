import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Upload, Copy, Check } from "lucide-react";
import { useInputCosts, useInputCostsMutations, InputCost } from "@/hooks/useInputCosts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface InputCostsApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InputCostsApiDialog({ open, onOpenChange }: InputCostsApiDialogProps) {
  const { selectedCompany } = useAuth();
  const { data: costs = [] } = useInputCosts();
  const { bulkCreateInputCosts } = useInputCostsMutations();

  const [activeTab, setActiveTab] = useState("export");
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportData = costs.map((c) => ({
    code: c.code,
    account_code: c.account_code,
    name: c.name,
    vat_rate: c.vat_rate,
    is_vat_deductible: c.is_vat_deductible,
    is_active: c.is_active,
    is_procurement_cost: c.is_procurement_cost,
    is_import_cost: c.is_import_cost,
    description: c.description,
  }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    toast.success("JSON kopiran u clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ulazni-troskovi-${selectedCompany?.code || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      toast.error("Unesite JSON podatke");
      return;
    }

    try {
      setImporting(true);
      const data = JSON.parse(jsonInput);
      const items = Array.isArray(data) ? data : [data];

      const validItems = items
        .filter((item) => item.code && item.account_code && item.name)
        .map((item) => ({
          code: item.code,
          account_code: item.account_code,
          name: item.name,
          vat_rate: Number(item.vat_rate) || 20,
          is_vat_deductible: item.is_vat_deductible !== false,
          is_active: item.is_active !== false,
          is_procurement_cost: item.is_procurement_cost === true,
          is_import_cost: item.is_import_cost === true,
          description: item.description || null,
        }));

      if (validItems.length === 0) {
        toast.error("Nema validnih stavki za uvoz");
        return;
      }

      await bulkCreateInputCosts.mutateAsync(validItems);
      setJsonInput("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Neispravan JSON format");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Ulazni troškovi - API (JSON)</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Izvoz</TabsTrigger>
            <TabsTrigger value="import">Uvoz</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Kopirano!" : "Kopiraj"}
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Preuzmi JSON
              </Button>
            </div>
            <Textarea
              readOnly
              value={JSON.stringify(exportData, null, 2)}
              className="font-mono text-xs h-80"
            />
            <p className="text-sm text-muted-foreground">
              Ukupno {costs.length} troškova
            </p>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label>JSON podaci za uvoz</Label>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='[{"code": "T01", "account_code": "5120", "name": "Usluge", "vat_rate": 20, ...}]'
                className="font-mono text-xs h-80"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zatvori
          </Button>
          {activeTab === "import" && (
            <Button onClick={handleImport} disabled={importing || !jsonInput.trim()}>
              <Upload className="w-4 h-4 mr-2" />
              {importing ? "Uvoz..." : "Uvezi"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
