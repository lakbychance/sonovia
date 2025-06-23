import { X } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

export interface ToastProps {
    id: string | number;
    title: string;
    description?: string;
    button?: {
        label: string;
        onClick: () => void;
    };
    type?: 'success' | 'error' | 'info' | 'warning'; // Added type for styling
}

/** A fully custom toast that still maintains the animations and interactions. */
export function CustomToast(props: ToastProps) {
    const { title, description, button, id, type = 'info' } = props;

    let borderColor = 'border-zinc-700'; // Default border
    let titleColor = 'text-zinc-100';
    const descriptionColor = 'text-zinc-400';
    let buttonBgColor = 'bg-zinc-700 hover:bg-zinc-600';
    const buttonTextColor = 'text-zinc-100';
    let gradientBgClass = 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-black'; // Default info gradient, very dark

    switch (type) {
        case 'success':
            borderColor = 'border-green-500';
            titleColor = 'text-green-400';
            buttonBgColor = 'bg-green-600 hover:bg-green-500';
            gradientBgClass = 'bg-gradient-to-br from-green-900 via-zinc-900 to-black';
            break;
        case 'error':
            borderColor = 'border-red-500';
            titleColor = 'text-red-400';
            buttonBgColor = 'bg-red-600 hover:bg-red-500';
            gradientBgClass = 'bg-gradient-to-br from-red-900 via-zinc-900 to-black';
            break;
        case 'warning':
            borderColor = 'border-yellow-500';
            titleColor = 'text-yellow-400';
            buttonBgColor = 'bg-yellow-600 hover:bg-yellow-500';
            gradientBgClass = 'bg-gradient-to-br from-yellow-900 via-zinc-900 to-black';
            break;
        // Info uses default dark theme colors and gradient
        default: // Explicitly set for 'info' or any other unspecified type
            gradientBgClass = 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-black';
            // borderColor, titleColor, buttonBgColor will use their default initial values
            break;
    }

    return (
        <div className={`flex rounded-lg items-center p-4 border ${borderColor} backdrop-blur-md ${gradientBgClass}`}>
            <div className="flex-1">
                <p className={`text-sm font-medium ${titleColor}`}>{title}</p>
                {description && <p className={`mt-1 text-sm ${descriptionColor}`}>{description}</p>}
            </div>
            {button && (
                <div className="ml-4 shrink-0">
                    <button
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${buttonBgColor} ${buttonTextColor} transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-indigo-500 focus:outline-none`}
                        onClick={() => {
                            button.onClick();
                            sonnerToast.dismiss(id);
                        }}
                    >
                        {button.label}
                    </button>
                </div>
            )}
            {!button && ( // Add a default dismiss button if no action button is provided
                <div className="ml-4 shrink-0">
                    <button
                        onClick={() => sonnerToast.dismiss(id)}
                        className="text-zinc-300 hover:text-zinc-100 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}
        </div>
    );
}
