
import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StickyNote, Send, Trash2, Clock } from 'lucide-react';

interface Note {
    id: number;
    text: string;
    created_at: string;
}

const LOCAL_STORAGE_KEY = 'erp_local_notes';

const CloudNotes: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNoteText, setNewNoteText] = useState('');

    // --- Load Data ---
    useEffect(() => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            setNotes(JSON.parse(stored));
        }
    }, []);

    const saveToLocal = (updatedNotes: Note[]) => {
        setNotes(updatedNotes);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedNotes));
    };

    // --- Add Note ---
    const handleSaveNote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;

        const newNote: Note = {
            id: Date.now(),
            text: newNoteText,
            created_at: new Date().toISOString()
        };

        const updated = [newNote, ...notes];
        saveToLocal(updated);
        setNewNoteText('');
    };

    const handleDeleteNote = (id: number) => {
        const updated = notes.filter(n => n.id !== id);
        saveToLocal(updated);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <StickyNote className="text-yellow-400" size={24}/> Local Notes
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Personal notes stored on this device.</p>
                </div>
            </div>

            {/* Input Area */}
            <Card className="p-4">
                <form onSubmit={handleSaveNote} className="flex gap-2">
                    <input 
                        value={newNoteText} 
                        onChange={(e) => setNewNoteText(e.target.value)} 
                        placeholder="Type a note here..."
                        className="flex-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                    />
                    <Button type="submit" disabled={!newNoteText.trim()} variant="primary" className="px-6 flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white border-none">
                        <Send size={18}/> 
                        <span className="hidden md:inline">Save</span>
                    </Button>
                </form>
            </Card>

            {/* Notes List */}
            <div className="space-y-3">
                {notes.length === 0 && (
                    <div className="text-center py-10 text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] border-dashed">
                        No notes found. Keep track of important info here!
                    </div>
                )}

                {notes.map(note => (
                    <div key={note.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 shadow-sm hover:border-[var(--border-highlight)] transition-colors animate-slideDown group relative">
                        <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed pr-8">{note.text}</p>
                        <button 
                            onClick={() => handleDeleteNote(note.id)}
                            className="absolute top-2 right-2 text-[var(--text-secondary)] hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={16}/>
                        </button>
                        <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex justify-between items-center text-xs text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1">
                                <Clock size={12}/> {new Date(note.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CloudNotes;
