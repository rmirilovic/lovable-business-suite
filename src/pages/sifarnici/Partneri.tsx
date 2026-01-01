import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Search, Plus, Filter, Building2, Phone, Mail } from "lucide-react";

interface Partner {
  id: string;
  code: string;
  name: string;
  type: "kupac" | "dobavljac" | "oba";
  pib: string;
  city: string;
  phone: string;
  email: string;
  balance: number;
}

const mockPartners: Partner[] = [
  {
    id: "1",
    code: "PAR-001",
    name: "Delta Trade d.o.o.",
    type: "kupac",
    pib: "123456789",
    city: "Beograd",
    phone: "+381 11 1234567",
    email: "info@deltatrade.rs",
    balance: 245000,
  },
  {
    id: "2",
    code: "PAR-002",
    name: "Mega Market",
    type: "kupac",
    pib: "987654321",
    city: "Novi Sad",
    phone: "+381 21 7654321",
    email: "nabavka@megamarket.rs",
    balance: -128500,
  },
  {
    id: "3",
    code: "PAR-003",
    name: "Dobavljač Plus d.o.o.",
    type: "dobavljac",
    pib: "456789123",
    city: "Niš",
    phone: "+381 18 9876543",
    email: "prodaja@dobavljacplus.rs",
    balance: -312000,
  },
  {
    id: "4",
    code: "PAR-004",
    name: "ABC Partneri",
    type: "oba",
    pib: "789123456",
    city: "Kragujevac",
    phone: "+381 34 1122334",
    email: "office@abcpartneri.rs",
    balance: 85200,
  },
];

const typeLabels = {
  kupac: "Kupac",
  dobavljac: "Dobavljač",
  oba: "Kupac/Dobavljač",
};

const typeStyles = {
  kupac: "bg-success/10 text-success",
  dobavljac: "bg-accent/10 text-accent",
  oba: "bg-primary/10 text-primary",
};

export default function Partneri() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "kupac" | "dobavljac">("all");

  const filteredPartners = mockPartners.filter((partner) => {
    const matchesSearch =
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.pib.includes(searchTerm);
    const matchesFilter =
      filter === "all" ||
      partner.type === filter ||
      (filter === "kupac" && partner.type === "oba") ||
      (filter === "dobavljac" && partner.type === "oba");
    return matchesSearch && matchesFilter;
  });

  return (
    <MainLayout title="Šifarnik partnera">
      {/* Toolbar */}
      <div className="erp-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pretraži po nazivu, šifri ili PIB-u..."
                className="erp-input w-full pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  filter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Svi
              </button>
              <button
                onClick={() => setFilter("kupac")}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  filter === "kupac"
                    ? "bg-success text-success-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Kupci
              </button>
              <button
                onClick={() => setFilter("dobavljac")}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  filter === "dobavljac"
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Dobavljači
              </button>
            </div>
          </div>
          <button className="erp-btn-accent gap-2">
            <Plus className="w-4 h-4" />
            <span>Novi partner</span>
          </button>
        </div>
      </div>

      {/* Partner Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map((partner, index) => (
          <div
            key={partner.id}
            className="erp-card p-5 hover:shadow-erp-md transition-shadow cursor-pointer animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {partner.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{partner.code}</p>
                </div>
              </div>
              <span
                className={`erp-badge ${typeStyles[partner.type]}`}
              >
                {typeLabels[partner.type]}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">PIB:</span>
                <span className="font-mono">{partner.pib}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Mesto:</span>
                <span>{partner.city}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{partner.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{partner.email}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Saldo:</span>
              <span
                className={`font-semibold ${
                  partner.balance >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {partner.balance >= 0 ? "+" : ""}
                {partner.balance.toLocaleString()} RSD
              </span>
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}
