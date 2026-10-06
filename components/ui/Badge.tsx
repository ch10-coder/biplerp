import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
    size?: 'sm' | 'md';
    dot?: boolean;
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'blue',
    size = 'md',
    dot = false,
    className = ''
}) => {
    const sizeMap = {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs'
    };

    // WCAG AA compliant contrast classes for both Light and Dark themes
    const variantMap = {
        blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30',
        rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
        slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
    };

    const dotColorMap = {
        blue: 'bg-blue-500 dark:bg-blue-400',
        emerald: 'bg-emerald-500 dark:bg-emerald-400',
        amber: 'bg-amber-600 dark:bg-amber-400 animate-pulse',
        rose: 'bg-rose-500 dark:bg-rose-400 animate-pulse',
        purple: 'bg-purple-500 dark:bg-purple-400',
        slate: 'bg-slate-500 dark:bg-slate-400'
    };

    return (
        <span className={`inline-flex items-center gap-1.5 font-semibold font-mono tracking-tight rounded-full border ${sizeMap[size]} ${variantMap[variant]} ${className}`}>
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColorMap[variant]}`} />}
            {children}
        </span>
    );
};
