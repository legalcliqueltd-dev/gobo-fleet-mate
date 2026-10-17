import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  /** Small mono label above the title. */
  eyebrow: string;
  title: string;
  /** The number the screen exists to answer. Rendered huge, in mono. */
  count?: number | null;
  /** What the number counts — "left", "due today". */
  countLabel?: string;
  /** Of the total, how many are settled. Drives the rail under the title. */
  done?: number;
  total?: number;
  children?: ReactNode;
};

/**
 * The navy slab every driver list screen opens with.
 *
 * It is the one brand moment on these screens and it carries real
 * information, not decoration: the count IS the answer to why the driver
 * opened the screen. Everything below it is white cards, so the slab is also
 * what tells him which screen he is on without reading the title.
 *
 * Navy in both themes via `brand-ink` — `primary` flips to neon in dark and
 * a neon slab would be a flashbang on a phone held at night.
 */
export default function DriverScreenHeader({
  eyebrow,
  title,
  count,
  countLabel,
  done = 0,
  total = 0,
  children,
}: Props) {
  const showRail = total > 0;
  const pct = showRail ? Math.round((done / total) * 100) : 0;
  const allDone = showRail && done >= total;

  return (
    <header className="relative overflow-hidden rounded-b-[28px] bg-brand-ink px-5 pb-5 pt-5 text-brand-ink-foreground">
      {/* The repeating mark, barely there. Grain on the navy, never wallpaper. */}
      <div className="brand-pattern pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-brand-ink-foreground/55">
            {eyebrow}
          </p>
          <h1 className="mt-1.5 font-heading text-[28px] font-extrabold leading-none tracking-tight">
            {title}
          </h1>
        </div>

        {count != null && (
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'telemetry text-[40px] font-bold leading-none',
                allDone || count === 0 ? 'text-signal' : 'text-brand-ink-foreground'
              )}
            >
              {count}
            </p>
            {countLabel && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-ink-foreground/55">
                {countLabel}
              </p>
            )}
          </div>
        )}
      </div>

      {showRail && (
        <div
          className="relative mt-4 h-1 overflow-hidden rounded-full bg-brand-ink-foreground/15"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${done} of ${total} done`}
        >
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {children && <div className="relative mt-4">{children}</div>}
    </header>
  );
}
