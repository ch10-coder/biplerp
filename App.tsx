import React, { useState, useEffect, useRef } from 'react';
import { ViewName, AppData } from './types';
import { getAppData, getCachedData, invalidateCache, updateAppSettings } from './services/storageService';
import { supabase } from './services/supabaseClient';
import Login from './views/Login';
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
import { 
  LayoutDashboard, ShoppingCart, Truck, ClipboardList, BarChart3, 
  Settings as SettingsIcon, Database, Info, FileSpreadsheet, ArrowUpRight, 
  Calculator, Activity, Command, Loader2, LogOut, Search, ChevronLeft, 
  ChevronRight, Sparkles, Moon, Sun, Trees, Zap, Grid, X, CheckSquare, 
  UploadCloud, CheckCircle2 
} from 'lucide-react';

const VIEW_TITLES: Record<ViewName, string> = {
  DASHBOARD: 'Dashboard Overview',
  PURCHASE: 'Inward Bill Entry',
  ISSUE: 'Material Issuance',
  STOCK_REGISTER: 'Live Stock Register',
  MRN_REGISTER: 'MRN & Purchase History',
  ISSUE_REGISTER: 'Material Issue History',
  STOCK_TAKING: 'Physical Stock Audit',
  REPORTS: 'Reports & Analytics',
  WORK_AREA: 'Workbench & Calculator',
  MASTER_DATA: 'Master Data Directory',
  BULK_IMPORT: 'Bulk CSV Import',
  SETTINGS: 'Configuration & Themes',
  ABOUT: 'System Information',
};

const THEMES = [
  { id: 'default', label: 'Cosmic Dark', icon: Moon },
  { id: 'midnight', label: 'Midnight Neon', icon: Zap },
  { id: 'forest', label: 'Forest Emerald', icon: Trees },
  { id: 'light', label: 'Classic SaaS', icon: Sun },
] as const;

const MOCK_LOCAL_SESSION = { user: { email: 'admin@local.test', id: 'local-test-admin' } };

const App = () => {
  // Auto-detect if user wants bypass or is on local dev preview
  const [session, setSession] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('erp_bypass_auth') === 'true') {
        return MOCK_LOCAL_SESSION;
      }
      // Auto-bypass on localhost / 127.0.0.1 for instant local preview
      if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
          localStorage.getItem('erp_auth_explicit_logout') !== 'true') {
        return MOCK_LOCAL_SESSION;
      }
    }
    return null;
  });

  const [currentView, setCurrentView] = useState<ViewName>('DASHBOARD');
  const [data, setData] = useState<AppData | null>(null);
  
  // Navigation states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('erp_sidebar_collapsed') === 'true';
  });
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  
  const lastWriteTimestampRef = useRef<number>(0);

  // Toggle and save desktop sidebar collapsed state
  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('erp_sidebar_collapsed', String(next));
      return next;
    });
  };

  // --- Auth Check ---
  useEffect(() => {
    const isBypassActive = localStorage.getItem('erp_bypass_auth') === 'true' || 
      ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
       localStorage.getItem('erp_auth_explicit_logout') !== 'true');

    if (isBypassActive) {
      if (!session) setSession(MOCK_LOCAL_SESSION);
      return;
    }

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setSession(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) setSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const refreshData = async (forceRefresh = false) => {
    const newData = await getAppData(forceRefresh);
    setData(newData); 
  };

  // --- Data & Realtime Sync ---
  useEffect(() => {
    if (session) {
      refreshData();

      let channel: any = null;
      if (supabase) {
        channel = supabase.channel('public:db_changes')
          .on('postgres_changes', { event: '*', schema: 'public' }, (_payload) => {
            const timeSinceWrite = Date.now() - lastWriteTimestampRef.current;
            if (timeSinceWrite < 3000) return;
            invalidateCache();
            refreshData(true);
          })
          .subscribe();
      }

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const cached = getCachedData();
          if (!cached) refreshData(true);
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
      
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  }, [data?.appSettings?.theme]);

  // Keyboard Shortcuts (Ctrl/Cmd + K)
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
    setIsMobileMoreOpen(false);
  };

  const handleLogout = async () => {
    localStorage.removeItem('erp_bypass_auth');
    localStorage.setItem('erp_auth_explicit_logout', 'true');
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (_) {}
    }
    setSession(null);
    setData(null);
  };

  const cycleTheme = async () => {
    if (!data) return;
    const currentTheme = data.appSettings?.theme || 'default';
    const currentIndex = THEMES.findIndex(t => t.id === currentTheme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length].id;
    
    const updatedSettings = { ...data.appSettings, theme: nextTheme };
    setData({ ...data, appSettings: updatedSettings });
    await updateAppSettings(updatedSettings);
  };

  // Nav Item component for Desktop Sidebar
  const DesktopNavItem = ({ 
    view, 
    label, 
    icon, 
    badge 
  }: { 
    view: ViewName; 
    label: string; 
    icon: React.ReactNode; 
    badge?: string | number 
  }) => {
    const isActive = currentView === view;
    return (
      <button
        type="button"
        onClick={() => handleNav(view)}
        title={isSidebarCollapsed ? label : undefined}
        className={`w-full group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold select-none cursor-pointer ${
          isActive 
            ? 'bg-[var(--accent)] text-white shadow-[0_4px_16px_var(--accent-glow)]' 
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
        } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
      >
        <div className={`shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
          {icon}
        </div>
        
        {!isSidebarCollapsed && (
          <>
            <span className="truncate flex-1 text-left">{label}</span>
            {badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]'
              }`}>
                {badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  if (!session) {
    return (
      <Login 
        onLoginSuccess={() => {
          setSession(MOCK_LOCAL_SESSION);
          refreshData();
        }} 
      />
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-main)] text-[var(--text-primary)]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-4 border border-[var(--border-color)]">
          <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Synchronizing Inventory</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 font-mono">Fetching catalog & transactions from cloud...</p>
      </div>
    );
  }

  const currentThemeObj = THEMES.find(t => t.id === (data.appSettings?.theme || 'default')) || THEMES[0];
  const ThemeIcon = currentThemeObj.icon;

  return (
    <div className="fixed inset-0 w-full flex flex-col font-sans overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300">
      
      {/* ================= GLOBAL TOP HEADER ================= */}
      <header className="bg-[var(--bg-sidebar)]/80 backdrop-blur-xl border-b border-[var(--border-color)] px-4 sm:px-6 flex justify-between items-center shrink-0 z-30 h-16 shadow-sm">
        
        {/* Left: Brand & Page Context */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-white text-xs font-mono font-bold shadow-md shadow-[var(--accent)]/20 shrink-0">
            {data.appSettings?.appName?.slice(0, 2).toUpperCase() || 'IM'}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[var(--text-primary)]">
                {data.appSettings?.appName || 'InventoryMate'}
              </span>
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full font-mono bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                v2.9
              </span>
              {session.user?.email === 'admin@local.test' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                  LOCAL TEST
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--text-secondary)] font-medium truncate max-w-[180px] sm:max-w-xs">
              {VIEW_TITLES[currentView] || 'ERP Workspace'}
            </span>
          </div>
        </div>

        {/* Center: Global Search Bar trigger (Desktop & Tablet) */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <button
            type="button"
            onClick={() => setIsCmdOpen(true)}
            className="w-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-[var(--accent)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-secondary)] flex justify-between items-center transition-all duration-200 shadow-sm group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
              <span>Search inventory or jump to module...</span>
            </div>
            <kbd className="flex items-center gap-0.5 text-[10px] bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-1.5 py-0.5 font-mono text-[var(--text-secondary)]">
              <Command size={10} /> K
            </kbd>
          </button>
        </div>

        {/* Right: Actions, Theme Toggle, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Mobile search trigger */}
          <button
            type="button"
            onClick={() => setIsCmdOpen(true)}
            className="md:hidden p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Search"
          >
            <Search size={16} />
          </button>

          {/* Quick Theme Switcher Button */}
          <button
            type="button"
            onClick={cycleTheme}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-[var(--accent)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-all cursor-pointer"
            title={`Current: ${currentThemeObj.label}. Click to cycle theme`}
          >
            <ThemeIcon size={16} className="text-[var(--accent)]" />
            <span className="hidden xl:inline text-xs font-semibold">{currentThemeObj.label}</span>
          </button>

          {/* User profile & Company info */}
          <div className="hidden sm:flex flex-col items-end pl-2 border-l border-[var(--border-color)]">
            <span className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate max-w-[120px]">
              {data.appSettings?.companyName || 'Store'}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono leading-tight truncate max-w-[120px]">
              {session?.user?.email?.split('@')[0]}
            </span>
          </div>

          {/* Logout */}
          <button 
            type="button"
            onClick={handleLogout} 
            className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-rose-500/10 border border-[var(--border-color)] hover:border-rose-500/30 text-[var(--text-secondary)] hover:text-rose-400 transition-all cursor-pointer" 
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* ================= DESKTOP SIDEBAR (md & above) ================= */}
        <aside 
          className={`hidden md:flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] transition-all duration-300 relative z-20 shrink-0 ${
            isSidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            
            {/* Group: Core */}
            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-60">
                  Overview
                </div>
              )}
              <div className="space-y-1">
                <DesktopNavItem view="DASHBOARD" label="Dashboard" icon={<LayoutDashboard size={18} />} />
              </div>
            </div>

            {/* Group: Operations */}
            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-60">
                  Operations
                </div>
              )}
              <div className="space-y-1">
                <DesktopNavItem view="PURCHASE" label="Bill Inward" icon={<Truck size={18} />} />
                <DesktopNavItem view="ISSUE" label="Issue Material" icon={<ShoppingCart size={18} />} />
                <DesktopNavItem view="STOCK_TAKING" label="Physical Audit" icon={<CheckCircle2 size={18} />} />
              </div>
            </div>

            {/* Group: Registers */}
            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-60">
                  Registers
                </div>
              )}
              <div className="space-y-1">
                <DesktopNavItem 
                  view="STOCK_REGISTER" 
                  label="Stock Register" 
                  icon={<ClipboardList size={18} />} 
                  badge={data.materials.length} 
                />
                <DesktopNavItem view="MRN_REGISTER" label="MRN History" icon={<FileSpreadsheet size={18} />} />
                <DesktopNavItem view="ISSUE_REGISTER" label="Issue History" icon={<ArrowUpRight size={18} />} />
                <DesktopNavItem view="REPORTS" label="Reports" icon={<BarChart3 size={18} />} />
              </div>
            </div>

            {/* Group: Tools & Config */}
            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider opacity-60">
                  Management
                </div>
              )}
              <div className="space-y-1">
                <DesktopNavItem view="WORK_AREA" label="Workbench" icon={<Calculator size={18} />} />
                <DesktopNavItem view="MASTER_DATA" label="Master Data" icon={<Database size={18} />} />
                <DesktopNavItem view="BULK_IMPORT" label="Bulk Import" icon={<UploadCloud size={18} />} />
                <DesktopNavItem view="SETTINGS" label="Settings" icon={<SettingsIcon size={18} />} />
                <DesktopNavItem view="ABOUT" label="About System" icon={<Info size={18} />} />
              </div>
            </div>
          </nav>

          {/* Desktop Sidebar Footer: Collapse Toggle */}
          <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div className="text-[11px] font-mono text-[var(--text-secondary)] truncate pl-2">
                Cloud Sync Active
              </div>
            )}
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className={`p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer ${
                isSidebarCollapsed ? 'mx-auto' : ''
              }`}
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </aside>

        {/* ================= MAIN VIEW CONTENT ================= */}
        {/* Notice: pb-24 on mobile ensures no content is clipped under bottom nav */}
        <main className="flex-1 relative bg-[var(--bg-main)] overflow-hidden flex flex-col">
          <div className="h-full overflow-y-auto overflow-x-hidden pb-24 md:pb-6">
            {currentView === 'DASHBOARD' && <Dashboard data={data} onViewChange={handleNav} onUpdate={refreshData} />}
            {currentView === 'PURCHASE' && (
              <TransactionForm 
                key="PURCHASE" 
                type="PURCHASE" 
                materials={data.materials} 
                settings={data.appSettings} 
                onComplete={async () => { await refreshData(); handleNav('STOCK_REGISTER'); }} 
                onCancel={() => handleNav('DASHBOARD')}
              />
            )}
            {currentView === 'ISSUE' && (
              <TransactionForm 
                key="ISSUE" 
                type="ISSUE" 
                materials={data.materials} 
                settings={data.appSettings} 
                onComplete={async () => { await refreshData(); handleNav('STOCK_REGISTER'); }} 
                onCancel={() => handleNav('DASHBOARD')}
              />
            )}
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

      {/* ================= MOBILE BOTTOM NAVIGATION (Under md) ================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-sidebar)]/95 backdrop-blur-xl border-t border-[var(--border-color)] px-2 py-1.5 flex items-center justify-around z-40 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => handleNav('DASHBOARD')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            currentView === 'DASHBOARD' 
              ? 'text-[var(--accent)] font-bold' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <LayoutDashboard size={20} className={currentView === 'DASHBOARD' ? 'scale-110 transition-transform' : ''} />
          <span className="text-[10px] mt-1">Dashboard</span>
        </button>

        {/* 2. Bill Entry */}
        <button
          type="button"
          onClick={() => handleNav('PURCHASE')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            currentView === 'PURCHASE' 
              ? 'text-[var(--accent)] font-bold' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Truck size={20} className={currentView === 'PURCHASE' ? 'scale-110 transition-transform' : ''} />
          <span className="text-[10px] mt-1">Inward</span>
        </button>

        {/* 3. Issue Material */}
        <button
          type="button"
          onClick={() => handleNav('ISSUE')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            currentView === 'ISSUE' 
              ? 'text-[var(--accent)] font-bold' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <ShoppingCart size={20} className={currentView === 'ISSUE' ? 'scale-110 transition-transform' : ''} />
          <span className="text-[10px] mt-1">Issue</span>
        </button>

        {/* 4. Stock Register */}
        <button
          type="button"
          onClick={() => handleNav('STOCK_REGISTER')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            currentView === 'STOCK_REGISTER' 
              ? 'text-[var(--accent)] font-bold' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <ClipboardList size={20} className={currentView === 'STOCK_REGISTER' ? 'scale-110 transition-transform' : ''} />
          <span className="text-[10px] mt-1">Stock</span>
        </button>

        {/* 5. More Menu */}
        <button
          type="button"
          onClick={() => setIsMobileMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            isMobileMoreOpen 
              ? 'text-[var(--accent)] font-bold' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Grid size={20} />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </nav>

      {/* ================= MOBILE "MORE" BOTTOM SHEET MODAL ================= */}
      {isMobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMoreOpen(false)}
          />

          {/* Sheet Panel */}
          <div className="relative bg-[var(--bg-sidebar)] border-t border-[var(--border-color)] rounded-t-3xl p-5 shadow-2xl safe-bottom max-h-[80vh] overflow-y-auto animate-slideUp">
            
            {/* Drag Pill & Header */}
            <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full mx-auto mb-4" />
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)]">All Modules</h3>
                <p className="text-xs text-[var(--text-secondary)]">Navigate registers, audits, and configuration</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid of Modules */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { view: 'STOCK_TAKING' as ViewName, label: 'Physical Audit', icon: <CheckCircle2 size={18} />, desc: 'Stock verification' },
                { view: 'MRN_REGISTER' as ViewName, label: 'MRN History', icon: <FileSpreadsheet size={18} />, desc: 'Inward records' },
                { view: 'ISSUE_REGISTER' as ViewName, label: 'Issue History', icon: <ArrowUpRight size={18} />, desc: 'Outward records' },
                { view: 'REPORTS' as ViewName, label: 'Analytics & Reports', icon: <BarChart3 size={18} />, desc: 'Custom reporting' },
                { view: 'WORK_AREA' as ViewName, label: 'Workbench', icon: <Calculator size={18} />, desc: 'Calculator & scratchpad' },
                { view: 'MASTER_DATA' as ViewName, label: 'Master Data', icon: <Database size={18} />, desc: 'SKUs, Vendors, Depts' },
                { view: 'BULK_IMPORT' as ViewName, label: 'Bulk Import', icon: <UploadCloud size={18} />, desc: 'CSV migration' },
                { view: 'SETTINGS' as ViewName, label: 'Settings', icon: <SettingsIcon size={18} />, desc: 'Themes & backups' },
                { view: 'ABOUT' as ViewName, label: 'System Info', icon: <Info size={18} />, desc: 'App details' },
              ].map(item => (
                <button
                  type="button"
                  key={item.view}
                  onClick={() => handleNav(item.view)}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                    currentView === item.view
                      ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${
                    currentView === item.view ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-main)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate">{item.label}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Command Palette Modal (Ctrl/Cmd + K) */}
      <CommandPalette 
        isOpen={isCmdOpen} 
        onClose={() => setIsCmdOpen(false)} 
        onNavigate={handleNav} 
      />
    </div>
  );
};

export default App;
