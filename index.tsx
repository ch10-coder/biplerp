import React, { Component, ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AlertTriangle, RefreshCw, Trash2, Copy, Download, Upload, ShieldAlert, Activity, MonitorX, ChevronDown, ChevronUp } from 'lucide-react';

// --- GLOBAL ERROR TRAP (Non-React) ---
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Global Error Trap:", message, error);
    // Only intervene if React fails to mount completely
    const root = document.getElementById('root');
    if (root && (!root.innerHTML || root.innerHTML === '')) {
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
        
        root.innerHTML = `
            <div style="background:#09090b; color:#e4e4e7; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; padding:20px; text-align:center;">
                <div style="background:#27272a; padding:20px; border-radius:50%; margin-bottom:20px; border:1px solid #3f3f46;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <h2 style="color:#ef4444; margin:0 0 10px 0; font-size:1.5rem; font-weight:700;">Critical Startup Error</h2>
                <p style="color:#a1a1aa; margin:0 0 30px 0; max-width:400px; line-height:1.5; font-size:0.9rem;">${message}</p>
                <div style="display:flex; gap:10px;">
                    <button onclick="window.location.reload();" style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">Retry</button>
                    <button onclick="localStorage.clear(); window.location.reload();" style="background:#3f3f46; color:#ef4444; border:1px solid #ef4444; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">Factory Reset</button>
                </div>
            </div>
        `;
    }
};

// --- REACT ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  expanded: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  fileInputRef = React.createRef<HTMLInputElement>();

  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    expanded: false
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null, expanded: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleSoftReset = () => {
      window.location.reload();
  }

  handleHardReset = () => {
      if(window.confirm("⚠️ FACTORY RESET WARNING\n\nThis will DELETE ALL DATA including inventory, transactions, and settings.\n\nAre you sure you want to proceed?")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  handleExportData = () => {
      try {
          const dump: Record<string, string> = {};
          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) dump[key] = localStorage.getItem(key) || '';
          }
          
          const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `IM_Rescue_Backup_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          alert("Backup data saved to your device.");
      } catch (e) {
          alert("Failed to export data.");
      }
  }

  handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = event.target?.result as string;
              const data = JSON.parse(json);
              
              if (typeof data === 'object' && data !== null) {
                  // Basic validation: check if it looks like a dump
                  if (confirm("Restore data from backup? This will overwrite current data.")) {
                      Object.entries(data).forEach(([key, val]) => {
                          if (typeof val === 'string') localStorage.setItem(key, val);
                      });
                      alert("Restore successful. Reloading...");
                      window.location.reload();
                  }
              } else {
                  throw new Error("Invalid format");
              }
          } catch (err) {
              alert("Invalid Backup File. Must be a JSON dump.");
          }
      };
      reader.readAsText(file);
  }

  copyError = () => {
      const text = `${this.state.error?.toString()}\n\n${this.state.errorInfo?.componentStack}`;
      navigator.clipboard.writeText(text);
      alert("Error log copied to clipboard");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#09090b] text-zinc-200 flex flex-col items-center justify-center p-4 font-sans z-[9999] overflow-y-auto">
          
          {/* Ambient Glow */}
          <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-900/10 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]"></div>
          </div>

          <div className="relative z-10 w-full max-w-md animate-fadeIn">
            {/* Main Card */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
                
                {/* Header */}
                <div className="p-8 text-center border-b border-zinc-800 bg-gradient-to-b from-red-500/5 to-transparent">
                    <div className="w-16 h-16 bg-[#27272a] rounded-2xl border border-red-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                        <MonitorX size={32} className="text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">System Safe Mode</h1>
                    <p className="text-zinc-500 text-xs mt-2">
                        The application encountered a critical error.<br/>
                        Use the recovery tools below to restore functionality.
                    </p>
                </div>

                {/* Primary Action */}
                <div className="p-6 pb-2">
                    <button 
                        onClick={this.handleSoftReset} 
                        className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-3 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} /> 
                        Reload Application
                    </button>
                </div>

                {/* Recovery Grid */}
                <div className="p-6 pt-2 grid grid-cols-2 gap-3">
                    <button 
                        onClick={this.handleExportData}
                        className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-300 py-3 rounded-xl text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <Download size={16} className="text-blue-400"/>
                        <span>Backup Data</span>
                    </button>
                    
                    <button 
                        onClick={() => this.fileInputRef.current?.click()}
                        className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-300 py-3 rounded-xl text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <Upload size={16} className="text-green-400"/>
                        <span>Restore Backup</span>
                    </button>
                    
                    <button 
                        onClick={this.handleHardReset}
                        className="col-span-2 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 hover:border-red-800 text-red-400 py-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
                    >
                        <ShieldAlert size={16}/> 
                        Factory Reset (Clear Data)
                    </button>
                </div>

                {/* Technical Details Accordion */}
                <div className="border-t border-zinc-800">
                    <button 
                        onClick={() => this.setState(s => ({expanded: !s.expanded}))}
                        className="w-full flex justify-between items-center p-4 text-[10px] uppercase font-bold text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
                    >
                        <span className="flex items-center gap-2"><Activity size={12}/> Technical Details</span>
                        {this.state.expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </button>
                    
                    {this.state.expanded && (
                        <div className="p-4 pt-0 bg-zinc-900/50">
                            <div className="bg-black border border-zinc-800 rounded p-3 relative group">
                                <button 
                                    onClick={this.copyError} 
                                    className="absolute top-2 right-2 p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Copy to Clipboard"
                                >
                                    <Copy size={12}/>
                                </button>
                                <code className="text-red-400 text-[10px] font-mono block whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed">
                                    {this.state.error?.message || 'Unknown Error'}
                                    {this.state.errorInfo?.componentStack}
                                </code>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-6 text-center">
                <p className="text-[10px] text-zinc-600 font-mono">
                    InventoryMate ERP &bull; Recovery Mode
                </p>
            </div>
          </div>

          <input 
                type="file" 
                ref={this.fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={this.handleRestoreData} 
            />
        </div>
      );
    }

    return this.props.children; 
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);