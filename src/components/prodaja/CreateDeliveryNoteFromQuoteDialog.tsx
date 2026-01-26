import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuotesForDelivery, useCreateDeliveryNoteFromQuote } from "@/hooks/useDeliveryNotes";
import { useWarehouses } from "@/hooks/useWarehouses";

interface CreateDeliveryNoteFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (deliveryNoteId: string) => void;
}

export function CreateDeliveryNoteFromQuoteDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDeliveryNoteFromQuoteDialogProps) {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { data: quotes, isLoading: quotesLoading } = useQuotesForDelivery(
    selectedCompany?.id
  );
  const { warehouses, isLoading: warehousesLoading } = useWarehouses(
    selectedCompany?.id
  );
  const createMutation = useCreateDeliveryNoteFromQuote();

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const handleCreate = async () => {
    if (!selectedQuoteId || !selectedWarehouseId || !selectedCompany || !selectedYear || !user) {
      return;
    }

    const result = await createMutation.mutateAsync({
      quoteId: selectedQuoteId,
      companyId: selectedCompany.id,
      yearId: selectedYear.id,
      warehouseId: selectedWarehouseId,
      userId: user.id,
    });

    onSuccess(result.id);
    onOpenChange(false);
    setSelectedQuoteId(null);
    setSelectedWarehouseId("");
  };

  const isLoading = quotesLoading || warehousesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kreiraj otpremnicu iz ponude
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Izaberite magacin za otpremu *</Label>
            <Select
              value={selectedWarehouseId}
              onValueChange={setSelectedWarehouseId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Izaberite magacin" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Izaberite ponudu sa materijalnim dobrima</Label>
            <p className="text-sm text-muted-foreground">
              Prikazane su samo proknjižene ponude koje sadrže robu, repromaterijal
              ili gotove proizvode (SVK 1, 2, 9).
            </p>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Broj ponude</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kupac</TableHead>
                  <TableHead className="text-center">Mat. stavki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Učitavanje...
                    </TableCell>
                  </TableRow>
                ) : !quotes || quotes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nema dostupnih ponuda sa materijalnim dobrima
                    </TableCell>
                  </TableRow>
                ) : (
                  quotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className={`cursor-pointer transition-colors ${
                        selectedQuoteId === quote.id
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedQuoteId(quote.id)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          name="quote"
                          checked={selectedQuoteId === quote.id}
                          onChange={() => setSelectedQuoteId(quote.id)}
                          className="w-4 h-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {quote.quote_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(quote.quote_date), "dd.MM.yyyy", {
                          locale: sr,
                        })}
                      </TableCell>
                      <TableCell>
                        {quote.partner_code} - {quote.partner_name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {quote.material_item_count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !selectedQuoteId ||
              !selectedWarehouseId ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? "Kreiranje..." : "Kreiraj otpremnicu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
