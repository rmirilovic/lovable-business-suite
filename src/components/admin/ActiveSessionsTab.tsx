import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { RefreshCw, Trash2, Wifi } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { sr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ActiveSession {
  id: string;
  user_id: string;
  company_id: string;
  session_token: string;
  created_at: string;
  last_heartbeat: string;
  browser?: string | null;
  os?: string | null;
  device_type?: string | null;
  ip_address?: string | null;
  user_email?: string;
  company_name?: string;
}

export function ActiveSessionsTab() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("active_sessions")
        .select("*")
        .order("last_heartbeat", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // Fetch user emails and company names
      const userIds = [...new Set(data.map((s) => s.user_id))];
      const companyIds = [...new Set(data.map((s) => s.company_id))];

      const [profilesRes, companiesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, first_name, last_name").in("id", userIds),
        supabase.from("companies").select("id, name").in("id", companyIds),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p) => [p.id, p.email || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id])
      );
      const companyMap = new Map(
        (companiesRes.data || []).map((c) => [c.id, c.name])
      );

      const enriched = data.map((s) => ({
        ...s,
        user_email: profileMap.get(s.user_id) || s.user_id,
        company_name: companyMap.get(s.company_id) || s.company_id,
      }));

      setSessions(enriched);
    } catch (err) {
      console.error("Failed to fetch active sessions:", err);
      toast.error("Greška pri učitavanju aktivnih sesija.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleRemoveSession = async (sessionToken: string) => {
    try {
      await supabase.rpc("remove_session", { _session_token: sessionToken });
      toast.success("Sesija je uklonjena.");
      fetchSessions();
    } catch {
      toast.error("Greška pri uklanjanju sesije.");
    }
  };

  const getHeartbeatStatus = (lastHeartbeat: string) => {
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    const minutes = diff / 60_000;
    if (minutes < 5) return "active";
    if (minutes < 10) return "idle";
    return "stale";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Aktivne sesije ({sessions.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSessions}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Osveži
        </Button>
      </div>

      <TableScrollContainer className="max-h-[calc(100vh-20rem)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Korisnik</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Browser / Uređaj</TableHead>
              <TableHead>IP adresa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prijava</TableHead>
              <TableHead>Poslednji heartbeat</TableHead>
              <TableHead className="w-[80px]">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nema aktivnih sesija.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const status = getHeartbeatStatus(session.last_heartbeat);
                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.user_email}
                    </TableCell>
                    <TableCell>{session.company_name}</TableCell>
                    <TableCell className="text-sm">
                      <div>{session.browser || "—"}</div>
                      <div className="text-muted-foreground">{[session.os, session.device_type].filter(Boolean).join(" · ") || "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {session.ip_address || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "active"
                            ? "default"
                            : status === "idle"
                            ? "secondary"
                            : "destructive"
                        }
                        className="gap-1"
                      >
                        <Wifi className="w-3 h-3" />
                        {status === "active"
                          ? "Aktivan"
                          : status === "idle"
                          ? "Neaktivan"
                          : "Istekao"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(session.created_at), "dd.MM.yyyy HH:mm", { locale: sr })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(session.last_heartbeat), {
                        addSuffix: true,
                        locale: sr,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSession(session.session_token)}
                        title="Ukloni sesiju"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableScrollContainer>
    </div>
  );
}
