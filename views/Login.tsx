import React, { useState } from 'react';
import { supabase, saveSupabaseConfig, SUPABASE_URL_KEY, SUPABASE_KEY_KEY } from '../services/supabaseClient';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Database, LogIn, Key, Globe, AlertCircle, ShieldCheck, Sparkles, Zap } from 'lucide-react';

interface Props {
    onLoginSuccess: () => void;
}

const Login: React.FC<Props> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Config State
    const [showConfig, setShowConfig] = useState(!supabase);
    const [url, setUrl] = useState(localStorage.getItem(SUPABASE_URL_KEY) || '');
    const [key, setKey] = useState(localStorage.getItem(SUPABASE_KEY_KEY) || '');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) { setError("Setup Database Connection First"); return; }
        
        setLoading(true);
        setError('');
        
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            localStorage.removeItem('erp_auth_explicit_logout');
            onLoginSuccess();
        }
    };

    const handleBypass = () => {
        localStorage.setItem('erp_bypass_auth', 'true');
        localStorage.removeItem('erp_auth_explicit_logout');
        onLoginSuccess();
    };

    const handleSaveConfig = () => {
        if (!url || !key) return;
        saveSupabaseConfig(url, key);
        setShowConfig(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] p-4 sm:p-6 relative overflow-hidden">
            {/* Subtle Ambient Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-fadeIn">
                <Card className="p-6 sm:p-8 border-[var(--border-color)] shadow-2xl backdrop-blur-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-[var(--accent)] to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-[var(--accent)]/25 mb-4 text-white">
                            <Database size={32} />
                        </div>
                        <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                            InventoryMate ERP
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 font-medium">
                            Cloud inventory & multi-batch store management
                        </p>
                    </div>

                    {showConfig ? (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex gap-3 text-amber-400 mb-2">
                                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                <div className="text-xs leading-relaxed">
                                    Connect your Supabase database. Enter the API URL and Anon Key found in Project Settings &gt; API.
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                    Project URL
                                </label>
                                <div className="relative">
                                    <Globe className="absolute left-3.5 top-3 text-[var(--text-secondary)]" size={16} />
                                    <input 
                                        value={url} 
                                        onChange={e => setUrl(e.target.value)} 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl pl-10 p-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none" 
                                        placeholder="https://xyz.supabase.co"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                    Anon Key
                                </label>
                                <div className="relative">
                                    <Key className="absolute left-3.5 top-3 text-[var(--text-secondary)]" size={16} />
                                    <input 
                                        value={key} 
                                        onChange={e => setKey(e.target.value)} 
                                        type="password" 
                                        className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl pl-10 p-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none font-mono" 
                                        placeholder="eyJh..."
                                    />
                                </div>
                            </div>
                            <Button onClick={handleSaveConfig} className="w-full mt-4" size="lg">
                                Connect Database
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-4 animate-fadeIn">
                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs sm:text-sm text-center font-medium">
                                    {error}
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                    Email Address
                                </label>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none" 
                                    placeholder="store.manager@company.com" 
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                    Password
                                </label>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none font-mono" 
                                    placeholder="••••••••" 
                                    required
                                />
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full mt-2" 
                                size="lg" 
                                loading={loading}
                            >
                                Sign In with Supabase
                            </Button>

                            {/* Local Bypass Option */}
                            <div className="pt-2">
                                <div className="relative my-3">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-[var(--border-color)]"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="bg-[var(--bg-card)] px-2 text-[var(--text-secondary)] font-medium">Quick Preview</span>
                                    </div>
                                </div>

                                <Button 
                                    type="button"
                                    variant="secondary" 
                                    onClick={handleBypass}
                                    className="w-full border-dashed border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/10 font-bold"
                                    size="lg"
                                >
                                    <Zap size={16} className="text-[var(--accent)]" /> Bypass Login (Local Test Mode)
                                </Button>
                            </div>

                            <div className="text-center pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfig(true)} 
                                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] flex items-center justify-center gap-1.5 mx-auto font-medium transition-colors cursor-pointer"
                                >
                                    <Key size={13} /> Update Connection Settings
                                </button>
                            </div>
                        </form>
                    )}
                </Card>
                
                <div className="text-center mt-6">
                    <p className="text-[11px] text-[var(--text-secondary)] font-mono opacity-70">
                        Local Test Mode uses in-memory / browser persistence
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
