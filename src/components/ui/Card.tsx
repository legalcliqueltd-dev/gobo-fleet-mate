import clsx from 'clsx';
import { PropsWithChildren } from 'react';

export function Card({ 
  className, 
  children, 
  variant = 'glass' 
}: PropsWithChildren<{ className?: string; variant?: 'glass' | 'brutal' }>) {
  const styles = variant === 'brutal' ? 'nb-card' : 'glass-card soft-shadow';
  return <div className={clsx(styles, 'rounded-xl', className)}>{children}</div>;
}
export function CardHeader({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx('px-4 py-3 border-b border-white/10 dark:border-slate-800/60', className)}>{children}</div>;
}
export function CardContent({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx('p-4', className)}>{children}</div>;
}
