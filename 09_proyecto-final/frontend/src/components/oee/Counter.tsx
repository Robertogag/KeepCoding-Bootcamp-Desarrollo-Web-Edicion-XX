interface CounterProps {
  label: string;
  value: string;
  unit?: string;
  className?: string;
}

export function Counter({ label, value, unit, className }: CounterProps) {
  return (
    <div className={className}>
      <dt className="eyebrow">{label}</dt>
      <dd className="numeric mt-1 text-2xl leading-none">
        {value}
        {unit ? <span className="ml-1 text-sm text-muted">{unit}</span> : null}
      </dd>
    </div>
  );
}
