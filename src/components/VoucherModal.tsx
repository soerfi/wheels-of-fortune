import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';

interface VoucherModalProps {
  result: { id: number, prize: any };
  settings: any;
  onClose: () => void;
}

export default function VoucherModal({ result, settings, onClose }: VoucherModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`/api/winners/${result.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: formData.name,
          user_email: formData.email
        })
      });
      setStep(2);
    } catch (error) {
      alert('Fehler beim Speichern der Daten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-3xl bg-zinc-950 border-4 border-white shadow-[16px_16px_0_0_#EF4444] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-modal-title"
      >
        <button
          onClick={onClose}
          aria-label="Schliessen"
          className="absolute top-4 right-4 z-10 p-2 bg-black hover:bg-white text-white hover:text-black border-2 border-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="p-8 pb-4 text-center" aria-live="assertive">
          <h2 id="voucher-modal-title" className="text-6xl font-display uppercase tracking-widest text-white mb-2 shadow-[2px_2px_0_0_#EF4444]">WIN!</h2>
          <p className="text-xl text-zinc-400 font-bold uppercase tracking-widest">YOU GOT <strong className="text-red-500">{result.prize.name}</strong></p>
          {result.prize.description && (
            <p className="text-sm text-zinc-300 mt-4 font-medium italic max-w-lg mx-auto leading-relaxed">{result.prize.description}</p>
          )}
        </div>

        {step === 1 ? (
          <div className="p-8 max-w-md mx-auto">
            <p className="text-zinc-400 mb-6 text-center font-bold tracking-widest uppercase">Details angeben, um Gutschein zu erhalten.</p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-900 border-2 border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-white transition-colors rounded-none"
                  placeholder="Dein Name"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">E-Mail</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-zinc-900 border-2 border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-white transition-colors rounded-none"
                  placeholder="deine@email.ch"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 mt-8 px-8 py-5 bg-red-600 hover:bg-white text-white hover:text-black border-2 border-transparent hover:border-black font-display text-2xl uppercase tracking-widest transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_0_#000] disabled:opacity-50"
              >
                {isSubmitting ? 'SENDING...' : 'GET CODE VIA EMAIL'}
                <ArrowRight size={24} />
              </button>
            </form>
          </div>
        ) : (
          <div className="p-8 pb-16 text-center max-w-md mx-auto" aria-live="polite">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="flex justify-center mb-6"
            >
              <CheckCircle2 size={80} className="text-green-500" aria-hidden="true" />
            </motion.div>
            <h3 className="text-3xl font-display text-white mb-4 uppercase tracking-widest">SUCCESS!</h3>
            <p className="text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
              Dein Gutscheincode wurde erfolgreich an<br />
              <strong className="text-white border-b-2 border-red-500">{formData.email}</strong><br />
              gesendet.
            </p>
            <button
              onClick={onClose}
              className="mt-8 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest transition-colors w-full border-2 border-zinc-700"
            >
              OK, DANKE!
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
