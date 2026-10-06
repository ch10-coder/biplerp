import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: ReactNode;
    subtitle?: string;
    action?: ReactNode;
    headerIcon?: ReactNode;
    onClick?: () => void;
    hoverable?: boolean;
}

export const Card = React.memo(({
    children,
    className = '',
    title,
    subtitle,
    action,
    headerIcon,
    onClick,
    hoverable = false
}: CardProps) => {
    const isInteractive = Boolean(onClick || hoverable);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <div 
            className={`
                glass-effect rounded-2xl p-5 sm:p-6 transition-all duration-300 relative overflow-hidden
                ${isInteractive ? 'cursor-pointer hover:border-[var(--border-highlight)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)] active:scale-[0.99] group' : ''}
                ${className}
            `}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? handleKeyDown : undefined}
        >
            {/* Subtle sheen highlight on hover */}
            {isInteractive && (
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}

            {(title || action) && (
                <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border-color)] relative z-10">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {headerIcon && (
                            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                                {headerIcon}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight truncate">
                                {title}
                            </h3>
                            {subtitle && (
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    {action && (
                        <div className="flex items-center gap-2 shrink-0">
                            {action}
                        </div>
                    )}
                </div>
            )}

            <div className="relative z-10 min-w-0 flex-1">
                {children}
            </div>
        </div>
    );
});

Card.displayName = 'Card';
