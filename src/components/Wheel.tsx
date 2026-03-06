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

    // Normalize v to positive layout.
    // Skater is at 260 degrees (10 deg above Left/270). Pegs are at i * 20 + 10.
    // Alignment shift calculation: (v - 10) % 20 == 0 when peg hits Skater.
    const shiftedV = v - 10;
    const normalizedV = ((shiftedV % 360) + 360) % 360;
    const dist = sliceAngle - (normalizedV % sliceAngle);

    // Physics parameters
    const liftThreshold = sliceAngle * 0.15; // Start lifting when peg is 15% of a slice away
    const maxLift = -35; // Pointer pivots upwards when hit by peg from below (since it's on the left and wheel is clockwise)

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
      let matchingIndices = prizes.map((p, index) => p.id === result.prize.id ? index : -1).filter(i => i !== -1);

      if (matchingIndices.length === 0) {
        // Fallback if the backend selected a prize that didn't fit into the 18 visual slots
        console.warn("Winning prize not displayed visually, falling back to Trostpreis slot for animation.");
        matchingIndices = [prizes.length - 1]; // Spin to the last slot (usually the Trostpreis padding)
      }

      // Pick a random slot among the matches
      const winningIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

      // Skater is located at -left-[4%], rotated -10deg. The physical position is visual 260 degrees.
      // Text acts as the trailing pin. We want to stop 10 degrees earlier to land exactly in the center of the slice.
      const currentRotation = rotateX.get();
      const targetAngle = 230 - (winningIndex * sliceAngle);

      // Decreased extra spins to 8 so the wheel moves convincingly but slower over 15 seconds
      const extraSpins = 8 * 360;
      const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
      const rotationDelta = targetAngle - normalizedCurrent;

      const newRotation = currentRotation + extraSpins + rotationDelta + (rotationDelta < 0 ? 360 : 0);

      // Add a slight random offset within the slice interior
      const randomOffset = (Math.random() - 0.5) * (sliceAngle * 0.8);
      const finalRotation = newRotation + randomOffset;

      animate(rotateX, finalRotation, {
        duration: 15,
        ease: [0.05, 0.95, 0.05, 1], // Even smoother, slower deceleration at the end
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
          // Wait at least 5 seconds before showing the modal
          setTimeout(() => onSpinComplete(result), 5000);
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

        {/* Skater Pin Wrapper aligned to wheel center, rotated -10deg so Skater sits 10deg above the left horizontal axis */}
        <div className="absolute inset-0 z-30 pointer-events-none" style={{ transform: 'rotate(-10deg)' }}>
          {/* Skater Pin (Left side horizontal within rotated wrapper) */}
          <div className="absolute top-1/2 left-[calc(-20%+10px)] md:left-[calc(-25%+10px)] -translate-y-1/2 drop-shadow-xl pointer-events-auto" style={{ transformOrigin: '50% 50%' }}>
            <motion.div style={{ rotate: pointerRotate, transformOrigin: '50% 50%' }} className="flex items-center">
              {/* The Skater Image serving as the pointing pin */}
              <img src="/Soerfi-Needle.png" alt="Skater Pin" className="w-24 md:w-32 object-contain" />
            </motion.div>
          </div>
        </div>

        {/* Outer Decor Ring */}
        <div className="absolute inset-0 rounded-full bg-[#b51401] shadow-[0_15px_35px_rgba(0,0,0,0.3)] flex items-center justify-center">

          {/* Wheel Graphic */}
          <motion.div
            ref={wheelRef}
            className="w-[96%] h-[96%] rounded-full overflow-hidden bg-zinc-900 shadow-inner"
            style={{
              rotate: useTransform(rotateX, v => v - 90), // Offset so 0 degrees is visually Top
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
              {prizes.map((prize, i) => {
                const midAngle = i * sliceAngle + sliceAngle / 2;

                return (
                  <g key={i}>
                    {/* Peg Notches */}
                    {/* Moved 20px outward compared to before (translate from 46 to 50 for +4 viewBox units) and rotated by 10 degrees to match text alignment */}
                    <line
                      x1="48"
                      y1="50"
                      x2="50"
                      y2="50"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      transform={`rotate(${i * sliceAngle + 10}, 50, 50) translate(50, 0)`}
                    />

                    {/* Text placement */}
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
                      transform={`rotate(${midAngle + 10 - 180}, 50, 50)`}
                    >
                      {prize.name.length > (numPrizes > 12 ? 10 : 18)
                        ? prize.name.substring(0, numPrizes > 12 ? 10 : 18) + '..'
                        : prize.name.toUpperCase()}
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
