import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  BarChart2,
  Hash,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import type { CSVData, ChatMessage, ColumnStats } from "../types";
import { analyzeDataQuery } from "../utils/dataAnalyzer";

interface ChatBotProps {
  data: CSVData | null;
  fileName: string;
}

function analyzeColumnQuick(
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

function generateContextualResponse(
  data: CSVData,
  columnStats: ColumnStats[],
  query: string,
): string {
  const lowerQuery = query.toLowerCase();
  const { headers, rows } = data;

  // Correlation analysis
  if (
    lowerQuery.includes("correlation") ||
    lowerQuery.includes("relationship") ||
    lowerQuery.includes("relate")
  ) {
    const numericCols = columnStats.filter((c) => c.type === "numeric");
    if (numericCols.length < 2) {
      return "Need at least 2 numeric columns to analyze correlations. Your dataset has fewer.";
    }
    return `I can help analyze correlations between ${numericCols.map((c) => c.name).join(", ")}. In the Charts tab, select two numeric columns and use the Scatter chart type to visualize relationships.`;
  }

  // Outlier detection
  if (
    lowerQuery.includes("outlier") ||
    lowerQuery.includes("anomaly") ||
    lowerQuery.includes("unusual")
  ) {
    const numericCols = columnStats.filter(
      (c) => c.type === "numeric" && c.stdDev !== undefined,
    );
    const potentialOutliers = numericCols.filter((c) => {
      if (!c.stdDev || !c.mean) return false;
      const range = (c.max || 0) - (c.min || 0);
      return c.stdDev > range * 0.3;
    });

    if (potentialOutliers.length > 0) {
      return `Potential outliers detected in: ${potentialOutliers.map((c) => c.name).join(", ")}. These columns have high standard deviation relative to their range, suggesting possible outliers. Check the Insights tab for more details.`;
    }
    return "No obvious outlier patterns detected. All numeric columns have relatively normal distributions.";
  }

  // Missing data analysis
  if (
    lowerQuery.includes("missing") ||
    lowerQuery.includes("null") ||
    lowerQuery.includes("empty") ||
    lowerQuery.includes("incomplete")
  ) {
    const missingCols = columnStats.filter((c) => c.nullCount > 0);
    if (missingCols.length === 0) {
      return "Great news! Your dataset has no missing values. All columns are 100% complete.";
    }
    const details = missingCols
      .map((c) => {
        const pct = ((c.nullCount / rows.length) * 100).toFixed(1);
        return `**${c.name}**: ${c.nullCount.toLocaleString()} missing (${pct}%)`;
      })
      .join("\n");
    return `Found missing values in ${missingCols.length} column(s):\n\n${details}\n\nConsider data cleaning strategies like imputation or removing incomplete rows.`;
  }

  // Data quality
  if (
    lowerQuery.includes("quality") ||
    lowerQuery.includes("clean") ||
    lowerQuery.includes("dirty")
  ) {
    const issues: string[] = [];

    const highMissing = columnStats.filter(
      (c) => c.nullCount > rows.length * 0.1,
    );
    if (highMissing.length > 0)
      issues.push(`${highMissing.length} column(s) with >10% missing data`);

    const highCardinality = columnStats.filter(
      (c) => c.type === "categorical" && c.uniqueCount > rows.length * 0.5,
    );
    if (highCardinality.length > 0)
      issues.push(`${highCardinality.length} column(s) with high cardinality`);

    const numericCols = columnStats.filter((c) => c.type === "numeric");
    const potentialOutliers = numericCols.filter(
      (c) =>
        c.stdDev &&
        c.mean &&
        (c.max || 0) - (c.min || 0) > 0 &&
        c.stdDev > ((c.max || 0) - (c.min || 0)) * 0.3,
    );
    if (potentialOutliers.length > 0)
      issues.push(
        `${potentialOutliers.length} column(s) with potential outliers`,
      );

    if (issues.length === 0)
      return "Your dataset looks clean with no major quality issues detected.";
    return `**Data Quality Report**\n\nDetected issues:\n${issues.map((i) => `- ${i}`).join("\n")}\n\nRecommend reviewing the Insights tab for detailed analysis.`;
  }

  // Recommendation
  if (
    lowerQuery.includes("recommend") ||
    lowerQuery.includes("suggest") ||
    lowerQuery.includes("what should i") ||
    lowerQuery.includes("help me")
  ) {
    const numericCols = columnStats.filter((c) => c.type === "numeric");
    const categoricalCols = columnStats.filter((c) => c.type === "categorical");

    const suggestions: string[] = [];

    if (numericCols.length >= 2) {
      suggestions.push(
        `- Explore correlations using Scatter charts between ${numericCols[0].name} and ${numericCols[1].name}`,
      );
    }
    if (categoricalCols.length > 0 && numericCols.length > 0) {
      suggestions.push(
        `- Compare ${numericCols[0].name} across ${categoricalCols[0].name} using Bar charts`,
      );
    }
    if (categoricalCols.length > 0) {
      const dominant = categoricalCols.find(
        (c) =>
          c.topValues &&
          c.topValues[0] &&
          c.topValues[0].count / rows.length > 0.5,
      );
      if (dominant) {
        suggestions.push(
          `- Investigate why "${dominant.topValues![0].value}" dominates ${dominant.name}`,
        );
      }
    }

    return `**Suggested Analysis**\n\nBased on your data, here's what you might explore:\n${suggestions.join("\n")}\n\nWould you like me to explain any of these in more detail?`;
  }

  // Trend analysis
  if (
    lowerQuery.includes("trend") ||
    lowerQuery.includes("pattern") ||
    lowerQuery.includes("over time")
  ) {
    const numericCols = columnStats.filter((c) => c.type === "numeric");
    if (numericCols.length === 0)
      return "No numeric columns found for trend analysis.";

    const trends = numericCols.slice(0, 3).map((c) => {
      const firstHalf = rows.slice(0, Math.floor(rows.length / 2));
      const secondHalf = rows.slice(Math.floor(rows.length / 2));

      const firstAvg =
        firstHalf.reduce((sum, r) => sum + (Number(r[c.name]) || 0), 0) /
        firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, r) => sum + (Number(r[c.name]) || 0), 0) /
        secondHalf.length;

      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      const direction =
        change > 5
          ? ":chart_with_upwards_trend:"
          : change < -5
            ? ":chart_with_downwards_trends:"
            : "";

      return `**${c.name}**: ${change > 0 ? "+" : ""}${change.toFixed(1)}% change ${direction}`;
    });

    return `**Trend Analysis**\n\nComparing first and second half of data:\n\n${trends.join("\n")}\n\nUse Line or Area charts to visualize these patterns.`;
  }

  // Compare columns
  if (
    lowerQuery.includes("compare") ||
    lowerQuery.includes("versus") ||
    lowerQuery.includes(" vs ") ||
    lowerQuery.includes("difference between")
  ) {
    const numericCols = columnStats.filter((c) => c.type === "numeric");
    if (numericCols.length < 2) {
      return "Need at least 2 numeric columns for comparison. Try asking about specific columns instead.";
    }

    const comparison = numericCols
      .slice(0, 3)
      .map(
        (c) =>
          `**${c.name}**: Avg=${c.mean?.toLocaleString()}, Range=${c.min?.toLocaleString()}-${c.max?.toLocaleString()}`,
      )
      .join("\n");

    return `**Column Comparison**\n\n${comparison}\n\nUse the Charts tab with Bar or Radar visualizations for detailed comparison.`;
  }

  return ""; // Empty string means fall back to default analyzer
}

export default function ChatBot({ data, fileName }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const columnStatsRef = useRef<ColumnStats[]>([]);

  useEffect(() => {
    if (data) {
      columnStatsRef.current = data.headers.map((h) =>
        analyzeColumnQuick(data.rows, h),
      );
    }
  }, [data]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (data && messages.length === 0) {
      const numericCols = columnStatsRef.current.filter(
        (c) => c.type === "numeric",
      );
      const categoricalCols = columnStatsRef.current.filter(
        (c) => c.type === "categorical",
      );

      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Hello! I've analyzed **"${fileName}"** with ${data.rows.length.toLocaleString()} rows and ${data.headers.length} columns.\n\n**Quick Overview:**\n- ${numericCols.length} numeric columns\n- ${categoricalCols.length} categorical columns\n- ${columnStatsRef.current.filter((c) => c.nullCount > 0).length} columns with missing values\n\n**Try asking:**\n- "What's the data quality?"\n- "Show correlations"\n- "Any outliers?"\n- "Compare columns"\n- "What do you recommend?"`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [data, fileName, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !data) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 800),
    );

    // Try contextual response first
    let response = generateContextualResponse(
      data,
      columnStatsRef.current,
      userMessage.content,
    );

    // Fall back to default analyzer
    if (!response) {
      response = analyzeDataQuery(data, userMessage.content);
    }

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const quickActions = [
    { label: "Data quality", icon: AlertCircle },
    { label: "Recommendations", icon: Sparkles },
    { label: "Show patterns", icon: TrendingUp },
    { label: "Column stats", icon: BarChart2 },
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all duration-300 z-50 group ${
          isOpen
            ? "bg-slate-800 text-white rotate-0"
            : "bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white hover:scale-110"
        }`}
        style={{
          boxShadow: isOpen
            ? "0 10px 40px rgba(0,0,0,0.3)"
            : "0 10px 40px rgba(6,182,212,0.4)",
        }}
      >
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse border-2 border-white" />
        )}
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-white opacity-80" />
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[420px] h-[550px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-violet-500/20 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-lg shadow-cyan-500/25">
                <Bot className="w-5 h-5 text-white" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-sm">
                  Data Assistant
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {data ? `${fileName} loaded` : "No data loaded"}
                </p>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${data ? "bg-emerald-400" : "bg-slate-500"}`}
              />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 slide-up ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                      : "bg-slate-700"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div className="max-w-[80%]">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-tr-sm"
                        : "bg-slate-700/50 text-slate-200 rounded-tl-sm border border-white/5"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === "user"
                        ? "text-right text-slate-500"
                        : "text-slate-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="bg-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5">
                  <div className="flex gap-1.5">
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {data && messages.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickActions.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setInput(label);
                      setTimeout(() => {
                        const form = document.querySelector("form");
                        if (form) {
                          form.dispatchEvent(
                            new Event("submit", {
                              bubbles: true,
                              cancelable: true,
                            }),
                          );
                        }
                      }, 50);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-full text-xs text-slate-300 hover:text-white transition-colors whitespace-nowrap border border-white/5"
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/10 bg-slate-800/50"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  data ? "Ask about your data..." : "Upload data first..."
                }
                disabled={!data}
                className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:bg-slate-800 disabled:text-slate-500 text-sm text-white placeholder-slate-400 transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || !data}
                className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-cyan-500/25 disabled:shadow-none"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
