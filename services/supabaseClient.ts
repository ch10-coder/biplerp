
import { createClient } from '@supabase/supabase-js';

// Configuration keys for LocalStorage
export const SUPABASE_URL_KEY = 'erp_supabase_url';
export const SUPABASE_KEY_KEY = 'erp_supabase_key';

const getStoredConfig = () => {
    return {
        url: localStorage.getItem(SUPABASE_URL_KEY) || '',
        key: localStorage.getItem(SUPABASE_KEY_KEY) || ''
    };
};

const config = getStoredConfig();

// Initialize the client only if keys are present
export const supabase = (config.url && config.key) 
    ? createClient(config.url, config.key) 
    : null;

// Helper to save config and reload
export const saveSupabaseConfig = (url: string, key: string) => {
    localStorage.setItem(SUPABASE_URL_KEY, url);
    localStorage.setItem(SUPABASE_KEY_KEY, key);
    window.location.reload();
};

export const clearSupabaseConfig = () => {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_KEY_KEY);
    window.location.reload();
};
