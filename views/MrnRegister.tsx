
import React, { useState, useMemo, useEffect, useRef, forwardRef } from 'react';
import { AppData, Transaction } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FilterHeader } from '../components/ui/FilterHeader';
import { MultiSelect } from '../components/ui/MultiSelect';
import { updateTransaction, deleteTransaction, deleteBill, updateMaterial, getAppData, smartUpdateSingleTransaction, propagateItemCategorization, ensureMasterData } from '../services/storageService';
import { Download, Search, Calendar, FileText, Filter, List, Edit, Save, Trash2, Lock, AlertTriangle, X, LayoutGrid, Tag, Building, FileSignature, ArrowUpDown, FolderPen, SlidersHorizontal, Check, Copy, Info, Receipt } from 'lucide-react';
import TransactionForm from './TransactionForm';
import { TableVirtuoso, Virtuoso, VirtuosoGrid } from 'react-virtuoso';

interface Props {
    data: AppData;
    onUpdate?: () => void;
}

const getValue = (t: Transaction, key: string, materials: any[]): string => {
    if (key === 'item') return t.materialName;
    if (key === 'dept') return t.department || '-';
    if (key === 'group') return t.group || '-';
    if (key === 'bin') return t.location || '-';
    if (key === 'gstNo') return t.gstNo || '-';
    
    // Increased precision for rates to support 0.005 and derived calculation
    if (key === 'rate') {
        // Show the actual basic rate as entered by the user
        return (t.rate || 0).toFixed(4);
    }
    if (key === 'avgRate') {
        // Show the landed/avg rate (derived from totalValue minus GST)
        if (t.avgRate && t.avgRate > 0) return t.avgRate.toFixed(4);
        if (t.totalValue > 0 && t.quantity > 0) {
            const basicVal = t.totalValue - (t.gstAmount || 0);
            return (basicVal / t.quantity).toFixed(4);
        }
        return (t.rate || 0).toFixed(4);
    }

    if (key === 'gstRate') return (t.gstRate || 0).toString();
    
    if (key === 'unit') {
        const mat = materials.find(m => m.id === t.materialId);
        return mat?.unit || '-';
    }

    if (key === 'mrnDate' || key === 'grnDate' || key === 'billDate') {
        const d = t[key as keyof Transaction];
        return d ? new Date(String(d)).toLocaleDateString('en-GB') : '-';
    }
    const val = t[key as keyof Transaction];
    return val ? String(val) : '-';
};

const MrnRegister: React.FC<Props> = ({ data, onUpdate }) => {
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0];
    });

    const [tabMode, setTabMode] = useState<'ITEMS' | 'BILLS'>('ITEMS'); 
    const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE');
    
    const [rawSearch, setRawSearch] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setGlobalSearch(rawSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [rawSearch]);

    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
    const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    
    const [sortBy, setSortBy] = useState<'date' | 'mrn' | 'vendor' | 'item' | 'amount'>('mrn');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const uniqueDepartments = useMemo(() => {
        const depts = new Set<string>();
        data.departments.forEach(d => { if (d) depts.add(d.trim()); });
        data.materials.forEach(m => { if (m.department) depts.add(m.department.trim()); });
        data.transactions.forEach(t => { if (t.department) depts.add(t.department.trim()); });
        return Array.from(depts).sort();
    }, [data]);

    const initialColumns = [
        { key: 'mrnNo', label: 'MRN', width: 60 },
        { key: 'mrnDate', label: 'Date', width: 70 },
        { key: 'grnNo', label: 'GRN', width: 60 },
        { key: 'billNo', label: 'Bill No', width: 90 },
        { key: 'billDate', label: 'Bill Dt', width: 80 },
        { key: 'vendor', label: 'Vendor', width: 140 },
        { key: 'item', label: 'Item Name', width: 180 },
        { key: 'unit', label: 'UOM', width: 50 },
        { key: 'qty', label: 'Qty', isNumeric: true, width: 70 },
        { key: 'rate', label: 'Rate', isNumeric: true, width: 80 },
        { key: 'avgRate', label: 'Landed', isNumeric: true, width: 80 },
        { key: 'totalValue', label: 'Total', isNumeric: true, width: 100 },
        { key: 'dept', label: 'Dept', width: 90 },
        { key: 'group', label: 'Group', width: 90 },
        { key: 'gstRate', label: 'GST%', isNumeric: true, width: 50 },
    ];

    const [columns, setColumns] = useState(initialColumns);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(initialColumns.map(c => c.key));
    const [isColSelectorOpen, setIsColSelectorOpen] = useState(false);

    // Detail Modal State
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [editingBillFullData, setEditingBillFullData] = useState<{ header: any, items: Transaction[] } | null>(null);
    const [cloningBillData, setCloningBillData] = useState<{ header: any, items: Transaction[] } | null>(null);
    
    const [quickEditTx, setQuickEditTx] = useState<Transaction | null>(null);
    const [quickEditForm, setQuickEditForm] = useState({ group: '', department: '' });

    const [securityCheck, setSecurityCheck] = useState<{ type: 'EDIT' | 'DELETE', transaction: Transaction } | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleColumnResize = (colKey: string, newWidth: number) => {
        setColumns(prev => prev.map(col => col.key === colKey ? { ...col, width: newWidth } : col));
    };

    const toggleColumnVisibility = (key: string) => {
        setVisibleColumns(prev => 
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [year, month] = e.target.value.split('-').map(Number);
        if (!isNaN(year) && !isNaN(month)) {
            const start = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
            const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0];
            setStartDate(start);
            setEndDate(end);
        }
    };

    const baseData = useMemo(() => {
        return data.transactions
            .filter(t => t.type === 'PURCHASE')
            .filter(t => {
                const dateToCheck = t.mrnDate || t.billDate || t.date || '';
                if (startDate && dateToCheck < startDate) return false;
                if (endDate && dateToCheck > endDate) return false;
                return true;
            });
    }, [data.transactions, startDate, endDate]);

    const getUniqueValues = (colKey: string) => {
        const values = new Set<string>();
        baseData.forEach(t => {
            if (colKey !== 'actions') values.add(getValue(t, colKey, data.materials));
        });
        return Array.from(values).sort();
    };

    const filteredTransactions = useMemo(() => {
        const result = baseData.filter(t => {
            if (globalSearch) {
                const term = globalSearch.toLowerCase();
                const terms = term.split(' ').filter(x => x); 
                const rowString = [
                    t.mrnNo, t.billNo, t.vendor, t.materialName, t.department, t.group, t.grnNo, t.gstNo
                ].join(' ').toLowerCase();
                if (!terms.every(keyword => rowString.includes(keyword))) return false;
            }
            for (const [key, val] of Object.entries(activeFilters)) {
                const selectedValues = val as string[];
                if (selectedValues.length === 0) continue; 
                const rowVal = getValue(t, key, data.materials);
                if (!selectedValues.includes(rowVal)) return false;
            }
            return true;
        });

        // Default Sort by MRN Ascending so odd/even coloring logic lines up
        return result.sort((a, b) => {
            const mrnA = parseInt(a.mrnNo?.replace(/\D/g, '') || '0', 10);
            const mrnB = parseInt(b.mrnNo?.replace(/\D/g, '') || '0', 10);
            if (mrnA !== mrnB) return mrnA - mrnB;
            return (a.billNo||'').localeCompare(b.billNo||'');
        });
    }, [baseData, globalSearch, activeFilters, data.materials, sortBy, sortDir]);

    // --- Unique Bills Calculation (Sorted by MRN Ascending) ---
    const uniqueBills = useMemo(() => {
        if (tabMode !== 'BILLS') return [];
        const bills: Record<string, {
            id: string, 
            billNo: string,
            billDate: string,
            vendor: string,
            mrnNo: string,
            totalAmount: number,
            itemCount: number,
            gstNo: string,
            firstTx: Transaction
        }> = {};

        filteredTransactions.forEach(t => {
            const key = `${t.billNo}_${t.vendor}`;
            if (!bills[key]) {
                bills[key] = {
                    id: t.id,
                    billNo: t.billNo || 'Unknown',
                    billDate: t.billDate || '-',
                    vendor: t.vendor || 'Unknown',
                    mrnNo: t.mrnNo || '-',
                    totalAmount: 0,
                    itemCount: 0,
                    gstNo: t.gstNo || '-',
                    firstTx: t
                };
            }
            bills[key].totalAmount += t.totalValue;
            bills[key].itemCount += 1;
        });

        // Sort by MRN Number Ascending
        return Object.values(bills).sort((a,b) => {
             const mrnA = parseInt(a.mrnNo?.replace(/\D/g, '') || '0', 10);
             const mrnB = parseInt(b.mrnNo?.replace(/\D/g, '') || '0', 10);
             return mrnA - mrnB; 
        });
    }, [filteredTransactions, tabMode]);

    // ... (Handlers) ...
    const handleFilterChange = (colKey: string, selectedValues: string[]) => { setActiveFilters(prev => { const next = { ...prev, [colKey]: selectedValues }; if (selectedValues.length === 0) delete next[colKey]; return next; }); setOpenFilterCol(null); };
    const clearAllFilters = () => { setActiveFilters({}); setRawSearch(''); setGlobalSearch(''); };
    const handleOpenQuickEdit = (t: Transaction) => { setQuickEditTx(t); setQuickEditForm({ group: t.group || '', department: t.department || '' }); };
    
    const handleQuickEditSave = async () => { 
        if (!quickEditTx) return; 
        
        // Propagate Categorization to ALL history for this item
        await propagateItemCategorization(quickEditTx.materialId, quickEditForm.group, quickEditForm.department);
        
        // Ensure the new tags are in Master Data lists
        const appData = await getAppData();
        ensureMasterData(appData, [], [quickEditForm.department], [quickEditForm.group]);
        
        setQuickEditTx(null); 
        if (onUpdate) onUpdate(); 
    };

    const handleCloneBill = (t: Transaction) => { const relatedItems = data.transactions.filter(tx => tx.type === 'PURCHASE' && tx.billNo === t.billNo && tx.vendor === t.vendor); if (relatedItems.length === 0) return; const headerItem = relatedItems[0]; setCloningBillData({ header: { billNo: headerItem.billNo, billDate: headerItem.billDate, vendor: headerItem.vendor, gstNo: headerItem.gstNo, mrnNo: headerItem.mrnNo, mrnDate: headerItem.mrnDate, grnNo: headerItem.grnNo, grnDate: headerItem.grnDate }, items: relatedItems }); };
    const initiateAction = (type: 'EDIT' | 'DELETE', tx: Transaction) => { setSecurityCheck({ type, transaction: tx }); setPasswordInput(''); setAuthError(''); };
    const verifyAndProceed = () => { if (!securityCheck) return; const correctPassword = data.appSettings?.adminPassword || '1234'; if (passwordInput !== correctPassword) { setAuthError('Incorrect Password'); return; } setAuthError('VERIFIED'); };
    const handleFinalDelete = (scope: 'ITEM' | 'BILL') => { if (!securityCheck || securityCheck.type !== 'DELETE') return; if (scope === 'ITEM') { deleteTransaction(securityCheck.transaction.id); } else { if (securityCheck.transaction.billNo && securityCheck.transaction.vendor) { deleteBill(securityCheck.transaction.billNo, securityCheck.transaction.vendor); } else { alert("Cannot delete entire bill: Missing Bill No or Vendor."); return; } } if (onUpdate) onUpdate(); setSecurityCheck(null); setSelectedTx(null); };
    
    // Updated to handle opening from Bill Mode
    const openEditModal = (scope: 'ITEM' | 'BILL', txToEdit?: Transaction) => { 
        const targetTx = txToEdit || (securityCheck ? securityCheck.transaction : null);
        if (!targetTx) return;
        
        if (scope === 'ITEM') { 
            setEditingTx(JSON.parse(JSON.stringify(targetTx))); 
        } else { 
            const billNo = targetTx.billNo; 
            const vendor = targetTx.vendor; 
            const relatedItems = data.transactions.filter(t => t.type === 'PURCHASE' && t.billNo === billNo && t.vendor === vendor); 
            if (relatedItems.length === 0) return; 
            const headerItem = relatedItems[0]; 
            setEditingBillFullData({ header: { billNo: headerItem.billNo, billDate: headerItem.billDate, vendor: headerItem.vendor, gstNo: headerItem.gstNo, mrnNo: headerItem.mrnNo, mrnDate: headerItem.mrnDate, grnNo: headerItem.grnNo, grnDate: headerItem.grnDate }, items: relatedItems }); 
        } 
        setSecurityCheck(null); 
        setSelectedTx(null); 
        };
    
    const handleSaveItemEdit = async () => { 
        if (!editingTx) return; 
        const qty = editingTx.quantity || 0; 
        const rate = editingTx.rate || 0; 
        const disc = editingTx.discount || 0; 
        const freight = editingTx.freight || 0; 
        const gstRate = editingTx.gstRate || 0; 
        const basic = qty * rate; 
        const taxable = basic - disc + freight; 
        const gstAmt = taxable * (gstRate / 100); 
        const total = taxable + gstAmt; 
        const avg = qty > 0 ? (taxable / qty) : rate; 
        
        const updatedTx = { ...editingTx, totalValue: total, gstAmount: gstAmt, avgRate: avg }; 
        
        // Sync master and history categorization if changed
        if (editingTx.group && editingTx.department) {
            await propagateItemCategorization(editingTx.materialId, editingTx.group, editingTx.department);
        }
        
        await smartUpdateSingleTransaction(updatedTx); 
        if (onUpdate) onUpdate(); 
        setEditingTx(null); 
    };

    const handleExport = () => { if (filteredTransactions.length === 0) { alert("No data to export"); return; } const exportHeaders = [ "MRN", "MRN DATE", "GRN NO", "GRN DATE", "BILL NO", "BILL DATE", "GSTIN", "VENDOR NAME", "ITEM NAME", "UOM", "QUANTITY", "RATE (BASIC)", "AVG RATE (LANDED)", "TOTAL AMOUNT", "DEPARTMENT", "BIN", "C. HEAD", "GST %" ]; const companyName = data.appSettings?.companyName || 'My Company'; const title = "MRN Register (Inward)"; const csvContent = [ `"${companyName}"`, `"${title}"`, `"Generated on: ${new Date().toLocaleString()}"`, "", exportHeaders.join(","), ...filteredTransactions.map(t => { const mat = data.materials.find(m => m.id === t.materialId); const safe = (val: string | number) => `"${String(val || '').replace(/"/g, '""')}"`; return [ safe(t.mrnNo || ''), safe(t.mrnDate ? new Date(t.mrnDate).toLocaleDateString('en-GB') : ''), safe(t.grnNo || ''), safe(t.grnDate ? new Date(t.grnDate).toLocaleDateString('en-GB') : ''), safe(t.billNo || ''), safe(t.billDate ? new Date(t.billDate).toLocaleDateString('en-GB') : ''), safe(t.gstNo || ''), safe(t.vendor || ''), safe(t.materialName), safe(mat?.unit || ''), t.quantity, t.rate.toFixed(4), (t.avgRate || t.rate).toFixed(4), t.totalValue.toFixed(2), safe(t.department || ''), safe(t.location || mat?.location || ''), safe(t.group || mat?.group || ''), t.gstRate || 0 ].join(","); }) ].join("\n"); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", `MRN_Data_Filtered.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); };

    // --- Components ---
    const MobileFilterCard = () => (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg mb-4 space-y-4 md:hidden animate-fadeIn shadow-lg">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2 mb-2">
                <h3 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                    <Filter size={14} className="text-[var(--accent)]"/> Active Filters
                </h3>
                <Button onClick={clearAllFilters} variant="secondary" className="text-xs px-3 py-1.5 h-auto min-h-[30px] whitespace-nowrap bg-[var(--bg-main)] hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 transition-colors">Clear All</Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
                {['vendor', 'dept', 'group'].map(key => {
                    const unique = getUniqueValues(key);
                    return (
                         <MultiSelect
                            key={key}
                            label={key === 'group' ? 'C. Head' : key === 'dept' ? 'Department' : 'Vendor'}
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

    const activeColumns = columns.filter(c => visibleColumns.includes(c.key));

    // --- RENDER ---
    if (editingBillFullData) { return <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] p-4 overflow-y-auto"><div className="max-w-7xl mx-auto"><TransactionForm type="PURCHASE" materials={data.materials} onComplete={() => { setEditingBillFullData(null); if (onUpdate) onUpdate(); }} onCancel={() => setEditingBillFullData(null)} editMode={true} initialData={editingBillFullData || undefined} /></div></div>; }
    if (cloningBillData) { return <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] p-4 overflow-y-auto"><div className="max-w-7xl mx-auto"><TransactionForm type="PURCHASE" materials={data.materials} onComplete={() => { setCloningBillData(null); if (onUpdate) onUpdate(); }} onCancel={() => setCloningBillData(null)} cloneMode={true} editMode={false} initialData={cloningBillData || undefined} /></div></div>; }

    return (
        <div className="h-full flex flex-col p-4 md:p-4" onClick={() => setIsColSelectorOpen(false)}>
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 mb-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <FileText className="text-blue-500" size={20} /> MRN Register
                    </h2>
                    <p className="text-[10px] md:text-xs text-[var(--text-secondary)] mt-1">Filtered: <span className="text-[var(--text-primary)] font-mono">{tabMode === 'ITEMS' ? filteredTransactions.length : uniqueBills.length}</span> {tabMode === 'ITEMS' ? 'records' : 'bills'}</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 w-full lg:w-auto">
                    {/* View Switcher (Item/Bill) */}
                    <div className="flex bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)]">
                        <button onClick={() => setTabMode('ITEMS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-all ${tabMode === 'ITEMS' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                            <List size={14}/> Items
                        </button>
                        <button onClick={() => setTabMode('BILLS')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-all ${tabMode === 'BILLS' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                            <Receipt size={14}/> Bills
                        </button>
                    </div>

                    {/* Date Filters & Month Selector */}
                    <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] p-1.5 rounded-lg w-full md:w-auto">
                        <Calendar size={14} className="text-gray-500 ml-1"/>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[var(--bg-main)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border-color)] rounded px-1 w-28 p-1"/>
                        <span className="text-gray-600">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[var(--bg-main)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border-color)] rounded px-1 w-28 p-1"/>
                        
                        <select 
                            onChange={handleMonthSelect}
                            className="bg-[var(--bg-main)] text-[var(--text-primary)] text-xs border border-[var(--border-color)] rounded p-1 ml-2 cursor-pointer focus:outline-none focus:border-[var(--accent)]"
                            defaultValue=""
                        >
                            <option value="" disabled>Select Month</option>
                            {Array.from({length: 12}, (_, i) => {
                                const d = new Date();
                                d.setMonth(d.getMonth() - i);
                                return <option key={i} value={`${d.getFullYear()}-${d.getMonth()}`}>{d.toLocaleString('default', { month: 'short', year: 'numeric' })}</option>;
                            })}
                        </select>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-48">
                            <Search className="absolute left-3 top-2.5 text-gray-500" size={14}/>
                            <input type="text" placeholder="Search..." value={rawSearch} onChange={e => setRawSearch(e.target.value)} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg pl-9 pr-4 py-2 text-xs md:text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"/>
                        </div>
                        {tabMode === 'ITEMS' && (
                            <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5">
                                <button onClick={() => setViewMode('TABLE')} className={`p-1.5 rounded ${viewMode === 'TABLE' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}><List size={16}/></button>
                                <button onClick={() => setViewMode('CARD')} className={`p-1.5 rounded ${viewMode === 'CARD' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={16}/></button>
                            </div>
                        )}
                        <div className="relative">
                            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setIsColSelectorOpen(!isColSelectorOpen); }} className="px-2 h-full"><SlidersHorizontal size={16} /></Button>
                            {isColSelectorOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                                    <div className="text-xs font-bold text-[var(--text-secondary)] uppercase px-2 mb-2">Visible Columns</div>
                                    {columns.map(col => (<div key={col.key} className="flex items-center gap-2 p-2 hover:bg-[var(--bg-main)] rounded cursor-pointer text-xs text-[var(--text-primary)]" onClick={(e) => { e.stopPropagation(); toggleColumnVisibility(col.key); }}><div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${visibleColumns.includes(col.key) ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-gray-600'}`}>{visibleColumns.includes(col.key) && <Check size={10} className="text-white" />}</div>{col.label}</div>))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowMobileFilters(!showMobileFilters)} className={`md:hidden p-2 rounded-lg border ${Object.keys(activeFilters).length > 0 ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-gray-400'}`}><Filter size={16} /></button>
                        <Button onClick={handleExport} variant="success" className="whitespace-nowrap flex items-center gap-2 text-xs px-3"><Download size={14}/> <span className="hidden md:inline">CSV</span></Button>
                    </div>
                </div>
            </div>

            {showMobileFilters && <MobileFilterCard />}

            {/* --- BILL MODE VIEW --- */}
            {tabMode === 'BILLS' && (
                <VirtuosoGrid
                    style={{ height: '100%' }}
                    data={uniqueBills}
                    totalCount={uniqueBills.length}
                    components={{
                        List: forwardRef<HTMLDivElement>((props, ref) => (
                            <div
                                {...props}
                                ref={ref}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20"
                            />
                        )),
                        Item: forwardRef<HTMLDivElement>((props, ref) => (
                            <div {...props} ref={ref} className="h-full" />
                        ))
                    }}
                    itemContent={(index, bill) => (
                        <div key={`${bill.billNo}_${bill.vendor}`} onClick={() => openEditModal('BILL', bill.firstTx)} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 cursor-pointer hover:border-[var(--accent)] hover:shadow-lg transition-all group active:scale-[0.99] h-full flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Receipt size={16} className="text-blue-400"/>
                                        <span className="font-bold text-[var(--text-primary)] text-sm">{bill.billNo}</span>
                                    </div>
                                    <div className="text-xs text-[var(--text-secondary)] mt-1">{bill.vendor}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-bold text-green-400">₹{bill.totalAmount.toLocaleString()}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">{bill.itemCount} Items</div>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-[var(--border-color)] flex justify-between items-center text-xs text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1"><Calendar size={12}/> {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '-'}</span>
                                <span className="bg-[var(--bg-main)] px-2 py-0.5 rounded border border-[var(--border-color)] text-yellow-500 font-mono">MRN: {bill.mrnNo}</span>
                            </div>
                        </div>
                    )}
                />
            )}

            {/* --- ITEM MODE VIEW --- */}
            {tabMode === 'ITEMS' && viewMode === 'TABLE' && (
                <div className="flex flex-1 overflow-hidden p-0 border border-[var(--border-color)] bg-[var(--bg-card)] rounded-xl shadow-lg flex-col relative min-h-0 glass-effect">
                    <TableVirtuoso
                        data={filteredTransactions}
                        style={{ height: '100%' }}
                        className="custom-scrollbar"
                        fixedHeaderContent={() => (
                            <tr className="bg-[var(--bg-main)] shadow-md">
                                {activeColumns.map((col) => (
                                    <FilterHeader key={col.key} colKey={col.key} label={col.label} width={col.width} isNumeric={col.isNumeric} uniqueValues={getUniqueValues(col.key)} activeSelection={activeFilters[col.key] || []} isOpen={openFilterCol === col.key} onToggle={() => setOpenFilterCol(openFilterCol === col.key ? null : col.key)} onApply={(vals) => handleFilterChange(col.key, vals)} onClose={() => setOpenFilterCol(null)} onResize={(w) => handleColumnResize(col.key, w)} />
                                ))}
                            </tr>
                        )}
                        itemContent={(index, t) => {
                            const mat = data.materials.find(m => m.id === t.materialId);
                            const mrnNum = parseInt(t.mrnNo?.replace(/\D/g, '') || '0', 10);
                            const isOddMrn = !isNaN(mrnNum) && mrnNum % 2 !== 0;
                            const rowBg = isOddMrn ? 'bg-[var(--bg-main)]/50' : 'bg-transparent'; 

                            const r: any = { 
                                mrnNo: t.mrnNo || '-', 
                                mrnDate: t.mrnDate ? new Date(t.mrnDate).toLocaleDateString('en-GB') : '-', 
                                grnNo: t.grnNo || '-', 
                                grnDate: t.grnDate ? new Date(t.grnDate).toLocaleDateString('en-GB') : '-', 
                                billNo: t.billNo || '-', 
                                billDate: t.billDate ? new Date(t.billDate).toLocaleDateString('en-GB') : '-', 
                                gstNo: t.gstNo || '-', 
                                vendor: t.vendor || '-', 
                                item: t.materialName, 
                                unit: mat?.unit || '-', 
                                qty: t.quantity, 
                                rate: getValue(t, 'rate', data.materials),
                                avgRate: getValue(t, 'avgRate', data.materials),
                                totalValue: t.totalValue, 
                                dept: t.department || '-', 
                                bin: t.location || '-', 
                                group: t.group || '-', 
                                gstRate: t.gstRate || 0 
                            };
                            
                            return (
                                <>
                                    {activeColumns.map(col => {
                                        return <td key={col.key} className={`px-2 py-1 border-r border-[var(--border-color)] truncate ${col.isNumeric ? 'text-right font-mono' : ''} ${col.key === 'mrnNo' ? 'text-yellow-500' : ''} ${col.key === 'billNo' ? 'text-blue-300' : ''} ${col.key === 'item' ? 'font-medium' : ''} ${rowBg}`} style={{ maxWidth: col.width }} onClick={() => setSelectedTx(t)}>{r[col.key]}</td>;
                                    })}
                                </>
                            );
                        }}
                        fixedFooterContent={() => (
                            <tr className="bg-[var(--bg-main)] border-t border-[var(--border-color)] font-bold text-[var(--text-secondary)]">
                                <td colSpan={activeColumns.length} className="px-4 py-2 text-right text-[var(--text-primary)]">
                                    Total Items: {filteredTransactions.reduce((acc, t) => acc + t.quantity, 0).toLocaleString()} | Total Value: <span className="text-green-400">₹ {filteredTransactions.reduce((acc, t) => acc + t.totalValue, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </td>
                            </tr>
                        )}
                    />
                </div>
            )}

            {tabMode === 'ITEMS' && viewMode === 'CARD' && (
                <VirtuosoGrid
                    style={{ height: '100%' }}
                    data={filteredTransactions}
                    totalCount={filteredTransactions.length}
                    components={{
                        List: forwardRef<HTMLDivElement>((props, ref) => (
                            <div
                                {...props}
                                ref={ref}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-24"
                            />
                        )),
                        Item: forwardRef<HTMLDivElement>((props, ref) => (
                            <div {...props} ref={ref} className="h-full" />
                        ))
                    }}
                    itemContent={(index, t) => {
                        const mat = data.materials.find(m => m.id === t.materialId);
                        return (
                            <div key={t.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/5 transition-all active:scale-[0.98] h-full flex flex-col justify-between" onClick={() => setSelectedTx(t)}>
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="overflow-hidden pr-2">
                                            <h4 className="text-sm font-bold text-[var(--text-primary)] truncate" title={t.materialName}>{t.materialName}</h4>
                                            <div className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">{t.vendor}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-green-400 font-bold font-mono text-sm">₹{t.totalValue.toLocaleString()}</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">Qty: <span className="text-[var(--text-primary)] font-bold">{t.quantity}</span> {mat?.unit}</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-2 mt-2">
                                        <div className="flex flex-col"><span className="uppercase text-[9px] font-bold text-gray-500">Bill Details</span><span className="text-blue-300 font-mono">#{t.billNo}</span><span>{t.billDate ? new Date(t.billDate).toLocaleDateString() : '-'}</span></div>
                                        <div className="flex flex-col text-right"><span className="uppercase text-[9px] font-bold text-gray-500">MRN Details</span><span className="text-yellow-500 font-mono">#{t.mrnNo || '-'}</span><span>{t.mrnDate ? new Date(t.mrnDate).toLocaleDateString() : '-'}</span></div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--border-color)]/50"><div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-2 py-1 rounded text-[var(--text-secondary)] border border-[var(--border-color)] truncate max-w-[30%]"><Tag size={10}/> {t.group || 'General'}</div><div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-2 py-1 rounded text-[var(--text-secondary)] border border-[var(--border-color)] truncate max-w-[30%]"><Building size={10}/> {t.department || '-'}</div></div>
                            </div>
                        );
                    }}
                />
            )}

            {/* DETAIL & ACTION MODAL */}
            {selectedTx && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="glass-effect w-full max-w-2xl rounded-xl border border-[var(--border-color)] shadow-2xl p-6 bg-[var(--bg-card)]">
                        <div className="flex justify-between items-start mb-6 border-b border-[var(--border-color)] pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Info size={24} className="text-blue-500"/> Transaction Details
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">ID: {selectedTx.id}</p>
                            </div>
                            <button onClick={() => setSelectedTx(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 hover:bg-[var(--bg-main)] rounded"><X size={24}/></button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Item</label><div className="text-sm font-bold text-[var(--text-primary)]">{selectedTx.materialName}</div></div>
                                <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Vendor</label><div className="text-sm text-[var(--text-primary)]">{selectedTx.vendor}</div></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Bill No</label><div className="text-sm font-mono text-blue-300">{selectedTx.billNo}</div></div>
                                    <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Date</label><div className="text-sm font-mono text-[var(--text-primary)]">{selectedTx.billDate ? new Date(selectedTx.billDate).toLocaleDateString() : '-'}</div></div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-[var(--bg-main)] rounded border border-[var(--border-color)]">
                                    <div className="flex justify-between mb-1"><span className="text-xs text-[var(--text-secondary)]">Qty:</span><span className="font-bold text-[var(--text-primary)]">{selectedTx.quantity}</span></div>
                                    <div className="flex justify-between mb-1"><span className="text-xs text-[var(--text-secondary)]">Rate:</span><span className="font-mono text-[var(--text-primary)]">{getValue(selectedTx, 'rate', data.materials)}</span></div>
                                    <div className="flex justify-between border-t border-[var(--border-color)] pt-1 mt-1"><span className="text-xs font-bold text-[var(--text-secondary)]">Total:</span><span className="font-mono font-bold text-green-400">{selectedTx.totalValue.toFixed(2)}</span></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">MRN</label><div className="text-sm font-mono text-yellow-500">{selectedTx.mrnNo || '-'}</div></div>
                                    <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Group</label><div className="text-sm text-[var(--text-primary)]">{selectedTx.group}</div></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-[var(--border-color)]">
                            <Button onClick={() => { handleCloneBill(selectedTx); setSelectedTx(null); }} variant="secondary" className="flex-1 flex justify-center items-center gap-2 text-xs"><Copy size={14}/> Clone Bill</Button>
                            <Button onClick={() => { handleOpenQuickEdit(selectedTx); setSelectedTx(null); }} variant="secondary" className="flex-1 flex justify-center items-center gap-2 text-xs"><FolderPen size={14}/> Quick Classify</Button>
                            <Button onClick={() => { initiateAction('EDIT', selectedTx); setSelectedTx(null); }} className="flex-1 flex justify-center items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-white"><Edit size={14}/> Full Edit</Button>
                            <Button onClick={() => { initiateAction('DELETE', selectedTx); setSelectedTx(null); }} className="flex-1 flex justify-center items-center gap-2 text-xs bg-red-600 hover:bg-red-500 text-white"><Trash2 size={14}/> Delete</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK EDIT MODAL */}
            {quickEditTx && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="glass-effect w-full max-w-sm rounded-xl border border-blue-500/50 shadow-2xl p-6 bg-[var(--bg-card)]">
                        <div className="flex justify-between items-center mb-4 border-b border-[var(--border-color)] pb-3">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <FolderPen className="text-green-500" size={20}/> Quick Edit
                            </h3>
                            <button onClick={() => setQuickEditTx(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div className="text-xs text-[var(--text-secondary)]">
                                Updating categorization for:<br/>
                                <span className="text-[var(--text-primary)] font-bold text-sm">{quickEditTx.materialName}</span>
                                <div className="text-blue-300 mt-1 text-[10px]">Changes will propagate to material master and all history.</div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Group (C. Head)</label>
                                <input list="groups-quick" value={quickEditForm.group} onChange={e => setQuickEditForm({...quickEditForm, group: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)]" placeholder="Select Group..." autoFocus /><datalist id="groups-quick">{data.groups.map(g => <option key={g} value={g}/>)}</datalist>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Department</label>
                                <input list="depts-quick" value={quickEditForm.department} onChange={e => setQuickEditForm({...quickEditForm, department: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)]" placeholder="Select Department..." /><datalist id="depts-quick">{uniqueDepartments.map(d => <option key={d} value={d}/>)}</datalist>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" onClick={() => setQuickEditTx(null)} className="flex-1">Cancel</Button>
                                <Button variant="success" onClick={handleQuickEditSave} className="flex-1">Update & Sync</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {securityCheck && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"><div className="glass-effect w-full max-w-md rounded-xl border border-[var(--border-color)] shadow-2xl p-6 animate-fadeIn bg-[var(--bg-card)]">{authError !== 'VERIFIED' ? (<><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><Lock className="text-yellow-500" size={20}/> Security Check</h3><button onClick={() => setSecurityCheck(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20}/></button></div><div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mb-4 flex items-start gap-3"><AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16}/><div className="text-xs text-yellow-200">Admin password required.</div></div><div className="mb-4"><input type="password" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setAuthError(''); }} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)] focus:border-yellow-500 focus:outline-none" autoFocus placeholder="Default: 1234" />{authError && <p className="text-red-500 text-xs mt-1 animate-pulse">{authError}</p>}</div><div className="flex gap-3"><Button variant="secondary" onClick={() => setSecurityCheck(null)} className="flex-1">Cancel</Button><Button variant="primary" onClick={verifyAndProceed} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white">Verify</Button></div></>) : (securityCheck.type === 'DELETE' ? (<><div className="flex justify-between items-center mb-4 border-b border-[var(--border-color)] pb-3"><h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Trash2 className="text-red-500" size={20}/> Delete Option</h3><button onClick={() => setSecurityCheck(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20}/></button></div><div className="space-y-4"><div className="flex flex-col gap-3"><button onClick={() => handleFinalDelete('ITEM')} className="flex items-center justify-between p-3 rounded bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-red-500 group transition-all text-left"><div><div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-red-400">Delete This Item Only</div></div><Trash2 size={16} className="text-gray-600 group-hover:text-red-500"/></button><button onClick={() => handleFinalDelete('BILL')} className="flex items-center justify-between p-3 rounded bg-red-900/20 border border-red-900/50 hover:bg-red-900/40 hover:border-red-500 group transition-all text-left"><div><div className="text-sm font-bold text-red-200 group-hover:text-white">Delete Entire Bill</div></div><AlertTriangle size={16} className="text-red-500"/></button></div></div><div className="mt-4 pt-3 border-t border-[var(--border-color)] flex justify-end"><Button variant="secondary" onClick={() => setSecurityCheck(null)}>Cancel</Button></div></>) : (<><div className="flex justify-between items-center mb-4 border-b border-[var(--border-color)] pb-3"><h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Edit className="text-blue-500" size={20}/> Edit Option</h3><button onClick={() => setSecurityCheck(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20}/></button></div><div className="space-y-4"><div className="flex flex-col gap-3"><button onClick={() => openEditModal('ITEM')} className="flex items-center justify-between p-3 rounded bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-blue-500 group transition-all text-left"><div><div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-blue-400">Edit Item Details</div></div><Edit size={16} className="text-gray-600 group-hover:text-blue-500"/></button><button onClick={() => openEditModal('BILL')} className="flex items-center justify-between p-3 rounded bg-blue-900/10 border border-blue-900/30 hover:bg-blue-900/20 hover:border-blue-500 group transition-all text-left"><div><div className="text-sm font-bold text-blue-200 group-hover:text-white">Edit Entire Bill (Full Mode)</div></div><FileSignature size={16} className="text-blue-500"/></button></div></div><div className="mt-4 pt-3 border-t border-[var(--border-color)] flex justify-end"><Button variant="secondary" onClick={() => setSecurityCheck(null)}>Cancel</Button></div></>))}</div></div>}
            
            {editingTx && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="glass-effect w-full max-w-lg rounded-xl border border-[var(--border-color)] shadow-2xl p-6 bg-[var(--bg-card)]">
                        <div className="flex justify-between items-center mb-6 border-b border-[var(--border-color)] pb-4">
                            <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Edit className="text-blue-500"/> Edit Item Details</h3>
                            <button onClick={() => setEditingTx(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={24}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Group (C. Head)</label>
                                <input list="groups-full" value={editingTx.group || ''} onChange={e => setEditingTx({...editingTx, group: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-white text-xs" /><datalist id="groups-full">{data.groups.map(g => <option key={g} value={g}/>)}</datalist>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Department</label>
                                <input list="depts-full" value={editingTx.department || ''} onChange={e => setEditingTx({...editingTx, department: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-white text-xs" /><datalist id="depts-full">{uniqueDepartments.map(d => <option key={d} value={d}/>)}</datalist>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Quantity</label>
                                <input type="number" value={editingTx.quantity || ''} onChange={e => setEditingTx({...editingTx, quantity: parseFloat(e.target.value) || 0})} className="w-full bg-[var(--bg-main)] border border-blue-900 rounded p-2 text-[var(--text-primary)] font-mono font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Basic Rate</label>
                                <input type="number" value={editingTx.rate || ''} onChange={e => setEditingTx({...editingTx, rate: parseFloat(e.target.value) || 0})} className="w-full bg-[var(--bg-main)] border border-blue-900 rounded p-2 text-[var(--text-primary)] font-mono font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">GST %</label>
                                <input type="number" value={editingTx.gstRate || ''} onChange={e => setEditingTx({...editingTx, gstRate: parseFloat(e.target.value) || 0})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)] text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-4 pt-6">
                            <Button variant="secondary" onClick={() => setEditingTx(null)} className="flex-1">Cancel</Button>
                            <Button variant="success" onClick={handleSaveItemEdit} className="flex-1 flex justify-center items-center gap-2"><Save size={18} /> Update & Sync Master</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MrnRegister;
