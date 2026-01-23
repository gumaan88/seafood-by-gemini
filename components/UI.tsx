import React from 'react';
import { XMarkIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

// --- Loading Spinner ---
export const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full min-h-[50vh]">
    <div className="relative">
        <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-gray-200"></div>
        <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-primary-600 border-t-transparent"></div>
    </div>
  </div>
);

// --- Skeleton Card ---
export const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
        <div className="flex gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
        </div>
        <div className="mt-4 h-8 bg-gray-200 rounded w-full"></div>
    </div>
);

// --- Button ---
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost', isLoading?: boolean }> = ({ 
    children, className = '', variant = 'primary', isLoading, disabled, ...props 
}) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 select-none";
    const variants = {
        primary: "bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none",
        secondary: "bg-teal-500 hover:bg-teal-600 text-white shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none",
        danger: "bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none",
        outline: "border-2 border-primary-600 text-primary-600 hover:bg-primary-50 disabled:border-gray-300 disabled:text-gray-300",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 disabled:text-gray-300"
    };

    return (
        <button 
            className={`${baseStyle} ${variants[variant]} ${className}`} 
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
            {!isLoading && children}
        </button>
    );
};

// --- Card ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 ${className}`} {...props}>
        {children}
    </div>
);

// --- Badge ---
export const Badge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
        completed: 'bg-green-100 text-green-700 border-green-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    
    const labels: Record<string, string> = {
        pending: 'معلق',
        confirmed: 'مؤكد',
        completed: 'مكتمل',
        cancelled: 'ملغي',
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status] || 'bg-gray-100'}`}>
            {labels[status] || status}
        </span>
    );
};

// --- Modal ---
export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="relative inline-block align-bottom bg-white rounded-2xl text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-gray-100">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">{title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none"><XMarkIcon className="h-6 w-6" /></button>
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Toast UI Helper ---
export const ToastItem = ({ message, type }: { message: string, type: 'success' | 'error' | 'info' }) => (
    <div className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-slide-up ${
        type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-primary-600'
    }`}>
        {type === 'success' && <CheckCircleIcon className="w-5 h-5" />}
        {type === 'error' && <XCircleIcon className="w-5 h-5" />}
        {type === 'info' && <CheckCircleIcon className="w-5 h-5" />}
        {message}
    </div>
);
