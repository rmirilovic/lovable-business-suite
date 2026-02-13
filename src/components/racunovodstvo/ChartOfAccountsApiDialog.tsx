import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Upload, Copy, Check } from "lucide-react";
import { useChartOfAccounts, useChartOfAccountsMutations, ChartOfAccountsRow } from "@/hooks/useChartOfAccounts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ChartOfAccountsApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChartOfAccountsApiDialog({ open, onOpenChange }: ChartOfAccountsApiDialogProps) {
  const { selectedCompany } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();
  const { createAccount } = useChartOfAccountsMutations();

  const [activeTab, setActiveTab] = useState("export");
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportData = accounts.map((acc) => ({
    code: acc.code,
    name: acc.name,
    account_type: acc.account_type,
    parent_code: acc.parent_code,
    level: acc.level,
    is_active: acc.is_active,
    is_posting_allowed: acc.is_posting_allowed,
    description: acc.description,
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
    a.download = `kontni-plan-${selectedCompany?.code || "export"}.json`;
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

      // Sort by code length/value to ensure parents are created first
      const sorted = [...items].sort((a, b) => {
        if (a.code.length !== b.code.length) return a.code.length - b.code.length;
        return a.code.localeCompare(b.code);
      });

      let successCount = 0;
      for (const item of sorted) {
        if (!item.code || !item.name) continue;

        try {
          await createAccount.mutateAsync({
            code: item.code,
            name: item.name,
            account_type: item.account_type || "asset",
            parent_code: item.parent_code || null,
            level: item.level || item.code.length,
            is_active: item.is_active !== false,
            is_posting_allowed: item.is_posting_allowed !== false,
            description: item.description || null,
          });
          successCount++;
        } catch (error) {
          // Ignore duplicates, continue with others
          console.warn(`Skipped account ${item.code}:`, error);
        }
      }

      toast.success(`Uvezeno ${successCount} konta`);
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
          <DialogTitle>Kontni plan - API (JSON)</DialogTitle>
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
              Ukupno {accounts.length} konta
            </p>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label>JSON podaci za uvoz</Label>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='[{"code": "1010", "name": "Žiro račun", "account_type": "asset", ...}]'
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
