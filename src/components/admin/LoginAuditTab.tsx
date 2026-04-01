import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface LoginAuditEntry {
  id: string;
  user_email: string | null;
  user_name: string | null;
  company_name: string | null;
  login_at: string;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  screen_resolution: string | null;
  locale: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export function LoginAuditTab() {
  const [entries, setEntries] = useState<LoginAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchEntries = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("login_audit_log")
      .select("id, user_email, user_name, company_name, login_at, browser, os, device_type, screen_resolution, locale, ip_address, user_agent")
      .order("login_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (searchTerm.trim()) {
      query = query.or(`user_email.ilike.%${searchTerm}%,user_name.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching login audit:", error);
    }

    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [page]);

  const handleSearch = () => {
    setPage(0);
    fetchEntries();
  };

  const getDeviceBadgeVariant = (deviceType: string | null) => {
    switch (deviceType) {
      case "Mobilni":
        return "destructive" as const;
      case "Tablet":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Evidencija prijava korisnika u sistem
        </p>
        <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Osveži
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži po emailu, imenu ili IP adresi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleSearch}>
          Pretraži
        </Button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[calc(100vh-20rem)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Datum i vreme</TableHead>
              <TableHead className="whitespace-nowrap">Korisnik</TableHead>
              <TableHead className="whitespace-nowrap">Email</TableHead>
              <TableHead className="whitespace-nowrap">Firma</TableHead>
              <TableHead className="whitespace-nowrap">Browser</TableHead>
              <TableHead className="whitespace-nowrap">OS</TableHead>
              <TableHead className="whitespace-nowrap">Uređaj</TableHead>
              <TableHead className="whitespace-nowrap">Rezolucija</TableHead>
              <TableHead className="whitespace-nowrap">Locale</TableHead>
              <TableHead className="whitespace-nowrap">IP adresa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nema zapisa o prijavama
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(entry.login_at), "dd.MM.yyyy HH:mm:ss", { locale: sr })}
                  </TableCell>
                  <TableCell className="text-sm">{entry.user_name || "-"}</TableCell>
                  <TableCell className="text-sm">{entry.user_email || "-"}</TableCell>
                  <TableCell className="text-sm">{entry.company_name || "-"}</TableCell>
                  <TableCell className="text-sm">{entry.browser || "-"}</TableCell>
                  <TableCell className="text-sm">{entry.os || "-"}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={getDeviceBadgeVariant(entry.device_type)}>
                      {entry.device_type || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{entry.screen_resolution || "-"}</TableCell>
                  <TableCell className="text-sm">{entry.locale || "-"}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{entry.ip_address || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Strana {page + 1} · Prikazano {entries.length} zapisa
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prethodna
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={entries.length < pageSize}
          >
            Sledeća
          </Button>
        </div>
      </div>
    </div>
  );
}