// El servidor de Next también define `window`, así que la pregunta correcta es si corre en Node.
export const isServer =
  typeof process !== 'undefined' &&
  typeof process.versions === 'object' &&
  typeof process.versions?.node === 'string';
