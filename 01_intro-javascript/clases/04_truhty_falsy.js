console.log("Truthy y Falsy");

// En JavaScript, TODOS los valores se pueden evaluar como true o false
// Esto es muy útil en condicionales


// ==== Valores FALSY (los 6 únicos) ====

// 1. false
if (false) {
  console.log("esto No se ejectuta");
} else {
  console.log("si se ejecuta");
}

// 2. El número 0
if (0) {
  console.log("no se ejecuta 0")
} else {
  console.log("0 es falsy");
}

// 3. String vacío ""
const emptyString = "";
if (emptyString) {
  console.log("Esto NO se ejecuta");
} else {
  console.log("String vacío '' es falsy");
}

// 4. null
if (null) {
  console.log("Esto NO se ejecuta: NULL")
} else {
  console.log("null es falsy")
}

// 5. undefined
const value1 = undefined;
const message1 = value1 ? "Existe el value1" : "No existe value1";
console.log(message1);

// 6. NaN (Not a Number)
if (NaN) {
  console.log("Esto no se ejecuta");
} else {
  console.log("NaN es falsy");
  console.log(typeof NaN);
}


// ==== Valores TRUTHY (todo lo demás) ====

// Cualquier número diferente de 0
if (42) {
  console.log("42 es truthy");
}

if (-5) {
  console.log("-5 es truthy");
}

// Cualquier string con contenido (incluso si parece vacío, con espacio)
const saludo = " ";
if (saludo) {
  console.log("Mi crush me ha saludado!");
}

if ("0") {
  console.log("0 en string es truthy");
}

// true (obvio)
if (true) {
  console.log("true es truthy");
}

// Caso práctico - Validación de usuario
let username = "";

if (username) {
  console.log(`Hola ${username}`);
} else {
  console.log("Por favor, introduzca username");
}

username = "Ana";
if (username) {
  console.log(`Hola ${username}`);
} else {
  console.log("Por favor, introduzca username");
}

// Caso práctico - Validación de edad
let age = 0;  // Imaginemos un bebé recién nacido

// INCORRECTO: 0 es falsy!
if (age) {
  console.log(`Tu edad es ${age}`);
} else {
  console.log("No hay edad"); // Esto se ejecuta incorrectamente
}

// CORRECTO: Comparación explícita
if (age !== undefined && age !== null) {
  console.log(`Tu edad es ${age}`);
} else {
  console.log("No hay edad");
}

// MÁS MODERNO: Nullish Coalescing Operator (??)
// Solo considera null y undefined como "vacíos"

const displayAge = age ?? "Age not provided";
console.log(displayAge);

const config1 = { timeout: 0 };
const config2 = { timeout: null };
const config3 = {};

// Con || (mal para 0 o "")
console.log("Con ||:", config1.timeout || 3000); // 3000 (0 es falsy)

// Con ?? (mejor)
console.log("Con ??:", config1.timeout ?? 3000); // 0 (solo null/undefined)
console.log("Con ??:", config2.timeout ?? 3000); // 3000
console.log("Con ??:", config3.timeout ?? 3000); // 3000


// Valores que confundend: string "false" y "0":

// String "false" vs boolean false
if ("false") {
  console.log(" El string 'false' es truthy");
}

if (false) {
  console.log("Esto NO se ejecuta");
} else {
  console.log(" El boolean false es falsy");
}

// String "0" vs número 0
if ("0") {
  console.log(" El string '0' es truthy");
}

if (0) {
  console.log("Esto NO se ejecuta");
} else {
  console.log(" El número 0 es falsy");
}

// ==== Negación con ! ====
let value = "";

// Comprobar si un valor es falsy
if (!value) {
  console.log("value está vacío o es falsy");
}

value = "Hello";

if (!value) {
  console.log("Esto NO se ejecuta");
} else {
  console.log("value tiene contenido");
}