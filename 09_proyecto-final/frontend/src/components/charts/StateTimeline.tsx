'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { StateIndicator } from '@/components/status/StateIndicator';
import type { MachineEvent } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatDuration, formatTime } from '@/lib/format';
import { MACHINE_STATES, stateStyles } from '@/lib/machine-state';

interface StateTimelineProps {
  events: MachineEvent[];
  from: number;
  to: number;
  timeZone: string;
  onSelect?: (event: MachineEvent) => void;
}

interface Segment {
  event: MachineEvent;
  start: number;
  end: number;
}

interface Hover {
  index: number;
  left: number;
}

const HOUR = 3_600_000;
const TOOLTIP_HALF = 112;

// Línea de tiempo de estados: tooltip que sigue al cursor, resumen por estado y clic en cada tramo.
export function StateTimeline({ events, from, to, timeZone, onSelect }: StateTimelineProps) {
  const t = useTranslations('timeline');
  const te = useTranslations('events');
  const ts = useTranslations('machineState');
  const locale = useLocale();
  const barRef = useRef<HTMLOListElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const span = Math.max(1, to - from);

  const segments: Segment[] = events
    .map((event) => {
      const start = Math.max(new Date(event.started_at).getTime(), from);
      const end = Math.min(event.ended_at ? new Date(event.ended_at).getTime() : to, to);
      return { event, start, end };
    })
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  const totals = MACHINE_STATES.map((state) => ({
    state,
    seconds: segments
      .filter((segment) => segment.event.state === state)
      .reduce((sum, segment) => sum + (segment.end - segment.start) / 1000, 0),
  }));

  const ticks: number[] = [];
  for (let tick = Math.ceil(from / HOUR) * HOUR; tick <= to; tick += HOUR) ticks.push(tick);

  function place(index: number, x: number, width: number): Hover {
    return { index, left: Math.min(Math.max(x, TOOLTIP_HALF), Math.max(width - TOOLTIP_HALF, 0)) };
  }

  function locate(clientX: number) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const at = from + (x / rect.width) * span;
    const index = segments.findIndex((segment) => at >= segment.start && at < segment.end);
    setHover(index === -1 ? null : place(index, x, rect.width));
  }

  function focusSegment(index: number) {
    const bar = barRef.current;
    const segment = segments[index];
    if (!bar || !segment) return;
    const rect = bar.getBoundingClientRect();
    const center = ((segment.start + segment.end) / 2 - from) / span;
    setHover(place(index, center * rect.width, rect.width));
  }

  const active = hover ? segments[hover.index] : undefined;
  const reasonOf = (event: MachineEvent) =>
    event.reason ? (locale === 'en' ? event.reason.label_en : event.reason.label_es) : null;

  return (
    <figure className="panel p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">{t('title')}</span>
        <ul aria-label={t('legend')} className="flex flex-wrap gap-3">
          {MACHINE_STATES.map((state) => (
            <li key={state}>
              <StateIndicator state={state} size="sm" />
            </li>
          ))}
        </ul>
      </figcaption>

      {segments.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="relative mt-3">
          <ol
            ref={barRef}
            className="relative h-14 overflow-hidden rounded-md bg-panel-2 shadow-[inset_0_2px_6px_rgba(2,6,23,0.35)]"
            aria-label={t('title')}
            onMouseMove={(event) => locate(event.clientX)}
            onMouseLeave={() => setHover(null)}
          >
            {segments.map(({ event, start, end }, index) => {
              const label = t('segment', {
                state: ts(event.state),
                from: formatTime(start, timeZone, locale),
                to: formatTime(end, timeZone, locale),
                duration: formatDuration((end - start) / 1000),
              });
              return (
                <li
                  key={event.id}
                  className="absolute inset-y-0"
                  style={{
                    left: `${((start - from) / span) * 100}%`,
                    width: `${Math.max(((end - start) / span) * 100, 0.15)}%`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={label}
                    onFocus={() => focusSegment(index)}
                    onBlur={() => setHover(null)}
                    onClick={() => onSelect?.(event)}
                    className={cn(
                      'block h-full w-full border-r border-panel-solid/60 transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fg',
                      stateStyles[event.state].bar,
                      hover?.index === index ? 'brightness-125' : 'hover:brightness-110',
                      onSelect ? 'cursor-pointer' : 'cursor-default',
                    )}
                  />
                </li>
              );
            })}
          </ol>
          {active && hover ? (
            <div
              role="tooltip"
              className="panel pointer-events-none absolute bottom-full z-10 mb-2 w-56 -translate-x-1/2 px-3 py-2 text-xs"
              style={{ left: hover.left }}
            >
              <p
                className={cn(
                  'font-extrabold tracking-[0.06em] uppercase',
                  stateStyles[active.event.state].text,
                )}
              >
                {ts(active.event.state)}
              </p>
              <p className="numeric mt-0.5 text-fg">
                {formatTime(active.start, timeZone, locale)} –{' '}
                {formatTime(active.end, timeZone, locale)}
                <span className="text-muted">
                  {' '}
                  · {formatDuration((active.end - active.start) / 1000)}
                </span>
              </p>
              {active.event.state === 'DOWN' ? (
                <>
                  <p className="mt-0.5 text-muted">
                    {reasonOf(active.event) ??
                      (active.event.reason_code
                        ? te('alarmCode', { code: active.event.reason_code })
                        : te('noReason'))}
                    {active.event.comment ? ` · ${active.event.comment}` : ''}
                  </p>
                  {active.event.classified_by ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {te('classifiedBy', { user: active.event.classified_by.username })}
                    </p>
                  ) : null}
                </>
              ) : null}
              {onSelect && active.event.state === 'DOWN' ? (
                <p className="mt-1 text-[10px] font-bold tracking-[0.08em] text-accent-text uppercase">
                  {te('classify')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="relative mt-1 h-5 text-xs text-muted" aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="numeric absolute -translate-x-1/2"
                style={{ left: `${((tick - from) / span) * 100}%` }}
              >
                {formatTime(tick, timeZone, locale)}
              </span>
            ))}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <dt className="eyebrow self-center">{t('totals')}</dt>
            {totals.map((item) => (
              <div key={item.state} className="flex items-baseline gap-1.5">
                <dt className={cn('font-bold', stateStyles[item.state].text)}>{ts(item.state)}</dt>
                <dd className="numeric text-fg">{formatDuration(item.seconds)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </figure>
  );
}
