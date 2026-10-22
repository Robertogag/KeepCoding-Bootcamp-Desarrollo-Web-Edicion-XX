import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { routing } from './routing';

export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
    // Las fechas de planta se formatean con Intl en la zona de cada planta; esto solo evita
    // diferencias servidor/cliente en los pocos textos con fecha de next-intl.
    timeZone: 'UTC',
  };
});
