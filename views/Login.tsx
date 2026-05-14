
import React, { useState } from 'react';
import { supabase, saveSupabaseConfig, SUPABASE_URL_KEY, SUPABASE_KEY_KEY } from '../services/supabaseClient';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Database, LogIn, Key, Globe, AlertCircle } from 'lucide-react';

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
            onLoginSuccess();
        }
    };

    const handleSaveConfig = () => {
        if (!url || !key) return;
        saveSupabaseConfig(url, key);
        setShowConfig(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[100px]"></div>

            <Card className="w-full max-w-md bg-[var(--bg-card)] border-[var(--border-color)] shadow-2xl relative z-10 p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                        <Database className="text-white" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">InventoryMate Cloud</h1>
                    <p className="text-gray-500 text-sm mt-2">Sign in to access your inventory</p>
                </div>

                {showConfig ? (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-yellow-900/10 border border-yellow-500/30 p-4 rounded-lg flex gap-3 text-yellow-500 mb-4">
                            <AlertCircle size={20} className="shrink-0"/>
                            <div className="text-xs leading-relaxed">
                                Connect to your Supabase project. Enter the API URL and Anon Key found in your Project Settings &gt; API.
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project URL</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-2.5 text-gray-500" size={16}/>
                                <input value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg pl-10 p-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none" placeholder="https://xyz.supabase.co"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Anon Key</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 text-gray-500" size={16}/>
                                <input value={key} onChange={e => setKey(e.target.value)} type="password" className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg pl-10 p-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none" placeholder="eyJh..."/>
                            </div>
                        </div>
                        <Button onClick={handleSaveConfig} className="w-full mt-4">Connect Database</Button>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-4 animate-fadeIn">
                        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">{error}</div>}
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none" 
                                placeholder="name@company.com"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg p-3 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:outline-none" 
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 text-sm font-bold shadow-lg shadow-blue-900/20" disabled={loading}>
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </Button>

                        <div className="text-center pt-4">
                            <button type="button" onClick={() => setShowConfig(true)} className="text-xs text-gray-500 hover:text-blue-400 flex items-center justify-center gap-2 mx-auto">
                                <Key size={12}/> Update Connection Settings
                            </button>
                        </div>
                    </form>
                )}
            </Card>
        </div>
    );
};

export default Login;
