import React, { useState, useMemo, useEffect } from 'react';
import { AppData, ViewName, Task, Material } from '../types';
import { calculateBatches, toggleMonthlyEssentialStatus, updateDashboardTasks, updateMaterial } from '../services/storageService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Search, ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, CheckSquare, Plus, Trash2, BarChart2, Share2, Download, Layers, Activity, PieChart as PieIcon, CheckCircle, ShoppingBag, Calendar, Hash, ChevronRight, Truck, ShoppingCart, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, AreaChart, Area, PieChart, Pie, Legend, Sector } from 'recharts';
import { motion } from 'framer-motion';

interface DashboardProps {
    data: AppData;
    onViewChange: (view: ViewName) => void;
}

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#fff" className="text-sm font-bold">
        {payload.name.substring(0, 10)}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#9ca3af" fontSize={10}>
        {`Val: ${value.toLocaleString()}`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={14} textAnchor={textAnchor} fill="#fff" fontSize={10} fontWeight="bold">
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ data, onViewChange }) => {
    const [globalSearch, setGlobalSearch] = useState('');
    const [procurementTab, setProcurementTab] = useState<'LOW_STOCK' | 'MONTHLY'>('MONTHLY');
    const [activityTab, setActivityTab] = useState<'ACTIVITY' | 'TASKS'>('ACTIVITY');
    const [activeIndex, setActiveIndex] = useState(0);
    const [tasks, setTasks] = useState<Task[]>(data.tasks || []);
    const [newTask, setNewTask] = useState('');
    const currencySymbol = data.appSettings?.currencySymbol || '₹';
    const [refreshTick, setRefreshTick] = useState(0);
    
    // Optimistic UI state for verification
    const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

    const saveTasks = async (newTasks: Task[]) => {
        setTasks(newTasks);
        await updateDashboardTasks(newTasks); 
    };

    const addTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        await saveTasks([...tasks, { id: Date.now().toString(), text: newTask, done: false }]);
        setNewTask('');
    };

    const toggleTask = async (id: string) => {
        await saveTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const deleteTask = async (id: string) => {
        await saveTasks(tasks.filter(t => t.id !== id));
    };

    // --- Verification Logic ---
    const verificationQueue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        
        return data.materials.filter(m => {
            // 0. Check Optimistic State first
            if (verifiedIds.has(m.id)) return false;

            // 1. Must have stock left
            if ((m.currentStock || 0) <= 0.0001) return false;
            
            // 2. Must have been issued at least once (Active Item)
            const hasBeenIssued = data.transactions.some(t => t.materialId === m.id && t.type === 'ISSUE');
            if (!hasBeenIssued) return false;

            // 3. Must NOT have been verified today
            const lastVerifiedDate = m.lastVerified ? m.lastVerified.split('T')[0] : null;
            return lastVerifiedDate !== today;
        }).map(m => {
            // Find the last issue date for display
            const issues = data.transactions
                .filter(t => t.materialId === m.id && t.type === 'ISSUE')
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            return {
                ...m,
                lastIssueDate: issues[0]?.date || null
            };
        }).sort((a,b) => {
            // Priority: Items not verified for longest time first
            const dateA = a.lastVerified ? new Date(a.lastVerified).getTime() : 0;
            const dateB = b.lastVerified ? new Date(b.lastVerified).getTime() : 0;
            return dateA - dateB;
        });
    }, [data.materials, data.transactions, refreshTick, verifiedIds]);

    const handleVerifyItem = async (m: Material) => {
        // Optimistic Update: Hide immediately
        setVerifiedIds(prev => new Set(prev).add(m.id));
        
        // Background DB Update
        await updateMaterial({
            ...m,
            lastVerified: new Date().toISOString()
        });
        // We trigger refresh, but the UI is already updated via local state
        setRefreshTick(prev => prev + 1);
    };

    // --- Calculations ---
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
            if (val > 0) { groups[m.group || 'Unassigned'] = (groups[m.group || 'Unassigned'] || 0) + val; }
        });
        return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
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

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGlobalSearch(e.target.value);
    };

    const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    // Filtered Data based on Global Search
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

    const containerVariants: any = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
    };

    return (
        <motion.div 
            className="h-full overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-[var(--bg-main)]"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Dashboard</h2>
                    <div className="text-sm text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-500 group-focus-within:text-[var(--accent)] transition-colors" /></div>
                        <input type="text" value={globalSearch} onChange={handleSearch} placeholder="Quick filter dashboard..." className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all shadow-lg" />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={() => onViewChange('PURCHASE')} variant="primary" className="flex-1 sm:flex-none whitespace-nowrap flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20">
                            <Plus size={16}/> Purchase
                        </Button>
                        <Button onClick={() => onViewChange('ISSUE')} variant="secondary" className="flex-1 sm:flex-none whitespace-nowrap flex items-center justify-center gap-2">
                            <ArrowUpRight size={16}/> Issue
                        </Button>
                    </div>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-0 bg-gradient-to-br from-[var(--bg-card)] to-blue-900/10 border-[var(--border-color)] shadow-md">
                    <div className="p-5"><div className="flex justify-between items-start mb-4"><div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400"><Layers size={22} /></div><span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Inventory</span></div><div className="text-2xl font-bold text-[var(--text-primary)] font-mono tracking-tight">{currencySymbol} {totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><div className="text-xs text-gray-500 mt-1">{data.materials.length} Items</div></div>
                </Card>
                <Card className="p-0 bg-gradient-to-br from-[var(--bg-card)] to-green-900/10 border-[var(--border-color)] shadow-md">
                    <div className="p-5"><div className="flex justify-between items-start mb-4"><div className="p-2.5 bg-green-500/10 rounded-xl text-green-400"><TrendingUp size={22} /></div><span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Inflow (Mo)</span></div><div className="text-2xl font-bold text-[var(--text-primary)] font-mono tracking-tight">{currencySymbol} {financialTrendData[5].Purchase.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><div className="text-xs text-green-500/80 mt-1 font-medium">+ Purchase Value</div></div>
                </Card>
                <Card className="p-0 bg-gradient-to-br from-[var(--bg-card)] to-purple-900/10 border-[var(--border-color)] shadow-md">
                    <div className="p-5"><div className="flex justify-between items-start mb-4"><div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400"><ArrowUpRight size={22} /></div><span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Outflow (Mo)</span></div><div className="text-2xl font-bold text-[var(--text-primary)] font-mono tracking-tight">{currencySymbol} {financialTrendData[5].Issue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><div className="text-xs text-purple-500/80 mt-1 font-medium">Issues This Month</div></div>
                </Card>
                <Card className="p-0 bg-gradient-to-br from-[var(--bg-card)] to-red-900/10 border-[var(--border-color)] shadow-md">
                    <div className="p-5"><div className="flex justify-between items-start mb-4"><div className="p-2.5 bg-red-500/10 rounded-xl text-red-400"><AlertTriangle size={22} /></div><span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Alerts</span></div><div className={`text-2xl font-bold font-mono tracking-tight ${lowStockItems.length > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{lowStockItems.length}</div><div className="text-xs text-gray-500 mt-1">Items below min level</div></div>
                </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 min-h-[380px] flex flex-col p-6 border-[var(--border-color)]">
                    <div className="flex justify-between items-center mb-6"><div><h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-base"><Activity size={18} className="text-[var(--accent)]" /> Financial Overview</h3><p className="text-xs text-gray-500 mt-1">6-Month Trend</p></div></div>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={financialTrendData}>
                                <defs><linearGradient id="colorPurchase" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient><linearGradient id="colorIssue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 11}} axisLine={false} tickLine={false} />
                                <YAxis tick={{fill: '#6b7280', fontSize: 11}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="Purchase" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPurchase)" />
                                <Area type="monotone" dataKey="Issue" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorIssue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="min-h-[380px] flex flex-col p-6 border-[var(--border-color)]">
                    <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-base"><PieIcon size={18} className="text-purple-500" /> Distribution</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                {/* @ts-ignore */}
                                <Pie activeIndex={activeIndex} activeShape={renderActiveShape} data={groupCompositionData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" onMouseEnter={(_, i) => setActiveIndex(i)} stroke="none">
                                    {groupCompositionData.map((_, index) => (<Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24">
                {/* Monthly Essentials / Low Stock Section */}
                <div className="lg:col-span-2">
                    <Card className="flex flex-col h-[500px] p-0 overflow-hidden border-[var(--border-color)] bg-[var(--bg-card)]">
                         <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 shrink-0">
                            <div className="flex gap-2">
                                <button onClick={() => setProcurementTab('MONTHLY')} className={`text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${procurementTab === 'MONTHLY' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' : 'text-gray-500 hover:text-white'}`}><Calendar size={14}/> Monthly Essentials</button>
                                <button onClick={() => setProcurementTab('LOW_STOCK')} className={`text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${procurementTab === 'LOW_STOCK' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'text-gray-500 hover:text-white'}`}><AlertTriangle size={14}/> Low Stock</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {procurementTab === 'LOW_STOCK' ? (
                                filteredLowStock.length > 0 ? (
                                    filteredLowStock.map(m => (
                                        <div key={m.id} className="flex justify-between items-center p-3 hover:bg-[var(--bg-main)] rounded-lg border border-transparent hover:border-[var(--border-color)] transition-all group">
                                            <div><div className="font-bold text-[var(--text-primary)] text-sm">{m.name}</div><div className="text-[10px] text-gray-500 mt-0.5 uppercase">{m.location} • {m.group}</div></div>
                                            <div className="text-right"><div className="font-bold text-red-400 font-mono text-base">{m.currentStock} <span className="text-[10px] text-gray-600 font-sans">{m.unit}</span></div><div className="text-[10px] text-gray-600 font-bold">MIN: {m.minLevel}</div></div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 py-20"><ClipboardCheck size={48} className="mb-2"/><p className="text-sm">{globalSearch ? 'No matching low stock items' : 'Stock levels are healthy!'}</p></div>
                                )
                            ) : (
                                filteredPendingEssentials.length > 0 ? (
                                    filteredPendingEssentials.map(m => (
                                        <div key={m.id} className="flex justify-between items-center p-3 hover:bg-[var(--bg-main)] rounded-lg border border-transparent hover:border-[var(--border-color)] transition-all">
                                            <div><div className="font-medium text-yellow-100 text-sm">{m.name}</div><div className="text-[10px] text-gray-500 mt-0.5 uppercase">{m.group}</div></div>
                                            <button onClick={() => toggleMonthlyEssentialStatus(m.id, true).then(() => setRefreshTick(t => t + 1))} className="text-gray-600 hover:text-green-400 p-2 hover:bg-green-400/10 rounded-lg transition-all" title="Mark as Restocked"><CheckSquare size={20}/></button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 py-20"><Calendar size={48} className="mb-2"/><p className="text-sm">{globalSearch ? 'No matching pending essentials' : 'Monthly Restock Complete!'}</p></div>
                                )
                            )}
                        </div>
                    </Card>
                </div>

                {/* To Verify / Task Section */}
                <div className="space-y-6">
                     <Card className="flex flex-col h-[500px] p-0 border-[var(--border-color)] overflow-hidden bg-[var(--bg-card)]">
                        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 shrink-0">
                            <div className="flex gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] shadow-inner">
                                <button onClick={() => setActivityTab('ACTIVITY')} className={`flex-1 px-3 py-2 text-[11px] font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-all ${activityTab === 'ACTIVITY' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                    <ShieldCheck size={14}/> To Verify
                                </button>
                                <button onClick={() => setActivityTab('TASKS')} className={`flex-1 px-3 py-2 text-[11px] font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-all ${activityTab === 'TASKS' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                    <CheckSquare size={14}/> Tasks
                                </button>
                            </div>
                        </div>
                        
                        {activityTab === 'TASKS' ? (
                            <div className="flex flex-col flex-1 min-h-0">
                                <div className="p-3 border-b border-[var(--border-color)]/50"><form onSubmit={addTask} className="flex gap-2"><input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add quick task..." className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm px-4 py-2.5 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none shadow-inner" /><button type="submit" className="bg-[var(--accent)] text-white p-2.5 rounded-xl hover:opacity-90 shadow-lg shadow-[var(--accent)]/20"><Plus size={20} /></button></form></div>
                                <div className="flex-1 overflow-y-auto space-y-1 p-2 custom-scrollbar">
                                    {filteredTasks.length > 0 ? filteredTasks.map(t => (
                                        <div key={t.id} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-main)] transition-colors border border-transparent hover:border-[var(--border-color)]">
                                            <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="w-5 h-5 rounded-md border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--accent)] focus:ring-[var(--accent)]" />
                                            <span className={`flex-1 text-sm font-medium transition-all ${t.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{t.text}</span>
                                            <button onClick={() => deleteTask(t.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>
                                        </div>
                                    )) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-30 py-20"><CheckCircle size={40} className="mb-2"/><p className="text-xs">{globalSearch ? 'No matching tasks' : 'No pending tasks'}</p></div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-0 divide-y divide-[var(--border-color)]/50" style={{ touchAction: 'pan-y' }}>
                                    {filteredVerificationQueue.length > 0 ? (
                                        filteredVerificationQueue.map((m) => (
                                            <div key={m.id} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-main)]/80 transition-all group cursor-default relative animate-fadeIn">
                                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-blue-900/20 text-blue-400 group-hover:scale-110 transition-transform border border-blue-900/30">
                                                    <ShoppingCart size={18}/>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-sm font-bold text-[var(--text-primary)] truncate block pr-2 group-hover:text-blue-300 transition-colors">{m.name}</span>
                                                        <span className="text-sm font-mono font-bold text-green-400 shrink-0">{m.currentStock} <span className="text-[10px] text-gray-600 font-sans">{m.unit}</span></span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-1.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Last Issued: {m.lastIssueDate ? new Date(m.lastIssueDate).toLocaleDateString() : 'Historical'}</span>
                                                            <span className="text-[10px] text-yellow-500/70 font-medium">Loc: {m.location || 'Not Set'}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleVerifyItem(m)}
                                                            className="bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white p-2 rounded-xl transition-all border border-green-500/20 shadow-sm hover:shadow-green-500/20 active:scale-95"
                                                            title="Mark as Verified"
                                                        >
                                                            <ShieldCheck size={18}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-500 py-20 px-6 text-center animate-fadeIn">
                                            <ShieldCheck size={48} className="opacity-10 mb-3"/>
                                            <p className="text-sm font-bold opacity-30">{globalSearch ? 'No matching items' : 'Verification Queue Empty'}</p>
                                            <p className="text-[10px] opacity-20 mt-1 uppercase tracking-widest">{globalSearch ? '' : 'All issued items with stock have been checked today'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default Dashboard;