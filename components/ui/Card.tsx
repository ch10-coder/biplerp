
import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: string;
    onClick?: () => void;
}

export const Card = React.memo(({ children, className = '', title, onClick }: CardProps) => {
    return (
        <div 
            className={`
                glass-effect rounded-xl p-5 shadow-lg transition-all duration-300 relative overflow-hidden group
                border border-[var(--border-color)]
                ${onClick ? 'cursor-pointer hover:border-[var(--border-highlight)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] active:scale-[0.98]' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {/* Optional subtle sheen on hover for clickable cards */}
            {onClick && (
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-500" />
            )}

            {title && (
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-4 tracking-tight flex items-center gap-2 border-b border-[var(--border-color)] pb-2 relative z-10">
                    {title}
                </h3>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
});
