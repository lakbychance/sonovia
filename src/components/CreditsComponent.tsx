import React from 'react';
import clsx from 'clsx';

export interface CreditsComponentProps {
    href: string;
    label: string;
    show: boolean;
    className?: string;
}

const baseClasses =
    "absolute top-2 right-2 lg:left-2 lg:right-auto text-xs text-white/90 p-2 rounded-xl z-10 bg-gradient-to-r from-black/10 via-zinc-900 to-white/10 border border-zinc-700/80 backdrop-blur-sm transition-all duration-400 hover:text-orange-500 hover:bg-gradient-to-r hover:from-orange-500/10 hover:via-orange-400/10 hover:to-orange-300/10 hover:border-orange-500/50";

const CreditsComponent: React.FC<CreditsComponentProps> = ({ href, label, show, className }) => {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={clsx(baseClasses, show ? "opacity-100" : "opacity-0", className)}
        >
            {label}
        </a>
    );
};

export default CreditsComponent;

