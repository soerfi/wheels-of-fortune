import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

interface Prize {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

interface WheelProps {
  prizes: Prize[];
  onSpin: () => Promise<{ id: number, prize: Prize, code: string }>;
  onSpinComplete: (result: { id: number, prize: Prize, code: string }) => void;
}

export default function Wheel({ prizes, onSpin, onSpinComplete }: WheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Track rotation for physics
  const rotateX = useMotionValue(0);

  const numPrizes = prizes.length;
  // Fallback to 360 to avoid NaN
  const sliceAngle = numPrizes > 0 ? 360 / numPrizes : 360;

  // Pointer Animation Physics
  // dist represents how close the next peg is to the pointer (from sliceAngle down to 0)
  const pointerRotate = useTransform(rotateX, (v) => {
    if (numPrizes === 0) return 0;

    // Normalize v to positive layout
    const normalizedV = ((v % 360) + 360) % 360;
    const dist = sliceAngle - (normalizedV % sliceAngle);

    // Physics parameters
    const liftThreshold = sliceAngle * 0.15; // Start lifting when peg is 15% of a slice away
    const maxLift = -35; // Pointer pivots left (counter-clockwise) when hit by peg from left

    if (dist <= liftThreshold) {
      // Lifting up smoothly as peg approaches
      return (1 - (dist / liftThreshold)) * maxLift;
    }

    // Snapping back with a tiny bounce on the other side
    if (dist > sliceAngle - (sliceAngle * 0.1)) {
      const bounceProgress = (sliceAngle - dist) / (sliceAngle * 0.1); // 0 to 1
      return maxLift * (1 - bounceProgress);
    }

    return 0;
  });

  const handleSpinClick = async () => {
    if (isSpinning || prizes.length === 0) return;
    setIsSpinning(true);

    try {
      const result = await onSpin();

      // Find all indices of the winning prize (since we now have 18 slots with duplicates)
      const matchingIndices = prizes.map((p, index) => p.id === result.prize.id ? index : -1).filter(i => i !== -1);

      if (matchingIndices.length === 0) throw new Error("Winning prize not found on wheel");

      // Pick a random slot among the matches
      const winningIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

      // We want winningIndex slice to end up at the TOP (which is angle 0 before the -90 offset).
      const currentRotation = rotateX.get();
      const targetAngle = 360 - (winningIndex * sliceAngle + sliceAngle / 2);

      // Calculate total rotation: current + full spins + delta to target
      const extraSpins = 5 * 360;
      const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
      const rotationDelta = targetAngle - normalizedCurrent;

      const newRotation = currentRotation + extraSpins + rotationDelta + (rotationDelta < 0 ? 360 : 0);

      // Add a slight random offset within the slice interior
      const randomOffset = (Math.random() - 0.5) * (sliceAngle * 0.8);
      const finalRotation = newRotation + randomOffset;

      animate(rotateX, finalRotation, {
        duration: 5,
        ease: [0.15, 0.85, 0.1, 1], // Custom snappy slow-down curve
        onComplete: async () => {
          setIsSpinning(false);
          const confettiLib = await import('canvas-confetti');
          const confetti = confettiLib.default;
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#A91101', '#18181B', '#FFFFFF']
          });
          setTimeout(() => onSpinComplete(result), 800);
        }
      });

    } catch (error) {
      console.error(error);
      setIsSpinning(false);
    }
  };

  const createSlicePath = (index: number) => {
    if (numPrizes === 0) return '';
    const startAngle = (index * sliceAngle * Math.PI) / 180;
    const endAngle = ((index + 1) * sliceAngle * Math.PI) / 180;

    // SVG coordinates (center at 50,50, radius 50)
    const x1 = 50 + 50 * Math.cos(startAngle);
    const y1 = 50 + 50 * Math.sin(startAngle);
    const x2 = 50 + 50 * Math.cos(endAngle);
    const y2 = 50 + 50 * Math.sin(endAngle);

    const largeArcFlag = sliceAngle > 180 ? 1 : 0;
    return `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="relative flex flex-col items-center select-none pt-12 md:pt-16 max-w-full">
      {/* Container to handle mobile scaling gracefully */}
      <div className="relative w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] md:w-[500px] md:h-[500px]">

        {/* Physics Pointer (Anchored top center) */}
        <div className="absolute top-[-2%] md:top-[-4%] left-1/2 -translate-x-1/2 z-30 drop-shadow-xl" style={{ transformOrigin: 'top center' }}>
          <motion.div style={{ rotate: pointerRotate, transformOrigin: 'top center' }} className="flex flex-col items-center">
            {/* Pointer mount peg */}
            <div className="w-5 h-5 md:w-8 md:h-8 bg-zinc-200 border-[3px] md:border-4 border-[#9c1404] rounded-lg z-10 shadow-md flex items-center justify-center">
              <div className="w-2 h-2 md:w-3 md:h-3 bg-zinc-400 rounded-full inset-shadow-sm"></div>
            </div>
            {/* Pointer Base */}
            <div className="w-8 h-8 md:w-12 md:h-12 bg-[#b51401] rounded-sm -mt-3 md:-mt-4 flex flex-col items-center justify-end overflow-hidden pb-1 border-x-2 border-white/20"></div>
            {/* Pointer Arrow */}
            <div className="w-0 h-0 border-l-[16px] md:border-l-[24px] border-l-transparent border-r-[16px] md:border-r-[24px] border-r-transparent border-t-[24px] md:border-t-[36px] border-t-[#b51401]"></div>
          </motion.div>
        </div>

        {/* Outer Decor Ring */}
        <div className="absolute inset-0 rounded-full bg-[#b51401] shadow-[0_15px_35px_rgba(0,0,0,0.3)] flex items-center justify-center">

          {/* Wheel Graphic */}
          <motion.div
            ref={wheelRef}
            className="w-[96%] h-[96%] rounded-full overflow-hidden bg-zinc-900 border-[3px] border-[#b51401]"
            style={{ rotate: useTransform(rotateX, v => v - 90) }} // Offset so 0 degrees is visually Top
          >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              {prizes.map((prize, i) => {
                const midAngle = i * sliceAngle + sliceAngle / 2;
                const textFontSize = Math.max(3, 7 - (numPrizes * 0.15));

                // Styling inspired by references: Auto alternating black and white
                let isDark = i % 2 === 0;
                let sliceFill = isDark ? '#18181b' : '#f4f4f5';
                let textFill = isDark ? '#f4f4f5' : '#a11202';

                // Prevent two adjacent slices of the same color if odd
                if (numPrizes % 2 !== 0 && i === numPrizes - 1) {
                  sliceFill = '#a11202';
                  textFill = '#ffffff';
                }

                return (
                  <g key={prize.id}>
                    {/* Slice Wedge */}
                    <path
                      d={createSlicePath(i)}
                      fill={sliceFill}
                      stroke="#ffffff"
                      strokeWidth="0.4"
                    />

                    {/* Peg Notches */}
                    <line
                      x1="48"
                      y1="50"
                      x2="50"
                      y2="50"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      transform={`rotate(${i * sliceAngle}, 50, 50) translate(49, 0)`}
                    />

                    {/* Text placement */}
                    <text
                      x="64"
                      y="51.5"
                      fill={textFill}
                      stroke="none"
                      fontSize={textFontSize}
                      fontFamily="'Anton', sans-serif"
                      letterSpacing="0.06em"
                      textAnchor="start"
                      transform={`rotate(${midAngle}, 50, 50)`}
                    >
                      {prize.name.length > (numPrizes > 12 ? 10 : 18)
                        ? prize.name.substring(0, numPrizes > 12 ? 10 : 18) + '..'
                        : prize.name.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* Center Circle Hub */}
              <circle cx="50" cy="50" r="30" fill="#f4f4f5" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="#a11202" strokeWidth="0.75" />

              {/* Graphic Logo Text inside Hub */}
              <text x="50" y="44" fill="#a11202" fontSize="5" fontFamily="sans-serif" fontWeight="900" fontStyle="italic" textAnchor="middle" letterSpacing="0.05em">10 YEARS</text>
              <text x="50" y="55" fill="#a11202" fontSize="13" fontFamily="'Anton', sans-serif" textAnchor="middle" letterSpacing="0.05em">SKATE.CH</text>
              <text x="50" y="63" fill="#a11202" fontSize="4.5" fontFamily="sans-serif" fontWeight="700" textAnchor="middle" letterSpacing="0.05em">WHEEL OF FORTUNE</text>
            </svg>
          </motion.div>
        </div>
      </div>

      <button
        onClick={handleSpinClick}
        disabled={isSpinning || prizes.length === 0}
        aria-label={isSpinning ? "Glücksrad dreht sich, bitte warten" : "Dreh am Glücksrad"}
        className="relative mt-12 md:mt-16 px-12 md:px-20 py-4 md:py-6 border-[3px] border-white bg-[#b51401] hover:bg-[#9c1101] text-white font-display text-4xl md:text-5xl uppercase tracking-widest transition-all rounded-[3rem] hover:scale-[1.02] active:scale-95 shadow-[0_0_40px_rgba(181,20,1,0.6)] disabled:opacity-50 disabled:pointer-events-none"
      >
        {/* Adds a slight inner red glow inset string to match the softness inside */}
        <div className="absolute inset-0 rounded-[3rem] shadow-[inset_0_-4px_10px_rgba(0,0,0,0.1)] pointer-events-none"></div>
        <span className="relative z-10">{isSpinning ? 'WAIT...' : 'SPIN ROW!'}</span>
      </button>
    </div>
  );
}
