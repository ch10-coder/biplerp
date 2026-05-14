
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X, Search, CheckSquare, Square } from 'lucide-react';

interface MultiSelectProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Calculate filtered options based on search
    const filteredOptions = useMemo(() => {
        const safeOptions = options || [];
        if (!searchTerm) return safeOptions;
        return safeOptions.filter(opt => opt && opt.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [options, searchTerm]);

    // Update coordinates when opening
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const updatePosition = () => {
                const rect = containerRef.current!.getBoundingClientRect();
                // Check if it goes off-screen
                let left = rect.left + window.scrollX;
                if (window.innerWidth - left < 260) {
                    left = window.innerWidth - 270;
                }

                setCoords({
                    top: rect.bottom + window.scrollY + 4,
                    left: left,
                    width: Math.max(rect.width, 260)
                });
            };
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current && !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search on close
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleOption = (option: string) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    const clearSelection = (e?: React.MouseEvent) => {
        if(e) e.stopPropagation();
        onChange([]);
    };

    const selectAllFiltered = () => {
        // Add all filtered options to the selection (union)
        const newSet = new Set([...selected, ...filteredOptions]);
        onChange(Array.from(newSet));
    };

    const deselectAllFiltered = () => {
        // Remove filtered options from selection
        const toRemove = new Set(filteredOptions);
        const newSelected = selected.filter(x => !toRemove.has(x));
        onChange(newSelected);
    };

    // Check if all filtered options are currently selected
    const areAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));

    return (
        <>
            <div className={`relative ${className}`} ref={containerRef}>
                <div
                    className={`bg-[var(--bg-card)] border ${isOpen ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border-color)]'} text-[var(--text-primary)] text-xs rounded-lg p-2.5 flex justify-between items-center cursor-pointer min-w-[140px] hover:border-[var(--accent)] transition-all shadow-sm`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="truncate block mr-2 font-medium">
                        {selected.length === 0 ? label : <span className="text-[var(--accent)]">{selected.length} Selected</span>}
                    </span>
                    <div className="flex items-center gap-1">
                        {selected.length > 0 && (
                            <div 
                                onClick={clearSelection}
                                className="p-1 hover:bg-[var(--bg-main)] rounded-full text-[var(--text-secondary)] hover:text-white transition-colors"
                                title="Clear All"
                            >
                                <X size={12} />
                            </div>
                        )}
                        <ChevronDown size={14} className={`text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>

            {isOpen && coords && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 9999
                    }}
                    className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col max-h-[400px] ring-1 ring-[var(--border-color)] animate-fadeIn backdrop-blur-xl"
                >
                    {/* Search Bar */}
                    <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-main)] rounded-t-xl sticky top-0 z-20">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--text-secondary)]"/>
                            <input 
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={`Search ${label}...`}
                                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                            />
                        </div>
                    </div>

                    {/* Bulk Actions */}
                    <div className="flex justify-between items-center p-2 bg-[var(--bg-main)] border-b border-[var(--border-color)] text-[10px]">
                        <button 
                            onClick={areAllFilteredSelected ? deselectAllFiltered : selectAllFiltered}
                            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition-colors font-medium"
                        >
                            {areAllFilteredSelected ? <CheckSquare size={12} className="text-[var(--accent)]"/> : <Square size={12}/>}
                            {areAllFilteredSelected ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-[var(--text-secondary)]">{filteredOptions.length} items</span>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto custom-scrollbar p-1 flex-1 bg-[var(--bg-card)]">
                        {filteredOptions.map(option => (
                            <div
                                key={option}
                                className="flex items-center gap-3 p-2 hover:bg-[var(--bg-main)] cursor-pointer rounded-lg transition-colors group border-b border-transparent hover:border-[var(--border-color)]"
                                onClick={() => toggleOption(option)}
                            >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center shrink-0 transition-all ${selected.includes(option) ? 'bg-[var(--accent)] border-[var(--accent)] shadow-sm' : 'border-[var(--text-secondary)] bg-[var(--bg-main)]'}`}>
                                    {selected.includes(option) && <Check size={12} className="text-white" />}
                                </div>
                                <span className={`text-sm break-words leading-tight ${selected.includes(option) ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>{option}</span>
                            </div>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="p-4 text-xs text-[var(--text-secondary)] text-center italic">No matches found</div>
                        )}
                    </div>
                    
                    {/* Footer Actions */}
                    <div className="p-2 border-t border-[var(--border-color)] flex justify-end bg-[var(--bg-main)] rounded-b-xl">
                        <button onClick={() => setIsOpen(false)} className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white text-xs rounded-md font-medium transition-colors shadow-lg">
                            Done
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
