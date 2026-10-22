import { isServer } from '@/lib/runtime';

let starting: Promise<void> | null = null;
let handlersModule: Promise<typeof import('./handlers')> | null = null;

// En el navegador ninguna petición sale antes de que el service worker de MSW esté activo.
export function ensureMocks(): Promise<void> {
  if (process.env.NEXT_PUBLIC_API_MOCKING !== 'true' || isServer) return Promise.resolve();
  starting ??= import('./browser').then((module) => module.startWorker());
  return starting;
}

// En el servidor de Next (SSR, sitemap) los handlers se resuelven directo, sin interceptar la red:
// así no dependen del orden en que Next y MSW parchean fetch ni se pierden con la recarga en caliente.
export async function mockResponse(request: Request): Promise<Response | undefined> {
  if (process.env.NEXT_PUBLIC_API_MOCKING !== 'true' || !isServer) return undefined;
  handlersModule ??= import('./handlers');
  const [{ handlers }, { getResponse }] = await Promise.all([handlersModule, import('msw')]);
  return getResponse(handlers, request);
}
