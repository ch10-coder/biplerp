import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    children?: React.ReactNode;
    className?: string;
}

export const Button = React.memo(({ children, variant = 'primary', className = '', ...props }: ButtonProps) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-main)] shadow-md";
    
    const variants = {
        primary: "bg-gradient-to-r from-[var(--accent)] to-blue-600 hover:to-blue-500 text-white shadow-[var(--accent)]/20",
        secondary: "bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]",
        danger: "bg-gradient-to-r from-red-600 to-red-500 hover:to-red-400 text-white shadow-red-500/20",
        success: "bg-gradient-to-r from-green-600 to-green-500 hover:to-green-400 text-white shadow-green-500/20",
    };

    return (
        <button className={`${baseStyle} ${variants[variant]} ${className} disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`} {...props}>
            {children}
        </button>
    );
});