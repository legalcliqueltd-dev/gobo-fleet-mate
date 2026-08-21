import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'Auto' },
];

/**
 * Appearance control for the phone.
 *
 * Replaces the old ThemeToggle on native, which was built for a desktop
 * toolbar: 28px targets, hardcoded cyan/slate outside the design system, and
 * `hidden sm:inline` labels — which on a phone left three unlabelled specks.
 *
 * This is a full-width segmented control with 44px targets, tokened colours,
 * and labels that always show. "Auto" is offered because it is what most
 * drivers want: bright by day, dark at night, without them touching anything.
 */
export default function ThemeSegmented() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(value)}
            className={cn(
              'flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-all',
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
