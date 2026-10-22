import { useEffect, useState } from 'react';

// Reloj compartido para "hace X min": arranca con el instante del render y avanza en el cliente.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
