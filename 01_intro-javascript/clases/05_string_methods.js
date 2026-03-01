console.log("String Methods");

// length, includes, trim, tolowercase, touppercase, charat, indexof, slice, replace, chaining

// Vamos a usar principalmente esta cadena para algunos los ejemplos
let message = "  Hello Keepcoding!   ";
let course = "Introducción a Javascript";

console.log("Original:", message);
console.log("Curso:", course);

// ==== LENGTH: Longitud de un string ====
const messageLength = message.length;
console.log(messageLength);
console.log(course.length);

// ==== includes() - verificar si contiene texto ====
console.log(course.includes("Javascript"));

// Caso práctico - validar email
let testEmail = "user@keepcoding";
const tieneArroba = testEmail.includes("@");
const tienePunto = testEmail.includes(".");

if (tieneArroba && tienePunto) {
  console.log("Email válido");
} else {
  console.log('Email inválido');
}

// ==== TRIM - elimina espacios al inicio y al final ====
console.log(`Original: ${message}`);
console.log(`Trim: ${message.trim()}`);

// Caso práctico: limpiar input del usuario
let username = "   ana123   ";
console.log("Username sin limpiar:", `"${username}"`);
console.log("Username limpio:", `"${username.trim()}"`);

// ==== toLowerCase -> convertir a minúsculas ====
console.log(message.toLowerCase());

const messageClean1 = message.trim().toLowerCase();
console.log(messageClean1);

// ==== toUpperCase -> convierte a mayúsculas ====
const userInput = "keepcoding";
const correctAnswer = "KeepCoding";

console.log(userInput.toUpperCase());

if (userInput.toUpperCase() === correctAnswer.toUpperCase()) {
  console.log("Las respuestas coinciden");
}

// ==== charAt() -> obtener un caracter en una posición dada ====
let text = "Javascript";
console.log("charAt(6):", text.charAt(6)); // r
console.log("charAt(0):", text.charAt(0)); // J

// ==== indexOf -> buscar la posición de un caracter ====
console.log("En course, buscamos Javascript:", course.indexOf("Javascript"));
console.log(course.indexOf("Python"));

// Caso práctico: verificar si existe un texto
if (course.indexOf("Javascript") !== -1) {
  console.log("Este curso es de JS");
}


// ==== slice() -> Extraer parte de un string ====

// let course = "Introducción a Javascript";
console.log("slice(0,12):", course.slice(0, 12)); // Introducción
console.log("slice 15", course.slice(15)); // Javascript
console.log("slice -10", course.slice(-10)); // -> desde el final

// Caso práctico, extraer un nombre de usuario de un email:
let email = "italo@keepcoding.io";

let userName = email.slice(0, email.indexOf("@"));
console.log(userName);


// ==== replace() -> reemplaza la PRIMERA ocurrencia ====
let greeting = "Hello World";
console.log(greeting);

const greetingReplace = greeting.replace("World", "Keepcoding");
console.log(greetingReplace);

const repeated = "hello hello hello";
console.log(repeated.replace("hello", "hi"));

// Para reemplazar todas las ocurrencias usamos replaceAll()
console.log(repeated.replaceAll("hello", "hi"));


// ==== Encadenar métodos: ====
let result = "  Javascript es alucinante!  "
  .trim()
  .toUpperCase()
  .replace("ALUCINANTE", "LA HOSTIA");

console.log(result);

// Método para pasar number strings a number
const parseAge = parseInt("36");
console.log(parseAge);


// También se puede parsear a número asi:
// const parseAge = Number(promptAge ?? 0);
// const parseAge = +promptAge ?? 0;


// ============================================
// ERRORES COMUNES
// ============================================

// ERROR 1: Olvidar que los strings son inmutables
let original = "hello";
original.toUpperCase();
console.log("original después de toUpperCase():", original); // Sigue siendo "hello"

// CORRECTO: Asignar el resultado
let upper = original.toUpperCase();
console.log("upper:", upper); // "HELLO"

// ERROR 2: Confundir indexOf con includes
let phrase = "Learning JavaScript";
// indexOf retorna número, no boolean
if (phrase.indexOf("Java")) { // Esto siempre es true (retorna 9)
  console.log("Esto SIEMPRE se ejecuta (indexOf retorna 9, que es truthy)");
}

// CORRECTO
if (phrase.indexOf("Java") !== -1) {
  console.log("Forma correcta con indexOf");
}

// O mejor aún
if (phrase.includes("Java")) {
  console.log("Forma más clara con includes");
}

// EJERCICIO PARA EL FINDE
// === Conversor y analizador de texto

console.log("\nEJERCICIO CASA - Analizador de texto");

let texto = "   Me gusta aprender JavaScript cada día   ";

// 1. Eliminar espacios
// let textoLimpio = // COMPLETAR

// console.log("Texto limpio:", textoLimpio);

// 2. Mostrar en mayúsculas
// COMPLETAR

// 3. Mostrar en minúsculas
// COMPLETAR

// 4. ¿Contiene la palabra "javascript"?
// COMPLETAR

// 5️. Mostrar los primeros 5 caracteres
// COMPLETAR

// 6️. Tiene más de 20 caracteres?
// COMPLETAR

// ==== SOLUCIÓN ====

// Eliminar espacios
let textoLimpio = texto.trim();

console.log("Texto limpio:", textoLimpio);

// Mayúsculas
console.log("Mayúsculas:", textoLimpio.toUpperCase());

// Minúsculas
console.log("Minúsculas:", textoLimpio.toLowerCase());

//  Contiene "javascript"
if (textoLimpio.toLowerCase().includes("javascript")) {
  console.log("✅ El texto contiene la palabra 'javascript'");
} else {
  console.log("❌ El texto no contiene la palabra 'javascript'");
}

//  Primeros 5 caracteres
console.log("Primeros 5 caracteres:", textoLimpio.slice(0, 5));

//  Longitud mayor de 20
if (textoLimpio.length > 20) {
  console.log("El texto tiene más de 20 caracteres");
} else {
  console.log("El texto tiene 20 caracteres o menos");
}
