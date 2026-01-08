import { FileText, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatPrice } from "@/lib/formatting";

interface Document {
  id: string;
  type: "faktura" | "ponuda" | "prijemnica" | "nalog";
  number: string;
  partner: string;
  amount: number;
  date: Date;
  status: "placeno" | "ceka" | "kasni";
}

const mockDocuments: Document[] = [
  {
    id: "1",
    type: "faktura",
    number: "FA-2025-0042",
    partner: "Delta Trade d.o.o.",
    amount: 245000,
    date: new Date(2025, 11, 28),
    status: "placeno",
  },
  {
    id: "2",
    type: "faktura",
    number: "FA-2025-0041",
    partner: "Mega Market",
    amount: 128500,
    date: new Date(2025, 11, 27),
    status: "ceka",
  },
  {
    id: "3",
    type: "ponuda",
    number: "PO-2025-0018",
    partner: "ABC Partneri",
    amount: 85200,
    date: new Date(2025, 11, 26),
    status: "ceka",
  },
  {
    id: "4",
    type: "prijemnica",
    number: "PR-2025-0089",
    partner: "Dobavljač Plus",
    amount: 312000,
    date: new Date(2025, 11, 25),
    status: "placeno",
  },
  {
    id: "5",
    type: "faktura",
    number: "FA-2025-0040",
    partner: "Retail Point",
    amount: 67800,
    date: new Date(2025, 11, 24),
    status: "kasni",
  },
];

const typeLabels = {
  faktura: "Faktura",
  ponuda: "Ponuda",
  prijemnica: "Prijemnica",
  nalog: "Nalog",
};

const statusStyles = {
  placeno: "erp-badge-success",
  ceka: "erp-badge-warning",
  kasni: "erp-badge-destructive",
};

const statusLabels = {
  placeno: "Plaćeno",
  ceka: "Čeka",
  kasni: "Kasni",
};

export function RecentDocuments() {
  return (
    <div className="erp-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Poslednji dokumenti</h3>
        <button className="text-sm text-primary hover:underline flex items-center gap-1">
          Prikaži sve
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
      <div className="divide-y divide-border">
        {mockDocuments.map((doc, index) => (
          <div
            key={doc.id}
            className="p-4 hover:bg-table-hover transition-colors cursor-pointer animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {doc.number}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {typeLabels[doc.type]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{doc.partner}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground">{formatPrice(doc.amount)} RSD</p>
                <div className="flex items-center gap-2 justify-end mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(doc.date)}
                  </span>
                  <span className={cn(statusStyles[doc.status])}>
                    {statusLabels[doc.status]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
