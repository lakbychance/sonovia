import { toast as sonnerToast } from 'sonner';
import { CustomToast, ToastProps } from '../components/CustomToast'; // Adjusted path if needed

/**
 * Shows a custom toast.
 * The component itself is in CustomToast.tsx, this utility just invokes it.
 */
export function showCustomToast(toastOptions: Omit<ToastProps, 'id'>) {
    // Default duration for toasts, errors get a bit longer.
    const duration = toastOptions.type === 'error' ? 6000 : 4000;

    return sonnerToast.custom((id) => (
        <CustomToast
            id={id}
            title={toastOptions.title}
            description={toastOptions.description}
            button={toastOptions.button}
            type={toastOptions.type}
        />
    ), { duration });
} 