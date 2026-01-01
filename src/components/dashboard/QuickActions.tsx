import { Plus, FileText, Package, Users, Factory } from "lucide-react";

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const actions: QuickAction[] = [
  {
    label: "Nova faktura",
    description: "Kreiraj izlaznu fakturu",
    icon: FileText,
    color: "bg-primary text-primary-foreground",
  },
  {
    label: "Novi artikal",
    description: "Dodaj u šifarnik",
    icon: Package,
    color: "bg-success text-success-foreground",
  },
  {
    label: "Novi partner",
    description: "Kupac ili dobavljač",
    icon: Users,
    color: "bg-accent text-accent-foreground",
  },
  {
    label: "Radni nalog",
    description: "Pokreni proizvodnju",
    icon: Factory,
    color: "bg-warning text-warning-foreground",
  },
];

export function QuickActions() {
  return (
    <div className="erp-card p-4">
      <h3 className="font-semibold text-foreground mb-4">Brze akcije</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <button
            key={action.label}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-secondary/50 transition-all group animate-fade-in"
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <div
              className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform`}
            >
              <action.icon className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                {action.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
