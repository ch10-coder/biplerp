import React, { useState, useMemo, useEffect } from 'react';
import { AppData, ViewName, Task, Material } from '../types';
import { calculateBatches, toggleMonthlyEssentialStatus, updateDashboardTasks, updateMaterial } from '../services/storageService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { 
  Search, ArrowUpRight, TrendingUp, AlertTriangle, Plus, Trash2, 
  Layers, Activity, PieChart as PieIcon, CheckCircle, Calendar, 
  ShoppingCart, ShieldCheck, ClipboardCheck, Sparkles, CheckSquare, 
  Truck, ArrowRight, ArrowDownRight, Package, Calculator 
} from 'lucide-react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, 
  AreaChart, Area, PieChart, Pie, Sector 
} from 'recharts';

interface DashboardProps {
    data: AppData;
    onViewChange: (view: ViewName) => void;
    onUpdate?: () => void;
}

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 8) * cos;
  const sy = cy + (outerRadius + 8) * sin;
  const mx = cx + (outerRadius + 24) * cos;
  const my = cy + (outerRadius + 24) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 20;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  const displayName = payload?.name 
    ? (payload.name.length > 12 ? `${payload.name.substring(0, 12)}...` : payload.name) 
    : 'Unnamed';
  const displayVal = typeof value === 'number' ? value.toLocaleString() : (value || '0');
  const displayPercent = typeof percent === 'number' ? (percent * 100).toFixed(1) : '0';

  return (
    <g>
      <text x={cx} y={cy} dy={4} textAnchor="middle" fill="var(--text-primary)" className="text-xs font-bold font-mono">
        {displayName}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 4} outerRadius={outerRadius + 8} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1.5} />
      <circle cx={ex} cy={ey} r={2.5} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey - 4} textAnchor={textAnchor} fill="var(--text-secondary)" fontSize={10} className="font-mono">
        {`Val: ${displayVal}`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey + 12} textAnchor={textAnchor} fill="var(--text-primary)" fontSize={10} fontWeight="bold" className="font-mono">
        {`(${displayPercent}%)`}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] p-3 rounded-xl shadow-xl backdrop-blur-md">
        <p className="text-xs font-bold text-[var(--text-primary)] mb-2 font-mono">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4 text-xs font-medium py-0.5">
            <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              ₹{Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ data, onViewChange, onUpdate }) => {
    const [globalSearch, setGlobalSearch] = useState('');
    const [procurementTab, setProcurementTab] = useState<'LOW_STOCK' | 'MONTHLY'>('MONTHLY');
    const [activityTab, setActivityTab] = useState<'VERIFY' | 'TASKS'>('VERIFY');
    const [activeIndex, setActiveIndex] = useState(0);
    const [tasks, setTasks] = useState<Task[]>(data.tasks || []);
    const [newTask, setNewTask] = useState('');
    const currencySymbol = data.appSettings?.currencySymbol || '₹';
    const [refreshTick, setRefreshTick] = useState(0);
    
    // Optimistic UI state for verification
    const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

    // Synchronize tasks when data.tasks changes via external/realtime sync
    useEffect(() => {
        setTasks(data.tasks || []);
    }, [data.tasks]);

    const saveTasks = async (newTasks: Task[]) => {
        setTasks(newTasks);
        await updateDashboardTasks(newTasks);
        onUpdate?.();
    };

    const addTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        await saveTasks([...tasks, { id: Date.now().toString(), text: newTask.trim(), done: false }]);
        setNewTask('');
    };

    const toggleTask = async (id: string) => {
        await saveTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const deleteTask = async (id: string) => {
        await saveTasks(tasks.filter(t => t.id !== id));
    };

    // Pre-indexed map for latest issue date per material to avoid N+1 sorting
    const latestIssueDateMap = useMemo(() => {
        const map = new Map<string, string>();
        data.transactions.forEach(t => {
            if (t.type === 'ISSUE' && t.materialId && t.date) {
                const existing = map.get(t.materialId);
                if (!existing || new Date(t.date).getTime() > new Date(existing).getTime()) {
                    map.set(t.materialId, t.date);
                }
            }
        });
        return map;
    }, [data.transactions]);

    // Verification Logic (Optimized)
    const verificationQueue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        
        return data.materials.filter(m => {
            if (verifiedIds.has(m.id)) return false;
            if ((m.currentStock || 0) <= 0.0001) return false;
            
            // Must have been issued at least once
            const lastDate = latestIssueDateMap.get(m.id);
            if (!lastDate) return false;

            const lastVerifiedDate = m.lastVerified ? m.lastVerified.split('T')[0] : null;
            return lastVerifiedDate !== today;
        }).map(m => ({
            ...m,
            lastIssueDate: latestIssueDateMap.get(m.id) || null
        })).sort((a,b) => {
            const dateA = a.lastVerified ? new Date(a.lastVerified).getTime() : 0;
            const dateB = b.lastVerified ? new Date(b.lastVerified).getTime() : 0;
            return dateA - dateB;
        });
    }, [data.materials, latestIssueDateMap, refreshTick, verifiedIds]);

    const handleVerifyItem = async (m: Material) => {
        setVerifiedIds(prev => new Set(prev).add(m.id));
        await updateMaterial({
            ...m,
            lastVerified: new Date().toISOString()
        });
        setRefreshTick(prev => prev + 1);
        onUpdate?.();
    };

    // Financial & Inventory Metrics
    const totalStockValue = useMemo(() => {
        return data.materials.reduce((acc, m) => {
            const batches = calculateBatches(m.id, data);
            const val = batches.reduce((sum, b) => sum + (b.remainingQty * (b.avgRate ?? b.rate)), 0);
            return acc + val;
        }, 0);
    }, [data.materials, data.transactions]);
    
    const lowStockItems = useMemo(() => {
        return data.materials.filter(m => (m.minLevel || 0) > 0 && m.currentStock < (m.minLevel || 0))
            .sort((a,b) => ((a.minLevel||0) - a.currentStock) - ((b.minLevel||0) - b.currentStock));
    }, [data.materials]);

    const monthlyEssentialsData = useMemo(() => {
        const essentialIds = data.appSettings?.monthlyEssentials || [];
        const restockRecord = data.appSettings?.monthlyRestockRecord || {};
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const status = essentialIds.map(id => {
            const material = data.materials.find(m => m.id === id);
            if (!material) return null;
            const hasTransaction = data.transactions.some(t => t.materialId === id && t.type === 'PURCHASE' && (t.date || '').startsWith(currentMonthPrefix));
            const isManuallyDone = restockRecord[id] === currentMonthPrefix;
            return { ...material, isPurchased: hasTransaction || isManuallyDone, isManuallyDone };
        }).filter(Boolean) as any[];

        return { pending: status.filter(i => !i.isPurchased), completed: status.filter(i => i.isPurchased), all: status };
    }, [data.materials, data.transactions, data.appSettings, refreshTick]);

    const groupCompositionData = useMemo(() => {
        const groups: Record<string, number> = {};
        data.materials.forEach(m => {
            const batches = calculateBatches(m.id, data);
            const val = batches.reduce((sum, b) => sum + (b.remainingQty * (b.avgRate ?? b.rate)), 0);
            if (val > 0) { 
                const grp = m.group ? m.group.trim() : 'General';
                groups[grp] = (groups[grp] || 0) + val; 
            }
        });
        return Object.entries(groups)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [data.materials, data.transactions]);

    const financialTrendData = useMemo(() => {
        const trend = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            let pVal = 0, iVal = 0;
            data.transactions.forEach(t => {
                const tDate = new Date(t.date);
                if (tDate >= monthStart && tDate <= monthEnd) {
                    if (t.type === 'PURCHASE') pVal += (t.quantity * (t.avgRate ?? t.rate));
                    if (t.type === 'ISSUE') iVal += t.totalValue;
                }
            });
            trend.push({ name: d.toLocaleString('default', { month: 'short' }), Purchase: pVal, Issue: iVal });
        }
        return trend;
    }, [data.transactions]);

    const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

    // Search filters
    const filteredLowStock = useMemo(() => {
        if (!globalSearch) return lowStockItems;
        const term = globalSearch.toLowerCase();
        return lowStockItems.filter(m => m.name.toLowerCase().includes(term) || (m.group || '').toLowerCase().includes(term));
    }, [lowStockItems, globalSearch]);

    const filteredPendingEssentials = useMemo(() => {
        if (!globalSearch) return monthlyEssentialsData.pending;
        const term = globalSearch.toLowerCase();
        return monthlyEssentialsData.pending.filter(m => m.name.toLowerCase().includes(term) || (m.group || '').toLowerCase().includes(term));
    }, [monthlyEssentialsData.pending, globalSearch]);

    const filteredVerificationQueue = useMemo(() => {
        if (!globalSearch) return verificationQueue;
        const term = globalSearch.toLowerCase();
        return verificationQueue.filter(m => m.name.toLowerCase().includes(term) || (m.group || '').toLowerCase().includes(term));
    }, [verificationQueue, globalSearch]);

    const filteredTasks = useMemo(() => {
        if (!globalSearch) return tasks;
        const term = globalSearch.toLowerCase();
        return tasks.filter(t => t.text.toLowerCase().includes(term));
    }, [tasks, globalSearch]);

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
            
            {/* Top Bar: Title & Search Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                        Store Overview
                    </h1>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 font-medium">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                {/* Quick Search on Dashboard */}
                <div className="w-full md:w-80 relative">
                    <Search size={16} className="absolute left-3.5 top-3 text-[var(--text-secondary)] pointer-events-none" />
                    <input 
                        type="text" 
                        value={globalSearch} 
                        onChange={e => setGlobalSearch(e.target.value)} 
                        placeholder="Filter items, alerts & tasks..." 
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent)] shadow-sm"
                    />
                    {globalSearch && (
                        <button 
                            type="button"
                            onClick={() => setGlobalSearch('')}
                            className="absolute right-3 top-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                    type="button"
                    onClick={() => onViewChange('PURCHASE')}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-[var(--accent)]/15 to-blue-600/5 border border-[var(--accent)]/30 hover:border-[var(--accent)] text-[var(--text-primary)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-md shadow-[var(--accent)]/30 shrink-0 group-hover:scale-105 transition-transform">
                        <Truck size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold group-hover:text-[var(--accent)] transition-colors truncate">New Inward</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">Bill Entry</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onViewChange('ISSUE')}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500/15 to-indigo-600/5 border border-purple-500/30 hover:border-purple-500 text-[var(--text-primary)] hover:shadow-lg hover:shadow-purple-500/10 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0 group-hover:scale-105 transition-transform">
                        <ShoppingCart size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold group-hover:text-purple-400 transition-colors truncate">Issue Material</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">Department Issue</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onViewChange('STOCK_TAKING')}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-600/5 border border-emerald-500/30 hover:border-emerald-500 text-[var(--text-primary)] hover:shadow-lg hover:shadow-emerald-500/10 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0 group-hover:scale-105 transition-transform">
                        <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold group-hover:text-emerald-400 transition-colors truncate">Physical Audit</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">Stock Check</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onViewChange('WORK_AREA')}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-500/15 to-zinc-600/5 border border-[var(--border-color)] hover:border-[var(--text-secondary)] text-[var(--text-primary)] hover:shadow-lg transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                        <Calculator size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold transition-colors truncate">Workbench</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">Scratchpad & Math</div>
                    </div>
                </button>
            </div>

            {/* 4 Hero Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Stock Valuation */}
                <Card className="border-[var(--border-color)] hover:border-blue-500/40 relative overflow-hidden" hoverable>
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                            <Layers size={20} />
                        </div>
                        <Badge variant="blue" size="sm">Catalog</Badge>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                        {currencySymbol} {totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mt-1.5 pt-2 border-t border-[var(--border-color)]/60">
                        <span>Total Inventory</span>
                        <span className="font-mono font-bold text-[var(--text-primary)]">{data.materials.length} SKUs</span>
                    </div>
                </Card>

                {/* 2. Monthly Inflow */}
                <Card className="border-[var(--border-color)] hover:border-emerald-500/40 relative overflow-hidden" hoverable>
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <TrendingUp size={20} />
                        </div>
                        <Badge variant="emerald" size="sm" dot>Inflow</Badge>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                        {currencySymbol} {financialTrendData[5]?.Purchase.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                    </div>
                    <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 pt-2 border-t border-[var(--border-color)]/60 font-medium">
                        <span>Purchases (This Mo)</span>
                        <ArrowUpRight size={14} />
                    </div>
                </Card>

                {/* 3. Monthly Outflow */}
                <Card className="border-[var(--border-color)] hover:border-purple-500/40 relative overflow-hidden" hoverable>
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                            <ArrowUpRight size={20} />
                        </div>
                        <Badge variant="purple" size="sm">Issued</Badge>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                        {currencySymbol} {financialTrendData[5]?.Issue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                    </div>
                    <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400 mt-1.5 pt-2 border-t border-[var(--border-color)]/60 font-medium">
                        <span>Issued Material</span>
                        <span className="text-[10px] font-mono">Current Mo</span>
                    </div>
                </Card>

                {/* 4. Low Stock Alerts */}
                <Card className="border-[var(--border-color)] hover:border-rose-500/40 relative overflow-hidden" hoverable>
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                            <AlertTriangle size={20} />
                        </div>
                        <Badge variant={lowStockItems.length > 0 ? 'rose' : 'emerald'} size="sm" dot={lowStockItems.length > 0}>
                            {lowStockItems.length > 0 ? 'Action Needed' : 'Healthy'}
                        </Badge>
                    </div>
                    <div className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${lowStockItems.length > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>
                        {lowStockItems.length}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mt-1.5 pt-2 border-t border-[var(--border-color)]/60">
                        <span>Below Min Level</span>
                        {lowStockItems.length > 0 && (
                            <button 
                                type="button"
                                onClick={() => setProcurementTab('LOW_STOCK')}
                                className="text-[10px] text-rose-500 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                            >
                                View List →
                            </button>
                        )}
                    </div>
                </Card>
            </div>

            {/* Analytics Section: 6-Month Trend & Category Donut */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 6-Month Trend Area Chart */}
                <Card 
                    className="md:col-span-2 min-h-[380px] flex flex-col"
                    title={
                        <div className="flex items-center gap-2 text-sm sm:text-base">
                            <Activity size={18} className="text-[var(--accent)]" />
                            <span>Purchase vs Issuance Movement</span>
                        </div>
                    }
                    subtitle="6-month financial trajectory of store procurement and consumption"
                    action={
                        <div className="flex items-center gap-3 text-xs font-mono">
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Inward
                            </span>
                            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Outward
                            </span>
                        </div>
                    }
                >
                    <div className="w-full h-[280px] min-w-0 pt-2">
                        <ResponsiveContainer width="100%" height={280} minWidth={0}>
                            <AreaChart data={financialTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPurchaseModern" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                    </linearGradient>
                                    <linearGradient id="colorIssueModern" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.4} />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="Purchase" name="Inward Bill" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPurchaseModern)" />
                                <Area type="monotone" dataKey="Issue" name="Outward Issue" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIssueModern)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Category Valuation Donut */}
                <Card 
                    className="min-h-[380px] flex flex-col"
                    title={
                        <div className="flex items-center gap-2 text-sm sm:text-base">
                            <PieIcon size={18} className="text-purple-400" />
                            <span>Top Categories</span>
                        </div>
                    }
                    subtitle="Inventory value distribution"
                >
                    <div className="w-full h-[250px] min-w-0">
                        <ResponsiveContainer width="100%" height={250} minWidth={0}>
                            <PieChart>
                                <Pie 
                                    activeIndex={activeIndex} 
                                    activeShape={renderActiveShape} 
                                    data={groupCompositionData} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={55} 
                                    outerRadius={75} 
                                    dataKey="value" 
                                    onMouseEnter={(_, i) => setActiveIndex(i)} 
                                    stroke="none"
                                >
                                    {groupCompositionData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Compact Legend Chips */}
                    <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-[var(--border-color)]">
                        {groupCompositionData.slice(0, 4).map((g, idx) => (
                            <div key={g.name} className="flex items-center gap-2 text-xs truncate">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                <span className="text-[var(--text-secondary)] truncate">{g.name}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Operations Section: Stock Reorder / Verification Queue */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left 2 Cols: Monthly Essentials / Low Stock Reorder */}
                <div className="md:col-span-2">
                    <Card className="flex flex-col h-[480px] p-0 overflow-hidden">
                        
                        {/* Segmented Header */}
                        <div className="p-3.5 sm:p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/40 flex justify-between items-center">
                            <div className="flex gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setProcurementTab('MONTHLY')} 
                                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                                        procurementTab === 'MONTHLY' 
                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-sm' 
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <Calendar size={14} /> Monthly Essentials
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] font-mono">
                                        {monthlyEssentialsData.pending.length}
                                    </span>
                                </button>
                                
                                <button 
                                    type="button"
                                    onClick={() => setProcurementTab('LOW_STOCK')} 
                                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                                        procurementTab === 'LOW_STOCK' 
                                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 shadow-sm' 
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <AlertTriangle size={14} /> Critical Low Stock
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] font-mono">
                                        {lowStockItems.length}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* List Content */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {procurementTab === 'LOW_STOCK' ? (
                                filteredLowStock.length > 0 ? (
                                    filteredLowStock.map(m => (
                                        <div 
                                            key={m.id} 
                                            className="flex justify-between items-center p-3.5 rounded-xl bg-[var(--bg-main)]/30 hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition-all group"
                                        >
                                            <div className="min-w-0 pr-3">
                                                <div className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                                                    {m.name}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 uppercase tracking-wide truncate">
                                                    {m.location || 'No Rack'} • {m.group || 'General'}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-bold text-rose-500 dark:text-rose-400 font-mono text-base">
                                                    {m.currentStock} <span className="text-xs text-[var(--text-secondary)] font-sans">{m.unit}</span>
                                                </div>
                                                <div className="text-[10px] text-[var(--text-secondary)] font-mono font-semibold">
                                                    MIN LEVEL: {m.minLevel}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-16 text-center">
                                        <ClipboardCheck size={44} className="text-emerald-500 dark:text-emerald-400 mb-2 opacity-80" />
                                        <p className="text-sm font-bold text-[var(--text-primary)]">All stock levels are optimal</p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Zero items currently below the reorder threshold</p>
                                    </div>
                                )
                            ) : (
                                filteredPendingEssentials.length > 0 ? (
                                    filteredPendingEssentials.map(m => (
                                        <div 
                                            key={m.id} 
                                            className="flex justify-between items-center p-3.5 rounded-xl bg-[var(--bg-main)]/30 hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition-all"
                                        >
                                            <div className="min-w-0 pr-3">
                                                <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                                    {m.name}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 uppercase font-mono">
                                                    {m.group} • Current Stock: {m.currentStock} {m.unit}
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    toggleMonthlyEssentialStatus(m.id, true).then(() => {
                                                        setRefreshTick(t => t + 1);
                                                        onUpdate?.();
                                                    });
                                                }} 
                                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95" 
                                                title="Mark as Restocked"
                                            >
                                                <CheckSquare size={14} /> Done
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-16 text-center">
                                        <Calendar size={44} className="text-amber-500 dark:text-amber-400 mb-2 opacity-80" />
                                        <p className="text-sm font-bold text-[var(--text-primary)]">Monthly Restock Complete</p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">All essential supplies have been procured this month</p>
                                    </div>
                                )
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right 1 Col: Daily Verification Queue & Tasks */}
                <div className="space-y-6">
                    <Card className="flex flex-col h-[480px] p-0 overflow-hidden">
                        
                        {/* Segment Tab */}
                        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/40">
                            <div className="flex gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)]">
                                <button 
                                    type="button"
                                    onClick={() => setActivityTab('VERIFY')} 
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        activityTab === 'VERIFY' 
                                            ? 'bg-[var(--accent)] text-white shadow-sm' 
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <ShieldCheck size={14} /> To Verify ({verificationQueue.length})
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setActivityTab('TASKS')} 
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        activityTab === 'TASKS' 
                                            ? 'bg-[var(--accent)] text-white shadow-sm' 
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <CheckSquare size={14} /> Tasks ({tasks.filter(t => !t.done).length})
                                </button>
                            </div>
                        </div>

                        {activityTab === 'TASKS' ? (
                            <div className="flex flex-col flex-1 min-h-0">
                                
                                {/* Add Task Form */}
                                <form onSubmit={addTask} className="p-3 border-b border-[var(--border-color)] flex gap-2">
                                    <input 
                                        value={newTask} 
                                        onChange={e => setNewTask(e.target.value)} 
                                        placeholder="Add quick reminder..." 
                                        className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm px-3.5 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" 
                                    />
                                    <Button type="submit" size="sm" variant="primary">
                                        <Plus size={16} />
                                    </Button>
                                </form>

                                {/* Task List */}
                                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                                    {filteredTasks.length > 0 ? (
                                        filteredTasks.map(t => (
                                            <div 
                                                key={t.id} 
                                                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-main)]/60 border border-[var(--border-color)]/50 transition-colors"
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={t.done} 
                                                    onChange={() => toggleTask(t.id)} 
                                                    className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer" 
                                                />
                                                <span className={`flex-1 text-xs sm:text-sm font-medium transition-all ${
                                                    t.done ? 'text-[var(--text-secondary)] line-through opacity-60' : 'text-[var(--text-primary)]'
                                                }`}>
                                                    {t.text}
                                                </span>
                                                <button 
                                                    type="button"
                                                    onClick={() => deleteTask(t.id)} 
                                                    className="text-[var(--text-secondary)] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-16 text-center">
                                            <CheckCircle size={40} className="mb-2 opacity-50" />
                                            <p className="text-xs">No pending tasks</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                                {filteredVerificationQueue.length > 0 ? (
                                    filteredVerificationQueue.map(m => (
                                        <div 
                                            key={m.id} 
                                            className="p-3 rounded-xl bg-[var(--bg-main)]/40 hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition-all flex items-center justify-between gap-3 group"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-xs sm:text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                                                    {m.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] mt-0.5">
                                                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{m.currentStock} {m.unit}</span>
                                                    <span>•</span>
                                                    <span>Loc: {m.location || 'Rack -'}</span>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => handleVerifyItem(m)}
                                                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 shadow-sm"
                                                title="Mark Physical Stock Verified Today"
                                            >
                                                <ShieldCheck size={14} /> Check
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-16 text-center">
                                        <ShieldCheck size={44} className="text-emerald-500 dark:text-emerald-400 mb-2 opacity-80" />
                                        <p className="text-sm font-bold text-[var(--text-primary)]">All Verified Today</p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">Daily physical stock checks complete</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;