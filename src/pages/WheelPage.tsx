import { useEffect, useState } from 'react';
import Wheel from '../components/Wheel';
import VoucherModal from '../components/VoucherModal';
import AlertModal from '../components/AlertModal';
import { motion } from 'motion/react';

export default function WheelPage() {
  const [settings, setSettings] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [wheelPrizes, setWheelPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spinError, setSpinError] = useState('');
  const [result, setResult] = useState<{ id: number, prize: any, code: string } | null>(null);
  const [hasSpun, setHasSpun] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('skate_wheel_has_spun')) {
      setHasSpun(true);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, prizesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/prizes')
      ]);
      const s = await settingsRes.json();
      const p = await prizesRes.json();
      setSettings(s);

      const available = p.filter((pr: any) => pr.remaining_quantity > 0);
      setPrizes(available);

      if (available.length > 0) {
        // Generate 18 Wheel Slots
        const sorted = [...available].sort((a, b) => (a.weight || 1) - (b.weight || 1));
        const slots = [];
        const TOTAL_SLOTS = 18;

        for (let i = 0; i < sorted.length - 1; i++) {
          slots.push(sorted[i]);
        }

        const trostPrize = sorted[sorted.length - 1];
        while (slots.length < TOTAL_SLOTS) {
          slots.push(trostPrize);
        }

        // Randomly shuffle to spread out the Trostpreise
        for (let i = slots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [slots[i], slots[j]] = [slots[j], slots[i]];
        }

        setWheelPrizes(slots.slice(0, TOTAL_SLOTS));
      } else {
        setWheelPrizes([]);
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpin = async () => {
    try {
      const res = await fetch('/api/spin', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      if (err.message === 'Wheel is currently inactive.') {
        // Force refresh frontend state to show the paused banner
        fetchData();
      }
      setSpinError(err.message || 'Ein unbekannter Fehler ist aufgetreten.');
      throw err;
    }
  };

  const handleSpinComplete = (data: any) => {
    localStorage.setItem('skate_wheel_has_spun', 'true');
    setHasSpun(true);
    setResult(data);
    fetchData(); // Refresh prizes
  };

  if (loading) return <div className="min-h-screen bg-zinc-100 text-zinc-900 flex items-center justify-center">Laden...</div>;

  const now = new Date().getTime();
  let isActive = false;
  let nextSlotDate = null;

  if (settings?.active_slots) {
    let slots = [];
    try {
      slots = typeof settings.active_slots === 'string' ? JSON.parse(settings.active_slots) : settings.active_slots;
    } catch (e) {
      slots = settings.active_slots;
    }

    // Check if active
    isActive = slots.some((s: any) => {
      const from = new Date(s.from).getTime();
      const to = new Date(s.to).getTime();
      return now >= from && now <= to;
    });

    // If not active, find the next upcoming slot for the countdown
    if (!isActive) {
      const upcomingSlots = slots.map((s: any) => new Date(s.from).getTime()).filter((time: number) => time > now);
      if (upcomingSlots.length > 0) {
        nextSlotDate = new Date(Math.min(...upcomingSlots));
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col items-center justify-center relative overflow-hidden py-12">

      {/* Title Area Removed since the Wheel now has the massive 10 YEARS SKATE.CH logo inside it */}
      <div className="z-10 w-full flex flex-col items-center mb-8 px-4 text-center mt-4">
        <h2 className="text-2xl md:text-4xl font-display uppercase tracking-widest text-zinc-400 mb-2">
          Try your luck
        </h2>
        <div className="w-16 h-1 bg-[#b51401] mb-4"></div>
      </div>

      {!isActive ? (
        <div className="z-10 w-full flex justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 md:p-12 border-4 border-[#8B0000] text-center max-w-lg w-full shadow-[12px_12px_0_0_#8B0000]"
          >
            <h3 className="text-3xl md:text-4xl font-display mb-4 text-[#8B0000] uppercase">Aktion pausiert</h3>
            {nextSlotDate ? (
              <>
                <p className="text-zinc-600 font-bold uppercase tracking-widest leading-relaxed mb-6">
                  Das Glücksrad ist momentan im Pausenmodus. Die nächste Runde startet bald!
                </p>
                <div className="bg-[#8B0000] text-white p-6 border-4 border-black font-display text-4xl shadow-[6px_6px_0_0_#18181B]">
                  <CountdownTimer targetDate={nextSlotDate} />
                </div>
              </>
            ) : (
              <p className="text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                Das Glücksrad hat zurzeit keine aktiven Sessions geplant.
              </p>
            )}
          </motion.div>
        </div>
      ) : hasSpun ? (
        <div className="z-10 w-full flex justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 md:p-12 border-4 border-zinc-900 text-center max-w-lg w-full shadow-[12px_12px_0_0_#18181B]"
            onClick={() => {
              if (process.env.NODE_ENV !== 'production') {
                localStorage.removeItem('skate_wheel_has_spun');
                window.location.reload();
              }
            }}
          >
            <h3 className="text-3xl md:text-4xl font-display mb-4 text-[#8B0000] uppercase cursor-pointer">Schon gedreht!</h3>
            <p className="text-zinc-600 font-bold uppercase tracking-widest leading-relaxed border-t-2 border-zinc-100 pt-6">
              Du hast dein Glück bereits versucht. Komm bei der nächsten Runde wieder vorbei!
              {process.env.NODE_ENV !== 'production' && <span className="block mt-4 text-xs text-red-500 font-mono">(DEV-MODE: Klick hier zum Zurücksetzen)</span>}
            </p>
          </motion.div>
        </div>
      ) : prizes.length === 0 ? (
        <div className="z-10 w-full flex justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 md:p-12 border-4 border-zinc-900 text-center max-w-lg w-full shadow-[12px_12px_0_0_#18181B]"
          >
            <h3 className="text-3xl md:text-4xl font-display mb-4 text-[#8B0000] uppercase">Alles abgeräumt!</h3>
            <p className="text-zinc-600 font-bold uppercase tracking-widest leading-relaxed border-t-2 border-zinc-100 pt-6">
              Alle Preise wurden bereits gewonnen. Stay tuned für die nächste Runde!
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="z-10 w-full flex justify-center relative">
          <Wheel prizes={wheelPrizes} onSpin={handleSpin} onSpinComplete={handleSpinComplete} />
        </div>
      )}

      {result && (
        <VoucherModal
          result={result}
          settings={settings}
          onClose={() => setResult(null)}
        />
      )}

      {spinError && (
        <AlertModal
          type="error"
          message={spinError}
          onClose={() => setSpinError('')}
        />
      )}
    </div>
  );
}

// Simple Countdown Component
function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;

      if (difference <= 0) {
        clearInterval(interval);
        window.location.reload(); // Refresh to activate wheel
      } else {
        const h = Math.floor(difference / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return <span>{timeLeft || '00:00:00'}</span>;
}
