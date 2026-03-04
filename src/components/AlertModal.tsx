import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface AlertModalProps {
    type: 'error' | 'success';
    title?: string;
    message: string;
    onClose: () => void;
}

export default function AlertModal({ type, message, title, onClose }: AlertModalProps) {
    const isError = type === 'error';
    const Icon = isError ? AlertTriangle : CheckCircle;

    // Very vibrant red for error based on reference, green for success
    const themeColor = isError ? '#e80000' : '#22c55e';
    const defaultTitle = isError ? 'Fehler' : 'Erfolg';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{ boxShadow: `12px 12px 0 0 ${themeColor}` }}
                className="w-full max-w-[420px] bg-[#0a0a0b] border-[3px] border-white p-6 sm:p-8"
                role="alertdialog"
                aria-modal="true"
            >
                <div className="flex items-center gap-4 mb-5">
                    <Icon color={themeColor} strokeWidth={2.5} className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
                    <h3 className="text-3xl md:text-4xl font-display uppercase tracking-wider text-white mt-1">
                        {title || defaultTitle}
                    </h3>
                </div>

                <p className="text-zinc-400 font-bold font-sans uppercase tracking-[0.05em] text-sm md:text-base mb-8 leading-relaxed">
                    {message}
                </p>

                <button
                    onClick={onClose}
                    style={{ backgroundColor: themeColor }}
                    className="w-full py-4 text-white hover:opacity-90 font-bold uppercase tracking-[0.08em] transition-opacity cursor-pointer text-sm md:text-base border-0 outline-none"
                >
                    Verstanden
                </button>
            </motion.div>
        </div>
    );
}
