import { useLocale } from 'next-intl';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { oeeLevel } from '@/lib/oee-level';

const levelStroke = { good: 'var(--running)', warn: 'var(--idle)', bad: 'var(--down)' } as const;
const levelText = { good: 'text-running', warn: 'text-idle', bad: 'text-down' } as const;

interface OeeGaugeProps {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}

// Anillo de OEE liso: el arco llena en proporción y toma el color del semáforo, sin halo ni filtros.
export function OeeGauge({ value, size = 84, stroke = 8, label, className }: OeeGaugeProps) {
  const locale = useLocale();
  const level = oeeLevel(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, value));
  const dash = circumference * ratio;
  const color = level ? levelStroke[level] : 'var(--line-strong)';
  const center = size / 2;
  const arc = {
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeDasharray: `${dash} ${circumference - dash}`,
    transform: `rotate(-90 ${center} ${center})`,
  };
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'OEE'} ${formatPercent(value, locale)}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="block overflow-visible"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--line-strong)"
          strokeOpacity={0.6}
          strokeWidth={stroke}
        />
        {ratio > 0 ? <circle {...arc} stroke={color} strokeWidth={stroke} /> : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className={cn('numeric font-extrabold', level ? levelText[level] : 'text-muted')}
          style={{ fontSize: Math.round(size * 0.25) }}
        >
          {formatPercent(value, locale)}
        </span>
        {label ? (
          <span
            className="eyebrow mt-0.5"
            style={{ fontSize: Math.max(8, Math.round(size * 0.11)) }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
