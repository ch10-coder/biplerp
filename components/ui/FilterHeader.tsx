import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Filter, Check, Square, CheckSquare, X } from 'lucide-react';
import { Button } from './Button';

interface FilterHeaderProps {
    colKey: string;
    label: string;
    width?: string | number; 
    isNumeric?: boolean;
    uniqueValues: string[];
    activeSelection: string[];
    isOpen: boolean;
    onToggle: () => void;
    onApply: (selected: string[]) => void;
    onClose: () => void;
    onResize?: (newWidth: number) => void;
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({ 
    colKey, label, width, isNumeric = false, uniqueValues, activeSelection, isOpen, onToggle, onApply, onClose, onResize
}) => {
    const [tempSelection, setTempSelection] = useState<Set<string>>(new Set(activeSelection));
    const [searchTerm, setSearchTerm] = useState('');
    const [coords, setCoords] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const thRef = useRef<HTMLTableCellElement>(null);

    // Resize Logic
    useEffect(() => {
        if (!onResize || !thRef.current) return;

        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.pageX;
            const startWidth = thRef.current?.offsetWidth || 0;

            const handleMouseMove = (moveEvent: MouseEvent) => {
                const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX)); 
                onResize(newWidth);
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        const resizer = thRef.current.querySelector('.resizer') as HTMLElement;
        if (resizer) {
            resizer.addEventListener('mousedown', handleMouseDown);
        }

        return () => {
            if (resizer) {
                resizer.removeEventListener('mousedown', handleMouseDown);
            }
        };
    }, [onResize]);

    useEffect(() => {
        if (isOpen) {
            setTempSelection(new Set(activeSelection.length > 0 ? activeSelection : uniqueValues));
            setSearchTerm('');
            
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const dropdownWidth = 288; // w-72 = 18rem = 288px
                const dropdownHeight = 450;
                const padding = 10;

                let left = rect.left;
                if (left + dropdownWidth > window.innerWidth) {
                    left = window.innerWidth - dropdownWidth - padding;
                }
                left = Math.max(padding, left);

                let top = rect.bottom + 8;
                let maxHeight = 500;

                // If it doesn't fit below, try above
                if (top + dropdownHeight > window.innerHeight) {
                    const spaceAbove = rect.top - padding;
                    const spaceBelow = window.innerHeight - rect.bottom - padding;

                    if (spaceAbove > spaceBelow) {
                        // Position above
                        const actualHeight = Math.min(dropdownHeight, spaceAbove);
                        top = rect.top - actualHeight - 8;
                        maxHeight = actualHeight;
                    } else {
                        // Keep below but shrink
                        maxHeight = spaceBelow;
                    }
                }

                // Final clamp to ensure no top-clipping
                top = Math.max(padding, top);

                setCoords({ top, left, maxHeight });
            }
        }
    }, [isOpen, activeSelection, uniqueValues]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        const handleScroll = (event: Event) => {
            if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) return;
            if (isOpen && window.innerWidth >= 768) onClose(); 
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true); 
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen, onClose]);

    const filteredOptions = uniqueValues.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleToggleItem = (val: string) => {
        const newSet = new Set(tempSelection);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        setTempSelection(newSet);
    };

    const handleSelectAllFiltered = () => {
        const newSet = new Set(tempSelection);
        filteredOptions.forEach(v => newSet.add(v));
        setTempSelection(newSet);
    };

    const handleDeselectAllFiltered = () => {
        const newSet = new Set(tempSelection);
        filteredOptions.forEach(v => newSet.delete(v));
        setTempSelection(newSet);
    };

    const areAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(v => tempSelection.has(v));

    const handleApply = () => {
        if (tempSelection.size === uniqueValues.length) onApply([]);
        else onApply(Array.from(tempSelection));
    };

    const isActive = activeSelection.length > 0;
    const styleObj = typeof width === 'number' 
        ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } 
        : {};
    
    const widthClass = typeof width === 'string' ? width : '';

    return (
        <th 
            ref={thRef}
            className={`px-2 py-2 border-r border-[var(--border-color)] relative group ${widthClass} ${isNumeric ? 'text-right' : ''} bg-[var(--bg-main)]`}
            style={styleObj}
        >
            <div 
                ref={triggerRef}
                className="flex items-center justify-between gap-1 cursor-pointer hover:bg-[var(--bg-card)] p-1 -m-1 rounded transition-colors" 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
                <span className={`truncate text-xs font-bold tracking-wide ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
                <span className={`p-0.5 rounded transition-all ${isActive ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] opacity-50 group-hover:opacity-100'}`}>
                    <Filter size={10} fill={isActive ? "currentColor" : "none"} />
                </span>
            </div>

            {onResize && (
                <div 
                    className="resizer absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent)] z-20 opacity-0 hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                />
            )}

            {isOpen && createPortal(
                <>
                    <div 
                        className="md:hidden fixed inset-0 bg-black/70 z-[9998] backdrop-blur-sm"
                        onClick={onClose}
                    />
                    
                    <div 
                        ref={dropdownRef}
                        style={window.innerWidth >= 768 && coords ? {
                            position: 'fixed',
                            top: coords.top,
                            left: coords.left,
                            maxHeight: coords.maxHeight,
                            width: '288px', // Standard 72 units
                            zIndex: 9999 
                        } : {}}
                        className={`
                            bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col text-left z-[9999] ring-1 ring-white/5 backdrop-blur-2xl text-[var(--text-primary)]
                            fixed top-1/2 left-1/2 w-[90%] max-w-sm max-h-[80vh] -translate-x-1/2 -translate-y-1/2
                            md:top-auto md:left-auto md:w-72 md:max-w-none md:translate-x-0 md:translate-y-0 animate-fadeIn
                        `}
                        onClick={e => e.stopPropagation()} 
                    >
                        {/* Header */}
                        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 rounded-t-xl flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Filter: {label}</span>
                            <button onClick={onClose} className="md:hidden text-[var(--text-secondary)] hover:text-white"><X size={14}/></button>
                        </div>

                        {/* Search */}
                        <div className="p-3 bg-[var(--bg-card)]">
                            <div className="relative group">
                                <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"/>
                                <input 
                                    type="text" 
                                    placeholder={`Search options...`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-xs py-2 pl-9 pr-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Select All Actions */}
                        <div className="px-3 py-2 border-b border-[var(--border-color)] flex justify-between bg-[var(--bg-main)]/30 text-[10px]">
                            <button 
                                onClick={areAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered} 
                                className="flex items-center gap-1.5 text-[var(--text-primary)] hover:text-[var(--accent)] font-bold transition-colors"
                            >
                                {areAllFilteredSelected ? <CheckSquare size={12} className="text-[var(--accent)]"/> : <Square size={12}/>}
                                {areAllFilteredSelected ? 'Deselect All' : 'Select All'}
                            </button>
                            <span className="text-[var(--text-secondary)] font-mono">{tempSelection.size} selected</span>
                        </div>

                        {/* Options List */}
                        <div className="overflow-y-auto flex-1 p-1 custom-scrollbar min-h-[150px] bg-[var(--bg-card)]">
                            {filteredOptions.map(val => (
                                <div 
                                    key={val} 
                                    className={`flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-main)] cursor-pointer rounded-lg transition-all group border border-transparent ${tempSelection.has(val) ? 'bg-[var(--accent)]/5 border-[var(--accent)]/10' : ''}`}
                                    onClick={() => handleToggleItem(val)}
                                >
                                    <div className={`w-4 h-4 border rounded flex items-center justify-center shrink-0 transition-all ${tempSelection.has(val) ? 'bg-[var(--accent)] border-[var(--accent)] shadow-md' : 'border-[var(--border-color)] bg-[var(--bg-main)] group-hover:border-[var(--text-secondary)]'}`}>
                                        {tempSelection.has(val) && <Check size={11} strokeWidth={3} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs break-words leading-tight transition-colors ${tempSelection.has(val) ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                        {val || <em className="opacity-40 italic">Empty</em>}
                                    </span>
                                </div>
                            ))}
                            {filteredOptions.length === 0 && (
                                <div className="text-xs text-[var(--text-secondary)] text-center py-10 italic">No matching results</div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-3 border-t border-[var(--border-color)] flex gap-2 bg-[var(--bg-main)]/50 rounded-b-xl shrink-0">
                            <Button variant="secondary" onClick={onClose} className="flex-1 py-1.5 h-auto text-[10px] uppercase font-bold tracking-wider">Cancel</Button>
                            <Button variant="primary" onClick={handleApply} className="flex-1 py-1.5 h-auto text-[10px] uppercase font-bold tracking-wider shadow-[var(--accent)]/20">Apply Filters</Button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </th>
    );
};