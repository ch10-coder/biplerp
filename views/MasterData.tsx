
import React, { useState, useMemo } from 'react';
import { AppData } from '../types';
import { renameMasterEntry, deleteMasterEntry, vacuumMasterData, mergeMasterEntries, ensureMasterData } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { Search, Edit, X, Database, Layers, Briefcase, UserSquare, Check, Trash2, Merge, Sparkles, ArrowRight, ShieldAlert, Plus, Package, DollarSign, Activity, Scale, Wand2, ArrowDown } from 'lucide-react';
import { Card } from '../components/ui/Card';

interface Props {
    data: AppData;
    onUpdate: () => void;
}

type TabMode = 'ITEMS' | 'GROUPS' | 'DEPARTMENTS' | 'VENDORS' | 'UOM' | 'HYGIENE';

interface DuplicateGroup {
    master: string;
    variants: string[];
    score: number;
}

// Helper for fuzzy search (Levenshtein Distance)
const levenshteinDistance = (a: string, b: string): number => {
    const matrix = [];
    let i, j;
    for (i = 0; i <= b.length; i++) matrix[i] = [i];
    for (j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
    }
    return matrix[b.length][a.length];
};

const MasterData: React.FC<Props> = ({ data, onUpdate }) => {
    const { materials, transactions, departments, groups, vendors } = data;
    const [activeTab, setActiveTab] = useState<TabMode>('ITEMS');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    
    // Hygiene State
    const [hygieneScanResults, setHygieneScanResults] = useState<DuplicateGroup[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState<'VENDORS' | 'ITEMS' | 'GROUPS'>('VENDORS');

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editNameInput, setEditNameInput] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addNameInput, setAddNameInput] = useState('');

    // --- Computed Data ---
    const masterList = useMemo(() => {
        if (activeTab === 'HYGIENE') return [];

        let list: any[] = [];

        if (activeTab === 'ITEMS') {
            list = materials.map(m => ({
                id: m.id,
                name: m.name,
                type: 'ITEM',
                stock: m.currentStock,
                unit: m.unit,
                value: m.currentStock * m.pricePerUnit,
                group: m.group,
                dept: m.department,
                txCount: transactions.filter(t => t.materialId === m.id).length
            }));
        } else if (activeTab === 'VENDORS') {
            list = vendors.map(v => {
                const vendorTxs = transactions.filter(t => (t.vendor || '').toLowerCase() === v.toLowerCase());
                const totalSpend = vendorTxs.reduce((sum, t) => sum + t.totalValue, 0);
                const lastActive = vendorTxs.length > 0 
                    ? vendorTxs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date 
                    : null;
                return {
                    id: v,
                    name: v,
                    type: 'VENDOR',
                    txCount: vendorTxs.length,
                    totalValue: totalSpend,
                    lastActive
                };
            });
        } else if (activeTab === 'UOM') {
            // Extract Unique UOMs
            const uoms = Array.from(new Set(materials.map(m => m.unit || 'Nos'))).sort();
            list = uoms.map(u => {
                const linkedItems = materials.filter(m => (m.unit || 'Nos') === u);
                return {
                    id: u,
                    name: u,
                    type: 'UOM',
                    itemCount: linkedItems.length,
                    totalValue: 0,
                    txCount: 0
                };
            });
        } else {
            // Groups or Depts
            const sourceSet = new Set<string>();
            if (activeTab === 'GROUPS') {
                groups.forEach(g => { if (g) sourceSet.add(g.trim()); });
                materials.forEach(m => { if (m.group) sourceSet.add(m.group.trim()); });
                transactions.forEach(t => { if (t.group) sourceSet.add(t.group.trim()); });
            } else {
                departments.forEach(d => { if (d) sourceSet.add(d.trim()); });
                materials.forEach(m => { if (m.department) sourceSet.add(m.department.trim()); });
                transactions.forEach(t => { if (t.department) sourceSet.add(t.department.trim()); });
            }
            const source = Array.from(sourceSet).sort();
            
            list = source.map(name => {
                const key = activeTab === 'GROUPS' ? 'group' : 'department';
                const linkedItems = materials.filter(m => (m[key] || '').toLowerCase() === name.toLowerCase());
                const totalStockVal = linkedItems.reduce((sum, m) => sum + (m.currentStock * m.pricePerUnit), 0);
                
                return {
                    id: name,
                    name: name,
                    type: activeTab === 'GROUPS' ? 'GROUP' : 'DEPARTMENT',
                    itemCount: linkedItems.length,
                    totalValue: totalStockVal,
                    txCount: transactions.filter(t => (t[key] || '').toLowerCase() === name.toLowerCase()).length
                };
            });
        }
        
        return list
            .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));

    }, [activeTab, materials, transactions, groups, departments, vendors, searchTerm]);

    const globalStats = useMemo(() => {
        const totalEntries = masterList.length;
        const totalValue = masterList.reduce((acc, item) => acc + (item.totalValue || item.value || 0), 0);
        const unusedCount = masterList.filter(i => (i.txCount === 0 && i.itemCount === 0 && i.stock === 0)).length;
        return { totalEntries, totalValue, unusedCount };
    }, [masterList]);

    // --- Actions ---

    const handleSelect = (item: any) => {
        setSelectedEntry(item);
        setEditNameInput(item.name);
    };

    const handleCreate = () => {
        if (!addNameInput.trim()) return;
        const cleanName = addNameInput.trim();
        
        if (activeTab === 'GROUPS' && groups.includes(cleanName)) return alert("Group already exists");
        if (activeTab === 'DEPARTMENTS' && departments.includes(cleanName)) return alert("Department already exists");
        if (activeTab === 'VENDORS' && vendors.includes(cleanName)) return alert("Vendor already exists");

        if (activeTab === 'GROUPS') ensureMasterData(data, [], [], [cleanName]);
        if (activeTab === 'DEPARTMENTS') ensureMasterData(data, [], [cleanName], []);
        if (activeTab === 'VENDORS') ensureMasterData(data, [cleanName], [], []);
        // UOM doesn't need explicit creation, it's property based

        onUpdate();
        setIsAddModalOpen(false);
        setAddNameInput('');
    };

    const handleSaveRename = async () => {
        if (!selectedEntry || !editNameInput.trim()) return;
        const newName = editNameInput.trim();
        const oldName = selectedEntry.name;

        if (newName === oldName) { setIsEditModalOpen(false); return; }

        const isMerge = masterList.some(i => i.name.toLowerCase() === newName.toLowerCase() && i.name !== oldName);
        
        if (isMerge) {
            if (!confirm(`⚠️ MERGE DETECTED\n\n"${newName}" already exists.\n\nDo you want to merge "${oldName}" into "${newName}"?\n\nThis will re-assign all history to "${newName}" and delete "${oldName}".`)) return;
        } else {
            if (!confirm(`Rename "${oldName}" to "${newName}"?`)) return;
        }

        let typeStr: any = 'ITEM';
        if (activeTab === 'GROUPS') typeStr = 'GROUP';
        if (activeTab === 'DEPARTMENTS') typeStr = 'DEPARTMENT';
        if (activeTab === 'VENDORS') typeStr = 'VENDOR';
        if (activeTab === 'UOM') typeStr = 'UOM';

        await renameMasterEntry(typeStr, oldName, newName);
        
        setIsEditModalOpen(false);
        setSelectedEntry(null);
        onUpdate();
    };

    const handleDelete = async () => {
        if (!selectedEntry) return;
        if (confirm(`Permanently delete "${selectedEntry.name}"?\n\nThis is only recommended if there is no usage history.`)) {
            let typeStr: any = 'ITEM';
            if (activeTab === 'GROUPS') typeStr = 'GROUP';
            if (activeTab === 'DEPARTMENTS') typeStr = 'DEPARTMENT';
            if (activeTab === 'VENDORS') typeStr = 'VENDOR';
            
            // UOM cannot be explicitly deleted, only vacuumed if unused
            if (activeTab === 'UOM') {
                alert("Units cannot be explicitly deleted. Change the Unit on the associated Items first, then run 'Vacuum' in Maintenance.");
                return;
            }

            await deleteMasterEntry(typeStr, selectedEntry.name);
            setSelectedEntry(null);
            onUpdate();
        }
    };

    // --- Hygiene Logic ---
    const runSmartScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            let sourceList: string[] = [];
            if (scanTarget === 'VENDORS') sourceList = vendors;
            if (scanTarget === 'GROUPS') sourceList = groups;
            if (scanTarget === 'ITEMS') sourceList = materials.map(m => m.name);

            // 1. Group by simple cleaning (case/space)
            // 2. Levenshtein for typos
            
            const processed = new Set<string>();
            const clusters: DuplicateGroup[] = [];

            // Sort by length desc (longer names usually better masters)
            const sortedList = [...sourceList].sort((a,b) => b.length - a.length);

            sortedList.forEach(item => {
                if (processed.has(item)) return;
                
                const currentCluster = [item];
                processed.add(item);

                sortedList.forEach(other => {
                    if (item === other || processed.has(other)) return;
                    
                    // Logic: Distance <= 2 OR (One contains other and diff < 4)
                    const dist = levenshteinDistance(item.toLowerCase(), other.toLowerCase());
                    const isSimilar = dist <= 2 || (item.toLowerCase().includes(other.toLowerCase()) && dist < 4);

                    if (isSimilar) {
                        currentCluster.push(other);
                        processed.add(other);
                    }
                });

                if (currentCluster.length > 1) {
                    clusters.push({
                        master: item, // Default master is the first one found (longest)
                        variants: currentCluster.filter(x => x !== item),
                        score: currentCluster.length
                    });
                }
            });

            setHygieneScanResults(clusters);
            setIsScanning(false);
        }, 500);
    };

    const handleMergeCluster = async (cluster: DuplicateGroup) => {
        if (!confirm(`Merge ${cluster.variants.length} items into "${cluster.master}"?\n\nThis updates all history and deletes the variants.`)) return;
        
        let typeStr: any = 'ITEM';
        if (scanTarget === 'VENDORS') typeStr = 'VENDOR';
        if (scanTarget === 'GROUPS') typeStr = 'GROUP';

        await mergeMasterEntries(typeStr, cluster.variants, cluster.master);
        
        // Remove from results
        setHygieneScanResults(prev => prev.filter(c => c.master !== cluster.master));
        onUpdate();
    };

    return (
        <div className="h-full flex flex-col p-4 animate-fadeIn">
            {/* --- TOP BAR --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Database className="text-[var(--accent)]" size={24} /> Master Data Center
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">Manage entities, units, and data health.</p>
                </div>
                
                <div className="flex bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)] overflow-x-auto w-full md:w-auto no-scrollbar">
                    {[
                        { id: 'ITEMS', icon: Package, label: 'Items' },
                        { id: 'VENDORS', icon: UserSquare, label: 'Vendors' },
                        { id: 'UOM', icon: Scale, label: 'Units' },
                        { id: 'GROUPS', icon: Layers, label: 'Groups' },
                        { id: 'DEPARTMENTS', icon: Briefcase, label: 'Depts' },
                        { id: 'HYGIENE', icon: Wand2, label: 'Fix Data' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as TabMode); setSearchTerm(''); setSelectedEntry(null); }}
                            className={`px-4 py-2 text-xs font-bold rounded flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <tab.icon size={14} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- STATS BAR --- */}
            {activeTab !== 'HYGIENE' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
                    <Card className="p-3 flex items-center gap-3 border-[var(--border-color)] bg-[var(--bg-card)]">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Database size={18}/></div>
                        <div><div className="text-xl font-bold text-[var(--text-primary)]">{globalStats.totalEntries}</div><div className="text-[10px] text-[var(--text-secondary)] uppercase">Total Entries</div></div>
                    </Card>
                    <Card className="p-3 flex items-center gap-3 border-[var(--border-color)] bg-[var(--bg-card)]">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><DollarSign size={18}/></div>
                        <div>
                            <div className="text-xl font-bold text-[var(--text-primary)]">
                                {Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(globalStats.totalValue)}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] uppercase">Assoc. Value</div>
                        </div>
                    </Card>
                    <Card className="p-3 flex items-center gap-3 border-[var(--border-color)] bg-[var(--bg-card)]">
                        <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400"><ShieldAlert size={18}/></div>
                        <div><div className="text-xl font-bold text-[var(--text-primary)]">{globalStats.unusedCount}</div><div className="text-[10px] text-[var(--text-secondary)] uppercase">Unused / Idle</div></div>
                    </Card>
                    {activeTab !== 'ITEMS' && activeTab !== 'UOM' && (
                        <div className="flex items-center justify-center">
                            <Button onClick={() => setIsAddModalOpen(true)} className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[var(--bg-card)] border border-dashed border-[var(--border-color)] hover:border-[var(--accent)] text-[var(--text-secondary)] hover:text-[var(--accent)] shadow-none">
                                <Plus size={20}/>
                                <span className="text-xs font-bold">Add New {activeTab.slice(0, -1)}</span>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* --- MAIN SPLIT VIEW --- */}
            {activeTab !== 'HYGIENE' ? (
                <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden relative">
                    
                    {/* LEFT: MASTER LIST */}
                    <div className={`flex-1 flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg ${selectedEntry ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-500" size={14}/>
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {masterList.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => handleSelect(item)}
                                    className={`p-3 border-b border-[var(--border-color)] cursor-pointer transition-colors flex justify-between items-center group ${selectedEntry?.id === item.id ? 'bg-[var(--accent)]/10 border-l-4 border-l-[var(--accent)]' : 'hover:bg-[var(--bg-main)] border-l-4 border-l-transparent'}`}
                                >
                                    <div className="overflow-hidden">
                                        <div className={`font-medium text-sm truncate ${selectedEntry?.id === item.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{item.name}</div>
                                        <div className="text-[10px] text-[var(--text-secondary)] flex gap-2 mt-0.5">
                                            {item.type === 'ITEM' && <span>Stk: {item.stock}</span>}
                                            {item.type === 'UOM' && <span>Used by: {item.itemCount} items</span>}
                                            {(item.type === 'GROUP' || item.type === 'DEPARTMENT') && <span>Items: {item.itemCount}</span>}
                                            {item.type === 'VENDOR' && <span>Bills: {item.txCount}</span>}
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className={`text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity ${selectedEntry?.id === item.id ? 'opacity-100 text-[var(--accent)]' : ''}`}/>
                                </div>
                            ))}
                            {masterList.length === 0 && (
                                <div className="p-10 text-center text-[var(--text-secondary)] text-xs">No entries found</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: INSPECTOR PANEL */}
                    <div className={`flex-1 md:w-96 md:flex-none flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xl relative ${!selectedEntry ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
                        {!selectedEntry ? (
                            <div className="text-center p-6 text-[var(--text-secondary)]">
                                <Database size={48} className="mx-auto mb-4 opacity-20"/>
                                <p>Select an entry to view details and actions.</p>
                            </div>
                        ) : (
                            <>
                                {/* Detail Header */}
                                <div className="p-6 border-b border-[var(--border-color)] bg-gradient-to-b from-[var(--bg-main)] to-transparent relative">
                                    <button onClick={() => setSelectedEntry(null)} className="absolute top-4 right-4 md:hidden p-2 bg-[var(--bg-main)] rounded-full text-[var(--text-secondary)]"><X size={16}/></button>
                                    <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center mb-4">
                                        {activeTab === 'ITEMS' ? <Package size={24}/> : activeTab === 'VENDORS' ? <UserSquare size={24}/> : activeTab === 'UOM' ? <Scale size={24}/> : <Layers size={24}/>}
                                    </div>
                                    <h3 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{selectedEntry.name}</h3>
                                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                                        ID: {selectedEntry.id}
                                    </span>
                                </div>

                                {/* Analytics Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-[var(--bg-main)] rounded-lg border border-[var(--border-color)]">
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold mb-1">
                                                {selectedEntry.type === 'ITEM' ? 'Current Stock' : selectedEntry.type === 'VENDOR' ? 'Total Spend' : selectedEntry.type === 'UOM' ? 'Usage Count' : 'Total Stock Value'}
                                            </div>
                                            <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
                                                {selectedEntry.type === 'ITEM' ? selectedEntry.stock : selectedEntry.type === 'UOM' ? selectedEntry.itemCount : `₹${(selectedEntry.totalValue||0).toLocaleString(undefined, {notation:"compact"})}`}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-main)] rounded-lg border border-[var(--border-color)]">
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold mb-1">
                                                {selectedEntry.type === 'UOM' ? 'Linked Items' : 'Transactions'}
                                            </div>
                                            <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
                                                {selectedEntry.type === 'UOM' ? selectedEntry.itemCount : selectedEntry.txCount}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Context Info */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase flex items-center gap-2"><Activity size={12}/> Usage Insights</h4>
                                        {selectedEntry.type === 'VENDOR' && (
                                            <div className="text-xs text-[var(--text-primary)]">
                                                Last Active: <span className="font-bold">{selectedEntry.lastActive ? new Date(selectedEntry.lastActive).toLocaleDateString() : 'Never'}</span>
                                            </div>
                                        )}
                                        {selectedEntry.type === 'ITEM' && (
                                            <div className="text-xs text-[var(--text-primary)] space-y-1">
                                                <div>Group: <span className="font-bold text-blue-400">{selectedEntry.group}</span></div>
                                                <div>Dept: <span className="font-bold text-purple-400">{selectedEntry.dept}</span></div>
                                            </div>
                                        )}
                                        {selectedEntry.type === 'UOM' && (
                                            <div className="text-xs text-[var(--text-secondary)]">
                                                Updating this unit will automatically correct <strong className="text-[var(--text-primary)]">{selectedEntry.itemCount} items</strong> using it.
                                            </div>
                                        )}
                                        {(selectedEntry.type === 'GROUP' || selectedEntry.type === 'DEPARTMENT') && (
                                            <div className="text-xs text-[var(--text-secondary)]">
                                                This category contains <strong className="text-[var(--text-primary)]">{selectedEntry.itemCount} unique items</strong>.
                                            </div>
                                        )}
                                    </div>

                                    {/* Warnings */}
                                    {selectedEntry.txCount > 0 ? (
                                        <div className="bg-yellow-900/10 border border-yellow-500/30 p-3 rounded-lg flex gap-3 items-start">
                                            <ShieldAlert size={16} className="text-yellow-500 shrink-0 mt-0.5"/>
                                            <div className="text-xs text-yellow-200/80">
                                                This entry has historical data. Deleting is restricted to preserve audit trails. You can rename or merge it.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-green-900/10 border border-green-500/30 p-3 rounded-lg flex gap-3 items-start">
                                            <Check size={16} className="text-green-500 shrink-0 mt-0.5"/>
                                            <div className="text-xs text-green-200/80">
                                                Safe to delete. No transactions linked.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="p-4 bg-[var(--bg-main)] border-t border-[var(--border-color)] flex gap-3">
                                    <Button onClick={() => setIsEditModalOpen(true)} variant="secondary" className="flex-1">
                                        <Edit size={14} className="mr-2"/> Rename / Merge
                                    </Button>
                                    <Button onClick={handleDelete} disabled={selectedEntry.txCount > 0 && selectedEntry.type === 'ITEM'} variant="danger" className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 shadow-none">
                                        <Trash2 size={14} className="mr-2"/> Delete
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                // --- HYGIENE DASHBOARD (SMART CLEANUP) ---
                <div className="flex-1 flex flex-col p-4 bg-[var(--bg-card)]/50 rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="text-center py-6 border-b border-[var(--border-color)]">
                        <Wand2 size={40} className="text-[var(--accent)] mx-auto mb-3 animate-pulse-slow"/>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">Data Hygiene & Smart Merge</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-lg mx-auto">
                            Auto-detect similarities (typos, case differences) and merge them in one click.
                        </p>
                    </div>

                    <div className="flex justify-center gap-4 py-6">
                        <div className="flex bg-[var(--bg-main)] rounded-lg p-1 border border-[var(--border-color)]">
                            <button onClick={() => setScanTarget('VENDORS')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${scanTarget === 'VENDORS' ? 'bg-[var(--accent)] text-white' : 'text-gray-400'}`}>Vendors</button>
                            <button onClick={() => setScanTarget('GROUPS')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${scanTarget === 'GROUPS' ? 'bg-[var(--accent)] text-white' : 'text-gray-400'}`}>Groups</button>
                            <button onClick={() => setScanTarget('ITEMS')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${scanTarget === 'ITEMS' ? 'bg-[var(--accent)] text-white' : 'text-gray-400'}`}>Items</button>
                        </div>
                        <Button onClick={runSmartScan} disabled={isScanning} variant="primary" className="flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20">
                            {isScanning ? 'Scanning...' : `Scan for Duplicates`} <Sparkles size={14}/>
                        </Button>
                        <Button onClick={() => { if(confirm("Remove unused master data?")) { vacuumMasterData(); onUpdate(); } }} variant="secondary" className="flex items-center gap-2">
                            Vacuum Unused <Trash2 size={14}/>
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {hygieneScanResults.length === 0 ? (
                            <div className="text-center text-gray-500 text-xs italic mt-10">
                                {isScanning ? 'Analyzing records...' : 'Run a scan to find naming issues.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {hygieneScanResults.map((group, idx) => (
                                    <div key={idx} className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-4 relative group hover:border-[var(--accent)] transition-all">
                                        <div className="absolute top-2 right-2 text-xs font-bold bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded border border-yellow-800">
                                            {group.variants.length} variations
                                        </div>
                                        <div className="mb-3">
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Recommended Master</div>
                                            <div className="text-base font-bold text-green-400">{group.master}</div>
                                        </div>
                                        <div className="space-y-1 mb-4">
                                            <div className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">Detected Variants</div>
                                            {group.variants.map(v => (
                                                <div key={v} className="flex items-center gap-2 text-xs text-red-300 line-through decoration-red-500/50 opacity-70">
                                                    <ArrowDown size={10} className="text-gray-500 rotate-[-45deg]"/> {v}
                                                </div>
                                            ))}
                                        </div>
                                        <Button onClick={() => handleMergeCluster(group)} className="w-full text-xs flex justify-center items-center gap-2" variant="secondary">
                                            <Merge size={14}/> Merge All into "{group.master}"
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- ADD MODAL --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-md rounded-xl p-6 shadow-2xl animate-fadeIn">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Add New {activeTab.slice(0, -1)}</h3>
                        <input 
                            value={addNameInput} 
                            onChange={e => setAddNameInput(e.target.value)} 
                            placeholder={`Enter ${activeTab.toLowerCase()} name...`}
                            className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none mb-6"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <Button onClick={() => setIsAddModalOpen(false)} variant="secondary" className="flex-1">Cancel</Button>
                            <Button onClick={handleCreate} disabled={!addNameInput.trim()} variant="success" className="flex-1">Create</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- RENAME/MERGE MODAL --- */}
            {isEditModalOpen && selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-md rounded-xl p-6 shadow-2xl animate-fadeIn">
                        <div className="flex items-center gap-3 mb-4">
                            <Edit className="text-blue-500" size={24}/>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)]">Edit Entry</h3>
                                <p className="text-xs text-[var(--text-secondary)]">Renaming to an existing name will trigger a MERGE.</p>
                            </div>
                        </div>
                        
                        <div className="bg-[var(--bg-main)] p-3 rounded-lg border border-[var(--border-color)] mb-4">
                            <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Current Name</label>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{selectedEntry.name}</div>
                        </div>

                        <div className="mb-6">
                            <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)] mb-1 block">New Name</label>
                            <input 
                                value={editNameInput} 
                                onChange={e => setEditNameInput(e.target.value)} 
                                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button onClick={() => setIsEditModalOpen(false)} variant="secondary" className="flex-1">Cancel</Button>
                            <Button onClick={handleSaveRename} variant="primary" className="flex-1">
                                {masterList.some(i => i.name.toLowerCase() === editNameInput.toLowerCase() && i.name !== selectedEntry.name) ? 'Merge Records' : 'Save Rename'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterData;
