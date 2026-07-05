import { useState } from "react";
import { BarChart3, Upload, RefreshCw, Sparkles } from "lucide-react";
import CSVUpload from "./components/CSVUpload";
import Dashboard from "./components/Dashboard";
import ChatBot from "./components/ChatBot";
import type { CSVData } from "./types";

function App() {
  const [data, setData] = useState<CSVData | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [showUpload, setShowUpload] = useState(true);

  const handleDataLoaded = (csvData: CSVData, name: string) => {
    setData(csvData);
    setFileName(name);
    setShowUpload(false);
  };

  const handleReset = () => {
    setData(null);
    setFileName("");
    setShowUpload(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute top-1/2 -left-40 w-96 h-96 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute -bottom-40 right-1/3 w-72 h-72 bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-40 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25">
                <BarChart3 className="w-6 h-6 text-white" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                  DataViz AI
                </h1>
                <p className="text-xs text-slate-400">
                  Intelligent Data Analytics
                </p>
              </div>
            </div>

            {data && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4" />
                New Dataset
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {showUpload && !data ? (
          <div className="py-12">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-300 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Getting Started
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Upload Your Data
              </h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Drag and drop a CSV file to get started. I'll analyze your data
                and create interactive visualizations instantly.
              </p>
            </div>
            <CSVUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : data ? (
          <Dashboard data={data} fileName={fileName} />
        ) : null}
      </main>

      {/* ChatBot */}
      <ChatBot data={data} fileName={fileName} />
    </div>
  );
}

export default App;
