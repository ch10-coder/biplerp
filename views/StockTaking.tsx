import React, { useState, useMemo } from 'react';
import { Material, Transaction, AppData } from '../types';
import { updateMaterial, addTransactions, bulkUpdateMaterials, calculateBatches, repairMaterialTransactionValues, recalculateAllStock, getAppData } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { MultiSelect } from '../components/ui/MultiSelect';
import { Download, ChevronDown, FileText, ClipboardList, History, Info, CheckCheck, RotateCcw, Search, Filter, Layers, List, LayoutGrid, MapPin, Calendar, Hash, Tag, Building, X, Check, Undo2, FilterX, RefreshCw, AlertTriangle, Hammer } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Props {
    data: AppData;
    onUpdate: () => void;
}

const StockTaking: React.FC<Props> = ({ data, onUpdate }) => {
    const { materials, transactions, departments, groups } = data;

    // View Mode State
    const [viewMode, setViewMode] = useState<'SUMMARY' | 'REGISTER'>('SUMMARY');

    const [activeId, setActiveId] = useState<string | null>(null);
    const [editStock, setEditStock] = useState<string>('');
    const [editLocation, setEditLocation] = useState<string>('');
    
    // Verification Modal State
    const [verifyTarget, setVerifyTarget] = useState<Material | null>(null);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroups, setFilterGroups] = useState<string[]>([]);
    const [filterDepts, setFilterDepts] = useState<string[]>([]);
    const [filterLocations, setFilterLocations] = useState<string[]>([]);
    
    const [sortBy, setSortBy] = useState<'name' | 'location' | 'stock' | 'date'>('location');
    const [showVerified, setShowVerified] = useState(false); 
    const [cyclePeriod, setCyclePeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | '2MONTHS' | '3MONTHS'>('TODAY');
    
    // Export Menu State
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false); 

    // --- Derived Locations ---
    // FIX: Add explicit <string> to Set constructor to ensure Array.from returns string[] instead of unknown[]
    const locations = useMemo<string[]>(() => Array.from(new Set<string>((materials || []).map(m => (m.location || 'Unknown').trim()))).sort(), [materials]);

    const uniqueDepartments = useMemo(() => {
        const depts = new Set<string>();
        (departments || []).forEach(d => { if (d) depts.add(d.trim()); });
        (materials || []).forEach(m => { if (m.department) depts.add(m.department.trim()); });
        (transactions || []).forEach(t => { if (t.department) depts.add(t.department.trim()); });
        return Array.from(depts).sort();
    }, [departments, materials, transactions]);

    const uniqueGroups = useMemo(() => {
        const grps = new Set<string>();
        (groups || []).forEach(g => { if (g) grps.add(g.trim()); });
        (materials || []).forEach(m => { if (m.group) grps.add(m.group.trim()); });
        (transactions || []).forEach(t => { if (t.group) grps.add(t.group.trim()); });
        return Array.from(grps).sort();
    }, [groups, materials, transactions]);

    // --- OPTIMIZATION: Memoize Cycle Cutoff Date ---
    const cycleCutoff = useMemo(() => {
        const now = new Date();
        // Reset to start of day for fair comparison
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); 
        
        if (cyclePeriod === 'WEEK') {
            cutoff.setDate(cutoff.getDate() - 6);
        } else if (cyclePeriod === 'MONTH') {
            cutoff.setDate(cutoff.getDate() - 29);
        } else if (cyclePeriod === '2MONTHS') {
            cutoff.setDate(cutoff.getDate() - 59);
        } else if (cyclePeriod === '3MONTHS') {
            cutoff.setDate(cutoff.getDate() - 89);
        }
        return cutoff;
    }, [cyclePeriod]);

    // --- REGISTER DATA CALCULATION (MRN WISE) ---
    const registerData = useMemo(() => {
        if (viewMode !== 'REGISTER') return [];

        let allBatches: any[] = [];

        materials.forEach(mat => {
            // STRICT 0 STOCK FILTER - Filter out if stock is 0 or essentially 0
            if ((mat.currentStock || 0) <= 0.0001) return;

            // Apply Filters early for performance
            if (filterGroups.length > 0 && !filterGroups.some(g => g.toLowerCase() === (mat.group || '').trim().toLowerCase())) return;
            if (filterDepts.length > 0 && !filterDepts.some(d => d.toLowerCase() === (mat.department || '').trim().toLowerCase())) return;
            if (filterLocations.length > 0 && !filterLocations.some(l => l.toLowerCase() === (mat.location || 'Unknown').trim().toLowerCase())) return;
            if (searchTerm && !mat.name.toLowerCase().includes(searchTerm.toLowerCase()) && !mat.location.toLowerCase().includes(searchTerm.toLowerCase())) return;

            // Get FIFO Batches
            const batches = calculateBatches(mat.id, data);
            
            batches.forEach(b => {
                allBatches.push({
                    uniqueId: `${b.id}_${mat.id}`,
                    matId: mat.id,
                    name: mat.name,
                    group: mat.group,
                    department: mat.department,
                    unit: mat.unit,
                    location: mat.location || b.location, 
                    
                    // Upload Format Fields
                    mrnNo: b.mrnNo || '-',
                    mrnDate: b.mrnDate,
                    grnNo: b.grnNo || '-',
                    grnDate: b.grnDate,
                    billNo: b.billNo || '-',
                    billDate: b.billDate,
                    vendor: b.vendor || 'Opening/Adj',
                    gstNo: b.gstNo || '-',
                    gstRate: b.gstRate || 0,
                    
                    qty: b.remainingQty,
                    rate: b.rate,
                    avgRate: b.avgRate || b.rate,
                    value: b.remainingQty * (b.avgRate || b.rate)
                });
            });
        });

        // Sorting for Register
        return allBatches.sort((a, b) => {
            if (sortBy === 'date') return new Date(b.mrnDate || b.billDate || 0).getTime() - new Date(a.mrnDate || a.billDate || 0).getTime();
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'location') return (a.location||'').localeCompare(b.location||'');
            return 0;
        });

    }, [materials, data, viewMode, filterGroups, filterDepts, filterLocations, searchTerm, sortBy]);


    // --- SUMMARY DATA CALCULATION ---
    const { filteredAndSortedSummary, itemsPendingCount, itemsHiddenCount } = useMemo(() => {
        if (viewMode !== 'SUMMARY') return { filteredAndSortedSummary: [], itemsPendingCount: 0, itemsHiddenCount: 0 };

        let pending = 0;
        let hidden = 0;
        
        const filtered = materials
            .filter(m => {
                // Filter 1: STRICTLY Hide Zero Stock items
                // Handles undefined/null stock and very small float residuals
                // Using coalescing operator to ensure undefined treats as 0
                const stockVal = Number(m.currentStock ?? 0);
                if (isNaN(stockVal) || stockVal <= 0.0001) return false;

                const lastCheckTime = m.lastVerified ? new Date(m.lastVerified).getTime() : 0;
                const cutoffTime = cycleCutoff.getTime();
                
                const isVerified = lastCheckTime >= cutoffTime;
                
                if (!isVerified && m.currentStock > 0) pending++;
                
                const matchesSearch = searchTerm === '' || 
                                      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      (m.location || '').toLowerCase().includes(searchTerm.toLowerCase());
                
                const matchesGroup = filterGroups.length > 0 ? filterGroups.some(g => g.toLowerCase() === (m.group || '').trim().toLowerCase()) : true;
                const matchesDept = filterDepts.length > 0 ? filterDepts.some(d => d.toLowerCase() === (m.department || '').trim().toLowerCase()) : true;
                const matchesLoc = filterLocations.length > 0 ? filterLocations.some(l => l.toLowerCase() === (m.location || 'Unknown').trim().toLowerCase()) : true;

                if (!(matchesSearch && matchesGroup && matchesDept && matchesLoc)) return false;

                if (!showVerified && isVerified && !searchTerm) {
                    hidden++;
                    return false;
                }

                return true;
            })
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'location') return (a.location||'').localeCompare(b.location||'');
                if (sortBy === 'stock') return a.currentStock - b.currentStock;
                return 0;
            });
            
        return { filteredAndSortedSummary: filtered, itemsPendingCount: pending, itemsHiddenCount: hidden };
    }, [materials, searchTerm, filterGroups, filterDepts, filterLocations, sortBy, showVerified, cyclePeriod, cycleCutoff, viewMode]);


    const getRecentTransactions = (materialId: string) => {
        return transactions
            .filter(t => t.materialId === materialId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    };

    const handleEditStart = (m: Material) => {
        setActiveId(m.id);
        setEditStock(m.currentStock.toString());
        setEditLocation(m.location);
    };

    const handleQuickVerify = (e: React.MouseEvent, m: Material) => {
        e.preventDefault();
        e.stopPropagation(); 
        setVerifyTarget(m); // Open Modal
    };

    const confirmVerification = async () => {
        if (!verifyTarget) return;
        await updateMaterial({
            ...verifyTarget,
            lastVerified: new Date().toISOString()
        });
        setVerifyTarget(null);
        onUpdate();
    };

    const handleUnverify = async (e: React.MouseEvent, m: Material) => {
        e.stopPropagation();
        if (confirm(`Reset verification status for ${m.name}?`)) {
            // Explicitly set undefined to remove the property
            await updateMaterial({
                ...m,
                lastVerified: undefined
            });
            onUpdate();
        }
    };

    const handleSave = async (m: Material) => {
        const newStock = parseFloat(editStock);
        if (isNaN(newStock)) return;

        const diff = newStock - m.currentStock;

        if (diff !== 0) {
            const adjustment: Transaction = {
                id: Date.now().toString(),
                type: 'ADJUSTMENT',
                date: new Date().toISOString(),
                materialId: m.id,
                materialName: m.name,
                quantity: diff,
                rate: m.pricePerUnit,
                totalValue: Math.abs(diff) * m.pricePerUnit,
                department: m.department,
                remarks: `Stock Take: Adjusted from ${m.currentStock} to ${newStock}`
            };
            await addTransactions([adjustment]);
        }

        // Re-read the fresh material after addTransactions has recalculated stock
        const freshData = await getAppData();
        const freshMat = freshData.materials.find(x => x.id === m.id);
        
        await updateMaterial({
            ...(freshMat || m),
            location: editLocation,
            lastVerified: new Date().toISOString()
        });
        
        setActiveId(null);
        onUpdate();
    };

    const [isSyncing, setIsSyncing] = useState(false);
    const handleSyncStock = async () => {
        setIsSyncing(true);
        try {
            await recalculateAllStock();
            onUpdate();
        } finally {
            setIsSyncing(false);
        }
    };

    const handleResetVerification = async (e?: React.MouseEvent) => {
        if(e) e.preventDefault();
        
        const itemsToReset = materials.filter(m => {
             const matchesGroup = filterGroups.length > 0 ? filterGroups.some(g => g.toLowerCase() === (m.group || '').trim().toLowerCase()) : true;
             const matchesDept = filterDepts.length > 0 ? filterDepts.some(d => d.toLowerCase() === (m.department || '').trim().toLowerCase()) : true;
             return matchesGroup && matchesDept;
        });

        if (itemsToReset.length === 0) {
            alert("No items match the current Group/Department filters.");
            return;
        }

        const isFullReset = filterGroups.length === 0 && filterDepts.length === 0;
        const confirmMsg = isFullReset
            ? `⚠️ Are you sure you want to RESET verification for ALL ${itemsToReset.length} items?\n\nThis will mark everything as 'Pending Check'.`
            : `Are you sure you want to RESET verification for ${itemsToReset.length} items in the selected Groups/Departments?`;

        if (confirm(confirmMsg)) {
             await bulkUpdateMaterials(itemsToReset.map(m => m.id), { lastVerified: undefined });
             onUpdate();
             alert("Stock verification status has been reset.");
        }
    };

    const handleFixGhost = async (e: React.MouseEvent, m: Material) => {
        e.stopPropagation();
        await repairMaterialTransactionValues(m.id);
        onUpdate();
    };

    // --- Export Logic ---
    const handleExport = (type: 'VERIFIED' | 'PENDING' | 'BOTH' | 'CURRENT_VIEW', format: 'SUMMARY' | 'DETAILED') => {
        // ... (Export logic remains same)
        if (viewMode === 'REGISTER') {
            const headers = [
                "MRN", "MRN DATE", "GRN NO", "GRN DATE", "BILL NO", "BILL DATE", 
                "GSTIN", "VENDOR NAME", "ITEM NAME", "UOM", "QUANTITY", 
                "RATE (BASIC)", "AVG RATE (LANDED)", "TOTAL AMOUNT", 
                "DEPARTMENT", "BIN", "C. HEAD", "GST %"
            ];
            
            let csv = headers.join(",") + "\n";
            registerData.forEach(r => {
                const safe = (val: string | number) => `"${String(val || '').replace(/"/g, '""')}"`;
                const dateFmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB') : '-';
                
                csv += [
                    safe(r.mrnNo), dateFmt(r.mrnDate), safe(r.grnNo), dateFmt(r.grnDate),
                    safe(r.billNo), dateFmt(r.billDate), safe(r.gstNo), safe(r.vendor),
                    safe(r.name), safe(r.unit), r.qty, r.rate.toFixed(2), r.avgRate.toFixed(2), r.value.toFixed(2),
                    safe(r.department), safe(r.location), safe(r.group), r.gstRate || 0
                ].join(",") + "\n";
            });
            
            downloadCsv(csv, `Stock_Register_MRN_Wise_${new Date().toISOString().split('T')[0]}.csv`);
            return;
        }

        const cutoffTime = cycleCutoff.getTime();
        let itemsToExport: Material[] = [];

        if (type === 'CURRENT_VIEW') {
            itemsToExport = filteredAndSortedSummary;
        } else {
            itemsToExport = materials.filter(m => {
                const stockVal = Number(m.currentStock ?? 0);
                if (stockVal <= 0.0001) return false;
                
                // Respect Filters even in bulk exports if desired (User requested filtered export)
                // "BOTH" usually implies full dump, but if filters are active, we should probably respect them
                // to allow "Export All Filtered Items".
                // We will assume if filters are active, user wants filtered export.
                if (filterGroups.length > 0 && !filterGroups.some(g => g.toLowerCase() === (m.group || '').trim().toLowerCase())) return false;
                if (filterDepts.length > 0 && !filterDepts.some(d => d.toLowerCase() === (m.department || '').trim().toLowerCase())) return false;
                if (filterLocations.length > 0 && !filterLocations.some(l => l.toLowerCase() === (m.location || 'Unknown').trim().toLowerCase())) return false;

                const lastCheckTime = m.lastVerified ? new Date(m.lastVerified).getTime() : 0;
                const isVerified = lastCheckTime >= cutoffTime;

                if (type === 'VERIFIED' && !isVerified) return false;
                if (type === 'PENDING' && isVerified) return false;
                return true;
            });
        }
        
        if (itemsToExport.length === 0) { 
            alert(`No items found for export.`); 
            return; 
        }

        let csv = "";

        if (format === 'SUMMARY') {
            csv = "Material ID,Item Name,Group,Department,Location,UOM,Physical Count (System),Status,Last Verified,Valuation Rate,Total Value\n";
            itemsToExport.forEach(m => {
                const lastCheckTime = m.lastVerified ? new Date(m.lastVerified).getTime() : 0;
                const isVerified = lastCheckTime >= cutoffTime;
                const status = isVerified ? 'Verified' : 'Pending';
                const verifiedStr = m.lastVerified ? new Date(m.lastVerified).toLocaleDateString('en-GB') : '-';
                const s = (v: any) => `"${String(v||'').replace(/"/g, '""')}"`;
                
                csv += `${s(m.id)},${s(m.name)},${s(m.group)},${s(m.department)},${s(m.location)},${s(m.unit)},${m.currentStock},${status},${verifiedStr},${m.pricePerUnit.toFixed(4)},${(m.currentStock * m.pricePerUnit).toFixed(2)}\n`;
            });
        } else {
            csv = "Material ID,Item Name,Group,Department,Location,UOM,Item Total Stock,Status,Last Verified,Batch Qty,MRN No,MRN Date,Bill No,Bill Date,Vendor,GSTIN,Rate,Tx ID\n";
            itemsToExport.forEach(m => {
                const batches = calculateBatches(m.id, data);
                const lastCheckTime = m.lastVerified ? new Date(m.lastVerified).getTime() : 0;
                const isVerified = lastCheckTime >= cutoffTime;
                const status = isVerified ? 'Verified' : 'Pending';
                const verifiedStr = m.lastVerified ? new Date(m.lastVerified).toLocaleDateString('en-GB') : '-';
                const s = (v: any) => `"${String(v||'').replace(/"/g, '""')}"`;
                
                if (batches.length === 0) {
                    if (m.currentStock !== 0) {
                        csv += `${s(m.id)},${s(m.name)},${s(m.group)},${s(m.department)},${s(m.location)},${s(m.unit)},${m.currentStock},${status},${verifiedStr},${m.currentStock},-,-,-,-,Opening Stock,-,${m.pricePerUnit.toFixed(2)},-\n`;
                    }
                } else {
                    batches.forEach(b => {
                        const d = (v: any) => v ? new Date(v).toLocaleDateString('en-GB') : '-';
                        csv += `${s(m.id)},${s(m.name)},${s(m.group)},${s(m.department)},${s(m.location || b.location)},${s(m.unit)},${m.currentStock},${status},${verifiedStr},${b.remainingQty},${s(b.mrnNo)},${d(b.mrnDate)},${s(b.billNo)},${d(b.billDate)},${s(b.vendor)},${s(b.gstNo)},${b.rate},${s(b.id)}\n`;
                    });
                }
            });
        }

        const fName = type === 'CURRENT_VIEW' ? `Filtered_Stock` : `Stock_${type}`;
        downloadCsv(csv, `${fName}_${format}_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const downloadCsv = (content: string, filename: string) => {
        const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-4" onClick={() => showExportMenu && setShowExportMenu(false)}>
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <ClipboardList className="text-yellow-600 dark:text-yellow-500" size={24}/> Stock Taking Register
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">Physical verification & Audit trail</p>
                </div>
                
                <div className="flex bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)] w-full md:w-auto">
                    <button 
                        onClick={() => setViewMode('SUMMARY')}
                        className={`flex-1 px-4 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${viewMode === 'SUMMARY' ? 'bg-yellow-600 text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <CheckCheck size={14}/> Cycle Count
                    </button>
                    <button 
                        onClick={() => setViewMode('REGISTER')}
                        className={`flex-1 px-4 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${viewMode === 'REGISTER' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <List size={14}/> MRN Register
                    </button>
                </div>
            </div>
            
            {/* --- CONTROLS & FILTERS --- */}
            <div className="shrink-0 space-y-2">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3.5 text-[var(--text-secondary)]" size={16} />
                        <input 
                            type="text" 
                            placeholder={viewMode === 'REGISTER' ? "Search MRN, Bill, Vendor, Item..." : "Scan or type item name..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg py-3 pl-10 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] shadow-lg"
                        />
                    </div>
                    <div className="md:hidden">
                        <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} className="h-full px-3"><Filter size={18}/></Button>
                    </div>
                </div>
                
                <div className={`${showFilters ? 'block' : 'hidden'} md:grid md:grid-cols-3 gap-2 animate-fadeIn`}>
                    <MultiSelect label="Filter Groups" options={uniqueGroups} selected={filterGroups} onChange={setFilterGroups} className="w-full mb-2 md:mb-0"/>
                    <MultiSelect label="Filter Depts" options={uniqueDepartments} selected={filterDepts} onChange={setFilterDepts} className="w-full mb-2 md:mb-0"/>
                    <MultiSelect label="Filter Locations" options={locations} selected={filterLocations} onChange={setFilterLocations} className="w-full"/>
                </div>

                {/* Sub-Controls Bar */}
                <div className="flex flex-col md:flex-row gap-2 bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)] justify-between items-center">
                    <div className="flex gap-2 items-center w-full md:w-auto">
                        {viewMode === 'SUMMARY' ? (
                            <>
                                <select value={cyclePeriod} onChange={(e) => setCyclePeriod(e.target.value as any)} className="bg-[var(--bg-main)] text-yellow-600 dark:text-yellow-500 font-bold rounded p-1.5 border border-yellow-500/50 focus:ring-0 cursor-pointer text-xs">
                                    <option value="TODAY">Cycle: Today</option>
                                    <option value="WEEK">Cycle: Last 7 Days</option>
                                    <option value="MONTH">Cycle: Last 30 Days</option>
                                    <option value="2MONTHS">Cycle: Last 60 Days</option>
                                    <option value="3MONTHS">Cycle: Last 90 Days</option>
                                </select>
                                
                                <label className="flex items-center gap-1.5 bg-[var(--bg-main)] px-2 py-1 rounded cursor-pointer border border-[var(--border-color)] hover:border-[var(--text-secondary)]">
                                    <input 
                                        type="checkbox" 
                                        checked={showVerified} 
                                        onChange={(e) => setShowVerified(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded bg-[var(--bg-main)] border-[var(--border-color)] text-green-500 focus:ring-offset-[var(--bg-main)]"
                                    />
                                    <span className="text-xs text-[var(--text-secondary)]">Show Verified</span>
                                </label>
                            </>
                        ) : (
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-bold px-2 flex items-center gap-2">
                                <Hash size={14}/> {registerData.length} Batches Found
                            </div>
                        )}
                        
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-[var(--bg-main)] text-[var(--text-secondary)] text-xs rounded p-1.5 border-none focus:ring-0 cursor-pointer ml-auto md:ml-0">
                            <option value="location">Sort: Location</option>
                            <option value="name">Sort: A-Z</option>
                            {viewMode === 'REGISTER' && <option value="date">Sort: Date (New)</option>}
                        </select>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto justify-end relative">
                        <Button variant="secondary" onClick={onUpdate} className="text-xs py-1 px-3 h-8 flex items-center gap-2 border-[var(--border-color)] hover:bg-[var(--bg-main)]">
                            <RefreshCw size={14} /> Refresh
                        </Button>
                        <Button variant="secondary" onClick={handleSyncStock} disabled={isSyncing} className="text-xs py-1 px-3 h-8 flex items-center gap-2 bg-amber-100 dark:bg-amber-900/10 hover:bg-amber-200 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-900/30">
                            <Hammer size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Syncing...' : 'Sync Stock'}
                        </Button>

                        {viewMode === 'SUMMARY' && (
                            <Button variant="secondary" onClick={handleResetVerification} className="text-xs py-1 px-3 h-8 flex items-center gap-2 bg-red-100 dark:bg-red-900/10 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-900/30">
                                <RotateCcw size={14} /> Reset
                            </Button>
                        )}
                        
                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }} className="relative text-xs py-1 px-3 h-8 flex items-center gap-2 bg-[var(--accent)] hover:opacity-90 text-white border-none shadow-md">
                            <Download size={14} /> Export <ChevronDown size={14} />
                        </Button>
                        
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden animate-fadeIn z-50 ring-1 ring-white/10">
                                {/* ... Export Options ... */}
                                <div className="bg-[var(--bg-main)] px-4 py-1.5 text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Filtered Export</div>
                                <button onClick={() => handleExport('CURRENT_VIEW', 'SUMMARY')} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-main)]">Current View (Summary)</button>
                                <button onClick={() => handleExport('CURRENT_VIEW', 'DETAILED')} className="w-full text-left px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-main)]">Current View (Detailed)</button>
                                
                                <div className="bg-[var(--bg-main)] px-4 py-1.5 text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mt-1">Bulk Export (Filtered)</div>
                                <button onClick={() => handleExport('BOTH', 'SUMMARY')} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-main)]">All Filtered Items</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 relative border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl overflow-hidden glass-effect shadow-inner">
                <div className="absolute inset-0 overflow-auto custom-scrollbar p-3">
                    {viewMode === 'SUMMARY' ? (
                        <div className="space-y-4 pb-20">
                            {filteredAndSortedSummary.map(m => {
                                const lastCheckTime = m.lastVerified ? new Date(m.lastVerified).getTime() : 0;
                                const cutoffTime = cycleCutoff.getTime();
                                const isVerified = lastCheckTime >= cutoffTime;
                                
                                if (!showVerified && isVerified && !searchTerm) return null;
                                
                                const activeBatches = activeId === m.id ? calculateBatches(m.id, data) : [];
                                const batchCount = activeId === m.id ? activeBatches.length : calculateBatches(m.id, data).length;
                                
                                // GHOST STOCK DETECTION: Stock exists but 0 batches (or negative sum)
                                // This happens if transactions are deleted but material master isn't updated.
                                const isGhost = m.currentStock !== 0 && batchCount === 0;

                                return (
                                    <div key={m.id} className={`p-4 rounded-xl border transition-all ${activeId === m.id ? 'bg-[var(--bg-card)] border-blue-500 ring-2 ring-blue-500/20' : isGhost ? 'bg-red-100 dark:bg-red-900/10 border-red-300 dark:border-red-500/50' : isVerified ? 'bg-green-100 dark:bg-green-900/10 border-green-300 dark:border-green-800/50' : 'bg-[var(--bg-card)] border-[var(--border-color)]'}`}>
                                        {activeId === m.id ? (
                                            <div className="space-y-4 animate-fadeIn">
                                                {/* Detail View (Edit Mode) */}
                                                <div className="border-b border-[var(--border-color)] pb-3 mb-2">
                                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">{m.name}</h3>
                                                    {isGhost && <div className="text-xs text-red-500 dark:text-red-400 font-bold flex items-center gap-1 mt-1"><AlertTriangle size={12}/> Data Integrity Issue: Ghost Stock Detected</div>}
                                                </div>
                                                
                                                {/* Batches and History Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-[var(--bg-main)] rounded border border-[var(--border-color)] p-3">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase mb-2"><History size={12}/> Recent History</div>
                                                        <div className="space-y-1">
                                                            {getRecentTransactions(m.id).map(t => (
                                                                <div key={t.id} className="flex justify-between items-center text-xs border-b border-[var(--border-color)] pb-1">
                                                                    <span className="text-[var(--text-secondary)]">{new Date(t.date).toLocaleDateString()}</span>
                                                                    <span className={`font-bold ${t.type==='PURCHASE'?'text-green-600 dark:text-green-500':'text-red-600 dark:text-red-500'}`}>{(t.type || 'UNK').substring(0,3)}</span>
                                                                    <span className="text-[var(--text-primary)]">{t.quantity}</span>
                                                                </div>
                                                            ))}
                                                            {getRecentTransactions(m.id).length===0 && <div className="text-xs text-[var(--text-secondary)] italic">No history</div>}
                                                        </div>
                                                    </div>

                                                    <div className="bg-[var(--bg-main)] rounded border border-[var(--border-color)] p-3">
                                                        <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">
                                                            <span className="flex items-center gap-2"><Layers size={12}/> Active Batches</span>
                                                            <span className="text-purple-600 dark:text-purple-400">{activeBatches.length} Lots</span>
                                                        </div>
                                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                            {activeBatches.map((b, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-xs border-b border-[var(--border-color)] pb-2 last:border-0">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex gap-2 items-center mb-1">
                                                                            <span className="text-[var(--text-primary)] font-medium">{b.vendor || 'Op.Stock'}</span>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            {b.mrnNo && <span className="text-yellow-600 dark:text-yellow-500 font-mono text-[9px] bg-yellow-100 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-200 dark:border-yellow-900/30">MRN: {b.mrnNo}</span>}
                                                                            {b.billNo && <span className="text-blue-600 dark:text-blue-400 font-mono text-[9px] bg-blue-100 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/30">Bill: {b.billNo}</span>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="font-bold text-[var(--text-primary)] block text-sm">{b.remainingQty}</span>
                                                                        <span className="text-[9px] text-[var(--text-secondary)]">Loc: {b.location || m.location}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {activeBatches.length === 0 && <div className="text-xs text-[var(--text-secondary)] italic">System Stock is 0</div>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div><label className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Actual Qty</label><input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-3 text-2xl font-mono text-[var(--text-primary)] mt-1"/></div>
                                                    <div><label className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Location</label><input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-3 text-lg text-[var(--text-primary)] mt-1"/></div>
                                                </div>
                                                
                                                <div className="flex gap-2">
                                                    <Button onClick={() => setActiveId(null)} variant="secondary" className="flex-1 py-3">Cancel</Button>
                                                    {isGhost && (
                                                        <Button onClick={(e) => handleFixGhost(e, m)} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2">
                                                            <Hammer size={16}/> Auto-Fix
                                                        </Button>
                                                    )}
                                                    <Button onClick={() => handleSave(m)} variant="success" className="flex-1 py-3">Update</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center cursor-pointer" onClick={() => handleEditStart(m)}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={`font-medium ${isVerified ? 'text-green-600 dark:text-green-500' : 'text-[var(--text-primary)]'}`}>
                                                            {m.name}
                                                        </h3>
                                                        {isVerified && <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-300 dark:border-green-800">Verified</span>}
                                                        {isGhost && <span className="text-[10px] bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-300 dark:border-red-800 flex items-center gap-1 animate-pulse"><AlertTriangle size={10}/> Ghost</span>}
                                                        {!isGhost && batchCount > 1 && (
                                                            <span className="text-[9px] bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                                                                <Layers size={10}/> {batchCount} Lots
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)] mt-1"><span className="bg-[var(--bg-main)] px-2 py-0.5 rounded border border-[var(--border-color)] text-yellow-600 dark:text-yellow-500 font-bold">{m.location || 'No Loc'}</span><span className="opacity-70">{m.group}</span></div>
                                                    <div className="text-[10px] mt-1">{m.lastVerified ? <span className="text-[var(--text-secondary)]">Checked: {new Date(m.lastVerified).toLocaleDateString()}</span> : <span className="text-orange-500 dark:text-orange-400 italic">Pending Check</span>}</div>
                                                </div>
                                                <div className="flex items-center gap-3 pl-2">
                                                    <div className="text-right"><div className="text-xl font-bold text-[var(--text-primary)]">{m.currentStock}</div><div className="text-xs text-[var(--text-secondary)]">{m.unit}</div></div>
                                                    {isGhost ? (
                                                        <button type="button" onClick={(e) => handleFixGhost(e, m)} className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 flex items-center justify-center transition-all animate-pulse" title="Fix Ghost Stock">
                                                            <Hammer size={18}/>
                                                        </button>
                                                    ) : isVerified ? (
                                                        <button type="button" onClick={(e) => handleUnverify(e, m)} className="w-10 h-10 rounded-full bg-[var(--bg-main)] border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-all" title="Reset (Unverify)">
                                                            <Undo2 size={20}/>
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={(e) => handleQuickVerify(e, m)} className="w-10 h-10 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 flex items-center justify-center transition-all">
                                                            <CheckCheck size={20}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {filteredAndSortedSummary.length === 0 && <div className="text-center py-10 text-[var(--text-secondary)]">No items match filters</div>}
                        </div>
                    ) : (
                        // ... (Register View Remains Same)
                        <div className="pb-20">
                            {/* ... (Existing table code) ... */}
                            <table className="w-full text-left text-sm text-[var(--text-secondary)] whitespace-nowrap hidden md:table">
                                <thead className="bg-[var(--bg-main)] text-[var(--text-primary)] uppercase text-xs font-bold sticky top-0 z-30 shadow-md">
                                    <tr>
                                        <th className="p-3 border-r border-[var(--border-color)] w-24">MRN</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-28">MRN Date</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-24">GRN No</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-28">GRN Date</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-28">Bill No</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-28">Bill Date</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-32">GSTIN</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-48">Vendor Name</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-64">Item Name</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-16">UOM</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-20 text-right">Quantity</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-24 text-right">Rate (Basic)</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-28 text-right">Avg Rate</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-28 text-right">Total Amount</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-32">Department</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-20">Bin</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-32">C. Head</th>
                                        <th className="p-3 border-r border-[var(--border-color)] w-16 text-right">GST %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {registerData.map((row) => (
                                        <tr key={row.uniqueId} className="hover:bg-[var(--bg-main)]/50">
                                            <td className="p-3 border-r border-[var(--border-color)] font-mono text-yellow-600 dark:text-yellow-500">{row.mrnNo}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs">{row.mrnDate ? new Date(row.mrnDate).toLocaleDateString('en-GB') : '-'}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] font-mono">{row.grnNo}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs">{row.grnDate ? new Date(row.grnDate).toLocaleDateString('en-GB') : '-'}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] font-mono text-blue-600 dark:text-blue-300">{row.billNo}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs">{row.billDate ? new Date(row.billDate).toLocaleDateString('en-GB') : '-'}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs text-[var(--text-secondary)]">{row.gstNo}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-[var(--text-primary)] truncate max-w-[150px]" title={row.vendor}>{row.vendor}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] font-medium text-[var(--text-primary)] truncate max-w-[200px]" title={row.name}>{row.name}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs text-center">{row.unit}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-right font-mono font-bold text-[var(--text-primary)]">{row.qty}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-right font-mono">{row.rate.toFixed(2)}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-right font-mono text-blue-600 dark:text-blue-300">{row.avgRate.toFixed(2)}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-right font-mono font-bold text-green-600 dark:text-green-400">{row.value.toFixed(2)}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs truncate max-w-[100px]">{row.department}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs">{row.location}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-xs truncate max-w-[100px]">{row.group}</td>
                                            <td className="p-3 border-r border-[var(--border-color)] text-right font-mono text-xs">{row.gstRate}%</td>
                                        </tr>
                                    ))}
                                    {registerData.length === 0 && <tr><td colSpan={18} className="p-8 text-center text-[var(--text-secondary)]">No batch records found.</td></tr>}
                                </tbody>
                            </table>
                            {/* ... (Mobile Card View) ... */}
                             <div className="md:hidden grid grid-cols-1 gap-3">
                                {registerData.map((row) => (
                                    <div key={row.uniqueId} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 shadow-sm hover:border-[var(--accent)] transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="overflow-hidden pr-2">
                                                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate" title={row.name}>{row.name}</h4>
                                                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">{row.vendor}</div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-green-600 dark:text-green-400 font-bold font-mono text-sm">₹{row.value.toFixed(0)}</div>
                                                <div className="text-[10px] text-[var(--text-secondary)]">
                                                    Qty: <span className="text-[var(--text-primary)] font-bold">{row.qty}</span> {row.unit}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--border-color)]/50">
                                            <div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)] truncate max-w-[30%]">
                                                <Tag size={10}/> {row.group || 'General'}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-1.5 py-0.5 rounded text-yellow-600 dark:text-yellow-500 border border-[var(--border-color)] ml-auto truncate">
                                                <MapPin size={10}/> {row.location || '-'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* VERIFICATION MODAL */}
            {verifyTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[var(--bg-card)] w-full max-w-sm rounded-xl border border-green-500/50 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <CheckCheck className="text-green-600 dark:text-green-500" size={20}/> Confirm Verification
                            </h3>
                            <button onClick={() => setVerifyTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20}/></button>
                        </div>
                        
                        <p className="text-[var(--text-secondary)] mb-6 text-sm leading-relaxed">
                            Mark <strong>{verifyTarget.name}</strong> as physically verified?
                            <br/><br/>
                            <span className="text-xs text-[var(--text-secondary)] block p-2 bg-[var(--bg-main)] rounded border border-[var(--border-color)]">
                                System Stock: <span className="font-mono text-green-600 dark:text-green-400 font-bold">{verifyTarget.currentStock} {verifyTarget.unit}</span>
                            </span>
                        </p>
                        
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setVerifyTarget(null)} className="flex-1">Cancel</Button>
                            <Button variant="success" onClick={confirmVerification} className="flex-1 flex items-center justify-center gap-2">
                                <Check size={16}/> Confirm Match
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockTaking;