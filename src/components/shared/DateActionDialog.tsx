import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  defaultDate?: string;
  minDate?: string;
  minDateMessage?: string;
  onConfirm: (date: string) => void;
  isPending?: boolean;
}

export function DateActionDialog({
  open, onOpenChange, title, label, defaultDate, minDate, minDateMessage, onConfirm, isPending,
}: Props) {
  const [date, setDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));

  // Reset date every time dialog opens
  useEffect(() => {
    if (open) {
      setDate(defaultDate || format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, defaultDate]);

  const isValid = date && (!minDate || date >= minDate);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>{label}</Label>
            <LocaleDateInput value={date} onChange={setDate} />
          </div>
          {minDate && date && date < minDate && (
            <p className="text-sm text-destructive">
              {minDateMessage || `Datum ne može biti pre ${format(new Date(minDate), "dd.MM.yyyy")}`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button onClick={() => { onConfirm(date); onOpenChange(false); }} disabled={!isValid || isPending}>
            Potvrdi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
