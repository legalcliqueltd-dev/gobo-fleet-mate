import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Opt = ({ val, icon: Icon, label }: { val: 'light' | 'dark' | 'system'; icon: any; label: string }) => (
    <button
      onClick={() => setTheme(val)}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition',
        theme === val
          ? 'bg-cyan-600 text-white border-cyan-600'
          : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
      title={label}
      aria-pressed={theme === val}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="inline-flex items-center gap-1.5">
      <Opt val="light" icon={Sun} label="Light" />
      <Opt val="dark" icon={Moon} label="Dark" />
      <Opt val="system" icon={Monitor} label="System" />
    </div>
  );
}
