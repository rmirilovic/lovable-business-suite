import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { CustomsClearanceCost } from "@/hooks/useCustomsClearances";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { SearchablePartnerSelect, type Partner } from "@/components/ui/searchable-partner-select";
import { usePartners } from "@/hooks/usePartners";

interface Props {
  costs: CustomsClearanceCost[];
  isLoading: boolean;
  isEditable: boolean;
  clearanceId: string;
  companyId: string;
  onAdd: (cost: Omit<CustomsClearanceCost, "id" | "created_at" | "partner">) => void;
  onRemove: (costId: string) => void;
}

const DISTRIBUTION_METHODS = [
  { value: "by_value", label: "Po vrednosti" },
  { value: "by_quantity", label: "Po količini" },
];

export function CustomsClearanceCostsEditor({
  costs,
  isLoading,
  isEditable,
  clearanceId,
  companyId,
  onAdd,
  onRemove,
}: Props) {
  const { partners } = usePartners();
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("0,00");
  const [newMethod, setNewMethod] = useState("by_value");
  const [newPartnerId, setNewPartnerId] = useState("");
  const [newAccountCode, setNewAccountCode] = useState("");

  const handleAdd = () => {
    const amount = parseLocaleNumber(newAmount);
    if (!newDescription.trim() || amount <= 0) return;

    onAdd({
      customs_clearance_id: clearanceId,
      company_id: companyId,
      description: newDescription.trim(),
      amount,
      distribution_method: newMethod,
      partner_id: newPartnerId || null,
      account_code: newAccountCode || null,
      item_order: costs.length + 1,
    });

    setNewDescription("");
    setNewAmount("0,00");
    setNewMethod("by_value");
    setNewPartnerId("");
    setNewAccountCode("");
  };

  const getPartnerName = (partnerId: string | null) => {
    if (!partnerId) return "—";
    const p = partners.find((p) => p.id === partnerId);
    return p ? `${p.code} - ${p.name}` : "—";
  };

  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Zavisni troškovi (špedicija, prevoz, osiguranje...)</h3>

      {isEditable && (
        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <Input
                placeholder="Opis troška"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <SearchablePartnerSelect
                partners={partners as Partner[]}
                value={newPartnerId}
                onValueChange={setNewPartnerId}
                placeholder="Poverilac..."
              />
            </div>
            <div className="col-span-2">
              <LocaleNumberInput
                value={newAmount}
                onChange={setNewAmount}
                placeholder="Iznos"
                decimalPlaces={2}
              />
            </div>
            <div className="col-span-2">
              <Input
                placeholder="Konto"
                value={newAccountCode}
                onChange={(e) => setNewAccountCode(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Select value={newMethod} onValueChange={setNewMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISTRIBUTION_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Button
                onClick={handleAdd}
                disabled={!newDescription.trim() || parseLocaleNumber(newAmount) <= 0}
                className="w-full"
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {costs.length > 0 && (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead>Poverilac</TableHead>
                <TableHead className="w-[100px]">Konto</TableHead>
                <TableHead className="w-[130px] text-right">Iznos</TableHead>
                <TableHead className="w-[140px]">Raspodela</TableHead>
                {isEditable && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((cost, idx) => (
                <TableRow key={cost.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>{cost.description}</TableCell>
                  <TableCell className="text-sm">{getPartnerName(cost.partner_id)}</TableCell>
                  <TableCell className="text-sm">{cost.account_code || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatDecimal(cost.amount, 2)}</TableCell>
                  <TableCell>
                    {cost.distribution_method === "by_value" ? "Po vrednosti" : "Po količini"}
                  </TableCell>
                  {isEditable && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => onRemove(cost.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={4} className="text-right">Ukupno zavisni troškovi:</TableCell>
                <TableCell className="text-right">{formatDecimal(totalCosts, 2)}</TableCell>
                <TableCell colSpan={isEditable ? 2 : 1} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {costs.length === 0 && !isEditable && (
        <p className="text-sm text-muted-foreground py-4 text-center">Nema zavisnih troškova.</p>
      )}
    </div>
  );
}
