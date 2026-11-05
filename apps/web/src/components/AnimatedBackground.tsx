/**
 * Animated ambient background: drifting aurora blobs + parallax grid + a
 * sweeping scan line. Pure CSS (see globals.css), fixed behind all content,
 * non-interactive, and disabled under prefers-reduced-motion.
 *
 * `variant="vivid"` is used on auth/landing (fuller intensity); `variant="app"`
 * is a calmer version for the authenticated workspace.
 */
export function AnimatedBackground({ variant = 'vivid' }: { variant?: 'vivid' | 'app' }) {
  const dim = variant === 'app' ? 'opacity-60' : 'opacity-100';
  return (
    <div className={`lunatic-bg ${dim}`} aria-hidden="true">
      <div className="lunatic-bg__blob lunatic-bg__blob--1" />
      <div className="lunatic-bg__blob lunatic-bg__blob--2" />
      <div className="lunatic-bg__blob lunatic-bg__blob--3" />
      <div className="lunatic-bg__grid" />
      {variant === 'vivid' && <div className="lunatic-bg__scan" />}
    </div>
  );
}
