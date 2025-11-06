import clsx from 'clsx';
import { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'brutal';
  size?: 'sm' | 'md' | 'lg' | 'icon';
};

export default function Button({ variant = 'primary', size = 'md', className, children, ...rest }: PropsWithChildren<Props>) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:opacity-50';
  const variants = {
    primary: 'bg-cyan-600 text-white hover:bg-cyan-700',
    outline: 'border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    brutal: 'nb-border bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[6px_6px_0_0_rgba(15,23,42,0.8)] hover:-translate-y-0.5',
  };
  const sizes = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2',
    icon: 'p-2',
  };
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}
