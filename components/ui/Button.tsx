import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

export const Button = React.memo(({
    children,
    type = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    className = '',
    disabled,
    ...props
}: ButtonProps) => {
    const sizeStyles = {
        sm: "px-3 py-1.5 text-xs font-medium gap-1.5 rounded-lg",
        md: "px-4 py-2.5 text-sm font-semibold gap-2 rounded-xl",
        lg: "px-5 py-3 text-base font-semibold gap-2.5 rounded-xl",
    };

    const baseStyle = "inline-flex items-center justify-center transition-all duration-200 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-main)] shadow-sm select-none cursor-pointer";
    
    const variants = {
        primary: "bg-gradient-to-r from-[var(--accent)] to-blue-600 hover:brightness-110 text-white shadow-[0_4px_16px_var(--accent-glow)] border border-white/10",
        secondary: "bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--text-secondary)] shadow-sm",
        outline: "bg-transparent hover:bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/40 hover:border-[var(--accent)]",
        ghost: "bg-transparent hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent shadow-none",
        danger: "bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white shadow-[0_4px_16px_rgba(239,68,68,0.25)] border border-red-500/20",
        success: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white shadow-[0_4px_16px_rgba(16,185,129,0.25)] border border-emerald-500/20",
    };

    return (
        <button 
            type={type}
            className={`
                ${baseStyle} 
                ${sizeStyles[size]} 
                ${variants[variant]} 
                ${className} 
                ${disabled || loading ? 'opacity-60 cursor-not-allowed active:scale-100' : ''}
            `}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <Loader2 className="animate-spin shrink-0" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            ) : icon ? (
                <span className="shrink-0">{icon}</span>
            ) : null}
            {children}
        </button>
    );
});

Button.displayName = 'Button';