export function greet(name) {
  return `Hola, ${name}!`;
}

export function sum(a, b) {
  return a + b;
}

export default function formatCurrency(amount) {
  return `${amount.toFixed(2)} €`;
}