
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { AppData, AppSettings } from '../types';
import { saveAppData, resetAppData, updateAppSettings, getAppData, vacuumMasterData, recalculateAllStock, migrateLegacyItemsToStrictIds } from '../services/storageService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Download, Upload, AlertTriangle, CheckCircle, Trash2, X, Save, Building, Type, Coins, ShieldAlert, Key, ListChecks, Search, Plus, Calendar, MapPin, FileText, Eraser, Palette, Moon, Trees, Sun, Settings2, Monitor, RefreshCw, GitBranch, Loader2 } from 'lucide-react';

interface Props {
    data: AppData;
    onRestore: () => void;
}

const Settings: React.FC<Props> = ({ data, onRestore }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    
    // Settings State
    const [appSettings, setAppSettings] = useState<AppSettings>(data.appSettings);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'ESSENTIALS' | 'SYSTEM'>('GENERAL');

    // Sync state with props when data changes
    useEffect(() => {
        setAppSettings(data.appSettings);
    }, [data.appSettings]);

    // Clear Data Password State
    const [clearPassword, setClearPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Password Change State
    const [currentPassInput, setCurrentPassInput] = useState('');
    const [newPassInput, setNewPassInput] = useState('');
    const [passChangeMsg, setPassChangeMsg] = useState('');

    // Essentials List State
    const [essentialSearch, setEssentialSearch] = useState('');

    // --- Live Theme Preview ---
    useEffect(() => {
        const theme = appSettings.theme || 'default';
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);

        return () => {
            const storedTheme = data.appSettings?.theme || 'default';
            document.documentElement.setAttribute('data-theme', storedTheme);
            document.body.setAttribute('data-theme', storedTheme);
        };
    }, [appSettings.theme, data.appSettings?.theme]);
    
    // --- Actions ---
    const handleSaveSettings = () => {
        updateAppSettings(appSettings);
        onRestore(); 
        setStatus({ type: 'success', msg: 'Application configuration updated successfully!' });
        setTimeout(() => setStatus(null), 3000);
    };

    const handleVacuum = async () => {
        if (confirm("This will scan for unused Vendor names, Departments, and Groups and remove them from the Master Data list. Transactions will not be affected.\n\nProceed?")) {
            const count = await vacuumMasterData();
            onRestore();
            setStatus({ type: 'success', msg: `Cleanup Complete: Removed ${count} unused master entries.` });
        }
    };

    const handleRecalculate = async () => {
        if(confirm("This will recalculate stock levels and weighted average prices for ALL items based on their complete transaction history.\n\nUse this if you see negative stock or incorrect values.\n\nProceed?")) {
            const count = await recalculateAllStock();
            onRestore();
            setStatus({ type: 'success', msg: `Recalculated stock for ${count} items.` });
        }
    };

    const handleMigration = async () => {
        if(confirm("⚠️ STRICT MODE MIGRATION\n\nThis will scan all items. If an item has transactions with DIFFERENT Groups or Departments, it will split them into separate Items with unique IDs.\n\nExample: 'Gloves' (Safety) and 'Gloves' (Kitchen) will become two distinct items.\n\nProceed?")) {
            const result = await migrateLegacyItemsToStrictIds();
            onRestore();
            setStatus({ type: 'success', msg: `Migration Complete: Split ${result.splitCount} transactions into ${result.newMaterialsCount} new unique items.` });
        }
    }

    const handleChangePassword = () => {
        if (!currentPassInput || !newPassInput) {
            setPassChangeMsg('Please fill both fields.');
            return;
        }
        if (currentPassInput !== appSettings.adminPassword) {
            setPassChangeMsg('Incorrect current password.');
            return;
        }
        if (newPassInput.length < 4) {
            setPassChangeMsg('New password too short (min 4 chars).');
            return;
        }
        setAppSettings(prev => ({...prev, adminPassword: newPassInput}));
        setPassChangeMsg('Password changed! Don\'t forget to Save.');
        setCurrentPassInput('');
        setNewPassInput('');
    };

    // --- Essentials Logic ---
    const filteredMaterials = useMemo(() => {
        if (!essentialSearch) return [];
        return data.materials
            .filter(m => m.name.toLowerCase().includes(essentialSearch.toLowerCase()) && !appSettings.monthlyEssentials?.includes(m.id))
            .slice(0, 5);
    }, [data.materials, essentialSearch, appSettings.monthlyEssentials]);

    const getMaterialStatus = (id: string) => {
        const restockRecord = data.appSettings?.monthlyRestockRecord || {};
        
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const hasTransaction = data.transactions.some(t => 
            t.materialId === id && 
            t.type === 'PURCHASE' &&
            (t.date || '').startsWith(currentMonthPrefix)
        );

        const isManuallyDone = restockRecord[id] === currentMonthPrefix;
        return hasTransaction || isManuallyDone;
    };

    const addEssential = (id: string) => {
        const currentList = appSettings.monthlyEssentials || [];
        if (!currentList.includes(id)) {
            setAppSettings(prev => ({...prev, monthlyEssentials: [...currentList, id]}));
        }
        setEssentialSearch('');
    };

    const removeEssential = (id: string) => {
        const currentList = appSettings.monthlyEssentials || [];
        setAppSettings(prev => ({...prev, monthlyEssentials: currentList.filter(item => item !== id)}));
    };

    // --- Backup/Restore ---
    const handleBackup = () => {
        try {
            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const link = document.createElement('a');
            link.href = url;
            link.download = `bipl_backup_${now.toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setStatus({ type: 'success', msg: 'Backup downloaded successfully!' });
        } catch (e) {
            setStatus({ type: 'error', msg: 'Failed to generate backup.' });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsRestoring(true);
        setStatus({ type: 'info', msg: 'Reading file...' });

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = event.target?.result as string;
                const parsedData = JSON.parse(json);
                if (!parsedData.materials || !Array.isArray(parsedData.transactions)) {
                    throw new Error("Invalid file format.");
                }
                
                // Prompt for Clean Restore
                if (confirm(`Backup loaded with ${parsedData.transactions.length} records.\n\nDo you want to REPLACE your current database with this backup?\n\n(Recommended to fix missing data issues. Existing data will be cleared.)`)) {
                    await resetAppData();
                }

                setStatus({ type: 'info', msg: `Uploading ${parsedData.transactions.length} records to cloud... This may take a moment.` });
                
                // Wait for the upload to complete
                await saveAppData(parsedData);
                
                // Refresh the app with new data
                onRestore(); 
                
                setStatus({ type: 'success', msg: 'Data restored successfully!' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (err: any) {
                console.error(err);
                setStatus({ type: 'error', msg: `Restore Failed: ${err.message || 'Unknown Error'}` });
            } finally {
                setIsRestoring(false);
            }
        };
        reader.readAsText(file);
    };

    const confirmClearData = () => {
        if (clearPassword !== appSettings.adminPassword) {
            setPasswordError('Incorrect password');
            return;
        }
        resetAppData();
        // Legacy 'erp_user_tasks' removal is now handled inside resetAppData
        localStorage.removeItem('erp_local_notes'); // Clear utility notes
        localStorage.removeItem('erp_scratchpad'); // Clear scratchpad
        onRestore();
        setStatus({ type: 'success', msg: 'All data cleared successfully.' });
        setShowClearConfirm(false);
        setClearPassword('');
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6 relative pb-20 animate-fadeIn">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Settings2 className="text-gray-400" /> App Configuration
                        </h2>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">Manage profile, essentials, and system preferences.</p>
                    </div>
                    <Button onClick={handleSaveSettings} variant="success" className="text-sm px-6 flex items-center gap-2 shadow-lg shadow-green-900/20">
                        <Save size={16}/> Save Changes
                    </Button>
                </div>

                {status && (
                    <div className={`p-4 rounded-lg border flex items-center gap-3 animate-fadeIn ${
                        status.type === 'success' ? 'bg-green-900/20 border-green-500 text-green-400' : 
                        status.type === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-blue-900/20 border-blue-500 text-blue-400'
                    }`}>
                        {status.type === 'success' ? <CheckCircle size={20}/> : status.type === 'error' ? <AlertTriangle size={20}/> : <Loader2 className="animate-spin" size={20}/>}
                        {status.msg}
                    </div>
                )}

                {/* TABS */}
                <div className="flex border-b border-[var(--border-color)] space-x-1">
                    <button onClick={() => setActiveTab('GENERAL')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'GENERAL' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-gray-500 hover:text-white'}`}>
                        <Building size={16} /> General
                    </button>
                    <button onClick={() => setActiveTab('ESSENTIALS')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ESSENTIALS' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-gray-500 hover:text-white'}`}>
                        <ListChecks size={16} /> Essentials
                    </button>
                    <button onClick={() => setActiveTab('SYSTEM')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'SYSTEM' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-gray-500 hover:text-white'}`}>
                        <Monitor size={16} /> System
                    </button>
                </div>

                {/* TAB CONTENT */}
                <div className="mt-6">
                    
                    {/* --- TAB 1: GENERAL --- */}
                    {activeTab === 'GENERAL' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                            <Card className="glass-effect border-[var(--border-color)] h-full">
                                <div className="flex items-center gap-2 mb-4 border-b border-[var(--border-color)] pb-3">
                                    <div className="p-2 bg-blue-900/30 rounded text-blue-400"><Building size={20} /></div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Company Profile</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Company / App Name</label>
                                        <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 focus-within:border-blue-500">
                                            <Type size={14} className="text-gray-500 mr-2"/>
                                            <input type="text" value={appSettings.appName} onChange={(e) => setAppSettings({...appSettings, appName: e.target.value})} className="w-full bg-transparent py-2 text-[var(--text-primary)] focus:outline-none"/>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Currency</label>
                                            <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 focus-within:border-blue-500">
                                                <Coins size={14} className="text-gray-500 mr-2"/>
                                                <input type="text" value={appSettings.currencySymbol} onChange={(e) => setAppSettings({...appSettings, currencySymbol: e.target.value})} className="w-full bg-transparent py-2 text-[var(--text-primary)] focus:outline-none" placeholder="₹, $, €"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Tax ID / GSTIN</label>
                                            <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 focus-within:border-blue-500">
                                                <FileText size={14} className="text-gray-500 mr-2"/>
                                                <input type="text" value={appSettings.companyGst || ''} onChange={(e) => setAppSettings({...appSettings, companyGst: e.target.value})} className="w-full bg-transparent py-2 text-[var(--text-primary)] focus:outline-none" placeholder="GST Number"/>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Full Address (For Reports)</label>
                                        <div className="flex items-start bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 py-2 focus-within:border-blue-500">
                                            <MapPin size={14} className="text-gray-500 mr-2 mt-1"/>
                                            <textarea value={appSettings.companyAddress || ''} onChange={(e) => setAppSettings({...appSettings, companyAddress: e.target.value})} className="w-full bg-transparent text-[var(--text-primary)] focus:outline-none text-sm resize-none h-16" placeholder="Registered Office Address..."/>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                            
                            <div className="flex flex-col justify-center items-center text-center p-8 bg-[var(--bg-card)]/30 border border-dashed border-[var(--border-color)] rounded-xl">
                                <Building size={48} className="text-gray-600 mb-4 opacity-50"/>
                                <h3 className="text-lg font-bold text-gray-400">Inventory Policy</h3>
                                <p className="text-sm text-gray-500 mt-2 max-w-xs">
                                    Minimum stock levels are managed manually per item. Negative stock is handled automatically by the system.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- TAB 2: ESSENTIALS --- */}
                    {activeTab === 'ESSENTIALS' && (
                        <Card className="glass-effect border-[var(--border-color)] animate-fadeIn">
                            <div className="flex items-center gap-2 mb-4 border-b border-[var(--border-color)] pb-3">
                                <div className="p-2 bg-yellow-900/30 rounded text-yellow-400"><ListChecks size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Monthly Essentials Watchlist</h3>
                                    <p className="text-xs text-[var(--text-secondary)]">Items added here will appear in the Dashboard procurement list until purchased this month.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="w-full md:w-1/2 relative">
                                    <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Add Item to List</label>
                                    <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 focus-within:border-yellow-500 h-10">
                                        <Search size={16} className="text-gray-500 mr-2"/>
                                        <input type="text" placeholder="Search to add..." value={essentialSearch} onChange={(e) => setEssentialSearch(e.target.value)} className="w-full bg-transparent text-[var(--text-primary)] focus:outline-none text-sm"/>
                                    </div>
                                    {filteredMaterials.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded mt-1 z-10 shadow-xl max-h-40 overflow-y-auto">
                                            {filteredMaterials.map(m => (
                                                <div key={m.id} onClick={() => addEssential(m.id)} className="p-2 hover:bg-[var(--bg-main)] cursor-pointer flex justify-between items-center text-sm border-b border-[var(--border-color)] last:border-0">
                                                    <span className="text-[var(--text-primary)]">{m.name}</span>
                                                    <span className="text-xs text-[var(--text-secondary)]">{m.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="w-full md:w-1/2">
                                    <label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Current Watchlist ({appSettings.monthlyEssentials?.length || 0})</label>
                                    <div className="bg-[var(--bg-main)]/30 border border-[var(--border-color)] rounded p-2 h-64 overflow-y-auto custom-scrollbar">
                                        {(appSettings.monthlyEssentials || []).length === 0 ? (
                                            <div className="text-center text-[var(--text-secondary)] text-xs py-20 flex flex-col items-center opacity-70">
                                                <Calendar size={32} className="mb-2 opacity-50"/>
                                                No essential items tracked.
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {(appSettings.monthlyEssentials || []).map(id => {
                                                    const mat = data.materials.find(m => m.id === id);
                                                    if (!mat) return null;
                                                    const isBought = getMaterialStatus(id);
                                                    return (
                                                        <div key={id} className="flex justify-between items-center bg-[var(--bg-card)] p-2 rounded border border-[var(--border-color)] group hover:border-yellow-500/30 transition-colors">
                                                            <div>
                                                                <div className="text-sm font-medium text-[var(--text-primary)]">{mat.name}</div>
                                                                <div className="text-[10px] flex gap-2">
                                                                    <span className="text-[var(--text-secondary)]">Stock: {mat.currentStock} {mat.unit}</span>
                                                                    {isBought ? <span className="text-green-400 font-bold flex items-center gap-1"><CheckCircle size={10}/> Done</span> : <span className="text-orange-400 font-bold">Pending</span>}
                                                                </div>
                                                            </div>
                                                            <button onClick={() => removeEssential(id)} className="text-[var(--text-secondary)] hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* --- TAB 3: SYSTEM --- */}
                    {activeTab === 'SYSTEM' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Theme Selector */}
                            <Card className="glass-effect border-[var(--border-color)]">
                                <div className="flex items-center gap-2 mb-4 border-b border-[var(--border-color)] pb-3">
                                    <div className="p-2 bg-pink-900/30 rounded text-pink-400"><Palette size={20} /></div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Appearance</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <button onClick={() => setAppSettings({...appSettings, theme: 'default'})} className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${appSettings.theme === 'default' ? 'border-blue-500 bg-gray-900/80 ring-2 ring-blue-500/20' : 'border-gray-700 bg-black/40 hover:border-gray-600'}`}>
                                        <div className="w-8 h-8 rounded-full bg-gray-950 border border-gray-700 flex items-center justify-center text-blue-400"><Moon size={16}/></div>
                                        <div><div className="font-bold text-white">Cosmic Gray</div><div className="text-xs text-gray-500">Dark Tech (Default)</div></div>
                                    </button>
                                    <button onClick={() => setAppSettings({...appSettings, theme: 'midnight'})} className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${appSettings.theme === 'midnight' ? 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/20' : 'border-gray-700 bg-[#020617]/60 hover:border-indigo-500/50'}`}>
                                        <div className="w-8 h-8 rounded-full bg-[#0f172a] border border-indigo-900 flex items-center justify-center text-indigo-400"><Moon size={16}/></div>
                                        <div><div className="font-bold text-indigo-100">Midnight Blur</div><div className="text-xs text-indigo-300/50">Neon Cyberpunk</div></div>
                                    </button>
                                    <button onClick={() => setAppSettings({...appSettings, theme: 'forest'})} className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${appSettings.theme === 'forest' ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/20' : 'border-gray-700 bg-[#022c22]/60 hover:border-emerald-500/50'}`}>
                                        <div className="w-8 h-8 rounded-full bg-[#064e3b] border border-emerald-900 flex items-center justify-center text-emerald-400"><Trees size={16}/></div>
                                        <div><div className="font-bold text-emerald-100">Forest Glass</div><div className="text-xs text-emerald-300/50">Bio-Tech</div></div>
                                    </button>
                                    <button onClick={() => setAppSettings({...appSettings, theme: 'light'})} className={`p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-2 ${appSettings.theme === 'light' ? 'border-blue-500 bg-white ring-2 ring-blue-500/20' : 'border-gray-200 bg-gray-100 hover:border-blue-300'}`}>
                                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-yellow-500 shadow-sm"><Sun size={16}/></div>
                                        <div><div className="font-bold text-gray-900">Classic White</div><div className="text-xs text-gray-500">Ceramic / Clean</div></div>
                                    </button>
                                </div>
                            </Card>

                            {/* System Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Card className="flex flex-col justify-between h-full border-blue-900/30 bg-blue-900/5 glass-effect">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-blue-900/30 rounded-full text-blue-400"><Eraser size={20} /></div><h3 className="text-lg font-bold text-[var(--text-primary)]">Vacuum Data</h3></div>
                                        <p className="text-[var(--text-secondary)] text-xs mb-4">Clean up unused master data entries to keep dropdowns organized.</p>
                                    </div>
                                    <Button onClick={handleVacuum} className="w-full flex items-center justify-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-white"><Eraser size={14} /> Run Cleanup</Button>
                                </Card>

                                <Card className="flex flex-col justify-between h-full border-purple-900/30 bg-purple-900/5 glass-effect">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-purple-900/30 rounded-full text-purple-400"><RefreshCw size={20} /></div><h3 className="text-lg font-bold text-[var(--text-primary)]">Data Integrity</h3></div>
                                        <p className="text-[var(--text-secondary)] text-xs mb-4">Force recalculate all stock levels from transaction history. Fixes "negative stock" bugs.</p>
                                    </div>
                                    <Button onClick={handleRecalculate} className="w-full flex items-center justify-center gap-2 text-xs bg-purple-600 hover:bg-purple-500 text-white"><RefreshCw size={14} /> Recalculate Stock & Values</Button>
                                </Card>

                                <Card className="flex flex-col justify-between h-full border-indigo-900/30 bg-indigo-900/5 glass-effect">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-indigo-900/30 rounded-full text-indigo-400"><GitBranch size={20} /></div><h3 className="text-lg font-bold text-[var(--text-primary)]">Strict Migration</h3></div>
                                        <p className="text-[var(--text-secondary)] text-xs mb-4">Convert legacy items to use strict ID separation for Groups/Departments.</p>
                                    </div>
                                    <Button onClick={handleMigration} className="w-full flex items-center justify-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"><GitBranch size={14} /> Split Mixed Items</Button>
                                </Card>

                                <Card className="flex flex-col justify-between h-full border-[var(--border-color)] bg-[var(--bg-card)] glass-effect">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-[var(--bg-main)] rounded-full text-[var(--text-secondary)]"><Key size={20} /></div><h3 className="text-lg font-bold text-[var(--text-primary)]">Admin Password</h3></div>
                                        <div className="space-y-2">
                                            <input type="password" placeholder="Current Pass" value={currentPassInput} onChange={(e) => setCurrentPassInput(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] text-xs focus:outline-none"/>
                                            <input type="password" placeholder="New Pass" value={newPassInput} onChange={(e) => setNewPassInput(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)] text-xs focus:outline-none"/>
                                            <div className={`text-[10px] ${passChangeMsg.includes('changed') ? 'text-green-400' : 'text-red-400'} h-4`}>{passChangeMsg}</div>
                                        </div>
                                    </div>
                                    <Button variant="secondary" onClick={handleChangePassword} className="w-full text-xs mt-2">Update Password</Button>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="flex flex-col justify-between h-full border-red-900/30 bg-red-950/10 glass-effect">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-red-900/30 rounded-full text-red-500"><Trash2 size={20} /></div><h3 className="text-lg font-bold text-[var(--text-primary)]">Factory Reset</h3></div>
                                        <p className="text-[var(--text-secondary)] text-xs mb-4">Permanently delete ALL data. Used for fresh starts.</p>
                                    </div>
                                    <Button variant="danger" onClick={() => setShowClearConfirm(true)} className="w-full text-xs">⚠️ Clear All Data</Button>
                                </Card>

                                <Card className="flex flex-col justify-between h-full border-[var(--border-color)] bg-[var(--bg-card)] glass-effect">
                                   <div>
                                       <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-blue-900/30 rounded-full text-blue-400"><Download size={20} /></div><h3 className="text-lg font-bold text-[var(--text-primary)]">Backup / Restore</h3></div>
                                       <div className="flex gap-2">
                                           <Button onClick={handleBackup} variant="secondary" className="flex-1 text-xs flex justify-center gap-2"><Download size={14}/> Backup</Button>
                                           <div className="relative flex-1">
                                               <Button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} variant="secondary" className="w-full text-xs flex justify-center gap-2">
                                                   {isRestoring ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                                                   Restore
                                               </Button>
                                               <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isRestoring} />
                                           </div>
                                       </div>
                                   </div>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] w-full max-w-md rounded-xl border border-red-500/50 shadow-2xl p-6 animate-fadeIn">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><AlertTriangle className="text-red-500" /> Confirm Deletion</h3>
                            <button onClick={() => { setShowClearConfirm(false); setClearPassword(''); setPasswordError(''); }} className="text-[var(--text-secondary)] hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 mb-4"><p className="text-red-200 font-medium">Are you absolutely sure?</p><p className="text-red-300/70 text-sm mt-2">This action will permanently delete ALL data. This process cannot be undone.</p></div>
                        <div className="mb-4"><label className="block text-xs uppercase text-[var(--text-secondary)] font-bold mb-1">Enter Admin Password to Confirm</label><input type="password" value={clearPassword} onChange={(e) => { setClearPassword(e.target.value); setPasswordError(''); }} placeholder="Enter password" className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-2 text-[var(--text-primary)] focus:border-red-500 focus:outline-none" autoFocus />{passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}</div>
                        <div className="flex gap-3"><Button variant="secondary" onClick={() => { setShowClearConfirm(false); setClearPassword(''); }} className="flex-1">Cancel</Button><Button variant="danger" onClick={confirmClearData} className="flex-1">Yes, Clear Everything</Button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
