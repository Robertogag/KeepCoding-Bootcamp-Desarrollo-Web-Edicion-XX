// Solo se vuelve a rutas internas sin prefijo de idioma; cualquier otra cosa manda al panel.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/app';
  return next.replace(/^\/(es|en)(?=\/|$)/, '') || '/app';
}
