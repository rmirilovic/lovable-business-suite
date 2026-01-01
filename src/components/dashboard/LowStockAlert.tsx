import { AlertTriangle, ArrowUpRight } from "lucide-react";

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  unit: string;
}

const lowStockItems: LowStockItem[] = [
  {
    id: "1",
    name: "Vijak M8x40",
    sku: "VIJ-M8-40",
    currentStock: 150,
    minStock: 500,
    unit: "kom",
  },
  {
    id: "2",
    name: "Čelična ploča 2mm",
    sku: "CEL-PL-2MM",
    currentStock: 12,
    minStock: 50,
    unit: "kom",
  },
  {
    id: "3",
    name: "Elektroda E7018",
    sku: "ELE-7018",
    currentStock: 45,
    minStock: 200,
    unit: "kg",
  },
  {
    id: "4",
    name: "Boja RAL 9016",
    sku: "BOJ-9016",
    currentStock: 8,
    minStock: 30,
    unit: "lit",
  },
];

export function LowStockAlert() {
  return (
    <div className="erp-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-foreground">Nizak nivo zaliha</h3>
        </div>
        <button className="text-sm text-primary hover:underline flex items-center gap-1">
          Svi artikli
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
      <div className="divide-y divide-border">
        {lowStockItems.map((item, index) => {
          const percentage = (item.currentStock / item.minStock) * 100;
          return (
            <div
              key={item.id}
              className="p-4 hover:bg-table-hover transition-colors animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-destructive">
                    {item.currentStock} {item.unit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Min: {item.minStock} {item.unit}
                  </p>
                </div>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-destructive rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
