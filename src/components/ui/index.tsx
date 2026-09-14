import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Level } from '@/content/schema';
import { sv } from '@/i18n/sv';

/** Shared primitives. Deliberately small -- layout lives in the routes. */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'text-[var(--accent-text)] bg-[var(--accent)] border-transparent',
  secondary: 'bg-[var(--bg-raised)] border-[var(--border)] text-[var(--text)]',
  ghost: 'bg-transparent border-transparent text-[var(--text-muted)]',
  danger: 'bg-transparent border-[var(--wrong)] text-[var(--wrong)]',
};

/**
 * The button look, separated from the <button> element.
 *
 * A file picker has to be a <label> wrapping a hidden <input type="file">
 * -- that is the only markup iOS Safari opens the Files picker from -- and it
 * should be indistinguishable from the buttons beside it.
 */
export function buttonClasses(variant: Variant = 'primary', full = false, className = '') {
  return `inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`;
}

export function Button({
  variant = 'primary',
  full,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean }) {
  return (
    <button {...rest} className={buttonClasses(variant, full, className)}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface p-4 ${className}`}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="muted mt-1 text-sm">{sub}</p>}
    </header>
  );
}

export function BackLink({ to, label }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="muted -ml-1 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
    >
      <span aria-hidden>←</span> {label ?? sv.nav.back}
    </Link>
  );
}

const LEVEL_VAR: Record<Level, string> = {
  1: 'var(--color-level-1)',
  2: 'var(--color-level-2)',
  3: 'var(--color-level-3)',
};

export function levelColor(level: Level): string {
  return LEVEL_VAR[level];
}

export function LevelPill({ level }: { level: Level }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ background: LEVEL_VAR[level], color: 'oklch(0.2 0.02 265)' }}
    >
      {sv.level[level]}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  color,
}: {
  /** 0..1 */
  value: number;
  label?: string;
  color?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="muted">{label}</span>
          <span className="font-semibold tabular-nums">{pct} %</span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--bg-sunken)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ title, help, action }: { title: string; help?: string; action?: ReactNode }) {
  return (
    <div className="surface px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {help && <p className="muted mx-auto mt-2 max-w-sm text-sm">{help}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success';
  children: ReactNode;
}) {
  const tones = {
    info: 'bg-[var(--bg-sunken)] text-[var(--text)]',
    warn: 'bg-[var(--partial-bg)] text-[var(--text)]',
    error: 'bg-[var(--wrong-bg)] text-[var(--text)]',
    success: 'bg-[var(--correct-bg)] text-[var(--text)]',
  } as const;
  return <div className={`rounded-xl px-4 py-3 text-sm ${tones[tone]}`} role="status">{children}</div>;
}

/** Status chip used on the result and review screens. */
export function StatusChip({ status }: { status: 'correct' | 'partial' | 'incorrect' | 'ungraded' }) {
  if (status === 'ungraded') return null;
  const map = {
    correct: { label: sv.session.correct, bg: 'var(--correct-bg)', fg: 'var(--correct)' },
    partial: { label: sv.session.partial, bg: 'var(--partial-bg)', fg: 'var(--partial)' },
    incorrect: { label: sv.session.incorrect, bg: 'var(--wrong-bg)', fg: 'var(--wrong)' },
  } as const;
  const s = map[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
