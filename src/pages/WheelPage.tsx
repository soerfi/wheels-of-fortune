import { useEffect, useState } from 'react';
import Wheel from '../components/Wheel';
import VoucherModal from '../components/VoucherModal';
import AlertModal from '../components/AlertModal';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export default function WheelPage() {
  const { t, i18n } = useTranslation();
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

    const handleKeyDown = (e: KeyboardEvent) => {
      // Option/Alt + Shift + R to reset
      if (e.altKey && e.shiftKey && e.code === 'KeyR') {
        localStorage.removeItem('skate_wheel_has_spun');
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

      const lang = i18n?.language?.split('-')[0].toLowerCase() || 'de';
      const l = ['en', 'fr', 'it'].includes(lang) ? `_${lang}` : '';

      const localizedPrizes = available.map((pr: any) => ({
        ...pr,
        name: pr[`name${l}`] || pr.name,
        description: pr[`description${l}`] || pr.description,
      }));

      setPrizes(localizedPrizes);

      if (localizedPrizes.length > 0) {
        const sorted = [...localizedPrizes].sort((a, b) => (a.weight || 1) - (b.weight || 1));
        const TOTAL_SLOTS = 18;
        const jackpotPrize = sorted.find(p => p.is_jackpot);

        let poolItems = sorted.map(p => ({
          prize: p,
          count: 1, // Minimum 1 slot per prize to ensure visibility
          weight: p.weight || 1,
          is_jackpot: p.is_jackpot
        }));

        // Cap any generic prize to half the wheel to prevent unavoidable adjacencies
        const MAX_PER_PRIZE = Math.floor(TOTAL_SLOTS / 2); // 9

        let unassigned = TOTAL_SLOTS - poolItems.length;
        if (unassigned < 0) {
          // Too many distinct prizes, cull lowest weighted ones
          const jp = poolItems.find(p => p.is_jackpot);
          const regs = poolItems.filter(p => !p.is_jackpot).sort((a, b) => b.weight - a.weight);
          poolItems = jp ? [jp, ...regs.slice(0, TOTAL_SLOTS - 1)] : regs.slice(0, TOTAL_SLOTS);
          unassigned = 0;
        }

        // Proportional distribution (D'Hondt method) based on weights
        while (unassigned > 0) {
          // Jackpot slots are locked at 1, others distribute proportionally
          const validItems = poolItems.filter(i => !i.is_jackpot && i.count < MAX_PER_PRIZE);
          if (validItems.length === 0) break;

          let bestItem = validItems[0];
          let bestScore = -1;
          for (const item of validItems) {
            const score = item.weight / (item.count + 1); // D'Hondt divisor
            if (score > bestScore) {
              bestScore = score;
              bestItem = item;
            }
          }
          bestItem.count++;
          unassigned--;
        }

        if (unassigned > 0) {
          // Failsafe: if there are fewer than 2 active regular prizes, 
          // capping at 9 left extra slots. We just forcefully allocate them to whatever's valid.
          const validItems = poolItems.filter(i => !i.is_jackpot);
          if (validItems.length > 0) {
            validItems[0].count += unassigned;
          }
        }

        // Space out to prevent identical prizes from sitting neatly side-by-side
        poolItems.sort((a, b) => b.count - a.count);

        const rawSlots = new Array(TOTAL_SLOTS).fill(null);
        const placementSequence = [];
        // Fill Evens then fill Odds (0, 2, 4... then 1, 3, 5...)
        // This ensures items with count <= 9 will NEVER touch their duplicates
        for (let i = 0; i < TOTAL_SLOTS; i += 2) placementSequence.push(i);
        for (let i = 1; i < TOTAL_SLOTS; i += 2) placementSequence.push(i);

        let seqIdx = 0;
        for (const item of poolItems) {
          for (let i = 0; i < item.count; i++) {
            rawSlots[placementSequence[seqIdx]] = item.prize;
            seqIdx++;
          }
        }

        // Find Jackpot and rotate the entire wheel so it lands precisely on index 2 (the golden zone)
        let finalSlots = [...rawSlots];
        if (jackpotPrize) {
          const jpIndex = rawSlots.findIndex(p => p.id === jackpotPrize.id);
          if (jpIndex !== -1) {
            const rotation = (2 - jpIndex + TOTAL_SLOTS) % TOTAL_SLOTS;
            finalSlots = new Array(TOTAL_SLOTS);
            for (let i = 0; i < TOTAL_SLOTS; i++) {
              finalSlots[(i + rotation) % TOTAL_SLOTS] = rawSlots[i];
            }
          }
        }

        setWheelPrizes(finalSlots);
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

    // localize result right before showing popup
    const lang = i18n?.language?.split('-')[0].toLowerCase() || 'de';
    const l = ['en', 'fr', 'it'].includes(lang) ? `_${lang}` : '';
    if (data && data.prize) {
      data.prize.name = data.prize[`name${l}`] || data.prize.name;
      data.prize.description = data.prize[`description${l}`] || data.prize.description;
    }

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

      {/* Dual Header Logos */}
      <div className="z-10 w-full flex flex-col items-center justify-center mb-8 md:mb-12 px-4 mt-6 md:mt-10 gap-5 md:gap-8">
        <motion.img
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          src="/10-years-skate.ch.png"
          alt="10 Years Skate.ch"
          className="w-full max-w-[280px] md:max-w-[450px] object-contain drop-shadow-xl"
        />
        <motion.img
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          src="/try-your-luck.png"
          alt="Try Your Luck"
          className="w-full max-w-[180px] md:max-w-[280px] object-contain drop-shadow-md"
        />
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
          >
            <h3 className="text-3xl md:text-4xl font-display mb-4 text-[#8B0000] uppercase">Schon gedreht!</h3>
            <p className="text-zinc-600 font-bold uppercase tracking-widest leading-relaxed border-t-2 border-zinc-100 pt-6 mb-8">
              Du hast dein Glück bereits versucht. Komm bei der nächsten Runde wieder vorbei!
            </p>
            <a 
              href="https://skate.ch/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 bg-red-600 hover:bg-black text-white font-display text-xl uppercase tracking-widest transition-colors border-2 border-transparent hover:border-black shadow-[4px_4px_0_0_#000]"
            >
              {t('wheel.shop_button')}
            </a>
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
