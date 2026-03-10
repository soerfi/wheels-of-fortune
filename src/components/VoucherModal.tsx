import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VoucherModalProps {
  result: { id: number, prize: any };
  settings: any;
  onClose: () => void;
}

export default function VoucherModal({ result, settings, onClose }: VoucherModalProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', newsletter: true });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/winners/${result.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          newsletter: formData.newsletter,
          user_email: formData.email,
          language: i18n?.language?.split('-')[0].toLowerCase() || 'de'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.error && (data.error.includes('bereits') || data.error.includes('already') || data.error.includes('déjà') || data.error.includes('già'))) {
          setStep(3);
          return;
        }
        throw new Error(data.error || t('modal.error_general'));
      }
      setStep(2);
    } catch (error: any) {
      alert(error.message || t('modal.error_general'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`relative w-full max-w-3xl bg-zinc-950 border-4 border-white overflow-hidden ${step === 3 ? 'shadow-[16px_16px_0_0_#A1A1AA]' : 'shadow-[16px_16px_0_0_#EF4444]'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-modal-title"
      >
        <button
          onClick={() => window.location.href = 'https://skate.ch/'}
          aria-label="Schliessen"
          className="absolute top-4 right-4 z-10 p-2 bg-black hover:bg-white text-white hover:text-black border-2 border-white transition-colors"
        >
          <X size={24} />
        </button>

        {step === 3 ? (
          <div className="p-8 pb-12 text-center" aria-live="assertive">
             <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="flex justify-center mb-6"
            >
              <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-white text-white font-display text-4xl">
                !
              </div>
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-display uppercase tracking-widest text-white mb-6">Hoppla, du hast dein Glück bereits versucht.</h2>
            <div className="text-zinc-400 font-bold uppercase tracking-widest leading-relaxed max-w-2xl mx-auto space-y-4 text-sm md:text-base">
                <p>Unser System hat erkannt, dass mit dieser E Mail Adresse schon einmal teilgenommen wurde. Gemäss Teilnahmebedingungen ist pro Person / Email nur ein Versuch erlaubt.</p>
                <p>Darum müssen wir diesen weiteren Versuch und einen allfälligen Gewinn daraus leider annullieren.</p>
                <p>Bitte prüfe deinen Posteingang. Dort solltest du bereits den Code aus deiner ersten Teilnahme finden.</p>
                <p className="text-white mt-6 border-b-2 border-zinc-700 inline-block pb-1">Viel Spass beim Einlösen.</p>
            </div>
            
            <div className="mt-10 flex justify-center">
              <a 
                href="https://skate.ch/" 
                className="inline-block px-10 py-5 bg-white hover:bg-zinc-300 text-black font-display text-xl uppercase tracking-widest transition-colors border-2 border-transparent shadow-[4px_4px_0_0_#52525B]"
              >
                Hier geht's zum Shop
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 pb-4 text-center" aria-live="assertive">
              <h2 id="voucher-modal-title" className="text-4xl md:text-5xl font-display uppercase tracking-widest text-white mb-2 shadow-[2px_2px_0_0_#EF4444]">{t('modal.title')}</h2>
              {result.prize.description && (
                <p className="text-2xl md:text-3xl text-red-500 mt-6 font-bold uppercase tracking-widest max-w-lg mx-auto leading-relaxed">{result.prize.description}</p>
              )}
            </div>

            {step === 1 ? (
              <div className="p-8 max-w-md mx-auto">
                <p className="text-zinc-400 mb-6 text-center font-bold tracking-widest uppercase">{t('modal.desc_2')}</p>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex gap-4">
                    <div className="w-1/2">
                      <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">{t('modal.first_name')}</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full bg-zinc-900 border-2 border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-white transition-colors rounded-none"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">{t('modal.last_name')}</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full bg-zinc-900 border-2 border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-white transition-colors rounded-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">{t('modal.email')}</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-zinc-900 border-2 border-zinc-700 px-4 py-3 text-white focus:outline-none focus:border-white transition-colors rounded-none"
                    />
                  </div>

                  <div className="flex items-start gap-3 mt-4">
                    <input
                      type="checkbox"
                      id="newsletter"
                      checked={formData.newsletter}
                      onChange={e => setFormData({ ...formData, newsletter: e.target.checked })}
                      className="mt-1 w-5 h-5 bg-zinc-900 border-2 border-zinc-700 checked:bg-red-600 appearance-none flex-shrink-0 cursor-pointer"
                      style={{ backgroundImage: formData.newsletter ? 'url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox=\'0 0 16 16\' fill=\'%23fff\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z\'/%3E%3C/svg%3E")' : 'none' }}
                    />
                    <label htmlFor="newsletter" className="text-sm text-zinc-400 cursor-pointer">
                      {t('modal.newsletter')}
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 mt-8 px-8 py-5 bg-red-600 hover:bg-white text-white hover:text-black border-2 border-transparent hover:border-black font-display text-xl uppercase tracking-widest transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_0_#000] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? t('modal.submitting') : t('modal.submit')}
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
                <h3 className="text-3xl font-display text-white mb-4 uppercase tracking-widest">{t('modal.success_title')}</h3>
                <p className="text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
                  {t('modal.success_desc')}
                </p>
                <p className="text-zinc-400 font-bold tracking-widest leading-relaxed mt-4">
                  <strong className="text-white border-b-2 border-red-500">{formData.email}</strong>
                </p>
                <button
                  onClick={() => window.location.href = 'https://skate.ch/'}
                  className="mt-8 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest transition-colors w-full border-2 border-zinc-700"
                >
                  OK!
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
