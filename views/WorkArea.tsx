
import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Calculator, FileEdit, Eraser, Save, X, RotateCcw, StickyNote, Send, Trash2, Clock, CheckSquare, Hash, Delete } from 'lucide-react';

interface Note {
    id: number;
    text: string;
    created_at: string;
}

const LOCAL_STORAGE_KEY_NOTES = 'erp_local_notes';

const WorkArea: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'UTILITIES' | 'NOTES'>('UTILITIES');

    // --- Notes Logic ---
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNoteText, setNewNoteText] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_NOTES);
        if (stored) setNotes(JSON.parse(stored));
    }, []);

    const saveNotesToLocal = (updatedNotes: Note[]) => {
        setNotes(updatedNotes);
        localStorage.setItem(LOCAL_STORAGE_KEY_NOTES, JSON.stringify(updatedNotes));
    };

    const handleAddNote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;
        const newNote: Note = { id: Date.now(), text: newNoteText, created_at: new Date().toISOString() };
        saveNotesToLocal([newNote, ...notes]);
        setNewNoteText('');
    };

    const handleDeleteNote = (id: number) => {
        saveNotesToLocal(notes.filter(n => n.id !== id));
    };

    // --- Scratchpad State ---
    const [scratchpadText, setScratchpadText] = useState('');
    const [savedStatus, setSavedStatus] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('erp_scratchpad');
        if (saved) setScratchpadText(saved);
    }, []);

    const handleSaveScratchpad = () => {
        localStorage.setItem('erp_scratchpad', scratchpadText);
        setSavedStatus('Saved');
        setTimeout(() => setSavedStatus(''), 2000);
    };

    const handleClearScratchpad = () => {
        if(confirm('Clear scratchpad?')) {
            setScratchpadText('');
            localStorage.removeItem('erp_scratchpad');
        }
    };

    // --- Calculator State ---
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [calcEquation, setCalcEquation] = useState('');
    const [isNewNumber, setIsNewNumber] = useState(true);

    const handleCalcInput = (val: string) => {
        if (['+', '-', '*', '/'].includes(val)) {
            setCalcEquation(calcDisplay + ' ' + val + ' ');
            setIsNewNumber(true);
        } else if (val === 'C') {
            setCalcDisplay('0');
            setCalcEquation('');
            setIsNewNumber(true);
        } else if (val === '=') {
            try {
                // eslint-disable-next-line no-eval
                const result = eval(calcEquation + calcDisplay);
                setCalcDisplay(String(Number(result.toFixed(8)))); // Limit decimals
                setCalcEquation('');
                setIsNewNumber(true);
            } catch (e) {
                setCalcDisplay('Error');
            }
        } else if (val === '.') {
            if (!calcDisplay.includes('.')) {
                setCalcDisplay(calcDisplay + '.');
                setIsNewNumber(false);
            }
        } else if (val === 'BS') {
             if (calcDisplay.length > 1) setCalcDisplay(calcDisplay.slice(0, -1));
             else setCalcDisplay('0');
        } else {
            if (isNewNumber || calcDisplay === '0') {
                setCalcDisplay(val);
                setIsNewNumber(false);
            } else {
                setCalcDisplay(calcDisplay + val);
            }
        }
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-4">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CheckSquare className="text-purple-500" size={24}/> Workspace
                    </h2>
                    <p className="text-xs text-gray-400">Tools for quick calculations and notes.</p>
                </div>
                
                {/* Tab Switcher */}
                <div className="flex bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)]">
                    <button 
                        onClick={() => setActiveTab('UTILITIES')}
                        className={`px-4 py-2 text-xs font-bold rounded flex items-center gap-2 transition-all ${activeTab === 'UTILITIES' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Calculator size={14}/> Utilities
                    </button>
                    <button 
                        onClick={() => setActiveTab('NOTES')}
                        className={`px-4 py-2 text-xs font-bold rounded flex items-center gap-2 transition-all ${activeTab === 'NOTES' ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <StickyNote size={14}/> Sticky Notes
                    </button>
                </div>
            </div>

            {activeTab === 'UTILITIES' ? (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-hidden">
                    
                    {/* CALCULATOR - Neumorphic Style */}
                    <div className="flex items-center justify-center h-full overflow-y-auto custom-scrollbar">
                        <div className="bg-[#1e293b] border-4 border-[#334155] rounded-3xl p-5 shadow-2xl w-full max-w-xs relative">
                            {/* Screen */}
                            <div className="bg-[#0f172a] rounded-xl p-4 mb-5 shadow-inner border border-gray-700 relative overflow-hidden">
                                <div className="text-[10px] text-gray-500 text-right h-4 font-mono">{calcEquation}</div>
                                <div className="text-3xl font-mono text-green-400 font-bold text-right tracking-widest truncate">{calcDisplay}</div>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"></div>
                            </div>

                            {/* Keypad */}
                            <div className="grid grid-cols-4 gap-3">
                                <button onClick={() => handleCalcInput('C')} className="h-12 rounded-lg font-bold bg-red-900/80 text-red-200 shadow-[0_4px_0_rgb(127,29,29)] active:shadow-none active:translate-y-1 transition-all">C</button>
                                <button onClick={() => handleCalcInput('/')} className="h-12 rounded-lg font-bold bg-slate-700 text-white shadow-[0_4px_0_rgb(51,65,85)] active:shadow-none active:translate-y-1 transition-all">÷</button>
                                <button onClick={() => handleCalcInput('*')} className="h-12 rounded-lg font-bold bg-slate-700 text-white shadow-[0_4px_0_rgb(51,65,85)] active:shadow-none active:translate-y-1 transition-all">×</button>
                                <button onClick={() => handleCalcInput('BS')} className="h-12 rounded-lg font-bold bg-slate-700 text-orange-400 shadow-[0_4px_0_rgb(51,65,85)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center"><Delete size={18}/></button>

                                {[7, 8, 9].map(n => (
                                    <button key={n} onClick={() => handleCalcInput(String(n))} className="h-12 rounded-lg font-bold bg-slate-600 text-white shadow-[0_4px_0_rgb(71,85,105)] active:shadow-none active:translate-y-1 transition-all text-lg">{n}</button>
                                ))}
                                <button onClick={() => handleCalcInput('-')} className="h-12 rounded-lg font-bold bg-slate-700 text-white shadow-[0_4px_0_rgb(51,65,85)] active:shadow-none active:translate-y-1 transition-all text-xl">−</button>

                                {[4, 5, 6].map(n => (
                                    <button key={n} onClick={() => handleCalcInput(String(n))} className="h-12 rounded-lg font-bold bg-slate-600 text-white shadow-[0_4px_0_rgb(71,85,105)] active:shadow-none active:translate-y-1 transition-all text-lg">{n}</button>
                                ))}
                                <button onClick={() => handleCalcInput('+')} className="h-12 rounded-lg font-bold bg-slate-700 text-white shadow-[0_4px_0_rgb(51,65,85)] active:shadow-none active:translate-y-1 transition-all text-xl">+</button>

                                {[1, 2, 3].map(n => (
                                    <button key={n} onClick={() => handleCalcInput(String(n))} className="h-12 rounded-lg font-bold bg-slate-600 text-white shadow-[0_4px_0_rgb(71,85,105)] active:shadow-none active:translate-y-1 transition-all text-lg">{n}</button>
                                ))}
                                <button onClick={() => handleCalcInput('=')} className="h-full row-span-2 rounded-lg font-bold bg-blue-600 text-white shadow-[0_4px_0_rgb(37,99,235)] active:shadow-none active:translate-y-1 transition-all text-xl flex items-center justify-center">=</button>

                                <button onClick={() => handleCalcInput('0')} className="col-span-2 h-12 rounded-lg font-bold bg-slate-600 text-white shadow-[0_4px_0_rgb(71,85,105)] active:shadow-none active:translate-y-1 transition-all text-lg">0</button>
                                <button onClick={() => handleCalcInput('.')} className="h-12 rounded-lg font-bold bg-slate-600 text-white shadow-[0_4px_0_rgb(71,85,105)] active:shadow-none active:translate-y-1 transition-all text-xl">.</button>
                            </div>
                        </div>
                    </div>

                    {/* SCRATCHPAD - Editor Style */}
                    <div className="flex flex-col h-full bg-[#1e1e1e] border border-[#333] rounded-xl overflow-hidden shadow-xl">
                        <div className="flex justify-between items-center bg-[#252526] px-4 py-2 border-b border-[#333]">
                            <div className="flex items-center gap-2 text-xs text-[#cccccc] font-medium">
                                <FileEdit size={14} className="text-yellow-500"/> UNTITLED.TXT
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleClearScratchpad} className="text-[#858585] hover:text-white p-1 transition-colors" title="Clear"><Eraser size={14}/></button>
                                <button onClick={handleSaveScratchpad} className="text-[#858585] hover:text-green-400 p-1 flex items-center gap-1 transition-colors" title="Save">
                                    <Save size={14}/> {savedStatus && <span className="text-[10px] text-green-500 animate-pulse">{savedStatus}</span>}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-[#1e1e1e] border-r border-[#333] text-[#555] text-xs font-mono pt-4 text-right pr-2 select-none leading-relaxed">
                                1<br/>2<br/>3<br/>4<br/>5<br/>6<br/>7<br/>8<br/>9<br/>10
                            </div>
                            <textarea 
                                value={scratchpadText}
                                onChange={e => setScratchpadText(e.target.value)}
                                placeholder="// Type your rough calculations here..."
                                className="w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 pl-10 resize-none focus:outline-none leading-relaxed selection:bg-[#264f78]"
                                spellCheck="false"
                            />
                        </div>
                        <div className="bg-[#007acc] text-white text-[10px] px-2 py-0.5 flex justify-between items-center">
                            <span>Ln {scratchpadText.split('\n').length}, Col {scratchpadText.length}</span>
                            <span>UTF-8</span>
                        </div>
                    </div>
                </div>
            ) : (
                // NOTES TAB
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Add Note */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-2 rounded-lg mb-4 shrink-0 flex gap-2">
                        <input 
                            value={newNoteText} 
                            onChange={(e) => setNewNoteText(e.target.value)} 
                            placeholder="Add a new sticky note..."
                            className="flex-1 bg-transparent border-none text-sm text-[var(--text-primary)] focus:ring-0 px-2"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote(e)}
                        />
                        <Button onClick={handleAddNote} disabled={!newNoteText.trim()} variant="primary" className="h-8 px-3 rounded-md">
                            <Send size={14}/>
                        </Button>
                    </div>

                    {/* Masonry Grid for Notes */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {notes.length === 0 && (
                                <div className="col-span-full py-20 text-center text-gray-500 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-xl">
                                    <StickyNote size={40} className="opacity-20 mb-2"/>
                                    <p>No notes yet</p>
                                </div>
                            )}
                            {notes.map(note => (
                                <div key={note.id} className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700/50 p-4 rounded-xl shadow-sm relative group hover:-translate-y-1 transition-transform duration-200">
                                    <p className="text-gray-800 dark:text-yellow-100 text-sm whitespace-pre-wrap font-medium leading-relaxed pr-6">{note.text}</p>
                                    <button 
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="absolute top-2 right-2 text-yellow-600 dark:text-yellow-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                    <div className="mt-3 pt-2 border-t border-yellow-200 dark:border-yellow-800/30 flex justify-between items-center text-[10px] text-yellow-600 dark:text-yellow-500/70">
                                        <span className="flex items-center gap-1">
                                            <Clock size={10}/> {new Date(note.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkArea;
