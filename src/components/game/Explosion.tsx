import { motion } from 'framer-motion';

// Fire-and-forget particle burst. Keyed by id so a new one mounts per blast.
export function Explosion({ x, y }: { x: number; y: number }) {
  const shards = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, zIndex: 40 }}>
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={{ scale: 0, opacity: 0.9 }}
        animate={{ scale: 6, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ width: 40, height: 40, background: 'radial-gradient(circle, #fff, #ff5a2e 40%, transparent 70%)' }}
      />
      <div className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl">
        <motion.span
          initial={{ scale: 0.4, opacity: 1 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="inline-block"
        >
          💥
        </motion.span>
      </div>
      {shards.map((_, i) => {
        const a = (i / shards.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{ backgroundColor: i % 2 ? '#ffb020' : '#ff5a2e' }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}
