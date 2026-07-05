import { useCallback } from "react";
import { Upload, FileSpreadsheet, Database } from "lucide-react";
import Papa from "papaparse";
import type { CSVData } from "../types";

interface CSVUploadProps {
  onDataLoaded: (data: CSVData, fileName: string) => void;
}

export default function CSVUpload({ onDataLoaded }: CSVUploadProps) {
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [],
  );

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      alert("Please upload a CSV file");
      return;
    }

    Papa.parse(file, {
      complete: (results) => {
        const rawData = results.data as string[][];
        const headers = rawData[0];
        const rows = rawData.slice(1).map((row) => {
          const obj: Record<string, string | number> = {};
          headers.forEach((header, index) => {
            const value = row[index];
            const numValue = Number(value);
            obj[header] = isNaN(numValue) ? value : numValue;
          });
          return obj;
        });

        onDataLoaded(
          {
            headers,
            rows: rows.filter((row) =>
              Object.values(row).some((v) => v !== undefined && v !== ""),
            ),
            rawData,
          },
          file.name,
        );
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        alert("Error parsing CSV file");
      },
    });
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <label className="group relative flex flex-col items-center justify-center w-full h-72 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden">
        {/* Gradient border effect */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ padding: "2px" }}
        >
          <div className="absolute inset-[2px] bg-slate-900 rounded-2xl" />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-2xl transition-all duration-300 bg-white/5 hover:bg-white/10 border-white/20 hover:border-cyan-500/50">
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-all duration-300 group-hover:scale-110">
            <Upload className="w-10 h-10 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          </div>
          <p className="mb-2 text-xl font-semibold text-white group-hover:text-cyan-100 transition-colors">
            Drop your CSV file here
          </p>
          <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
            or click to browse
          </p>
          <div className="flex items-center gap-2 mt-6 px-4 py-2 bg-white/5 rounded-full text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Supports .csv files</span>
          </div>
        </div>

        <input
          type="file"
          className="hidden"
          accept=".csv"
          onChange={handleFileInput}
        />
      </label>

      {/* Sample data hint */}
      <div className="mt-6 text-center">
        <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
          <Database className="w-4 h-4" />
          Your data is processed locally and never leaves your browser
        </p>
      </div>
    </div>
  );
}
