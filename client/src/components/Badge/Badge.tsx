import type { BadgeVariant } from '@/types';
import './Badge.css';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'accent' }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {label}
    </span>
  );
}
