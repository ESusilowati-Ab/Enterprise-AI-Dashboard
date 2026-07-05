import type { CSVData } from "../types";

function getNumericValues(
  rows: Record<string, string | number>[],
  column: string,
): number[] {
  return rows.map((row) => Number(row[column])).filter((v) => !isNaN(v));
}

function getValueCounts(
  rows: Record<string, string | number>[],
  column: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    const value = String(row[column] ?? "N/A");
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

function findColumn(query: string, headers: string[]): string | null {
  const lowerQuery = query.toLowerCase();
  for (const header of headers) {
    if (lowerQuery.includes(header.toLowerCase())) {
      return header;
    }
  }
  return null;
}

function getNumericStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  sum: number;
  stdDev: number;
} {
  if (values.length === 0)
    return { min: 0, max: 0, mean: 0, median: 0, sum: 0, stdDev: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const median =
    values.length % 2 === 0
      ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
      : sorted[Math.floor(values.length / 2)];

  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median,
    sum,
    stdDev,
  };
}

export function analyzeDataQuery(data: CSVData, query: string): string {
  const lowerQuery = query.toLowerCase();
  const { headers, rows } = data;

  // General info questions
  if (
    lowerQuery.includes("how many row") ||
    lowerQuery.includes("number of row") ||
    lowerQuery.includes("total row")
  ) {
    return `Your dataset contains **${rows.length.toLocaleString()} rows**.`;
  }

  if (
    lowerQuery.includes("how many column") ||
    lowerQuery.includes("number of column") ||
    lowerQuery.includes("total column")
  ) {
    return `Your dataset has **${headers.length} columns**: ${headers.join(", ")}.`;
  }

  if (
    lowerQuery.includes("column name") ||
    lowerQuery.includes("what are the column") ||
    lowerQuery.includes("list column") ||
    lowerQuery.includes("show column") ||
    lowerQuery.includes("column stats")
  ) {
    return `Here are all ${headers.length} columns in your dataset:\n\n${headers.map((h, i) => `${i + 1}. **${h}**`).join("\n")}`;
  }

  if (
    lowerQuery.includes("summary") ||
    lowerQuery.includes("overview") ||
    lowerQuery.includes("describe")
  ) {
    const numericCols = headers.filter((h) => {
      const values = getNumericValues(rows, h);
      return values.length > rows.length * 0.5;
    });

    let summary = `**Dataset Overview**\n\n`;
    summary += `- **Rows:** ${rows.length.toLocaleString()}\n`;
    summary += `- **Columns:** ${headers.length}\n`;
    summary += `- **Numeric columns:** ${numericCols.length > 0 ? numericCols.join(", ") : "None detected"}\n\n`;

    if (numericCols.length > 0) {
      summary += `**Quick stats for numeric columns:**\n\n`;
      numericCols.slice(0, 3).forEach((col) => {
        const values = getNumericValues(rows, col);
        const stats = getNumericStats(values);
        summary += `**${col}:** Min=${stats.min.toLocaleString()}, Max=${stats.max.toLocaleString()}, Avg=${stats.mean.toFixed(2)}\n`;
      });
    }

    return summary;
  }

  // Find a specific column mentioned in the query
  const targetColumn = findColumn(query, headers);

  if (targetColumn) {
    const numericValues = getNumericValues(rows, targetColumn);
    const isNumeric = numericValues.length > rows.length * 0.5;

    // Average/mean
    if (lowerQuery.includes("average") || lowerQuery.includes("mean")) {
      if (!isNumeric) {
        return `**${targetColumn}** appears to be a categorical column, not numeric. I can't calculate an average.\n\nTry asking for the most common values instead.`;
      }
      const stats = getNumericStats(numericValues);
      return `The **average of ${targetColumn}** is **${stats.mean.toFixed(2).toLocaleString()}** (based on ${numericValues.length.toLocaleString()} values).\n\nRange: ${stats.min.toLocaleString()} to ${stats.max.toLocaleString()}`;
    }

    // Sum
    if (lowerQuery.includes("sum") || lowerQuery.includes("total of")) {
      if (!isNumeric) {
        return `**${targetColumn}** appears to be a categorical column. I can't calculate a sum.`;
      }
      const stats = getNumericStats(numericValues);
      return `The **sum of ${targetColumn}** is **${stats.sum.toLocaleString()}** (based on ${numericValues.length.toLocaleString()} values).`;
    }

    // Min/Max
    if (
      lowerQuery.includes("minimum") ||
      lowerQuery.includes("min") ||
      lowerQuery.includes("lowest")
    ) {
      if (!isNumeric) {
        const valueCounts = getValueCounts(rows, targetColumn);
        const sorted = Object.entries(valueCounts).sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
        return `**${targetColumn}** is categorical. First value alphabetically: **${sorted[0]?.[0] || "N/A"}**`;
      }
      const stats = getNumericStats(numericValues);
      return `The **minimum of ${targetColumn}** is **${stats.min.toLocaleString()}**.`;
    }

    if (
      lowerQuery.includes("maximum") ||
      lowerQuery.includes("max") ||
      lowerQuery.includes("highest") ||
      lowerQuery.includes("largest")
    ) {
      if (!isNumeric) {
        const valueCounts = getValueCounts(rows, targetColumn);
        const sorted = Object.entries(valueCounts).sort((a, b) =>
          b[0].localeCompare(a[0]),
        );
        return `**${targetColumn}** is categorical. Last value alphabetically: **${sorted[0]?.[0] || "N/A"}**`;
      }
      const stats = getNumericStats(numericValues);
      return `The **maximum of ${targetColumn}** is **${stats.max.toLocaleString()}**.`;
    }

    // Median
    if (lowerQuery.includes("median")) {
      if (!isNumeric) {
        return `**${targetColumn}** appears to be a categorical column. I can't calculate a median.`;
      }
      const stats = getNumericStats(numericValues);
      return `The **median of ${targetColumn}** is **${stats.median.toLocaleString()}**.`;
    }

    // Top values / most common
    if (
      lowerQuery.includes("top") ||
      lowerQuery.includes("most common") ||
      lowerQuery.includes("frequency") ||
      lowerQuery.includes("distribution")
    ) {
      const valueCounts = getValueCounts(rows, targetColumn);
      const sorted = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      let response = `**Top values in ${targetColumn}:**\n\n`;
      sorted.forEach(([value, count], i) => {
        const pct = ((count / rows.length) * 100).toFixed(1);
        response += `${i + 1}. **${value}** - ${count.toLocaleString()} (${pct}%)\n`;
      });
      return response;
    }

    // Unique values
    if (lowerQuery.includes("unique") || lowerQuery.includes("distinct")) {
      const uniqueValues = new Set(rows.map((r) => String(r[targetColumn])));
      return `There are **${uniqueValues.size.toLocaleString()} unique values** in **${targetColumn}**.`;
    }

    // Null/missing values
    if (
      lowerQuery.includes("null") ||
      lowerQuery.includes("missing") ||
      lowerQuery.includes("empty")
    ) {
      const missing = rows.filter(
        (r) =>
          r[targetColumn] === undefined ||
          r[targetColumn] === "" ||
          r[targetColumn] === null,
      ).length;
      return `There are **${missing.toLocaleString()} missing values** in **${targetColumn}** (${((missing / rows.length) * 100).toFixed(1)}% of rows).`;
    }

    // Default column info
    if (isNumeric) {
      const stats = getNumericStats(numericValues);
      return `**${targetColumn}** is a numeric column.\n\n- **Type:** Numeric\n- **Values:** ${numericValues.length.toLocaleString()} / ${rows.length.toLocaleString()} rows\n- **Min:** ${stats.min.toLocaleString()}\n- **Max:** ${stats.max.toLocaleString()}\n- **Average:** ${stats.mean.toFixed(2)}\n- **Median:** ${stats.median.toLocaleString()}\n- **Std Dev:** ${stats.stdDev.toFixed(2)}`;
    } else {
      const valueCounts = getValueCounts(rows, targetColumn);
      const uniqueCount = Object.keys(valueCounts).length;
      const topValue = Object.entries(valueCounts).sort(
        (a, b) => b[1] - a[1],
      )[0];
      return `**${targetColumn}** is a categorical column.\n\n- **Type:** Categorical\n- **Unique values:** ${uniqueCount.toLocaleString()}\n- **Most common:** ${topValue?.[0] || "N/A"} (${topValue?.[1].toLocaleString()} occurrences)`;
    }
  }

  // Fallback suggestions
  return `I couldn't find a specific column matching your question. Here's what I can help with:\n\n- "What are the columns?"\n- "What is the average of [column]?"\n- "Show top values in [column]"\n- "How many rows are there?"\n- "Give me a summary"\n- "What's the data quality?"\n- "Show correlations"\n- "Any outliers?"\n\nYour columns are: ${headers.join(", ")}`;
}
