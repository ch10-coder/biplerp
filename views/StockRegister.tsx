
import React, { useState, useMemo, useEffect, useRef, forwardRef } from 'react';
import { Material, Transaction, AppData } from '../types';
import { Button } from '../components/ui/Button';
import { FilterHeader } from '../components/ui/FilterHeader';
import { MultiSelect } from '../components/ui/MultiSelect';
import { SlidersHorizontal, Check, Layers, Box, Trash2, Edit, Save, X, Filter, LayoutGrid, List, MapPin, Building, Download, Search, ArrowUpDown, History, FileText } from 'lucide-react';
import { deleteTransaction, updateTransaction, updateMaterial, calculateBatches } from '../services/storageService';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TableVirtuoso, VirtuosoGrid } from 'react-virtuoso';

interface Props {
    data: AppData;
    onUpdate: () => void;
}

// ... (Types & Config logic remain same) ...
interface BatchItem {
    uniqueId: string; 
    uin: string; 
    materialId: string;
    name: string;
    description?: string;
    department: string;
    group: string;
    location: string;
    unit: string;
    remainingQty: number; // Mapped to qty
    
    rate: number;
    avgRate: number;
    gstRate: number;
    gstAmount: number;
    vendor: string;
    billNo: string;
    billDate: string;
    grnNo: string;
    grnDate: string;
    mrnNo: string;
    mrnDate: string;
    gstNo: string;
}

const resolveBatchGroup = (b: any, mat: Material, groups: string[]) => {
    if (b.group) return b.group;
    if (b.department) {
        const deptName = b.department.trim();
        const matchingGroup = groups.find(g => g.toLowerCase() === deptName.toLowerCase());
        if (matchingGroup) return matchingGroup;
    }
    return mat.group || 'General';
};

const getValue = (item: any, key: string, mode: 'AGGREGATE' | 'BATCH'): string => {
    if (key === 'value') {
        const qty = mode === 'BATCH' ? item.remainingQty : item.currentStock;
        const rate = mode === 'BATCH' ? (item.avgRate || item.rate) : item.pricePerUnit;
        return (qty * rate).toFixed(2);
    }
    if (key === 'qty' || key === 'remainingQty') return (mode === 'BATCH' ? item.remainingQty : item.currentStock).toString();
    
    // High Precision for Rates (4 decimals)
    if (key === 'rate') return (mode === 'BATCH' ? item.rate : item.pricePerUnit).toFixed(4);
    if (key === 'avgRate') return (item.avgRate || item.rate || 0).toFixed(4);
    
    if (key === 'minLevel' || key === 'description') return item[key] ? String(item[key]) : '';
    if (key.includes('Date') || key === 'lastVerified') {
        return item[key] ? new Date(item[key]).toLocaleDateString('en-GB') : '-';
    }
    if (key === 'uin') return item.uin ? `#${item.uin.slice(-6)}` : '-';
    
    const val = item[key];
    return val !== undefined && val !== null ? String(val) : '-';
};

const RateSparkline = React.memo(({ data }: { data: number[] }) => {
    if (data.length < 2) return null;
    const chartData = data.map((val, idx) => ({ i: idx, val }));
    const isUp = data[data.length - 1] >= data[0];
    
    return (
        <div className="w-16 h-6">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id={isUp ? "colorUp" : "colorDown"} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Area 
                        type="monotone" 
                        dataKey="val" 
                        stroke={isUp ? "#10b981" : "#ef4444"} 
                        fill={`url(#${isUp ? "colorUp" : "colorDown"})`}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
});

const StockRegister: React.FC<Props> = ({ data, onUpdate }) => {
    const { materials, transactions, groups } = data;

    // ... (All State Hooks remain same) ...
    const [rawSearch, setRawSearch] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    
    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setGlobalSearch(rawSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [rawSearch]);

    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
    const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    
    const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value' | 'date'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const [dataMode, setDataMode] = useState<'AGGREGATE' | 'BATCH'>('AGGREGATE');
    const [layoutMode, setLayoutMode] = useState<'TABLE' | 'CARD'>('TABLE');
    
    const [aggCols, setAggCols] = useState([
        { key: 'name', label: 'Item Name', width: 220, isNumeric: false },
        { key: 'description', label: 'Desc', width: 120, isNumeric: false },
        { key: 'department', label: 'Dept', width: 100, isNumeric: false },
        { key: 'group', label: 'Group', width: 100, isNumeric: false },
        { key: 'location', label: 'Loc', width: 80, isNumeric: false },
        { key: 'minLevel', label: 'Min', width: 60, isNumeric: true },
        { key: 'unit', label: 'UOM', width: 60, isNumeric: false },
        { key: 'qty', label: 'Stock', width: 80, isNumeric: true },
        { key: 'rate', label: 'Rate (Avg)', width: 120, isNumeric: true },
        { key: 'value', label: 'Value', width: 100, isNumeric: true },
        { key: 'lastVerified', label: 'Verified', width: 90, isNumeric: false },
    ]);

    const [batchCols, setBatchCols] = useState([
        { key: 'mrnNo', label: 'MRN', width: 80, isNumeric: false },
        { key: 'mrnDate', label: 'Date', width: 90, isNumeric: false },
        { key: 'billNo', label: 'Bill', width: 100, isNumeric: false },
        { key: 'vendor', label: 'Vendor', width: 150, isNumeric: false },
        { key: 'name', label: 'Item Name', width: 200, isNumeric: false },
        { key: 'unit', label: 'UOM', width: 60, isNumeric: false },
        { key: 'qty', label: 'Qty', width: 80, isNumeric: true },
        { key: 'rate', label: 'Basic Rate', width: 90, isNumeric: true },
        { key: 'avgRate', label: 'Avg Rate', width: 90, isNumeric: true },
        { key: 'value', label: 'Total', width: 100, isNumeric: true },
        { key: 'department', label: 'Dept', width: 100, isNumeric: false },
        { key: 'location', label: 'Bin', width: 80, isNumeric: false },
        { key: 'group', label: 'Group', width: 100, isNumeric: false }
    ]);

    const [visibleAggKeys, setVisibleAggKeys] = useState<string[]>(['name', 'description', 'group', 'location', 'unit', 'qty', 'rate', 'value', 'lastVerified']);
    const [visibleBatchKeys, setVisibleBatchKeys] = useState<string[]>(['mrnNo', 'mrnDate', 'billNo', 'vendor', 'name', 'qty', 'rate', 'avgRate', 'value', 'department']);
    
    const [isColSelectorOpen, setIsColSelectorOpen] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [ledgerBatches, setLedgerBatches] = useState<any[]>([]);
    const [ledgerHistory, setLedgerHistory] = useState<Transaction[]>([]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedMaterial) {
            const freshMat = materials.find(m => m.id === selectedMaterial.id);
            if (freshMat) {
                const batches = calculateBatches(freshMat.id, data);
                setLedgerBatches(batches);
                const history = transactions
                    .filter(t => t.materialId === freshMat.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setLedgerHistory(history);
            }
        }
    }, [selectedMaterial, materials, transactions, data]);

    const handleColumnResize = (colKey: string, newWidth: number) => {
        if (dataMode === 'BATCH') {
            setBatchCols(prev => prev.map(c => c.key === colKey ? { ...c, width: newWidth } : c));
        } else {
            setAggCols(prev => prev.map(c => c.key === colKey ? { ...c, width: newWidth } : c));
        }
    };

    const batchData = useMemo(() => {
        if (dataMode !== 'BATCH') return [];
        let allBatches: BatchItem[] = [];
        materials.forEach(mat => {
            const batches = calculateBatches(mat.id, data);
            batches.forEach(b => {
                let batchRate = b.rate || 0;
                if (b.totalValue > 0 && b.quantity > 0) {
                     batchRate = (b.totalValue - (b.gstAmount||0)) / b.quantity;
                }

                allBatches.push({
                    uniqueId: `${b.id}_${mat.id}`,
                    uin: b.id,
                    materialId: mat.id,
                    name: mat.name, 
                    description: mat.description,
                    department: b.department || mat.department, 
                    group: resolveBatchGroup(b, mat, groups), 
                    location: b.location || mat.location, 
                    unit: mat.unit,
                    remainingQty: b.remainingQty,
                    rate: batchRate, 
                    avgRate: batchRate, 
                    gstRate: b.gstRate || 0,
                    gstAmount: 0,
                    vendor: b.vendor || '-',
                    billNo: b.billNo || '-',
                    billDate: b.billDate || '-',
                    grnNo: b.grnNo || '-',
                    grnDate: b.grnDate || '-',
                    mrnNo: b.mrnNo || '-',
                    mrnDate: b.mrnDate || '-',
                    gstNo: b.gstNo || '-'
                });
            });
        });
        return allBatches;
    }, [materials, transactions, dataMode, groups, data]);

    const batchCounts = useMemo(() => {
        if (dataMode === 'BATCH') return {};
        const counts: Record<string, number> = {};
        materials.forEach(m => {
            const b = calculateBatches(m.id, data);
            counts[m.id] = b.length;
        });
        return counts;
    }, [materials, data, dataMode]);

    const baseData = dataMode === 'BATCH' ? batchData : materials;

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        baseData.forEach((item: any) => values.add(getValue(item, key, dataMode)));
        return Array.from(values).sort();
    };

    const filteredData = useMemo(() => {
        let result = baseData.filter((item: any) => {
            if (globalSearch) {
                const term = globalSearch.toLowerCase();
                const searchString = [
                    item.name, 
                    item.description, 
                    item.group, 
                    item.department, 
                    item.location,
                    dataMode === 'BATCH' ? item.vendor : '',
                    dataMode === 'BATCH' ? item.billNo : '',
                    dataMode === 'BATCH' ? item.mrnNo : ''
                ].join(' ').toLowerCase();
                
                if (!searchString.includes(term)) return false;
            }
            for (const [key, val] of Object.entries(activeFilters)) {
                const selectedValues = val as string[];
                if (selectedValues.length === 0) continue;
                const itemVal = getValue(item, key, dataMode);
                if (!selectedValues.includes(itemVal)) return false;
            }
            return true;
        });

        return result.sort((a: any, b: any) => {
            let valA: any = '';
            let valB: any = '';
            if (sortBy === 'name') { valA = a.name; valB = b.name; }
            else if (sortBy === 'stock') { 
                valA = dataMode === 'BATCH' ? a.remainingQty : a.currentStock;
                valB = dataMode === 'BATCH' ? b.remainingQty : b.currentStock;
            }
            else if (sortBy === 'value') {
                const qtyA = dataMode === 'BATCH' ? a.remainingQty : a.currentStock;
                const rateA = dataMode === 'BATCH' ? (a.avgRate || a.rate) : a.pricePerUnit;
                valA = qtyA * rateA;
                
                const qtyB = dataMode === 'BATCH' ? b.remainingQty : b.currentStock;
                const rateB = dataMode === 'BATCH' ? (b.avgRate || b.rate) : b.pricePerUnit;
                valB = qtyB * rateB;
            }
            else if (sortBy === 'date') {
                valA = new Date(dataMode === 'BATCH' ? (a.mrnDate || a.billDate) : (a.lastVerified || 0)).getTime();
                valB = new Date(dataMode === 'BATCH' ? (b.mrnDate || b.billDate) : (b.lastVerified || 0)).getTime();
            }
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [baseData, globalSearch, activeFilters, sortBy, sortDir, dataMode]);

    const handleFilterChange = (key: string, values: string[]) => {
        setActiveFilters(prev => {
            const next = { ...prev, [key]: values };
            if (values.length === 0) delete next[key];
            return next;
        });
        setOpenFilterCol(null);
    };

    const toggleColumn = (key: string) => {
        const setter = dataMode === 'BATCH' ? setVisibleBatchKeys : setVisibleAggKeys;
        setter(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
    };

    const handleExport = () => {
        const cols = dataMode === 'BATCH' ? batchCols : aggCols;
        const visibleKeys = dataMode === 'BATCH' ? visibleBatchKeys : visibleAggKeys;
        
        const headers = cols.filter(c => visibleKeys.includes(c.key)).map(c => c.label);
        const keys = cols.filter(c => visibleKeys.includes(c.key)).map(c => c.key);

        const companyName = data.appSettings?.companyName || 'My Company';
        const reportTitle = `Stock Register - ${dataMode === 'BATCH' ? 'Batch Wise' : 'Summary'}`;
        const dateStr = new Date().toLocaleString();

        const csvContent = [
            `"${companyName}"`,
            `"${reportTitle}"`,
            `"Generated on: ${dateStr}"`,
            "",
            headers.join(','),
            ...filteredData.map((item: any) => keys.map(k => `"${getValue(item, k, dataMode).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Stock_${dataMode}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const MobileFilterCard = () => (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg mb-4 space-y-4 md:hidden animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Active Filters</h3>
                <Button onClick={() => { setActiveFilters({}); setRawSearch(''); setGlobalSearch(''); }} variant="secondary" className="text-xs py-1 h-7">Clear All</Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
                {['group', 'department', 'location', (dataMode === 'BATCH' ? 'vendor' : null)].filter(Boolean).map((key: any) => {
                    const unique = getUniqueValues(key);
                    return (
                         <MultiSelect 
                            key={key}
                            label={`Filter ${key}`}
                            options={unique}
                            selected={activeFilters[key] || []}
                            onChange={(vals) => handleFilterChange(key, vals)}
                            className="w-full"
                         />
                    )
                })}
            </div>
        </div>
    );

    const currentCols = dataMode === 'BATCH' ? batchCols : aggCols;
    const activeColumns = currentCols.filter(c => (dataMode === 'BATCH' ? visibleBatchKeys : visibleAggKeys).includes(c.key));
    const handleOpenLedger = (item: any) => { const mat = materials.find(m => m.id === (item.materialId || item.id)); if (mat) { setSelectedMaterial(mat); } };

    return (
        <div className="h-full flex flex-col p-4 md:p-4" onClick={() => { if(isColSelectorOpen) setIsColSelectorOpen(false); }}>
            {/* --- Header Section --- */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 mb-4">
                <div className="flex items-center gap-4 w-full lg:w-auto justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                            {dataMode === 'BATCH' ? <Layers size={24} className="text-[var(--accent)]"/> : <Box size={24} className="text-[var(--accent)]"/>}
                            Stock Register
                        </h2>
                        <p className="text-[10px] md:text-xs text-[var(--text-secondary)] mt-1 hidden md:block">
                            {dataMode === 'BATCH' ? 'FIFO Batches (MRN Format)' : 'Stock Summary (Aggregate)'}
                        </p>
                    </div>
                    {/* Mobile Controls */}
                    <div className="flex gap-2 md:hidden">
                        <button onClick={() => setShowMobileFilters(!showMobileFilters)} className={`p-2 rounded-lg border ${Object.keys(activeFilters).length > 0 ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-gray-400'}`}>
                            <Filter size={18} />
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 w-full lg:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:w-56">
                        <Search className="absolute left-3 top-2.5 text-gray-500" size={14}/>
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={rawSearch} 
                            onChange={e => setRawSearch(e.target.value)} 
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg pl-9 pr-4 py-2 text-xs md:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5">
                        <button 
                            onClick={() => setDataMode('AGGREGATE')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${dataMode === 'AGGREGATE' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-gray-400 hover:text-[var(--text-primary)]'}`}
                        >
                            Summary
                        </button>
                        <button 
                            onClick={() => setDataMode('BATCH')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${dataMode === 'BATCH' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-gray-400 hover:text-[var(--text-primary)]'}`}
                        >
                            Batches
                        </button>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5">
                        <button onClick={() => setLayoutMode('TABLE')} className={`p-1.5 rounded ${layoutMode === 'TABLE' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-gray-400 hover:text-[var(--text-primary)]'}`}><List size={16}/></button>
                        <button onClick={() => setLayoutMode('CARD')} className={`p-1.5 rounded ${layoutMode === 'CARD' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-gray-400 hover:text-[var(--text-primary)]'}`}><LayoutGrid size={16}/></button>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2">
                        <span className="text-[var(--text-secondary)] text-xs mr-1 hidden md:inline">Sort:</span>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as any)} 
                            className="bg-transparent text-[var(--text-primary)] text-xs border-none focus:ring-0 cursor-pointer"
                        >
                            <option value="name">Name</option>
                            <option value="stock">Stock</option>
                            <option value="value">Value</option>
                            <option value="date">Date</option>
                        </select>
                        <button onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')} className="ml-1 p-1 text-gray-400 hover:text-[var(--text-primary)]">
                            <ArrowUpDown size={14} />
                        </button>
                    </div>

                    {/* Columns & Export */}
                    <div className="flex gap-2">
                        <div className="relative" onClick={e => e.stopPropagation()}>
                            <Button variant="secondary" onClick={() => setIsColSelectorOpen(!isColSelectorOpen)} className="px-2 h-full">
                                <SlidersHorizontal size={16} />
                            </Button>
                            {isColSelectorOpen && (
                                <div className={`absolute top-full mt-2 w-64 glass-effect rounded-lg shadow-2xl z-50 p-2 max-h-80 overflow-y-auto left-0 lg:left-auto lg:right-0 bg-[var(--bg-card)]`}>
                                    <div className="text-xs text-[var(--text-secondary)] uppercase font-bold px-2 py-1 mb-1">
                                        {dataMode === 'BATCH' ? 'Batch Columns' : 'Summary Columns'}
                                    </div>
                                    {currentCols.map(col => (
                                        <div 
                                            key={col.key} 
                                            className="flex items-center gap-2 p-2 hover:bg-[var(--bg-card-hover)] rounded cursor-pointer text-xs text-[var(--text-primary)]"
                                            onClick={() => toggleColumn(col.key)}
                                        >
                                            <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all ${activeColumns.find(c => c.key === col.key) ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-gray-600'}`}>
                                                {activeColumns.find(c => c.key === col.key) && <Check size={10} className="text-white" />}
                                            </div>
                                            {col.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button onClick={handleExport} variant="primary" className="text-xs whitespace-nowrap flex items-center gap-1 shadow-lg shadow-[var(--accent)]/10">
                            <Download size={14}/> Export
                        </Button>
                    </div>
                </div>
            </div>

            {showMobileFilters && <MobileFilterCard />}

            {/* --- Content Area --- */}
            {layoutMode === 'TABLE' ? (
                <div className="flex-1 border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl shadow-lg glass-effect overflow-hidden">
                    <TableVirtuoso
                        data={filteredData}
                        style={{ height: '100%' }}
                        className="custom-scrollbar"
                        fixedHeaderContent={() => (
                            <tr className="bg-[var(--bg-main)] shadow-md">
                                {activeColumns.map((col) => (
                                    <FilterHeader 
                                        key={col.key}
                                        colKey={col.key}
                                        label={col.label}
                                        width={col.width}
                                        isNumeric={col.isNumeric}
                                        uniqueValues={getUniqueValues(col.key)}
                                        activeSelection={activeFilters[col.key] || []}
                                        isOpen={openFilterCol === col.key}
                                        onToggle={() => setOpenFilterCol(openFilterCol === col.key ? null : col.key)}
                                        onApply={(vals) => handleFilterChange(col.key, vals)}
                                        onClose={() => setOpenFilterCol(null)}
                                        onResize={(w) => handleColumnResize(col.key, w)}
                                    />
                                ))}
                            </tr>
                        )}
                        itemContent={(index, item) => {
                            const batchCount = batchCounts[(item as any).id] || 0;
                            const hasMultipleBatches = dataMode === 'AGGREGATE' && batchCount > 1;
                            
                            // Calculate Sparkline Data
                            let sparklineData: number[] = [];
                            if (dataMode === 'AGGREGATE' && activeColumns.some(c => c.key === 'rate')) {
                                const history = transactions
                                    .filter(t => t.materialId === (item as any).id && t.type === 'PURCHASE')
                                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                    .slice(-10);
                                sparklineData = history.map(t => t.rate);
                            }

                            return (
                                <>
                                    {activeColumns.map(col => {
                                        const val = getValue(item, col.key, dataMode);
                                        
                                        if (col.key === 'name' && hasMultipleBatches) {
                                            return (
                                                <td key={col.key} className="px-2 py-1.5 border-r border-[var(--border-color)] font-medium text-[var(--text-primary)]" style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} onClick={() => handleOpenLedger(item)}>
                                                    <div className="flex items-center gap-2 h-full cursor-pointer">
                                                        <div className="truncate flex-1" title={val}>{val}</div>
                                                        <div className="flex items-center gap-0.5 bg-purple-900/30 text-purple-400 text-[9px] px-1.5 py-0.5 rounded border border-purple-900/50">
                                                            <Layers size={10}/> {batchCount}
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        if (col.key === 'rate' && dataMode === 'AGGREGATE') {
                                            return (
                                                <td key={col.key} className="px-2 py-1.5 border-r border-[var(--border-color)] text-right font-mono" style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} onClick={() => handleOpenLedger(item)}>
                                                    <div className="flex items-center justify-end gap-2 h-full cursor-pointer">
                                                        <RateSparkline data={sparklineData} />
                                                        <span>{val}</span>
                                                    </div>
                                                </td>
                                            )
                                        }

                                        return (
                                            <td key={col.key} className={`px-2 py-1.5 border-r border-[var(--border-color)] truncate cursor-pointer ${col.isNumeric ? 'text-right font-mono' : ''} ${col.key === 'name' ? 'font-medium text-[var(--text-primary)]' : ''} ${col.key === 'mrnNo' ? 'text-yellow-500 font-mono' : ''}`} style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} onClick={() => handleOpenLedger(item)}>
                                                {val}
                                            </td>
                                        );
                                    })}
                                </>
                            );
                        }}
                        fixedFooterContent={() => (
                            <tr className="bg-[var(--bg-main)] border-t border-[var(--border-color)] font-bold text-[var(--text-secondary)]">
                                <td colSpan={activeColumns.length} className="px-4 py-2 text-right text-[var(--text-primary)]">
                                    Count: {filteredData.length} | 
                                    Value: <span className="text-green-400">₹ {filteredData.reduce((acc, i) => acc + parseFloat(getValue(i, 'value', dataMode)), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </td>
                            </tr>
                        )}
                    />
                </div>
            ) : (
                <VirtuosoGrid
                    style={{ height: '100%' }}
                    data={filteredData}
                    totalCount={filteredData.length}
                    components={{
                        // FIX: Add <HTMLDivElement> to forwardRef
                        List: forwardRef<HTMLDivElement>((props, ref) => (
                            <div
                                {...props}
                                ref={ref}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 pb-24"
                            />
                        )),
                        // FIX: Add <HTMLDivElement> to forwardRef
                        Item: forwardRef<HTMLDivElement>((props, ref) => (
                            <div {...props} ref={ref} className="h-full" />
                        ))
                    }}
                    itemContent={(index, item) => {
                        const batchCount = batchCounts[(item as any).id] || 0;
                        return (
                            <div key={dataMode === 'BATCH' ? (item as any).uniqueId : (item as any).id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/5 transition-all cursor-pointer group active:scale-[0.98] h-full flex flex-col justify-between" onClick={() => handleOpenLedger(item)}>
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="overflow-hidden pr-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate" title={item.name}>{item.name}</h4>
                                                {dataMode === 'AGGREGATE' && batchCount > 1 && (
                                                    <span className="text-[9px] bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded border border-purple-900/50 flex items-center gap-1">
                                                        <Layers size={10}/> {batchCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">
                                                {dataMode === 'BATCH' ? ((item as any).vendor || 'Opening') : item.group}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-green-400 font-bold font-mono text-sm">₹{parseFloat(getValue(item, 'value', dataMode)).toLocaleString()}</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                                                <span className="text-[var(--text-primary)] font-bold">{getValue(item, 'qty', dataMode)}</span> {item.unit}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 pt-3 border-t border-[var(--border-color)] mt-auto">
                                    <div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-2 py-1 rounded text-[var(--text-secondary)] border border-[var(--border-color)] truncate max-w-[40%]">
                                        <Building size={10}/> {item.department || '-'}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-2 py-1 rounded text-yellow-500 border border-[var(--border-color)] ml-auto truncate">
                                        <MapPin size={10}/> {item.location || '-'}
                                    </div>
                                </div>
                            </div>
                        );
                    }}
                />
            )}

            {/* --- ITEM LEDGER MODAL --- */}
            {selectedMaterial && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="glass-effect w-full max-w-4xl rounded-2xl border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden bg-[var(--bg-card)]">
                        <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-main)]/50">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <FileText size={20} className="text-[var(--accent)]"/>
                                    {selectedMaterial.name}
                                </h3>
                                <div className="text-xs text-[var(--text-secondary)] flex gap-4 mt-1.5 font-mono">
                                    <span>Stock: <strong className="text-[var(--text-primary)]">{selectedMaterial.currentStock} {selectedMaterial.unit}</strong></span>
                                    <span>Value: <strong className="text-green-400">₹{(selectedMaterial.currentStock * selectedMaterial.pricePerUnit).toFixed(2)}</strong></span>
                                    <span>Grp: {selectedMaterial.group}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedMaterial(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-full hover:bg-[var(--bg-card)] transition-colors"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-8">
                            {/* Section 1: Active Batches */}
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-3 flex items-center gap-2 tracking-wider"><Layers size={14}/> Active FIFO Batches ({ledgerBatches.length})</h4>
                                <div className="border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                                        <thead className="bg-[var(--bg-main)] text-[var(--text-secondary)] uppercase font-semibold">
                                            <tr>
                                                <th className="p-3">MRN / Date</th>
                                                <th className="p-3">Vendor / Bill</th>
                                                <th className="p-3 text-right">Remaining</th>
                                                <th className="p-3 text-right">Rate</th>
                                                <th className="p-3 text-right">Value</th>
                                                <th className="p-3">Loc</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]/50">
                                            {ledgerBatches.map((b, i) => (
                                                <tr key={i} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                                                    <td className="p-3">
                                                        <div className="text-yellow-500 font-mono">{b.mrnNo || '-'}</div>
                                                        <div className="text-[10px] mt-0.5">{b.mrnDate ? new Date(b.mrnDate).toLocaleDateString() : '-'}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="text-[var(--text-primary)] truncate max-w-[150px] font-medium">{b.vendor || 'Opening'}</div>
                                                        <div className="text-[10px] text-blue-400 mt-0.5">{b.billNo}</div>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-[var(--text-primary)] font-mono">{b.remainingQty}</td>
                                                    <td className="p-3 text-right font-mono">{b.rate.toFixed(4)}</td>
                                                    <td className="p-3 text-right text-green-400 font-mono">{(b.remainingQty * b.rate).toFixed(2)}</td>
                                                    <td className="p-3 text-[10px]">{b.location || selectedMaterial.location}</td>
                                                </tr>
                                            ))}
                                            {ledgerBatches.length === 0 && <tr><td colSpan={6} className="p-6 text-center italic text-[var(--text-secondary)]">No active batches (Stock is 0)</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section 2: Transaction History */}
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-3 flex items-center gap-2 tracking-wider"><History size={14}/> Transaction History</h4>
                                <div className="space-y-2">
                                    {ledgerHistory.map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:border-[var(--border-highlight)] transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner ${t.type === 'PURCHASE' ? 'bg-green-900/20 text-green-400 border border-green-900/50' : t.type === 'ISSUE' ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'bg-yellow-900/20 text-yellow-400 border border-yellow-900/50'}`}>
                                                    {(t.type || '').substring(0,2)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-[var(--text-primary)]">{t.type === 'PURCHASE' ? t.vendor : t.department}</div>
                                                    <div className="text-[10px] text-[var(--text-secondary)] flex gap-2 mt-0.5">
                                                        <span>{new Date(t.date).toLocaleDateString()}</span>
                                                        <span className="text-gray-500">•</span>
                                                        <span className="text-[var(--text-secondary)]">{t.type === 'PURCHASE' ? `Bill: ${t.billNo}` : t.remarks || 'No remarks'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold font-mono text-sm ${t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0) ? 'text-green-400' : 'text-red-400'}`}>
                                                    {t.type === 'PURCHASE' || (t.type === 'ADJUSTMENT' && t.quantity > 0) ? '+' : ''}{t.quantity}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">@{t.rate.toFixed(4)}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {ledgerHistory.length === 0 && <div className="text-center text-[var(--text-secondary)] italic py-6 border border-dashed border-[var(--border-color)] rounded-xl">No transaction history found.</div>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-[var(--bg-main)]/50 border-t border-[var(--border-color)] text-right backdrop-blur-md">
                            <Button variant="secondary" onClick={() => setSelectedMaterial(null)}>Close Panel</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockRegister;
