console.log("ESTRUCTURAS DE CONTROL");


// ============================================
// SENTENCIAS CONDICIONALES - IF/ELSE
// ============================================

// Las estructuras condicionales nos permiten ejecutar código SOLO si se cumple una condición

// IF simple:

const temperatura = 30;
if (temperatura > 25) {
  console.log("Hace calor!");
}

const esAdulto = true;
if (esAdulto) {
  console.log("Eres adulto");
}

// bifurcar IF...ELSE, es decir, o una cosa u otra
const edad = 16;

if (edad >= 18) {
  console.log("Puedes entrar");
} else {
  console.log("NO puedes entrar aquí, bye");
}

// If sin llaves
const miEdad = 22;

if (miEdad >= 18)
  console.log("Puedes entrar ahora"); // Esto es como ponerlo todo en una línea.

console.log("Bienvenido!");

// Imprime "Bienvenido!" porque el primer console.log es parte del if, el segundo no, aunque no estén implícitas las llaves, por eso es importante usarlas como forma del BLOQUE de código

// Aquí ya podemos ver ejemplo de lógica de negocio
const nombreProducto1 = "T-Shirt";
const precioProducto1 = 50;
let cantidadProducto1 = 2;

const nombreProducto2 = "Jeans";
const precioProducto2 = 40;
let cantidadProducto2 = 1;

const totalDespuesDeDescuento = 45;

if (totalDespuesDeDescuento > 50) {
  console.log("Tienes envío gratis");
} else {
  console.log("Costes de envío aplicados");
}

// Podemos usarlo para reasignar variables:
let mensaje;
if (precioProducto1 < precioProducto2) {
  mensaje = "Producto T-shirt tiene mejor precio que Jeans"
} else {
  mensaje = `Producto ${nombreProducto1} es más caro que ${nombreProducto2}`
}
console.log(mensaje);

// ==== ENCADENAMIENTO DE CONDICIONES ====
// If....else if .... else
// En este caso el orden importa, y la primera condición que se ejecuta gana.

const nota = 60;

if (nota >= 90) {
  console.log("Sobresaliente!");
} else if (nota >= 70) {
  console.log("Notable");
} else if (nota >= 50) {
  console.log("Aprobado");
} else {
  console.log("Suspendido");
}

let mensaje2;
const score = 95;
if (score >= 90) {
  mensaje2 = "Excelente";
} else if (score >= 70) {
  mensaje2 = "Bien";
} else {
  mensaje2 = "Necesitas mejorar";
}

console.log(mensaje2);


// ==== Hoisting ====
/**
 * La palabra hoisting significa literalmente:

Elevar o "izar hacia arriba"

En JavaScript significa que:

El motor mueve las declaraciones al principio del archivo antes de ejecutar el código.

Importante:
No mueve el código físicamente.
Lo que mueve es la declaración internamente.
 */

// var:
console.log(userName);
var userName = "Alicia";

// con let
// console.log(userAge);
// let userAge = 30;


// CONDICIONES COMBINADAS:

const edad5 = 25;
const tieneLicencia = false;
const puedeConducir = edad5 >= 18 && tieneLicencia;

if (puedeConducir) {
  console.log("Puedes conducir");
} else {
  console.log("No puedes conducir");
}


// CASO PRÁCTICO: Sistema de descuentos
const precioOriginal = 100;
const esEstudiante = false;
const esMiembro = true;

let precioFinal = precioOriginal;

if (esEstudiante) {
  precioFinal = precioOriginal * 0.8;
  console.log("Descuendo de estudiante aplicado");
} else if (esMiembro) {
  precioFinal = precioOriginal * 0.2;
  console.log("Descuendo miembro aplicado");
}

console.log(`Precio original: ${precioOriginal} €`);
console.log(`Precio final: ${precioFinal} €`);


console.log("\nEJERCICIO 2 - Par o Impar:");
const numero2 = 20;

if (numero2 % 2 === 0) {
  console.log(`El número ${numero2} es par`)
} else {
  console.log(`El número ${numero2} es impar`)
}


// ==== OPERADOR TERNARIO ====
/*
Forma abreviada de if/else para asignaciones simples

SINTAXIS:
condición ? valorSiTrue : valorSiFalse
*/

// () ? "" : ""; equivale a if...else


const edad3 = 20;

const mensaje3 = edad3 >= 18 ? "Mayor de edad" : "Menor de edad";
console.log(mensaje3);

// Equivalente con if/else:
let mensaje4;
if (edad3 >= 18) {
  mensaje4 = "Mayor de edad";
} else {
  mensaje4 = "Menor de edad";
}
console.log(mensaje4);

// Caso práctico
const puntos2 = 50;
const estado = puntos2 >= 100 ? "VIP" : "Regular";
console.log("Estado del cliente:", estado);

let isLoggedIn;
const mensajeHome = isLoggedIn ? "Welcome back" : "Please login";
console.log(mensajeHome);


// Encadenar operadores ternarios, si hay muchos puede dificultar la lectura:

let isAdmin = true;

const mensajeHome2 = isLoggedIn && isAdmin
  ? "Admin Panel"
  : isLoggedIn
    ? "User panel"
    : "Login";

console.log(mensajeHome2);


// Otro caso práctico:
// Nos vamos o no a Disney
const tenerVacaciones = false;
const suficienteDinero = false;
const hijaGustaDisney = false;

let mensajeFamilia;

if (tenerVacaciones && suficienteDinero && hijaGustaDisney) {
  mensajeFamilia = "Nos vamos a Disney!";
} else if (tenerVacaciones && suficienteDinero) {
  mensajeFamilia = "Vamos a Murcia";
} else {
  mensajeFamilia = "No podemos ir a Disney AÚN ni a MURCIA";
}

console.log(mensajeFamilia);

console.clear();


// ==== SWITCH ====
/*
Switch es útil cuando tienes MUCHAS opciones para evaluar
*/


// Podemos tener varias condiciones encadenadas, pero podemos mejorar la legibilidad. Por ejemplo, si tenemos varias condiciones if...else encadenadas:

const role = "editor";

if (role === "admin") {
  console.log("Full acces IF");
} else if (role === "editor") {
  console.log("Edit acces IF")
} else if (role === "viewer") {
  console.log("Read access IF")
} else {
  console.log("No access");
}

// REFACTOR con Switch ...case ...default
// Y VALIDA VALOR Y TIPO:

switch (role) {
  case "admin":
    console.log("Full acces SWITCH");
    break;
  case "editor":
    console.log("Edit access SWITCH");
    break;
  case "viewer":
    console.log("Read access SWITCH");
    break;
  default:
    console.log("No access SWITCH");
}

// Otro ejemplo:
const dia = 5;

let diaDeLaSemana;

switch (dia) {
  case 1:
    diaDeLaSemana = "Lunes";
    break;
  case 2:
    diaDeLaSemana = "Martes";
    break;
  case 3:
    diaDeLaSemana = "Miércoles";
    break;
  case 4:
    diaDeLaSemana = "Jueves";
    break;
  case 5:
    diaDeLaSemana = "Viernes";
    break;
  case 6:
  case 7:
    diaDeLaSemana = "Fin de Semana!!!";
    break;
  default:
    diaDeLaSemana = "Día no válido";
}

console.log(diaDeLaSemana);


// Caso práctico calculadora:
const num1 = 10;
const num2 = 5;
const operacion = "-";

let resultado;
switch (operacion) {
  case "+":
    resultado = num1 + num2;
    break;
  case "-":
    resultado = num1 - num2;
    break;
  case "*":
    resultado = num1 * num2;
    break;
  case "/":
    resultado = num1 / num2;
    break;
  default:
    resultado = "Operación no válida";
}

console.log(resultado);


console.log("============");

/**
 * Dados los productos:
 *
 * Calcula el precio total de todos los productos sumando los subtotales de cada uno (precio * cantidad).
*/

const productAName = "T-shirt";
const productAPrice = 20;
const productAQuantity = 2;

const productBName = "Cap";
const productBPrice = 35;
const productBQuantity = 1;

const productCName = "Socks";
const productCPrice = 10;
const productCQuantity = 3;

/**

Usa una estructura condicional (if, else if, else) para mostrar un mensaje según el total:
Si el total es menor a 50, muestra "Puedes agregar más productos".
Si el total es entre 50 y 100, muestra "Estás cerca de tu límite de compra".
Si el total es mayor a 100, muestra "Has alcanzado el límite de tu compra".

Muestra el total y el mensaje en un único console.log.
*/

// Solución:
const subtotalA = productAPrice * productAQuantity
const subtotalB = productBPrice * productBQuantity
const subtotalC = productCPrice * productCQuantity

const total = subtotalA + subtotalB + subtotalC

if (total < 50) {
  message = "Puedes agregar más productos";
} else if (total >= 50 && total <= 100) {
  message = "Estás cerca de tu límite de compra";
} else {
  message = "Has alcanzado el límite de tu compra";
}
console.log("Total: " + total + " euros " + message);