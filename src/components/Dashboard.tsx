import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Table,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Columns3,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Hash,
  Type,
  Calendar,
  Zap,
  Eye,
  Download,
} from "lucide-react";
import type { CSVData, ColumnStats } from "../types";

interface DashboardProps {
  data: CSVData;
  fileName: string;
}

const COLORS = [
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#84cc16",
];

function analyzeColumn(
  rows: Record<string, string | number>[],
  header: string,
): ColumnStats {
  const values = rows.map((row) => row[header]).filter((v) => v !== undefined);
  const uniqueValues = [...new Set(values)];
  const nullCount = rows.length - values.length;

  const numericValues = values
    .filter((v): v is number => typeof v === "number" && !isNaN(v))
    .sort((a, b) => a - b);

  if (numericValues.length > 0) {
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const mean = sum / numericValues.length;
    const sortedValues = [...numericValues].sort((a, b) => a - b);
    const median =
      numericValues.length % 2 === 0
        ? (sortedValues[numericValues.length / 2 - 1] +
            sortedValues[numericValues.length / 2]) /
          2
        : sortedValues[Math.floor(numericValues.length / 2)];

    const variance =
      numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      numericValues.length;
    const stdDev = Math.sqrt(variance);

    return {
      name: header,
      type: "numeric",
      uniqueCount: uniqueValues.length,
      nullCount,
      min: numericValues[0],
      max: numericValues[numericValues.length - 1],
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
    };
  }

  const valueCounts: Record<string, number> = {};
  values.forEach((v) => {
    const str = String(v);
    valueCounts[str] = (valueCounts[str] || 0) + 1;
  });

  const topValues = Object.entries(valueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  return {
    name: header,
    type: "categorical",
    uniqueCount: uniqueValues.length,
    nullCount,
    topValues,
  };
}

function generateInsights(
  columnStats: ColumnStats[],
  totalRows: number,
): {
  type: "success" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
}[] {
  const insights: {
    type: "success" | "warning" | "info";
    icon: React.ReactNode;
    title: string;
    description: string;
  }[] = [];

  const numericCols = columnStats.filter((c) => c.type === "numeric");
  const categoricalCols = columnStats.filter((c) => c.type === "categorical");

  if (columnStats.some((c) => c.nullCount > totalRows * 0.1)) {
    const cols = columnStats.filter((c) => c.nullCount > 0);
    insights.push({
      type: "warning",
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Missing Data Detected",
      description: `${cols.length} column(s) have missing values. Consider data cleaning before analysis.`,
    });
  }

  if (numericCols.length > 0) {
    numericCols.forEach((col) => {
      if (col.stdDev && col.stdDev > Math.abs(col.mean || 0) * 2) {
        insights.push({
          type: "info",
          icon: <Activity className="w-5 h-5" />,
          title: `High Variance in ${col.name}`,
          description: `Standard deviation (${col.stdDev?.toFixed(2)}) is high relative to mean. Data is widely spread.`,
        });
      }
    });
  }

  const highCardinality = categoricalCols.filter(
    (c) => c.uniqueCount > totalRows * 0.5,
  );
  if (highCardinality.length > 0) {
    insights.push({
      type: "info",
      icon: <Hash className="w-5 h-5" />,
      title: "High Cardinality Columns",
      description: `${highCardinality.map((c) => c.name).join(", ")} have many unique values. May be IDs or free text.`,
    });
  }

  if (numericCols.length >= 2) {
    insights.push({
      type: "success",
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Correlation Analysis Available",
      description: `${numericCols.length} numeric columns detected. Scatter plots can reveal relationships.`,
    });
  }

  categoricalCols.forEach((col) => {
    if (col.topValues && col.topValues[0]) {
      const topPct = ((col.topValues[0].count / totalRows) * 100).toFixed(1);
      if (Number(topPct) > 50) {
        insights.push({
          type: "info",
          icon: <PieChartIcon className="w-5 h-5" />,
          title: `Dominant Value in ${col.name}`,
          description: `"${col.topValues[0].value}" appears in ${topPct}% of rows.`,
        });
      }
    }
  });

  if (numericCols.length > 0) {
    const positiveCols = numericCols.filter((c) => (c.min || 0) >= 0);
    insights.push({
      type: "success",
      icon: <CheckCircle className="w-5 h-5" />,
      title: "Data Quality",
      description: `${positiveCols.length} of ${numericCols.length} numeric columns have valid positive values.`,
    });
  }

  return insights.slice(0, 6);
}

export default function Dashboard({ data, fileName }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "table" | "charts" | "stats" | "insights"
  >("insights");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");
  const [chartType, setChartType] = useState<
    "bar" | "pie" | "line" | "area" | "scatter"
  >("bar");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const columnStats = useMemo(() => {
    return data.headers.map((header) => analyzeColumn(data.rows, header));
  }, [data]);

  const numericColumns = useMemo(() => {
    return columnStats
      .filter((col) => col.type === "numeric")
      .map((col) => col.name);
  }, [columnStats]);

  const categoricalColumns = useMemo(() => {
    return columnStats
      .filter((col) => col.type === "categorical")
      .map((col) => col.name);
  }, [columnStats]);

  const insights = useMemo(
    () => generateInsights(columnStats, data.rows.length),
    [columnStats, data.rows.length],
  );

  const chartData = useMemo(() => {
    if (!xAxis || !yAxis) return [];

    const aggregated: Record<string, { total: number; count: number }> = {};
    data.rows.forEach((row) => {
      const xValue = String(row[xAxis] || "Unknown");
      const yValue = Number(row[yAxis]) || 0;
      if (!aggregated[xValue]) {
        aggregated[xValue] = { total: 0, count: 0 };
      }
      aggregated[xValue].total += yValue;
      aggregated[xValue].count += 1;
    });

    return Object.entries(aggregated)
      .map(([name, { total, count }]) => ({
        name,
        value: total,
        avg: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
        count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [xAxis, yAxis, data.rows]);

  const pieData = useMemo(() => {
    if (!xAxis) return [];
    const counts: Record<string, number> = {};
    data.rows.forEach((row) => {
      const value = String(row[xAxis] || "Unknown");
      counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [xAxis, data.rows]);

  const scatterData = useMemo(() => {
    if (!xAxis || !yAxis || chartType !== "scatter") return [];
    return data.rows
      .map((row, index) => ({
        x: Number(row[xAxis]) || 0,
        y: Number(row[yAxis]) || 0,
        index,
      }))
      .filter((d) => !isNaN(d.x) && !isNaN(d.y));
  }, [xAxis, yAxis, chartType, data.rows]);

  const distributionData = useMemo(() => {
    if (!xAxis || !numericColumns.includes(xAxis)) return [];

    const values = data.rows
      .map((row) => Number(row[xAxis]))
      .filter((v) => !isNaN(v))
      .sort((a, b) => a - b);

    const min = values[0] || 0;
    const max = values[values.length - 1] || 0;
    const range = max - min;
    const bucketCount = 10;
    const bucketSize = range / bucketCount || 1;

    const buckets: { range: string; count: number; start: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const start = min + i * bucketSize;
      const end = start + bucketSize;
      buckets.push({
        range: `${start.toFixed(1)}-${end.toFixed(1)}`,
        count: 0,
        start,
      });
    }

    values.forEach((v) => {
      const bucketIndex = Math.min(
        Math.floor((v - min) / bucketSize),
        bucketCount - 1,
      );
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].count++;
      }
    });

    return buckets;
  }, [xAxis, numericColumns, data.rows]);

  const radarData = useMemo(() => {
    if (numericColumns.length < 3) return [];

    return numericColumns.slice(0, 6).map((col) => {
      const stats = columnStats.find((s) => s.name === col);
      if (!stats || !stats.max || !stats.mean)
        return { column: col, normalized: 0 };

      const values = data.rows
        .map((row) => Number(row[col]))
        .filter((v) => !isNaN(v));
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;

      return {
        column: col.length > 10 ? col.substring(0, 10) + "..." : col,
        normalized: max > 0 ? Math.round((avg / max) * 100) : 0,
        fullMark: 100,
      };
    });
  }, [numericColumns, columnStats, data.rows]);

  const autoSelectAxes = () => {
    if (categoricalColumns.length > 0) {
      setXAxis(categoricalColumns[0]);
    } else if (numericColumns.length > 0) {
      setXAxis(numericColumns[0]);
    }
    if (numericColumns.length > 0) {
      setYAxis(numericColumns[0]);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header with key metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{fileName}</h2>
          <p className="text-slate-400">
            {data.rows.length.toLocaleString()} rows x {data.headers.length}{" "}
            columns
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={autoSelectAxes}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 shadow-lg shadow-cyan-500/25"
          >
            <Zap className="w-4 h-4" />
            Auto-visualize
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Numeric Columns</p>
              <p className="text-xl font-bold text-white">
                {numericColumns.length}
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Type className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Categorical Columns</p>
              <p className="text-xl font-bold text-white">
                {categoricalColumns.length}
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Hash className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Values</p>
              <p className="text-xl font-bold text-white">
                {(data.rows.length * data.headers.length).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-xl p-4 border border-violet-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <AlertTriangle className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Missing Values</p>
              <p className="text-xl font-bold text-white">
                {columnStats
                  .reduce((sum, c) => sum + c.nullCount, 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "insights", icon: Lightbulb, label: "Insights" },
          { id: "charts", icon: BarChart3, label: "Charts" },
          { id: "table", icon: Table, label: "Data Table" },
          { id: "stats", icon: Columns3, label: "Column Stats" },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all duration-300 ${
              activeTab === id
                ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
                : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Insights Tab */}
      {activeTab === "insights" && (
        <div className="space-y-6 fade-in">
          {/* Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02] ${
                  insight.type === "success"
                    ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
                    : insight.type === "warning"
                      ? "bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20"
                      : "bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      insight.type === "success"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : insight.type === "warning"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {insight.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Radar Chart for numeric columns */}
          {radarData.length > 0 && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Column Comparison
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis
                      dataKey="column"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <PolarRadiusAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Radar
                      name="Normalized Average"
                      dataKey="normalized"
                      stroke="#06b6d4"
                      fill="#06b6d4"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Distribution overview */}
          {numericColumns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numericColumns.slice(0, 4).map((col) => {
                const stats = columnStats.find((s) => s.name === col);
                if (!stats) return null;

                const values = data.rows
                  .map((row) => Number(row[col]))
                  .filter((v) => !isNaN(v));
                const sorted = [...values].sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
                const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
                const iqr = q3 - q1;

                return (
                  <div
                    key={col}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-white">{col}</h4>
                      <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
                        Numeric
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Min</span>
                        <span className="text-white font-medium">
                          {stats.min?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max</span>
                        <span className="text-white font-medium">
                          {stats.max?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mean</span>
                        <span className="text-cyan-400 font-medium">
                          {stats.mean?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Median</span>
                        <span className="text-emerald-400 font-medium">
                          {stats.median?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Std Dev</span>
                        <span className="text-amber-400 font-medium">
                          {stats.stdDev?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IQR</span>
                        <span className="text-violet-400 font-medium">
                          {iqr.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === "charts" && (
        <div className="space-y-6 fade-in">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  X-Axis {chartType === "scatter" ? "(Numeric)" : "(Category)"}
                </label>
                <select
                  value={xAxis}
                  onChange={(e) => setXAxis(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                >
                  <option value="">Select column</option>
                  {(chartType === "scatter"
                    ? numericColumns
                    : [...categoricalColumns, ...numericColumns]
                  ).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Y-Axis (Numeric)
                </label>
                <select
                  value={yAxis}
                  onChange={(e) => setYAxis(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                >
                  <option value="">Select column</option>
                  {numericColumns.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-1">
                {[
                  { id: "bar", icon: BarChart3 },
                  { id: "pie", icon: PieChartIcon },
                  { id: "line", icon: TrendingUp },
                  { id: "area", icon: Activity },
                  { id: "scatter", icon: Eye },
                ].map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setChartType(id as typeof chartType)}
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      chartType === id
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>

            {(xAxis &&
              (chartType === "pie" || chartType === "scatter" || yAxis ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "pie" ? (
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                          outerRadius={150}
                          fill="#06b6d4"
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    ) : chartType === "scatter" ? (
                      <ScatterChart>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <XAxis
                          dataKey="x"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                        />
                        <YAxis
                          dataKey="y"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Scatter data={scatterData} fill="#06b6d4" />
                      </ScatterChart>
                    ) : chartType === "bar" ? (
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="value"
                          fill="#06b6d4"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="avg"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    ) : chartType === "area" ? (
                      <AreaChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#06b6d4"
                          fill="url(#colorGradient)"
                        />
                        <defs>
                          <linearGradient
                            id="colorGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#06b6d4"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#06b6d4"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    ) : (
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={{ fill: "#06b6d4", strokeWidth: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-slate-400">
                  Select both axes to visualize data
                </div>
              ))) || (
              <div className="h-[400px] flex items-center justify-center text-slate-400">
                Select columns to visualize data
              </div>
            )}
          </div>

          {/* Distribution Chart */}
          {xAxis &&
            numericColumns.includes(xAxis) &&
            distributionData.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Distribution of {xAxis}
                </h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <XAxis
                        dataKey="range"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                      />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Table Tab */}
      {activeTab === "table" && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-300">
                    #
                  </th>
                  {data.headers.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left font-semibold text-slate-300 whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.rows.slice(0, 100).map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedRow(selectedRow === i ? null : i)}
                    className={`cursor-pointer transition-all duration-150 ${
                      selectedRow === i ? "bg-cyan-500/20" : "hover:bg-white/5"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    {data.headers.map((header) => (
                      <td
                        key={header}
                        className="px-4 py-3 text-slate-300 whitespace-nowrap"
                      >
                        {String(row[header] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.rows.length > 100 && (
            <div className="px-4 py-3 bg-white/5 border-t border-white/10 text-sm text-slate-400">
              Showing first 100 of {data.rows.length.toLocaleString()} rows
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in">
          {columnStats.map((stat) => {
            const isNumeric = stat.type === "numeric";
            const completionRate =
              ((data.rows.length - stat.nullCount) / data.rows.length) * 100;

            return (
              <div
                key={stat.name}
                className="bg-white/5 rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white truncate">
                    {stat.name}
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      isNumeric
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {stat.type}
                  </span>
                </div>

                {/* Completion bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Data completion</span>
                    <span
                      className={
                        completionRate > 90
                          ? "text-emerald-400"
                          : completionRate > 70
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {completionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        completionRate > 90
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : completionRate > 70
                            ? "bg-gradient-to-r from-amber-500 to-orange-500"
                            : "bg-gradient-to-r from-red-500 to-rose-500"
                      }`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Unique values</span>
                    <span className="font-medium text-white">
                      {stat.uniqueCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Missing values</span>
                    <span className="font-medium text-white">
                      {stat.nullCount.toLocaleString()}
                    </span>
                  </div>

                  {isNumeric && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Min</span>
                        <span className="font-medium text-cyan-400">
                          {stat.min?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max</span>
                        <span className="font-medium text-cyan-400">
                          {stat.max?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mean</span>
                        <span className="font-medium text-emerald-400">
                          {stat.mean?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Median</span>
                        <span className="font-medium text-emerald-400">
                          {stat.median?.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}

                  {stat.type === "categorical" && stat.topValues && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-slate-400 mb-2 text-xs">Top values</p>
                      {stat.topValues
                        .slice(0, 5)
                        .map(({ value, count }, idx) => (
                          <div
                            key={value}
                            className="flex justify-between text-xs mb-1 items-center"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-1.5 h-1.5 rounded-full`}
                                style={{ backgroundColor: COLORS[idx] }}
                              />
                              <span className="text-slate-300 truncate max-w-[120px]">
                                {value}
                              </span>
                            </div>
                            <span className="text-slate-500">
                              {((count / data.rows.length) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
