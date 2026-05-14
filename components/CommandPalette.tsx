
import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, LayoutDashboard, Truck, ShoppingCart, Calculator, FileText, ClipboardList, BarChart3, Settings, Database, ArrowUpRight } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: any) => void;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const actions = [
        { id: 'DASHBOARD', label: 'Go to Dashboard', icon: <LayoutDashboard size={18}/> },
        { id: 'PURCHASE', label: 'New Inward Entry (Bill)', icon: <Truck size={18}/> },
        { id: 'ISSUE', label: 'Issue Material', icon: <ShoppingCart size={18}/> },
        { id: 'STOCK_REGISTER', label: 'View Stock Register', icon: <ClipboardList size={18}/> },
        { id: 'MRN_REGISTER', label: 'View MRN History', icon: <FileText size={18}/> },
        { id: 'ISSUE_REGISTER', label: 'View Issue History', icon: <ArrowUpRight size={18}/> },
        { id: 'REPORTS', label: 'Reports & Analytics', icon: <BarChart3 size={18}/> },
        { id: 'WORK_AREA', label: 'Open Calculator / Scratchpad', icon: <Calculator size={18}/> },
        { id: 'MASTER_DATA', label: 'Manage Master Data', icon: <Database size={18}/> },
        { id: 'SETTINGS', label: 'Settings', icon: <Settings size={18}/> },
    ];

    const filtered = actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filtered.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-lg bg-[#0f172a] border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn ring-1 ring-white/10">
                
                <div className="flex items-center px-4 py-4 border-b border-gray-800">
                    <Search className="text-gray-400 mr-3" size={20} />
                    <input 
                        className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder-gray-500 text-lg font-medium"
                        placeholder="Type a command..."
                        autoFocus
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                    />
                    <div className="text-[10px] text-gray-500 border border-gray-700 rounded px-2 py-1 font-mono">ESC</div>
                </div>

                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filtered.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">No results found.</div>
                    ) : (
                        filtered.map((action, idx) => (
                            <div 
                                key={action.id}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-300 hover:bg-white/5'}`}
                                onClick={() => { onNavigate(action.id); onClose(); }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                <div className={`${idx === selectedIndex ? 'text-white' : 'text-gray-400'}`}>
                                    {action.icon}
                                </div>
                                <div className="flex-1 text-sm font-medium">{action.label}</div>
                                {idx === selectedIndex && <ArrowRight size={14} className="animate-pulse"/>}
                            </div>
                        ))
                    )}
                </div>
                
                <div className="px-4 py-2 bg-black/20 border-t border-gray-800 text-[10px] text-gray-500 flex justify-between">
                    <span>Navigation: <span className="font-mono text-gray-400">↑↓</span> to select, <span className="font-mono text-gray-400">↵</span> to enter</span>
                    <span>InventoryMate v2.8</span>
                </div>
            </div>
        </div>
    );
};
