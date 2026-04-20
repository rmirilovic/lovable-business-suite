import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";

export type ZakljucniListLevel = "class" | "two" | "three" | "full" | "analytics";

export interface ZakljucniListRow {
  /** Code that should appear in the leftmost "Šifra konta" column. For analytics rows: "<account>/<analytics>". */
  code: string;
  /** Underlying account code (without analytics) — used for sorting/grouping. */
  account_code: string;
  /** Analytics code (only for level === "analytics" with analytics present). */
  analytics: string | null;
  /** Description of the account (or analytics description for analytics rows). */
  description: string;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  total_debit: number;
  total_credit: number;
  balance: number;
  /** Visual nesting level (0 = class, 1 = 2-cifre, 2 = 3-cifre, 3 = full account, 4 = analytics). */
  indent: number;
  /** True if the row is an aggregated parent (class / 2-cifre / 3-cifre). */
  is_aggregate: boolean;
}

interface UseZakljucniListParams {
  dateFrom: string | null;
  dateTo: string | null;
  accountFrom: string;
  accountTo: string;
  level: ZakljucniListLevel;
}

interface RawItem {
  account_code: string;
  cost_center_code: string | null;
  debit_amount: number;
  credit_amount: number;
  partner_id: string | null;
  partners: { code: string | null; name: string | null } | null;
  journal_entries: { entry_date: string; status: string; business_year_id: string };
}

function getAnalyticsCode(item: RawItem): string | null {
  if (item.cost_center_code) return item.cost_center_code;
  if (item.partners?.code) return item.partners.code;
  return null;
}

function getAnalyticsDesc(item: RawItem): string {
  return item.partners?.name || "";
}

interface Bucket {
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  description?: string;
  account_code: string;
  analytics?: string | null;
}

export function useZakljucniList({
  dateFrom,
  dateTo,
  accountFrom,
  accountTo,
  level,
}: UseZakljucniListParams) {
  const { selectedCompany, selectedYear } = useAuth();
  const { data: accounts = [] } = useChartOfAccounts();

  return useQuery({
    queryKey: [
      "zakljucni-list",
      selectedCompany?.id,
      selectedYear?.id,
      dateFrom,
      dateTo,
      accountFrom,
      accountTo,
      level,
    ],
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
    queryFn: async (): Promise<ZakljucniListRow[]> => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const fromCode = (accountFrom || "0").trim();
      const toCode = (accountTo || "99999").trim();

      // Build query: get all posted items in selected business year, in account range, up to dateTo.
      let query = supabase
        .from("journal_entry_items")
        .select(`
          account_code,
          cost_center_code,
          debit_amount,
          credit_amount,
          partner_id,
          partners(code, name),
          journal_entries!inner(entry_date, status, business_year_id)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id)
        .gte("account_code", fromCode)
        .lte("account_code", toCode + "\uffff");

      if (dateTo) {
        query = query.lte("journal_entries.entry_date", dateTo);
      }

      // Fetch in chunks (Supabase 1000-row default). Use range pagination.
      const pageSize = 1000;
      let offset = 0;
      const all: RawItem[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await query.range(offset, offset + pageSize - 1);
        if (error) throw error;
        const chunk = (data || []) as unknown as RawItem[];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        offset += pageSize;
      }

      const accountNameMap = new Map(accounts.map((a) => [a.code, a.name]));

      // Decide for each item which "key" to bucket under, based on level.
      // For aggregate levels (class/two/three) we bucket only by the truncated code.
      // For "full" level we bucket by the full account code.
      // For "analytics" level we bucket by `${account}|${analytics ?? ""}`.
      const buckets = new Map<string, Bucket>();

      const isOpening = (entryDate: string): boolean => {
        if (!dateFrom) return false;
        return entryDate < dateFrom;
      };

      const truncate = (code: string, len: number): string => {
        if (code.length <= len) return code;
        return code.slice(0, len);
      };

      for (const item of all) {
        const fullCode = item.account_code;
        const entryDate = item.journal_entries.entry_date;
        const debit = Number(item.debit_amount) || 0;
        const credit = Number(item.credit_amount) || 0;

        let key: string;
        let bucketCode: string;
        let analyticsCode: string | null = null;
        let description = "";

        if (level === "class") {
          bucketCode = truncate(fullCode, 1);
          key = bucketCode;
          description = `Klasa ${bucketCode}`;
        } else if (level === "two") {
          bucketCode = truncate(fullCode, 2);
          key = bucketCode;
          description = accountNameMap.get(bucketCode) || `Konto ${bucketCode}`;
        } else if (level === "three") {
          bucketCode = truncate(fullCode, 3);
          key = bucketCode;
          description = accountNameMap.get(bucketCode) || `Konto ${bucketCode}`;
        } else if (level === "full") {
          bucketCode = fullCode;
          key = bucketCode;
          description = accountNameMap.get(bucketCode) || "";
        } else {
          // analytics
          analyticsCode = getAnalyticsCode(item);
          bucketCode = fullCode;
          key = `${fullCode}|${analyticsCode ?? ""}`;
          description = analyticsCode
            ? getAnalyticsDesc(item) || accountNameMap.get(fullCode) || ""
            : accountNameMap.get(fullCode) || "";
        }

        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = {
            opening_debit: 0,
            opening_credit: 0,
            period_debit: 0,
            period_credit: 0,
            description,
            account_code: bucketCode,
            analytics: analyticsCode,
          };
          buckets.set(key, bucket);
        } else if (!bucket.description && description) {
          bucket.description = description;
        }

        if (isOpening(entryDate)) {
          bucket.opening_debit += debit;
          bucket.opening_credit += credit;
        } else {
          bucket.period_debit += debit;
          bucket.period_credit += credit;
        }
      }

      // For levels "three" and "full" we should ALSO include their parent
      // aggregated rows (per spec: 3-cifre level shows 2-cifre parents that
      // have postings; full shows 2- and 3-cifre parents that have postings).
      // We achieve this by re-aggregating from the raw data with broader keys.
      const extra = new Map<string, Bucket>();
      const addExtra = (item: RawItem, len: number) => {
        const code = truncate(item.account_code, len);
        const key = `__agg${len}_${code}`;
        const debit = Number(item.debit_amount) || 0;
        const credit = Number(item.credit_amount) || 0;
        let b = extra.get(key);
        if (!b) {
          b = {
            opening_debit: 0,
            opening_credit: 0,
            period_debit: 0,
            period_credit: 0,
            description: accountNameMap.get(code) || `Konto ${code}`,
            account_code: code,
            analytics: null,
          };
          extra.set(key, b);
        }
        const opening = isOpening(item.journal_entries.entry_date);
        if (opening) {
          b.opening_debit += debit;
          b.opening_credit += credit;
        } else {
          b.period_debit += debit;
          b.period_credit += credit;
        }
      };

      if (level === "three" || level === "full" || level === "analytics") {
        for (const item of all) {
          if (item.account_code.length >= 2) addExtra(item, 2);
        }
      }
      if (level === "full" || level === "analytics") {
        for (const item of all) {
          if (item.account_code.length >= 3) addExtra(item, 3);
        }
      }
      if (level === "analytics") {
        // also include the bare full account row (without analytics) as aggregate
        for (const item of all) {
          const code = item.account_code;
          const key = `__agg_full_${code}`;
          const debit = Number(item.debit_amount) || 0;
          const credit = Number(item.credit_amount) || 0;
          let b = extra.get(key);
          if (!b) {
            b = {
              opening_debit: 0,
              opening_credit: 0,
              period_debit: 0,
              period_credit: 0,
              description: accountNameMap.get(code) || "",
              account_code: code,
              analytics: null,
            };
            extra.set(key, b);
          }
          if (isOpening(item.journal_entries.entry_date)) {
            b.opening_debit += debit;
            b.opening_credit += credit;
          } else {
            b.period_debit += debit;
            b.period_credit += credit;
          }
        }
      }

      // Build final rows
      type BuiltRow = ZakljucniListRow & { _sortKey: string };
      const built: BuiltRow[] = [];

      const indentFor = (codeLen: number, hasAnalytics: boolean): number => {
        if (hasAnalytics) return 4;
        if (codeLen === 1) return 0;
        if (codeLen === 2) return 1;
        if (codeLen === 3) return 2;
        return 3;
      };

      // Helper to build sort key so that parents come immediately before their children
      const sortKey = (accountCode: string, analytics: string | null): string => {
        // pad to 5 + analytics; aggregate rows sort BEFORE deeper rows that share prefix
        const padded = accountCode.padEnd(5, "0");
        return `${padded}|${accountCode.length.toString().padStart(2, "0")}|${analytics ?? ""}`;
      };

      const pushBucket = (b: Bucket, isAggregate: boolean) => {
        const codeLen = b.account_code.length;
        const total_debit = b.opening_debit + b.period_debit;
        const total_credit = b.opening_credit + b.period_credit;
        built.push({
          code: b.analytics ? `${b.account_code}/${b.analytics}` : b.account_code,
          account_code: b.account_code,
          analytics: b.analytics ?? null,
          description: b.description ?? "",
          opening_debit: b.opening_debit,
          opening_credit: b.opening_credit,
          period_debit: b.period_debit,
          period_credit: b.period_credit,
          total_debit,
          total_credit,
          balance: total_debit - total_credit,
          indent: indentFor(codeLen, !!b.analytics),
          is_aggregate: isAggregate,
          _sortKey: sortKey(b.account_code, b.analytics ?? null),
        });
      };

      for (const b of buckets.values()) {
        // For non-aggregate levels: class/two/three ARE aggregates by themselves.
        const isAggregate = level === "class" || level === "two" || level === "three";
        pushBucket(b, isAggregate);
      }
      for (const b of extra.values()) {
        pushBucket(b, true);
      }

      built.sort((a, b) => a._sortKey.localeCompare(b._sortKey));

      return built.map(({ _sortKey, ...rest }) => rest);
    },
  });
}
