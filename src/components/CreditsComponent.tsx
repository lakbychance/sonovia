import React from 'react';
import clsx from 'clsx';

export interface CreditsComponentProps {
    href: string;
    label: string;
    show: boolean;
    className?: string;
}

const baseClasses =
    "absolute top-2 right-2 lg:left-2 lg:right-auto text-xs text-white/90 p-2 rounded-xl z-10 bg-black/50 backdrop-blur-md border border-white/50";

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

