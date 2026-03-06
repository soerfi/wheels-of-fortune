import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';

interface Prize {
    id: number;
    name: string;
    color?: string;
    description?: string;
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

// Constants for physics and delays
const FULL_ROTATION = 360;
// Represents the shift required to visually align the Needle with the Graphic.
const POINTER_ALIGNMENT_OFFSET = 10;
// Perfect baseline: (270 true Left - 10 deg needle offset - 30 margin offset)
const TARGET_ANGLE_BASE = 230;
// The wheel spins 8 full times before resting
const EXTRA_SPINS = 8 * FULL_ROTATION;
// Timeout until the win popup shows
const MODAL_DELAY_MS = 5000;

function normalizeAngle(value: number): number {
    return ((value % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
}

function truncateLabel(label: string, maxLength: number): string {
    const trimmed = label.trim().toUpperCase();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}..` : trimmed;
}

export default function Wheel({ prizes, onSpin, onSpinComplete }: WheelProps) {
    const [isSpinning, setIsSpinning] = useState(false);
    const wheelRef = useRef<HTMLDivElement>(null);
    const completeTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (completeTimeoutRef.current !== null) {
                window.clearTimeout(completeTimeoutRef.current);
            }
        };
    }, []);

    const rotateX = useMotionValue(0);

    const numPrizes = prizes.length;
    const sliceAngle = useMemo(
        () => (numPrizes > 0 ? FULL_ROTATION / numPrizes : FULL_ROTATION),
        [numPrizes]
    );

    const labelMaxLength = numPrizes > 12 ? 10 : 18;

    const wheelRotate = useTransform(rotateX, (value) => value - 90);

    // Pointer Animation Physics
    // This calculates the bouncing effect when a slice peg hits the Skater needle.
    const pointerRotate = useTransform(rotateX, (value) => {
        if (numPrizes === 0) return 0;

        // Shift by 10 properties to align the needle hit-box.
        const shifted = value - POINTER_ALIGNMENT_OFFSET;
        const normalized = normalizeAngle(shifted);
        // Calculate how far away the next peg is
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

    const handleSpinClick = async () => {
        if (isSpinning || numPrizes === 0) return;

        setIsSpinning(true);

        try {
            const result = await onSpin();

            const matchingIndices = prizes
                .map((prize, index) => (prize.id === result.prize.id ? index : -1))
                .filter((index): index is number => index !== -1);

            // Deduce a fallback index (pad slot) if the won prize somehow doesn't physically fit in the visual list 
            const fallbackIndex = Math.max(numPrizes - 1, 0);
            const availableIndices = matchingIndices.length > 0 ? matchingIndices : [fallbackIndex];

            if (matchingIndices.length === 0) {
                console.warn('Winning prize not displayed visually, using fallback slot for animation.');
            }

            // If the item exists multiple times (padding), pick one randomly to spin to
            const winningIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

            // Mathematics to align the skater exactly to the center of the won slice
            const currentRotation = rotateX.get();
            const currentNormalized = normalizeAngle(currentRotation);

            // Subtract the slice's offset from the perfect 230deg margin.
            const targetAngle = TARGET_ANGLE_BASE - winningIndex * sliceAngle;

            const rawDelta = targetAngle - currentNormalized;
            // Ensure we never rotate backwards (visual glitch prevention)
            const forwardDelta = rawDelta < 0 ? rawDelta + FULL_ROTATION : rawDelta;
            const baseRotation = currentRotation + EXTRA_SPINS + forwardDelta;

            // Organic fuzziness: do not stop exactly mathematically dead center, add a tiny bit of random padding 
            const randomOffset = (Math.random() - 0.5) * (sliceAngle * 0.8);
            const finalRotation = baseRotation + randomOffset;

            animate(rotateX, finalRotation, {
                duration: 15,
                ease: [0.05, 0.95, 0.05, 1],
                onComplete: async () => {
                    setIsSpinning(false);

                    try {
                        const confettiModule = await import('canvas-confetti');
                        const confetti = confettiModule.default;
                        confetti({
                            particleCount: 150,
                            spread: 80,
                            origin: { y: 0.6 },
                            colors: ['#A91101', '#18181B', '#FFFFFF'],
                        });
                    } catch (confettiError) {
                        console.error('Confetti failed to load:', confettiError);
                    }

                    completeTimeoutRef.current = window.setTimeout(() => {
                        onSpinComplete(result);
                    }, MODAL_DELAY_MS);
                },
            });
        } catch (error) {
            console.error('Spin failed:', error);
            setIsSpinning(false);
        }
    };

    return (
        <div className="relative flex max-w-full select-none flex-col items-center pt-12 md:pt-16">
            <div className="relative h-[300px] w-[300px] sm:h-[350px] sm:w-[350px] md:h-[500px] md:w-[500px]">
                <div className="pointer-events-none absolute inset-0 z-30" style={{ transform: 'rotate(-10deg)' }}>
                    <div
                        className="pointer-events-auto absolute top-1/2 left-[calc(-20%+10px)] -mt-[10px] -translate-y-1/2 drop-shadow-xl md:left-[calc(-25%+10px)]"
                        style={{ transformOrigin: '50% 50%' }}
                    >
                        <motion.div style={{ rotate: pointerRotate, transformOrigin: '50% 50%' }} className="flex items-center">
                            <img src="/Soerfi-Needle.png" alt="Skater Pin" className="w-24 object-contain md:w-32" />
                        </motion.div>
                    </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#b51401] shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
                    <motion.div
                        ref={wheelRef}
                        className="h-[96%] w-[96%] overflow-hidden rounded-full bg-zinc-900 shadow-inner"
                        style={{
                            rotate: wheelRotate,
                            backgroundImage: 'url(/Wheel-of-Fortune.svg)',
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                        }}
                    >
                        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
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
                                        {/* CSS Rotated Divider Pins / Pegs 
                                            Positioned outward to align perfectly with SVG graphics */}
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
                disabled={isSpinning || numPrizes === 0}
                aria-label={isSpinning ? 'Glücksrad dreht sich, bitte warten' : 'Dreh am Glücksrad'}
                className="relative mt-12 rounded-[3rem] border-[3px] border-white bg-[#b51401] px-12 py-4 font-display text-4xl uppercase tracking-widest text-white shadow-[0_0_40px_rgba(181,20,1,0.6)] transition-all hover:scale-[1.02] hover:bg-[#9c1101] active:scale-95 disabled:pointer-events-none disabled:opacity-50 md:mt-16 md:px-20 md:py-6 md:text-5xl"
            >
                <div className="pointer-events-none absolute inset-0 rounded-[3rem] shadow-[inset_0_-4px_10px_rgba(0,0,0,0.1)]" />
                <span className="relative z-10">{isSpinning ? 'WAIT...' : 'SPIN ROW!'}</span>
            </button>
        </div>
    );
}
