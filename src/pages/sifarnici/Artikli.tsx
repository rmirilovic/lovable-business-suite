import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Search,
  Plus,
  Filter,
  Download,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
} from "lucide-react";

interface Article {
  id: string;
  code: string;
  name: string;
  group: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  status: "active" | "inactive";
}

const mockArticles: Article[] = [
  {
    id: "1",
    code: "ART-001",
    name: "Vijak M8x40 DIN 933",
    group: "Vijci",
    unit: "kom",
    purchasePrice: 12,
    salePrice: 18,
    stock: 2500,
    status: "active",
  },
  {
    id: "2",
    code: "ART-002",
    name: "Matica M8 DIN 934",
    group: "Matice",
    unit: "kom",
    purchasePrice: 5,
    salePrice: 8,
    stock: 3200,
    status: "active",
  },
  {
    id: "3",
    code: "ART-003",
    name: "Čelična ploča 2000x1000x2mm",
    group: "Limovi",
    unit: "kom",
    purchasePrice: 8500,
    salePrice: 12000,
    stock: 45,
    status: "active",
  },
  {
    id: "4",
    code: "ART-004",
    name: "Elektroda E7018 3.25mm",
    group: "Elektrode",
    unit: "kg",
    purchasePrice: 450,
    salePrice: 650,
    stock: 120,
    status: "active",
  },
  {
    id: "5",
    code: "ART-005",
    name: "Boja industrijska RAL 9016",
    group: "Boje",
    unit: "lit",
    purchasePrice: 1200,
    salePrice: 1800,
    stock: 35,
    status: "inactive",
  },
];

export default function Artikli() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const filteredArticles = mockArticles.filter(
    (article) =>
      article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredArticles.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredArticles.map((a) => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <MainLayout title="Šifarnik artikala">
      {/* Toolbar */}
      <div className="erp-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pretraži po šifri ili nazivu..."
                className="erp-input w-full pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="erp-btn-primary gap-2 hidden md:inline-flex">
              <Filter className="w-4 h-4" />
              Filteri
            </button>
          </div>
          <div className="flex gap-3">
            <button className="erp-btn-primary gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Izvoz</span>
            </button>
            <button className="erp-btn-accent gap-2">
              <Plus className="w-4 h-4" />
              <span>Novi artikal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="erp-table-header">
                <th className="w-12 p-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={
                      selectedItems.length === filteredArticles.length &&
                      filteredArticles.length > 0
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3 text-left font-medium">Šifra</th>
                <th className="p-3 text-left font-medium">Naziv</th>
                <th className="p-3 text-left font-medium">Grupa</th>
                <th className="p-3 text-left font-medium">JM</th>
                <th className="p-3 text-right font-medium">Nabavna cena</th>
                <th className="p-3 text-right font-medium">Prodajna cena</th>
                <th className="p-3 text-right font-medium">Stanje</th>
                <th className="p-3 text-center font-medium">Status</th>
                <th className="w-12 p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredArticles.map((article, index) => (
                <tr
                  key={article.id}
                  className="hover:bg-table-hover transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={selectedItems.includes(article.id)}
                      onChange={() => toggleSelect(article.id)}
                    />
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-sm text-primary">
                      {article.code}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-foreground">
                    {article.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{article.group}</td>
                  <td className="p-3 text-muted-foreground">{article.unit}</td>
                  <td className="p-3 text-right font-mono">
                    {article.purchasePrice.toLocaleString()} RSD
                  </td>
                  <td className="p-3 text-right font-mono">
                    {article.salePrice.toLocaleString()} RSD
                  </td>
                  <td className="p-3 text-right font-mono">
                    {article.stock.toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={
                        article.status === "active"
                          ? "erp-badge-success"
                          : "erp-badge-destructive"
                      }
                    >
                      {article.status === "active" ? "Aktivan" : "Neaktivan"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end">
                      <button className="p-1.5 rounded hover:bg-secondary transition-colors">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-secondary transition-colors">
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-secondary transition-colors">
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Prikazano {filteredArticles.length} od {mockArticles.length} artikala
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary transition-colors disabled:opacity-50">
              Prethodna
            </button>
            <button className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground">
              1
            </button>
            <button className="px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary transition-colors">
              2
            </button>
            <button className="px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary transition-colors">
              Sledeća
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
