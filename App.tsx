
import React, { useState, useEffect, useRef } from 'react';
import { ViewName, AppData } from './types';
import { getAppData, getCachedData, invalidateCache } from './services/storageService';
import { supabase } from './services/supabaseClient'; // Import Client
import Login from './views/Login'; // Import Login
import Dashboard from './views/Dashboard';
import StockRegister from './views/StockRegister';
import MrnRegister from './views/MrnRegister';
import IssueRegister from './views/IssueRegister';
import TransactionForm from './views/TransactionForm';
import StockTaking from './views/StockTaking';
import Reports from './views/Reports';
import BulkImport from './views/BulkImport';
import Settings from './views/Settings';
import MasterData from './views/MasterData';
import WorkArea from './views/WorkArea';
import About from './views/About';
import { CommandPalette } from './components/CommandPalette';
import { Menu, X, LayoutDashboard, ShoppingCart, Truck, ClipboardList, BarChart3, Settings as SettingsIcon, Database, UserCircle, Info, FileSpreadsheet, ArrowUpRight, Calculator, Activity, Command, Loader2, LogOut, Search } from 'lucide-react';

const CheckIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const UploadIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const App = () => {
  const [session, setSession] = useState<any>(null); // Auth Session
  const [currentView, setCurrentView] = useState<ViewName>('DASHBOARD');
  const [data, setData] = useState<AppData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  // Tracks when we last triggered a write so Realtime doesn't re-download our own changes
  const lastWriteTimestampRef = useRef<number>(0);

  // --- Auth Check ---
  useEffect(() => {
      if (supabase) {
          supabase.auth.getSession().then(({ data: { session } }) => {
              setSession(session);
          });

          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
              setSession(session);
          });

          return () => subscription.unsubscribe();
      }
  }, []);

  const refreshData = async (forceRefresh = false) => {
    const newData = await getAppData(forceRefresh);
    setData(newData); 
  };

  // --- Data & Realtime & Visibility ---
  useEffect(() => {
      if (session) {
          refreshData();

          // 1. Realtime Listener — only triggers re-fetch for EXTERNAL changes
          //    Skips if this browser just made a write in the last 3 seconds
          let channel: any = null;
          if (supabase) {
              channel = supabase.channel('public:db_changes')
              .on(
                  'postgres_changes',
                  { event: '*', schema: 'public' }, 
                  (_payload) => {
                      const timeSinceWrite = Date.now() - lastWriteTimestampRef.current;
                      if (timeSinceWrite < 3000) {
                          // This is our OWN write echoed back — skip the re-fetch
                          console.log('[Realtime] Own write detected, skipping re-fetch to save egress.');
                          return;
                      }
                      // External change from another device/user — force refresh
                      console.log('[Realtime] External change detected, refreshing...');
                      invalidateCache();
                      refreshData(true);
                  }
              )
              .subscribe();
          }

          // 2. Visibility Listener — only re-fetches if data is older than 5 minutes
          const STALE_THRESHOLD_MS = 5 * 60 * 1000;
          const handleVisibilityChange = () => {
              if (document.visibilityState === 'visible') {
                  const cached = getCachedData();
                  if (!cached) {
                      // No cache at all — fetch fresh
                      console.log('[Visibility] No cache, fetching...');
                      refreshData(true);
                  } else {
                      console.log('[Visibility] Cache still fresh, skipping DB fetch.');
                  }
              }
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);

          return () => { 
              if (channel && supabase) supabase.removeChannel(channel); 
              document.removeEventListener('visibilitychange', handleVisibilityChange);
          };
      }
  }, [session]);

  // Theme Sync
  useEffect(() => {
      if (data?.appSettings?.theme) {
          const theme = data.appSettings.theme;
          document.documentElement.setAttribute('data-theme', theme);
          document.body.setAttribute('data-theme', theme);
          
          // Toggle 'dark' class for Tailwind dark mode modifiers
          if (theme === 'light') {
              document.documentElement.classList.remove('dark');
          } else {
              document.documentElement.classList.add('dark');
          }
      }
  }, [data?.appSettings?.theme]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault();
              setIsCmdOpen(prev => !prev);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNav = (view: ViewName) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
      if(supabase) await supabase.auth.signOut();
      setSession(null);
      setData(null);
  };

  const NavItem = ({ view, label, icon }: { view: ViewName; label: string; icon?: React.ReactNode }) => {
    const isActive = currentView === view;
    return (
        <button
        onClick={() => handleNav(view)}
        className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-all flex items-center gap-3 font-medium text-sm border border-transparent active:scale-95 duration-200 relative overflow-hidden group
            ${isActive 
            ? 'bg-[var(--accent)]/10 text-[var(--accent)] shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
            }`}
        >
        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)] rounded-r"></div>}
        <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        <span>{label}</span>
        </button>
    );
  };

  if (!session) {
      return <Login onLoginSuccess={() => refreshData()} />;
  }

  if (!data) {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-main)] text-[var(--text-primary)]">
              <Loader2 className="animate-spin text-[var(--accent)] mb-4" size={48} />
              <h2 className="text-xl font-bold">Syncing with Cloud...</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">Downloading latest inventory data</p>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 w-full flex flex-col font-sans overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300">
      
      {/* Global Header */}
      <div className="bg-[var(--bg-main)]/80 backdrop-blur-md border-b border-[var(--border-color)] p-4 flex justify-between items-center shrink-0 z-30 h-16 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="text-[var(--text-secondary)] focus:outline-none p-1 rounded hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
                <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)] flex items-center gap-3 tracking-tight cursor-default">
                <div className="w-8 h-8 bg-gradient-to-br from-[var(--accent)] to-purple-600 rounded-lg flex items-center justify-center text-white text-xs shadow-lg shadow-[var(--accent)]/20 font-mono">
                    {data.appSettings?.appName?.slice(0,2).toUpperCase() || 'IM'}
                </div>
                <span className="hidden md:inline">{data.appSettings?.appName || 'InventoryMate'}</span>
                <span className="md:hidden">ERP</span>
            </h1>
        </div>

        {/* Global Action Search Bar */}
        <div className="hidden md:block flex-1 max-w-xl mx-4 relative group">
            <div 
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-full pl-10 pr-4 py-2 text-sm text-[var(--text-secondary)] flex justify-between items-center cursor-pointer hover:border-[var(--accent)] transition-all shadow-sm group-hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                onClick={() => setIsCmdOpen(true)}
            >
                <div className="flex items-center gap-2">
                    <Search size={14} />
                    <span>Search or jump to...</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-1.5 py-0.5">
                    <Command size={10} /> + K
                </div>
            </div>
        </div>

        <div className="flex items-center gap-4">
             {data.lastAction && (
                <div className="hidden lg:flex flex-col items-end text-[10px] text-[var(--text-secondary)] border-r border-[var(--border-color)] pr-4 mr-1">
                    <div className="flex items-center gap-1">
                        <Activity size={10} className="text-[var(--accent)]"/>
                        Last: {data.lastAction.type}
                    </div>
                    <span className="opacity-70 max-w-[100px] truncate">{data.lastAction.description}</span>
                </div>
             )}
             <div className="hidden md:flex flex-col items-end">
                 <span className="text-xs font-bold text-[var(--text-primary)]">{data.appSettings?.companyName || 'Enterprise'}</span>
                 <span className="text-[10px] text-[var(--text-secondary)] font-mono">{session.user.email}</span>
             </div>
             <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all cursor-pointer" title="Logout">
                <LogOut size={16} />
             </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
          <aside className={`
            fixed inset-y-0 left-0 w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) z-50 flex flex-col h-full shadow-2xl backdrop-blur-xl
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="p-4 flex justify-between items-center border-b border-[var(--border-color)] bg-[var(--bg-main)]/50">
              <span className="font-bold text-[var(--text-primary)]">Menu</span>
              <button onClick={() => setIsSidebarOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-card)]">
                <X size={20} />
              </button>
            </div>

            <nav className="px-3 py-4 flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
              <div className="px-4 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-70">Main</div>
              <NavItem view="DASHBOARD" label="Dashboard" icon={<LayoutDashboard size={18} />} />
              
              <div className="h-4"></div>
              <div className="px-4 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-70">Operations</div>
              <NavItem view="PURCHASE" label="Bill Entry" icon={<Truck size={18} />} />
              <NavItem view="ISSUE" label="Issue Material" icon={<ShoppingCart size={18} />} />
              <NavItem view="STOCK_TAKING" label="Stock Taking" icon={<CheckIcon size={18} />} />
              
              <div className="h-4"></div>
              <div className="px-4 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-70">Registers</div>
              <NavItem view="STOCK_REGISTER" label="Stock Register" icon={<ClipboardList size={18} />} />
              <NavItem view="MRN_REGISTER" label="MRN History" icon={<FileSpreadsheet size={18} />} />
              <NavItem view="ISSUE_REGISTER" label="Issue History" icon={<ArrowUpRight size={18} />} />
              <NavItem view="REPORTS" label="Reports" icon={<BarChart3 size={18} />} />
              
              <div className="h-4"></div>
              <div className="px-4 py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-70">System</div>
              <NavItem view="WORK_AREA" label="Workbench" icon={<Calculator size={18} />} />
              <NavItem view="MASTER_DATA" label="Master Data" icon={<Database size={18} />} />
              <NavItem view="BULK_IMPORT" label="Bulk Import" icon={<UploadIcon size={18} />} />
              <NavItem view="SETTINGS" label="Settings" icon={<SettingsIcon size={18} />} />
              <NavItem view="ABOUT" label="System Info" icon={<Info size={18} />} />
            </nav>

            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-main)]/30 backdrop-blur-sm">
                <div className="text-[10px] text-[var(--text-secondary)] text-center font-mono">
                    Cloud Connected • {data.appSettings?.theme === 'light' ? 'Light' : data.appSettings?.theme === 'midnight' ? 'Midnight' : data.appSettings?.theme === 'forest' ? 'Forest' : 'Cosmic'} Build
                </div>
            </div>
          </aside>

          <main className="flex-1 relative bg-[var(--bg-main)] overflow-hidden">
            <div className="absolute inset-0 overflow-hidden flex flex-col">
              {currentView === 'DASHBOARD' && <Dashboard data={data} onViewChange={handleNav} />}
              {currentView === 'PURCHASE' && <TransactionForm key="PURCHASE" type="PURCHASE" materials={data.materials} settings={data.appSettings} onComplete={refreshData} />}
              {currentView === 'ISSUE' && <TransactionForm key="ISSUE" type="ISSUE" materials={data.materials} settings={data.appSettings} onComplete={refreshData} />}
              {currentView === 'STOCK_REGISTER' && <StockRegister data={data} onUpdate={refreshData} />}
              {currentView === 'MRN_REGISTER' && <MrnRegister data={data} onUpdate={refreshData} />}
              {currentView === 'ISSUE_REGISTER' && <IssueRegister data={data} onUpdate={refreshData} />}
              {currentView === 'STOCK_TAKING' && <StockTaking data={data} onUpdate={refreshData} />}
              {currentView === 'REPORTS' && <Reports data={data} onUpdate={refreshData} />}
              {currentView === 'WORK_AREA' && <WorkArea />}
              {currentView === 'MASTER_DATA' && <MasterData data={data} onUpdate={refreshData} />}
              {currentView === 'BULK_IMPORT' && <BulkImport onComplete={async () => { await refreshData(); handleNav('DASHBOARD'); }} />}
              {currentView === 'SETTINGS' && <Settings data={data} onRestore={refreshData} />}
              {currentView === 'ABOUT' && <About />}
            </div>
          </main>
      </div>
      
      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} onNavigate={handleNav} />

      <button
        onClick={() => setIsCmdOpen(true)}
        className="md:hidden fixed bottom-6 right-6 w-12 h-12 bg-gradient-to-br from-[var(--accent)] to-purple-600 text-white rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center justify-center z-50 active:scale-90 transition-transform border border-white/20 backdrop-blur-md"
        aria-label="Open Actions"
      >
        <Command size={20} />
      </button>
    </div>
  );
};

export default App;
