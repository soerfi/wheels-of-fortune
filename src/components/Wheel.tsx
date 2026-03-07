import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface Prize {
    id: number;
    name: string;
    color?: string;
    description?: string;
    is_jackpot?: number;
}

interface SpinResult {
    id: number;
    prize: Prize;
    code: string;
}

interface WheelProps {
    prizes: Prize[];
    onSpin: () => Promise<SpinResult>;
    onSpinComplete: (result: SpinResult) => void;
}

const FULL_ROTATION = 360;
const POINTER_ALIGNMENT_OFFSET = 10;
const TARGET_ANGLE_BASE = 240;
const EXTRA_SPINS = 8 * FULL_ROTATION;
const MODAL_DELAY_MS = 5000;
const RANDOM_OFFSET_FACTOR = 0.2;

function normalizeAngle(value: number): number {
    return ((value % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
}

function truncateLabel(label: string, maxLength: number): string {
    const trimmed = label.trim().toUpperCase();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}..` : trimmed;
}

export default function Wheel({ prizes, onSpin, onSpinComplete }: WheelProps) {
    const { t } = useTranslation();
    const [isSpinning, setIsSpinning] = useState(false);
    const [hasWon, setHasWon] = useState(false);
    const completeTimeoutRef = useRef<number | null>(null);

    const rotateX = useMotionValue(0);

    const numPrizes = prizes.length;
    const sliceAngle = useMemo(
        () => (numPrizes > 0 ? FULL_ROTATION / numPrizes : FULL_ROTATION),
        [numPrizes]
    );

    const labelMaxLength = numPrizes > 12 ? 10 : 18;

    const wheelRotate = useTransform(rotateX, (value) => value - 90);

    const pointerRotate = useTransform(rotateX, (value) => {
        if (numPrizes === 0) return 0;

        const shifted = value - POINTER_ALIGNMENT_OFFSET;
        const normalized = normalizeAngle(shifted);
        const distanceToNextPeg = sliceAngle - (normalized % sliceAngle);

        const liftThreshold = sliceAngle * 0.15;
        const bounceThreshold = sliceAngle * 0.1;
        const maxLift = -35;

        if (distanceToNextPeg <= liftThreshold) {
            return (1 - distanceToNextPeg / liftThreshold) * maxLift;
        }

        if (distanceToNextPeg > sliceAngle - bounceThreshold) {
            const bounceProgress = (sliceAngle - distanceToNextPeg) / bounceThreshold;
            return maxLift * (1 - bounceProgress);
        }

        return 0;
    });

    useEffect(() => {
        return () => {
            if (completeTimeoutRef.current !== null) {
                window.clearTimeout(completeTimeoutRef.current);
            }
        };
    }, []);

    const handleSpinClick = async () => {
        if (isSpinning || numPrizes === 0) return;

        setIsSpinning(true);

        try {
            const result = await onSpin();

            const matchingIndices = prizes
                .map((prize, index) => (prize.id === result.prize.id ? index : -1))
                .filter((index): index is number => index !== -1);

            const fallbackIndex = Math.max(numPrizes - 1, 0);
            const availableIndices = matchingIndices.length > 0 ? matchingIndices : [fallbackIndex];

            if (matchingIndices.length === 0) {
                console.warn('Winning prize not displayed visually, using fallback slot for animation.');
            }

            const winningIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

            const currentRotation = rotateX.get();
            const currentNormalized = normalizeAngle(currentRotation);
            const targetAngle = TARGET_ANGLE_BASE - winningIndex * sliceAngle;

            const rawDelta = targetAngle - currentNormalized;
            const forwardDelta = rawDelta < 0 ? rawDelta + FULL_ROTATION : rawDelta;

            const baseRotation = currentRotation + EXTRA_SPINS + forwardDelta;

            const randomOffset = (Math.random() - 0.5) * (sliceAngle * RANDOM_OFFSET_FACTOR);
            const finalRotation = baseRotation + randomOffset;

            animate(rotateX, finalRotation, {
                duration: 15,
                ease: [0.05, 0.95, 0.05, 1],
                onComplete: async () => {
                    setIsSpinning(false);

                    try {
                        const confettiModule = await import('canvas-confetti');
                        const confetti = confettiModule.default;

                        // Check if it's the jackpot prize
                        const isJackpot = result.prize.is_jackpot === 1;

                        confetti({
                            particleCount: isJackpot ? 250 : 150,
                            spread: isJackpot ? 100 : 80,
                            origin: { y: 0.6 },
                            colors: isJackpot ? ['#FFD700', '#DAA520', '#FFFFFF'] : ['#A91101', '#18181B', '#FFFFFF'],
                            ticks: isJackpot ? 300 : 200,
                        });

                        setHasWon(true);
                    } catch (confettiError) {
                        console.error('Confetti failed to load:', confettiError);
                    }

                    completeTimeoutRef.current = window.setTimeout(() => {
                        onSpinComplete(result);
                    }, MODAL_DELAY_MS);
                }
            });
        } catch (error) {
            console.error('Spin failed:', error);
            setIsSpinning(false);
        }
    };

    return (
        <div className="relative flex flex-col items-center select-none pt-12 md:pt-16 max-w-full">
            <div className="relative w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] md:w-[500px] md:h-[500px]">
                <div className="absolute inset-0 z-30 pointer-events-none" style={{ transform: 'rotate(-10deg)' }}>
                    <div
                        className="absolute top-1/2 left-[calc(-20%+10px)] md:left-[calc(-25%+10px)] -translate-y-1/2 -mt-[10px] drop-shadow-xl pointer-events-auto"
                        style={{ transformOrigin: '50% 50%' }}
                    >
                        <motion.div style={{ rotate: pointerRotate, transformOrigin: '50% 50%' }} className="flex items-center">
                            <img src="/Soerfi-Needle.png" alt="Skater Pin" className="w-24 md:w-32 object-contain" />
                        </motion.div>
                    </div>
                </div>

                <div className="absolute inset-0 rounded-full bg-[#b51401] shadow-[0_15px_35px_rgba(0,0,0,0.3)] flex items-center justify-center">
                    <motion.div
                        className="w-[96%] h-[96%] rounded-full overflow-hidden bg-zinc-900 shadow-inner"
                        style={{
                            rotate: wheelRotate,
                            backgroundImage: 'url(/Wheel-of-Fortune.svg)',
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                        }}
                    >
                        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                            <defs>
                                <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0.5" dy="0.5" stdDeviation="1" floodColor="#000000" floodOpacity="0.8" />
                                </filter>
                            </defs>

                            {prizes.map((prize, index) => {
                                const midAngle = index * sliceAngle + sliceAngle / 2;
                                const displayName = truncateLabel(prize.name, labelMaxLength);

                                return (
                                    <g key={`${prize.id}-${index}`}>
                                        <line
                                            x1="48"
                                            y1="50"
                                            x2="50"
                                            y2="50"
                                            stroke="#ffffff"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            transform={`rotate(${index * sliceAngle + POINTER_ALIGNMENT_OFFSET}, 50, 50) translate(50, 0)`}
                                        />

                                        <text
                                            x="6"
                                            y="51.5"
                                            fill="#ffffff"
                                            filter="url(#text-shadow)"
                                            stroke="none"
                                            fontSize={3.2}
                                            fontFamily="system-ui, -apple-system, sans-serif"
                                            fontWeight="600"
                                            letterSpacing="0.05em"
                                            textAnchor="start"
                                            transform={`rotate(${midAngle + POINTER_ALIGNMENT_OFFSET - 180}, 50, 50)`}
                                        >
                                            {displayName}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </motion.div>
                </div>
            </div>

            <button
                onClick={handleSpinClick}
                disabled={isSpinning || numPrizes === 0 || hasWon}
                aria-label={isSpinning ? 'Glücksrad dreht sich, bitte warten' : 'Dreh am Glücksrad'}
                className="relative mt-8 md:mt-12 px-10 md:px-16 py-3 md:py-5 border-[3px] border-white bg-[#b51401] hover:bg-[#9c1101] text-white font-display text-3xl md:text-4xl uppercase tracking-widest transition-all rounded-[3rem] hover:scale-[1.02] active:scale-95 shadow-[0_0_40px_rgba(181,20,1,0.6)] disabled:opacity-50 disabled:pointer-events-none"
            >
                <div className="absolute inset-0 rounded-[3rem] shadow-[inset_0_-4px_10px_rgba(0,0,0,0.1)] pointer-events-none"></div>
                <span className="relative z-10">{hasWon ? t('wheel.you_won') : isSpinning ? 'WAIT...' : t('wheel.spin_now')}</span>
            </button>
        </div>
    );
}