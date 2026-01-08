import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/formatting";

const data = [
  { month: "Jan", prodaja: 2400000, nabavka: 1800000 },
  { month: "Feb", prodaja: 1980000, nabavka: 1600000 },
  { month: "Mar", prodaja: 2800000, nabavka: 2100000 },
  { month: "Apr", prodaja: 2780000, nabavka: 2000000 },
  { month: "Maj", prodaja: 3200000, nabavka: 2400000 },
  { month: "Jun", prodaja: 2890000, nabavka: 2200000 },
  { month: "Jul", prodaja: 3490000, nabavka: 2600000 },
  { month: "Avg", prodaja: 3200000, nabavka: 2500000 },
  { month: "Sep", prodaja: 3800000, nabavka: 2900000 },
  { month: "Okt", prodaja: 4100000, nabavka: 3100000 },
  { month: "Nov", prodaja: 3600000, nabavka: 2800000 },
  { month: "Dec", prodaja: 4200000, nabavka: 3200000 },
];

const formatValue = (value: number) => {
  if (value >= 1000000) {
    return `${formatNumber(value / 1000000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  }
  return `${formatNumber(value / 1000, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;
};

export function SalesChart() {
  return (
    <div className="erp-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">
          Pregled prodaje i nabavke
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Prodaja</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-sm text-muted-foreground">Nabavka</span>
          </div>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorProdaja" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(213, 50%, 25%)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(213, 50%, 25%)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="colorNabavka" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(25, 95%, 53%)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(25, 95%, 53%)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(214, 20%, 88%)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 15%, 45%)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 15%, 45%)", fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(214, 20%, 88%)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
              formatter={(value: number) => [
                `${formatNumber(value / 1000, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} K RSD`,
              ]}
            />
            <Area
              type="monotone"
              dataKey="prodaja"
              stroke="hsl(213, 50%, 25%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorProdaja)"
            />
            <Area
              type="monotone"
              dataKey="nabavka"
              stroke="hsl(25, 95%, 53%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorNabavka)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
