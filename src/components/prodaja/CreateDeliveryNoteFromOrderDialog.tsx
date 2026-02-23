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
import { Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDeliveryOrdersForDeliveryNote,
  useCreateDeliveryNoteFromOrder,
} from "@/hooks/useDeliveryNotes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (deliveryNoteId: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" }> = {
  approved: { label: "Odobren", variant: "secondary" },
  reserved: { label: "Rezervisan", variant: "default" },
};

export function CreateDeliveryNoteFromOrderDialog({ open, onOpenChange, onSuccess }: Props) {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { data: orders, isLoading } = useDeliveryOrdersForDeliveryNote(
    selectedCompany?.id,
    selectedYear?.id
  );
  const createMutation = useCreateDeliveryNoteFromOrder();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedOrderId || !selectedCompany || !selectedYear || !user) return;

    const result = await createMutation.mutateAsync({
      orderId: selectedOrderId,
      companyId: selectedCompany.id,
      yearId: selectedYear.id,
      userId: user.id,
    });

    onSuccess(result.id);
    onOpenChange(false);
    setSelectedOrderId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Kreiraj otpremnicu iz naloga za isporuku
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Izaberite nalog za isporuku</Label>
            <p className="text-sm text-muted-foreground">
              Prikazani su samo odobreni ili rezervisani nalozi koji nemaju povezanu otpremnicu.
            </p>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Broj naloga</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kupac</TableHead>
                  <TableHead>Magacin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Stavki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Učitavanje...
                    </TableCell>
                  </TableRow>
                ) : !orders || orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nema dostupnih naloga za isporuku
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const status = STATUS_LABELS[order.status] || STATUS_LABELS.approved;
                    return (
                      <TableRow
                        key={order.id}
                        className={`cursor-pointer transition-colors ${
                          selectedOrderId === order.id ? "bg-primary/10" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="order"
                            checked={selectedOrderId === order.id}
                            onChange={() => setSelectedOrderId(order.id)}
                            className="w-4 h-4"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>
                          {format(new Date(order.order_date), "dd.MM.yyyy", { locale: sr })}
                        </TableCell>
                        <TableCell>
                          {order.partner_code} - {order.partner_name}
                        </TableCell>
                        <TableCell>
                          {order.warehouse_code
                            ? `${order.warehouse_code} - ${order.warehouse_name}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{order.item_count}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
            disabled={!selectedOrderId || createMutation.isPending}
          >
            {createMutation.isPending ? "Kreiranje..." : "Kreiraj otpremnicu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
