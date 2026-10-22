import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const next = fileURLToPath(new URL('../frontend/node_modules/next/dist/bin/next', import.meta.url));
const address = 'http://localhost:3000/es';

function listening() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: 'localhost', port: 3000 });
    const finish = (connected) => {
      socket.destroy();
      resolve(connected);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1500, () => finish(false));
  });
}

if (await listening()) {
  let running = false;
  try {
    const response = await fetch(address, { signal: AbortSignal.timeout(15000) });
    running = response.ok && /<title>[^<]*OEE Live/i.test(await response.text());
  } catch {
    // No se inicia otro servidor sobre un puerto ocupado.
  }
  if (running) {
    console.log(`OEE Live ya está en ejecución. Abre ${address}`);
  } else {
    console.error('El puerto 3000 está ocupado. Revisa el proceso antes de iniciar OEE Live.');
    process.exitCode = 1;
  }
} else if (!existsSync(next)) {
  console.error('Faltan las dependencias del frontend. Ejecuta: pnpm --dir frontend install');
  process.exitCode = 1;
} else {
  console.log(`Iniciando OEE Live en ${address}`);
  const child = spawn(process.execPath, [next, 'dev', '--port', '3000'], {
    cwd: frontend,
    stdio: 'inherit',
  });
  child.once('error', (error) => {
    console.error(`No se pudo iniciar el frontend: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
}
