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
import { CalculationAdditionalCost } from "@/hooks/usePurchasePriceCalculations";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { SearchablePartnerSelect, Partner } from "@/components/ui/searchable-partner-select";

interface CalculationCostsEditorProps {
  costs: CalculationAdditionalCost[];
  partners: Partner[];
  isLoading: boolean;
  isEditable: boolean;
  onAdd: (cost: { description: string; amount: number; distribution_method: "by_value" | "by_quantity"; partner_id: string | null }) => Promise<void>;
  onUpdate: (id: string, data: Partial<CalculationAdditionalCost>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const DISTRIBUTION_METHODS = [
  { value: "by_value", label: "Po vrednosti" },
  { value: "by_quantity", label: "Po količini" },
];

export function CalculationCostsEditor({
  costs,
  partners,
  isLoading,
  isEditable,
  onAdd,
  onUpdate,
  onDelete,
}: CalculationCostsEditorProps) {
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("0,00");
  const [newMethod, setNewMethod] = useState<"by_value" | "by_quantity">("by_value");
  const [newPartnerId, setNewPartnerId] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const amount = parseLocaleNumber(newAmount);
    if (!newDescription.trim() || amount <= 0) return;

    setIsAdding(true);
    try {
      await onAdd({
        description: newDescription.trim(),
        amount,
        distribution_method: newMethod,
        partner_id: newPartnerId || null,
      });
      setNewDescription("");
      setNewAmount("0,00");
      setNewMethod("by_value");
      setNewPartnerId("");
    } finally {
      setIsAdding(false);
    }
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
      <h3 className="text-sm font-semibold">Zavisni troškovi nabavke</h3>

      {isEditable && (
        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <Input
                placeholder="Opis troška (prevoz, utovar, osiguranje...)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <SearchablePartnerSelect
                partners={partners}
                value={newPartnerId}
                onValueChange={setNewPartnerId}
                placeholder="Poverilac troška..."
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
              <Select value={newMethod} onValueChange={(v) => setNewMethod(v as any)}>
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
                disabled={!newDescription.trim() || parseLocaleNumber(newAmount) <= 0 || isAdding}
                className="w-full"
                size="icon"
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
                  <TableCell className="text-right font-medium">
                    {formatDecimal(cost.amount, 2)}
                  </TableCell>
                  <TableCell>
                    {cost.distribution_method === "by_value" ? "Po vrednosti" : "Po količini"}
                  </TableCell>
                  {isEditable && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(cost.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={3} className="text-right">
                  Ukupno zavisni troškovi:
                </TableCell>
                <TableCell className="text-right">
                  {formatDecimal(totalCosts, 2)}
                </TableCell>
                <TableCell colSpan={isEditable ? 2 : 1} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {costs.length === 0 && !isEditable && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nema zavisnih troškova.
        </p>
      )}
    </div>
  );
}
