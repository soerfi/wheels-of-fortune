import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Plus, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CodeManagerModalProps {
    prize: any;
    authToken: string;
    onClose: () => void;
    onChanged: () => void;
}

export default function CodeManagerModal({ prize, authToken, onClose, onChanged }: CodeManagerModalProps) {
    const [codes, setCodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newCodesInput, setNewCodesInput] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchCodes();
    }, [prize.id]);

    const fetchCodes = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/prizes/${prize.id}/codes`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!res.ok) throw new Error('Fehler beim Laden der Codes');
            const data = await res.json();
            setCodes(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateCode = async (id: number, newCodeText: string) => {
        try {
            const res = await fetch(`/api/codes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ code: newCodeText })
            });
            if (!res.ok) throw new Error('Update fehlgeschlagen');
            fetchCodes();
            onChanged();
        } catch (err) {
            alert('Fehler beim Aktualisieren des Codes.');
        }
    };

    const handleDeleteCode = async (id: number) => {
        if (!confirm('Sicher, dass du diesen Code löschen möchtest?')) return;
        try {
            const res = await fetch(`/api/codes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!res.ok) throw new Error('Löschen fehlgeschlagen');
            fetchCodes();
            onChanged();
        } catch (err) {
            alert('Fehler beim Löschen des Codes.');
        }
    };

    const handleAddCodes = async () => {
        const codesArray = newCodesInput.split('\n').map(c => c.trim()).filter(Boolean);
        if (codesArray.length === 0) return;

        setAdding(true);
        try {
            const res = await fetch(`/api/prizes/${prize.id}/codes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ codes: codesArray })
            });
            if (!res.ok) throw new Error('Hinzufügen fehlgeschlagen');
            setNewCodesInput('');
            fetchCodes();
            onChanged();
        } catch (err) {
            alert('Fehler beim Hinzufügen der Codes.');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-zinc-950 border-4 border-zinc-800 shadow-[16px_16px_0_0_#18181B]"
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-zinc-900 hover:bg-white text-zinc-400 hover:text-black transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="p-8 border-b border-zinc-800">
                    <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-2">
                        Codes für <span className="text-red-500">{prize.name}</span>
                    </h2>
                    <p className="text-zinc-500 text-sm">Verwalte die Code-Bestände für diesen Preis. Eingelöste Codes können nicht bearbeitet werden.</p>
                </div>

                <div className="p-8 overflow-y-auto flex-1 bg-zinc-950/50">
                    {error && <div className="p-4 bg-red-900/50 text-white rounded mb-6">{error}</div>}

                    {/* ADD NEW CODES */}
                    <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <h3 className="text-sm font-bold uppercase text-zinc-400 mb-4 tracking-wider">Neue Codes hinzufügen</h3>
                        <textarea
                            value={newCodesInput}
                            onChange={e => setNewCodesInput(e.target.value)}
                            placeholder={prize.is_same_code ? 'Gebe hier die gewünschte Anzahl mal den exakt selben Code ein (z.B. RABATT20\nRABATT20).' : '1 Code pro Zeile...'}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-4 py-3 text-white focus:outline-none focus:border-red-500 text-sm font-mono mb-4"
                            rows={3}
                        />
                        <button
                            onClick={handleAddCodes}
                            disabled={adding || newCodesInput.trim() === ''}
                            className="flex items-center gap-2 px-6 py-2 bg-white text-black hover:bg-zinc-200 rounded font-bold uppercase text-sm tracking-wider disabled:opacity-50 transition-colors"
                        >
                            <Plus size={16} /> Hinzufügen
                        </button>
                    </div>

                    {/* EXISTING CODES LIST */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-4 border-b border-zinc-800 pb-2">Bestehende Codes ({codes.length})</h3>

                        {loading ? (
                            <p className="text-zinc-500 p-4text-center">Laden...</p>
                        ) : codes.length === 0 ? (
                            <p className="text-zinc-500 italic p-4 text-center">Keine Codes vorhanden.</p>
                        ) : (
                            codes.map(c => (
                                <CodeRow key={c.id} codeObj={c} onUpdate={handleUpdateCode} onDelete={handleDeleteCode} />
                            ))
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

const CodeRow: React.FC<{ codeObj: any, onUpdate: (id: number, val: string) => void, onDelete: (id: number) => void }> = ({ codeObj, onUpdate, onDelete }) => {
    const [val, setVal] = useState(codeObj.code);
    const isUsed = codeObj.is_used === 1;

    const handleBlurOrSave = () => {
        if (val !== codeObj.code && val.trim() !== '') {
            onUpdate(codeObj.id, val);
        } else {
            setVal(codeObj.code); // Reset if emptied
        }
    };

    return (
        <div className={`flex items-center gap-3 p-3 rounded border ${isUsed ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-zinc-900 border-zinc-700'}`}>
            <div className="flex-1 flex items-center gap-3">
                {isUsed ? (
                    <>
                        <Lock size={16} className="text-red-900" />
                        <span className="font-mono text-zinc-500 text-sm line-through">{codeObj.code}</span>
                    </>
                ) : (
                    <input
                        type="text"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        onBlur={handleBlurOrSave}
                        onKeyDown={e => e.key === 'Enter' && handleBlurOrSave()}
                        className="w-full bg-transparent border-none text-white focus:outline-none focus:ring-1 focus:ring-zinc-500 px-2 py-1 rounded font-mono text-sm"
                    />
                )}
            </div>

            <div className="w-24 text-right">
                {isUsed ? (
                    <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider px-2 py-1 bg-red-500/10 rounded">Eingelöst</span>
                ) : (
                    <button
                        onClick={() => onDelete(codeObj.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded transition-colors"
                        title="Code löschen"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
