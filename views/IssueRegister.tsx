
import React, { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import { AppData, Transaction } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FilterHeader } from '../components/ui/FilterHeader';
import { MultiSelect } from '../components/ui/MultiSelect';
import { updateTransaction, deleteTransaction } from '../services/storageService';
import { Download, Search, Calendar, FileText, Filter, Check, LayoutGrid, List, ArrowUpRight, Tag, Building, User, ArrowRightLeft, Edit, Trash2, Save, X, Lock, AlertTriangle, SlidersHorizontal, FolderPen, Box, Info, RotateCcw } from 'lucide-react';
import { TableVirtuoso, VirtuosoGrid } from 'react-virtuoso';

interface Props {
    data: AppData;
    onUpdate?: () => void;
}

const isCrossDeptIssue = (sourceDept: string, targetDept: string) => { 
    const s = (sourceDept || '').trim().toLowerCase(); 
    const t = (targetDept || '').trim().toLowerCase(); 
    if (!s || !t) return false; 
    // Exclude General and Stationery items from cross-dept flags (they are for general use)
    const excluded = ['general', 'stationary', 'stationery']; 
    if (excluded.includes(s)) return false; 
    return s !== t; 
};

const getValue = (t: Transaction, key: string, materials: any[]): string => { 
    if (key === 'item') return t.materialName; 
    if (key === 'dept') return t.department || '-'; 
    if (key === 'sourceDept') { const mat = materials.find(m => m.id === t.materialId); return mat?.department || '-'; } 
    if (key === 'issueType') { const mat = materials.find(m => m.id === t.materialId); return isCrossDeptIssue(mat?.department || '', t.department || '') ? 'Cross Dept' : 'Internal'; } 
    if (key === 'group') { const mat = materials.find(m => m.id === t.materialId); return t.group || mat?.group || '-'; } 
    if (key === 'remarks') return t.remarks || '-'; 
    if (key === 'id') return t.id ? t.id.slice(-6).toUpperCase() : '-'; 
    if (key === 'unit') { const mat = materials.find(m => m.id === t.materialId); return mat?.unit || '-'; } 
    if (key === 'date') { return t.date ? new Date(t.date).toLocaleDateString('en-GB') : '-'; } 
    if (key === 'rate') return t.rate ? t.rate.toFixed(4) : '0.0000'; // High precision
    const val = t[key as keyof Transaction]; return val ? String(val) : '-'; 
};

const IssueRegister: React.FC<Props> = ({ data, onUpdate }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>('TABLE');
    const [globalSearch, setGlobalSearch] = useState('');
    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
    const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const uniqueDepartments = useMemo(() => {
        const depts = new Set<string>();
        (data.departments || []).forEach(d => { if (d) depts.add(d.trim()); });
        (data.materials || []).forEach(m => { if (m.department) depts.add(m.department.trim()); });
        (data.transactions || []).forEach(t => { if (t.department) depts.add(t.department.trim()); });
        return Array.from(depts).sort();
    }, [data]);

    const initialColumns = [ { key: 'date', label: 'Date', width: 80 }, { key: 'id', label: 'Slip ID', width: 70 }, { key: 'issueType', label: 'Type', width: 80 }, { key: 'item', label: 'Item Name', width: 180 }, { key: 'unit', label: 'UOM', width: 50 }, { key: 'qty', label: 'Qty', isNumeric: true, width: 70 }, { key: 'rate', label: 'Rate', isNumeric: true, width: 80 }, { key: 'totalValue', label: 'Value', isNumeric: true, width: 90 }, { key: 'sourceDept', label: 'Source', width: 90 }, { key: 'dept', label: 'Target', width: 100 }, { key: 'group', label: 'Group', width: 90 }, { key: 'remarks', label: 'Remarks', width: 140 } ];
    const [columns, setColumns] = useState(initialColumns);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(initialColumns.map(c => c.key));
    const [isColSelectorOpen, setIsColSelectorOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleColumnResize = (colKey: string, newWidth: number) => { setColumns(prev => prev.map(col => col.key === colKey ? { ...col, width: newWidth } : col)); };
    const toggleColumnVisibility = (key: string) => { setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key] ); };
    const baseData = useMemo(() => { return data.transactions.filter(t => t.type === 'ISSUE').filter(t => { const txDate = new Date(t.date); if (startDate) { const start = new Date(startDate); if (txDate < start) return false; } if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59); if (txDate > end) return false; } return true; }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }, [data.transactions, startDate, endDate]);
    const getUniqueValues = (colKey: string) => { const values = new Set<string>(); baseData.forEach(t => { if (colKey !== 'actions') values.add(getValue(t, colKey, data.materials)); }); return Array.from(values).sort(); };
    const filteredTransactions = useMemo(() => { return baseData.filter(t => { const mat = data.materials.find(m => m.id === t.materialId); const sourceDept = mat?.department || ''; if (globalSearch) { const term = globalSearch.toLowerCase(); const terms = term.split(' ').filter(x => x); const rowString = [ t.materialName, t.department, sourceDept, t.group, t.remarks, t.id ].join(' ').toLowerCase(); if (!terms.every(keyword => rowString.includes(keyword))) return false; } for (const [key, val] of Object.entries(activeFilters)) { const selectedValues = val as string[]; if (selectedValues.length === 0) continue; const rowVal = getValue(t, key, data.materials); if (!selectedValues.includes(rowVal)) return false; } return true; }); }, [baseData, globalSearch, activeFilters, data.materials]);
    const handleFilterChange = (colKey: string, selectedValues: string[]) => { setActiveFilters(prev => { const next = { ...prev, [colKey]: selectedValues }; if (selectedValues.length === 0) delete next[colKey]; return next; }); setOpenFilterCol(null); };
    const clearAllFilters = () => { setActiveFilters({}); setGlobalSearch(''); };
    const initiateDelete = (tx: Transaction) => { setDeleteTarget(tx); setPasswordInput(''); setAuthError(''); };
    const confirmDelete = () => { if (!deleteTarget) return; const correctPassword = data.appSettings?.adminPassword || '1234'; if (passwordInput !== correctPassword) { setAuthError('Incorrect Password'); return; } try { deleteTransaction(deleteTarget.id); setDeleteTarget(null); if (onUpdate) onUpdate(); } catch (e) { console.error("Deletion failed", e); alert("Error deleting transaction. Please try again."); } setSelectedTx(null); };
    const handleSaveEdit = () => { if (!editingTx) return; const newVal = editingTx.quantity * (editingTx.rate || 0); const updated = { ...editingTx, totalValue: newVal }; updateTransaction(updated); setEditingTx(null); if (onUpdate) onUpdate(); };
    const handleExport = () => { if (filteredTransactions.length === 0) { alert("No data to export"); return; } const exportHeaders = [ "ISSUE DATE", "SLIP ID", "TYPE", "ITEM NAME", "UOM", "QUANTITY", "RATE (AVG)", "TOTAL VALUE", "SOURCE DEPT", "TARGET DEPT", "GROUP", "REMARKS" ]; const companyName = data.appSettings?.companyName || 'My Company'; const csvContent = [ `"${companyName}"`, `"Issue Register (Outward)"`, `"Generated on: ${new Date().toLocaleString()}"`, "", exportHeaders.join(","), ...filteredTransactions.map(t => { const mat = data.materials.find(m => m.id === t.materialId); const safe = (val: string | number) => `"${String(val || '').replace(/"/g, '""')}"`; const type = isCrossDeptIssue(mat?.department || '', t.department || '') ? 'Cross Dept' : 'Internal'; return [ safe(t.date ? new Date(t.date).toLocaleDateString('en-GB') : ''), safe(t.id ? t.id.slice(-6).toUpperCase() : ''), safe(type), safe(t.materialName), safe(mat?.unit || ''), t.quantity, t.rate.toFixed(4), t.totalValue.toFixed(2), safe(mat?.department || ''), safe(t.department || ''), safe(t.group || mat?.group || ''), safe(t.remarks || '') ].join(","); }) ].join("\n"); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", `Issue_Register_${new Date().toISOString().split('T')[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); };
    
    const MobileFilterCard = () => ( 
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg mb-4 space-y-4 md:hidden animate-fadeIn"> 
            <div className="flex justify-between items-center"> 
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Active Filters</h3> 
                <Button onClick={clearAllFilters} variant="secondary" className="text-xs py-1 h-7">Clear All</Button> 
            </div> 
            <div className="grid grid-cols-1 gap-2"> 
                {['issueType', 'dept', 'sourceDept', 'group', 'item'].map(key => { 
                    const unique = getUniqueValues(key); 
                    const label = key === 'dept' ? 'Target Dept' : key === 'sourceDept' ? 'Source Dept' : key === 'issueType' ? 'Type' : key; 
                    return ( 
                        <MultiSelect 
                            key={key}
                            label={label}
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

    return (
        <div className="h-full flex flex-col p-4 md:p-4 pb-0" onClick={() => setIsColSelectorOpen(false)}>
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 mb-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <ArrowUpRight className="text-red-500" size={24} /> Issue Register
                    </h2>
                    <p className="text-[10px] md:text-xs text-[var(--text-secondary)] mt-1">Filtered: <span className="text-[var(--text-primary)] font-mono">{filteredTransactions.length}</span> records</p>
                </div>
                {/* ... (Controls identical) ... */}
                <div className="flex flex-col md:flex-row gap-2 w-full lg:w-auto">
                    {/* Date Range - Updated Visibility */}
                    <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] p-1.5 rounded-lg w-full md:w-auto">
                        <Calendar size={14} className="text-gray-500 ml-1"/>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[var(--bg-main)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border-color)] rounded px-1 w-24 p-1"/>
                        <span className="text-gray-600">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[var(--bg-main)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border-color)] rounded px-1 w-24 p-1"/>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-48">
                            <Search className="absolute left-3 top-2.5 text-gray-500" size={14}/>
                            <input type="text" placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg pl-9 pr-4 py-2 text-xs md:text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"/>
                        </div>
                        <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5">
                            <button onClick={() => setViewMode('TABLE')} className={`p-1.5 rounded ${viewMode === 'TABLE' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}><List size={16}/></button>
                            <button onClick={() => setViewMode('CARD')} className={`p-1.5 rounded ${viewMode === 'CARD' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={16}/></button>
                        </div>
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
                        <Button onClick={handleExport} variant="success" className="whitespace-nowrap flex items-center gap-2 text-xs px-3" title="Export CSV"><Download size={14}/> <span className="hidden md:inline">CSV</span></Button>
                    </div>
                </div>
            </div>

            {showMobileFilters && <MobileFilterCard />}

            {viewMode === 'TABLE' ? (
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
                            const sourceDept = mat?.department || '-'; const targetDept = t.department || '-'; const isMismatch = isCrossDeptIssue(sourceDept, targetDept);
                            const r: any = { date: t.date ? new Date(t.date).toLocaleDateString('en-GB') : '-', id: '#' + (t.id ? t.id.slice(-6).toUpperCase() : '-'), item: t.materialName, unit: mat?.unit || '-', qty: t.quantity, rate: t.rate.toFixed(4), totalValue: t.totalValue.toFixed(2), sourceDept: sourceDept, dept: targetDept, issueType: isMismatch ? 'Cross Dept' : 'Internal', group: t.group || mat?.group || '-', remarks: t.remarks || '-' };
                            return (
                                <>
                                    {activeColumns.map(col => {
                                        return <td key={col.key} className={`px-2 py-1.5 border-r border-[var(--border-color)] truncate ${col.isNumeric ? 'text-right font-mono' : ''} ${col.key === 'item' ? 'font-medium' : ''} ${col.key === 'totalValue' ? 'font-bold text-red-400' : ''} cursor-pointer`} style={{ maxWidth: col.width }} onClick={() => setSelectedTx(t)}>{col.key === 'issueType' ? (<span className={`text-[10px] px-2 py-0.5 rounded ${isMismatch ? 'bg-orange-900/30 text-orange-400' : 'bg-[var(--bg-main)] text-[var(--text-secondary)]'}`}>{r.issueType}</span>) : col.key === 'sourceDept' ? (<div className={`flex items-center gap-1 ${isMismatch ? 'text-orange-400 font-bold' : 'text-[var(--text-secondary)]'}`}>{r.sourceDept}{isMismatch && <ArrowRightLeft size={10} className="text-orange-600"/>}</div>) : (r[col.key])}</td>;
                                    })}
                                </>
                            );
                        }}
                        fixedFooterContent={() => (
                            <tr className="bg-[var(--bg-main)] border-t border-[var(--border-color)] font-bold text-[var(--text-secondary)]">
                                <td colSpan={activeColumns.length} className="px-4 py-1.5 text-right">Total Issued: {filteredTransactions.reduce((acc, t) => acc + t.quantity, 0).toLocaleString()} | Value: <span className="text-red-400">₹ {filteredTransactions.reduce((acc, t) => acc + t.totalValue, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></td>
                            </tr>
                        )}
                    />
                </div>
            ) : (
                <VirtuosoGrid
                    style={{ height: '100%' }}
                    data={filteredTransactions}
                    totalCount={filteredTransactions.length}
                    components={{
                        // FIX: Add <HTMLDivElement> to forwardRef
                        List: forwardRef<HTMLDivElement>((props, ref) => (
                            <div
                                {...props}
                                ref={ref}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-24"
                            />
                        )),
                        // FIX: Add <HTMLDivElement> to forwardRef
                        Item: forwardRef<HTMLDivElement>((props, ref) => (
                            <div {...props} ref={ref} className="h-full" />
                        ))
                    }}
                    itemContent={(index, t) => {
                        const mat = data.materials.find(m => m.id === t.materialId);
                        const sourceDept = mat?.department || '-'; const targetDept = t.department || '-'; const isMismatch = isCrossDeptIssue(sourceDept, targetDept);
                        return (
                            <div key={t.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 shadow-sm hover:border-red-500/50 transition-colors active:scale-[0.98] h-full flex flex-col justify-between" onClick={() => setSelectedTx(t)}>
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="overflow-hidden pr-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate" title={t.materialName}>{t.materialName}</h4>
                                                {isMismatch && <span className="text-[9px] bg-orange-900/30 text-orange-400 px-1.5 rounded">Cross-Dept</span>}
                                            </div>
                                            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{new Date(t.date).toLocaleDateString()} • Slip #{t.id.slice(-6)}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-red-400 font-bold font-mono text-sm">₹{t.totalValue.toLocaleString()}</div>
                                            <div className="text-[10px] text-[var(--text-secondary)]">Qty: <span className="text-[var(--text-primary)] font-bold">{t.quantity}</span> {mat?.unit}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--border-color)]/50 flex-wrap">
                                    <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${isMismatch ? 'bg-orange-900/20 text-orange-400 border-orange-800' : 'bg-[var(--bg-main)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}>
                                        <Building size={10}/> {sourceDept}{isMismatch && <ArrowRightLeft size={8} className="mx-0.5" />}{isMismatch && <span className="text-yellow-500 font-bold">{targetDept}</span>}
                                    </div>
                                    {!isMismatch && (<div className="flex items-center gap-1 text-[10px] bg-[var(--bg-main)] px-1.5 py-0.5 rounded text-yellow-500 border border-[var(--border-color)] truncate">To: {targetDept}</div>)}
                                </div>
                            </div>
                        );
                    }}
                />
            )}

            {/* DETAIL & ACTION MODAL */}
            {selectedTx && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="glass-effect w-full max-w-md rounded-xl border border-[var(--border-color)] shadow-2xl p-6 bg-[var(--bg-card)]">
                        <div className="flex justify-between items-start mb-6 border-b border-[var(--border-color)] pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Info size={24} className="text-red-500"/> Issue Details
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">Slip ID: {selectedTx.id}</p>
                            </div>
                            <button onClick={() => setSelectedTx(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 hover:bg-[var(--bg-main)] rounded"><X size={24}/></button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Item</label><div className="text-sm font-bold text-[var(--text-primary)]">{selectedTx.materialName}</div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Target Dept</label><div className="text-sm text-[var(--text-primary)]">{selectedTx.department}</div></div>
                                <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Date</label><div className="text-sm font-mono text-[var(--text-primary)]">{selectedTx.date ? new Date(selectedTx.date).toLocaleDateString() : '-'}</div></div>
                            </div>
                            <div className="p-3 bg-[var(--bg-main)] rounded border border-[var(--border-color)]">
                                <div className="flex justify-between mb-1"><span className="text-xs text-[var(--text-secondary)]">Qty:</span><span className="font-bold text-[var(--text-primary)]">{selectedTx.quantity}</span></div>
                                <div className="flex justify-between mb-1"><span className="text-xs text-[var(--text-secondary)]">Rate (Avg):</span><span className="font-mono text-[var(--text-primary)]">{selectedTx.rate.toFixed(4)}</span></div>
                                <div className="flex justify-between border-t border-[var(--border-color)] pt-1 mt-1"><span className="text-xs font-bold text-[var(--text-secondary)]">Total Value:</span><span className="font-mono font-bold text-red-400">{selectedTx.totalValue.toFixed(2)}</span></div>
                            </div>
                            <div><label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Remarks</label><div className="text-sm text-[var(--text-primary)] italic">{selectedTx.remarks || 'No remarks'}</div></div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-[var(--border-color)]">
                            <Button onClick={() => { setEditingTx({...selectedTx}); setSelectedTx(null); }} variant="secondary" className="flex-1 flex justify-center items-center gap-2 text-xs"><Edit size={14}/> Edit</Button>
                            <Button onClick={() => { initiateDelete(selectedTx); setSelectedTx(null); }} className="flex-1 flex justify-center items-center gap-2 text-xs bg-red-600 hover:bg-red-500 text-white"><RotateCcw size={14}/> Reverse / Delete</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals same as before */}
            {deleteTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn"><div className="bg-[var(--bg-card)] w-full max-w-md rounded-xl border border-[var(--border-color)] shadow-2xl p-6"><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><Lock className="text-yellow-500" size={20}/> Security Check</h3><button onClick={() => setDeleteTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20}/></button></div><div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 mb-4 flex items-start gap-3"><AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16}/><div className="text-xs text-red-200">Delete record for <strong>{deleteTarget.materialName}</strong>? Stock will return.</div></div><div className="mb-4"><input type="password" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setAuthError(''); }} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)] focus:border-red-500 focus:outline-none" autoFocus placeholder="Default: 1234" />{authError && <p className="text-red-500 text-xs mt-1 animate-pulse">{authError}</p>}</div><div className="flex gap-3"><Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button><Button variant="danger" onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white">Confirm</Button></div></div></div>}
            {editingTx && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"><div className="bg-[var(--bg-card)] w-full max-w-lg rounded-xl border border-[var(--border-color)] shadow-2xl p-6"><div className="flex justify-between items-center mb-6 border-b border-[var(--border-color)] pb-4"><h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Edit className="text-blue-500"/> Edit Issue Details</h3><button onClick={() => setEditingTx(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={24}/></button></div><div className="space-y-4"><div className="p-3 bg-[var(--bg-main)] rounded border border-[var(--border-color)] text-sm mb-4"><span className="text-[var(--text-secondary)]">Item:</span> <span className="text-white font-bold">{editingTx.materialName}</span></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Date</label><input type="date" value={editingTx.date.split('T')[0]} onChange={e => setEditingTx({...editingTx, date: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-white"/></div><div><label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Quantity</label><input type="number" value={editingTx.quantity} onChange={e => setEditingTx({...editingTx, quantity: parseFloat(e.target.value)})} className="w-full bg-[var(--bg-main)] border border-blue-900 rounded p-2 text-[var(--text-primary)] font-mono font-bold" /></div></div><div><label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Target Department</label><input list="depts-edit" type="text" value={editingTx.department || ''} onChange={e => setEditingTx({...editingTx, department: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-white" /><datalist id="depts-edit">{uniqueDepartments.map(d => <option key={d} value={d}/>)}</datalist></div><div><label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Remarks</label><input type="text" value={editingTx.remarks || ''} onChange={e => setEditingTx({...editingTx, remarks: e.target.value})} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-white" /></div></div><div className="flex gap-4 pt-6 mt-2 border-t border-[var(--border-color)]/50"><Button variant="secondary" onClick={() => setEditingTx(null)} className="flex-1">Cancel</Button><Button variant="success" onClick={handleSaveEdit} className="flex-1 flex justify-center items-center gap-2"><Save size={18} /> Save Changes</Button></div></div></div>}
        </div>
    );
};

export default IssueRegister;
