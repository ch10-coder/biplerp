import React, { useState, useEffect } from 'react';
import { ViewName } from '../types';
import { 
  Search, ArrowRight, LayoutDashboard, Truck, ShoppingCart, Calculator, 
  FileText, ClipboardList, BarChart3, Settings, Database, ArrowUpRight, 
  UploadCloud, Info 
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: ViewName) => void;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const actions: { id: ViewName; label: string; category: string; icon: React.ReactNode }[] = [
        { id: 'DASHBOARD', label: 'Go to Dashboard', category: 'Navigation', icon: <LayoutDashboard size={18}/> },
        { id: 'PURCHASE', label: 'New Inward Entry (Bill)', category: 'Operations', icon: <Truck size={18}/> },
        { id: 'ISSUE', label: 'Issue Material', category: 'Operations', icon: <ShoppingCart size={18}/> },
        { id: 'STOCK_REGISTER', label: 'Stock Register & Levels', category: 'Registers', icon: <ClipboardList size={18}/> },
        { id: 'MRN_REGISTER', label: 'MRN & Purchase History', category: 'Registers', icon: <FileText size={18}/> },
        { id: 'ISSUE_REGISTER', label: 'Material Issue History', category: 'Registers', icon: <ArrowUpRight size={18}/> },
        { id: 'STOCK_TAKING', label: 'Physical Stock Audit', category: 'Operations', icon: <ClipboardList size={18}/> },
        { id: 'REPORTS', label: 'Reports & Analytics', category: 'Registers', icon: <BarChart3 size={18}/> },
        { id: 'WORK_AREA', label: 'Workbench & Calculator', category: 'Tools', icon: <Calculator size={18}/> },
        { id: 'MASTER_DATA', label: 'Manage Master Data', category: 'System', icon: <Database size={18}/> },
        { id: 'BULK_IMPORT', label: 'Bulk Import Data', category: 'System', icon: <UploadCloud size={18}/> },
        { id: 'SETTINGS', label: 'Settings & Theme', category: 'System', icon: <Settings size={18}/> },
        { id: 'ABOUT', label: 'System Information', category: 'System', icon: <Info size={18}/> },
    ];

    const filtered = actions.filter(a => 
        a.label.toLowerCase().includes(query.toLowerCase()) || 
        a.category.toLowerCase().includes(query.toLowerCase())
    );

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[selectedIndex]) {
                    onNavigate(filtered[selectedIndex].id);
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filtered, selectedIndex, onNavigate, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={onClose} />
            
            <div className="relative w-full max-w-xl bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slideDown ring-1 ring-white/10">
                
                {/* Search Header */}
                <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-color)] bg-[var(--bg-card)]/40">
                    <Search className="text-[var(--text-secondary)] mr-3 shrink-0" size={20} />
                    <input 
                        className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 text-base font-medium"
                        placeholder="Search views, registers, operations..."
                        autoFocus
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                    />
                    <button 
                        onClick={onClose}
                        className="text-[10px] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg px-2 py-1 font-mono hover:text-[var(--text-primary)] cursor-pointer"
                    >
                        ESC
                    </button>
                </div>

                {/* Results List */}
                <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center text-[var(--text-secondary)] text-sm">
                            No matching commands found.
                        </div>
                    ) : (
                        filtered.map((action, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <div 
                                    key={action.id}
                                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-150 ${
                                        isSelected 
                                            ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 translate-x-1' 
                                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                                    }`}
                                    onClick={() => { onNavigate(action.id); onClose(); }}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                >
                                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}>
                                        {action.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold truncate">{action.label}</div>
                                        <div className={`text-[10px] font-mono uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-[var(--text-secondary)] opacity-70'}`}>
                                            {action.category}
                                        </div>
                                    </div>
                                    {isSelected && <ArrowRight size={16} className="animate-pulse" />}
                                </div>
                            );
                        })
                    )}
                </div>
                
                {/* Footer Hint */}
                <div className="px-4 py-2.5 bg-[var(--bg-card)]/50 border-t border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span>Navigate:</span>
                        <span className="font-mono bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-1.5 py-0.5">↑↓</span>
                        <span>Select:</span>
                        <span className="font-mono bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-1.5 py-0.5">↵</span>
                    </div>
                    <span className="font-mono text-[10px] opacity-70">InventoryMate v2.9</span>
                </div>
            </div>
        </div>
    );
};
