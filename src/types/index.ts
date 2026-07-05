export interface CSVData {
  headers: string[];
  rows: Record<string, string | number>[];
  rawData: string[][];
}

export interface ColumnStats {
  name: string;
  type: "numeric" | "categorical" | "date" | "text";
  uniqueCount: number;
  nullCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  topValues?: { value: string; count: number }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
