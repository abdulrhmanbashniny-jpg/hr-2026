import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg' | 'icon';

/** DESIGN.md "Buttons": amber gradient for the one call to action, navy for confirmations, white for the rest. */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-container text-white shadow-sm hover:bg-primary hover:shadow-md',
  accent: 'amber-gradient text-primary-container font-semibold shadow-md hover:brightness-105',
  secondary: 'bg-surface-container-lowest text-primary-container border border-line shadow-xs hover:border-line-strong hover:bg-canvas',
  ghost: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
  danger: 'text-[#EF4444] hover:bg-[rgb(239_68_68/0.06)]',
  whatsapp: 'bg-whatsapp text-white shadow-sm hover:brightness-95 hover:shadow-md',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-label-md gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-label-lg gap-2 rounded-xl',
  lg: 'h-12 px-6 text-label-lg gap-2.5 rounded-xl max-sm:h-13',
  icon: 'h-10 w-10 rounded-xl',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'press inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button {...props} disabled={props.disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading ? <LoaderCircle className="size-[1.1em] animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link {...props} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </Link>
  );
}
