console.log(" === 02. OPERADORES === ");

/*
Los OPERADORES son símbolos que nos permiten realizar operaciones
con valores y variables.

ANALOGÍA:
Son como las teclas de una calculadora:
+ = sumar
- = restar
* = multiplicar
/ = dividir

Pero JavaScript tiene MUCHOS más operadores que una calculadora.

TIPOS DE OPERADORES:
1. Aritméticos (+, -, *, /, %, **)
2. Asignación (=, +=, -=, *=, /=)
3. Comparación (==, ===, !=, !==, >, <, >=, <=)
4. Lógicos (&&, ||, !)
*/


// Operadires aritméticos

// realizamos operaciones matemáticas básicas

// SUMA (+)
const suma = 5 + 3;
console.log(suma); // 8

const precio1 = 100;
const precio2 = 5;
const total = precio1 + precio2;
console.log("total:", total); // 105

// RESTA (-)
const resta = 10 - 4;
console.log(resta); // 6

const saldo = 1000;
const gasto = 2500;
const saldoRestante = saldo - gasto;
console.log("saldoRestante:", saldoRestante);

// MULTIPLICACIÓN (*)
const multiplicacion = 5 * 4;
console.log(multiplicacion); // 20

// DIVISIÓN (/)
const division = 20 / 4;
console.log(division); // 5

// MÓDULO (%) - Resto de la división
const modulo = 10 % 3;
console.log("10 % 3 = ", modulo); // 1 (10 dividido 3 da 3, sobra 1)

// Caso práctico: ¿Es par o impar?
const numero = 17;
const esPar = numero % 2 === 0;
console.log("¿17 es par?:", esPar); // false

// potencia
const potencia = 2 ** 3;
console.log("2 ** 3 =", potencia); // 8 (2 x 2 x 2)

/**
 * orden (de mayor a menor prioridad)
 * 1. Paréntesis ()
 * 2. Potencias **
 * 3. Multiplicación, división, módulo
 * 4. sumas y restas
 */


// ============================================
// OPERADORES DE ASIGNACION

// ASIGNACIÓN SIMPLE (=)
let x = 10;

// ASIGNACIÓN CON SUMA (+=)
let puntos = 100;
console.log(puntos);

puntos += 50; // Equivalente a: puntos = puntos + 50
console.log("despues de += 50:", puntos);

// ASIGNACIÓN CON RESTA (-=)
let vidas = 5;
console.log(vidas);

vidas -= 2; // Equivalente a: vidas = vidas - 2
console.log("despues de -= 2:", vidas);

// ASIGNACIÓN CON MULTIPLICACIÓN (*=)
let valor = 10;
console.log("Valor inicial:", valor);

valor *= 3; // Equivalente a: valor = valor * 3
console.log("Después de *= 3:", valor); // 30

// ASIGNACIÓN CON DIVISIÓN (/=)
let cantidad2 = 100;
console.log("Cantidad inicial:", cantidad2);

cantidad2 /= 4; // Equivalente a: cantidad = cantidad / 4
console.log("Después de /= 4:", cantidad2); // 25

/*
CUÁNDO USAR:
  Usar += cuando acumulas valores (contadores, sumas)
  Usar -= cuando restas valores (vidas, stock)
  Usar *= cuando multiplicas (aplicar porcentajes)
  Usar /= cuando divides (repartir entre varios)
*/

// ============================================
// OPERADORES DE COMPARACIÓN


// IGUALDAD (==) - Compara valores (con conversión de tipos)
console.log("5 == 5:", 5 == 5);    // true
console.log("5 == 5:", 5 == "5"); // true (convierte tipos)
console.log(true == 1); // true

// IGUALDAD ESTRICTA (===) - Compara valores Y tipos
console.log("5 === 5:", 5 === 5);       // true
console.log("5 === '5':", 5 === "5");   // false (diferentes tipos)
console.log("true === 1:", true === 1); // false


/*
IMPORTANTE:
SIEMPRE usa === (triple igual) en lugar de == (doble igual)
Evita errores por conversión automática de tipos
*/

// DESIGUALDAD (!=) y (!==)
console.log(5 != 3); // true
console.log("5 != '5':", 5 != "5");     // false (convierte)

// estricto
console.log(5 !== "5"); // true -> usa este mejor

// MAYOR QUE (>)
console.log("10 > 5:", 10 > 5);         // true
console.log("5 > 10:", 5 > 10);         // false
console.log("5 > 5:", 5 > 5);           // false

// MENOR QUE (<)
console.log("3 < 8:", 3 < 8);           // true
console.log("8 < 3:", 8 < 3);           // false

// MAYOR O IGUAL (>=)
console.log("10 >= 10:", 10 >= 10);     // true
console.log("10 >= 5:", 10 >= 5);       // true
console.log("5 >= 10:", 5 >= 10);       // false

// MENOR O IGUAL (<=)
console.log("5 <= 5:", 5 <= 5);         // true
console.log("3 <= 5:", 3 <= 5);         // true
console.log("8 <= 5:", 8 <= 5);         // false


// CASO PRÁCTICO
const edadUsuario = 17;
const esMayor = edadUsuario >= 18;

console.log(`Edad ${edadUsuario} es mayor de edad??:`, esMayor);

// console.clear();


// ============================================
// OPERADORES LÓGICOS
// AND (&&) y OR (||)

// AND -> todas las condiciones deben ser verdaderas

console.log(true && true && true); // true
console.log(true && false);   // false
console.log(false && false); // false

const tieneEdad = true;
const tienePermiso = true;
const puedeEntrar = tieneEdad && tienePermiso;
console.log("Puede entrar?", puedeEntrar); // true

// OR -> una de ellas es verdadera
console.log(true || true); //true
console.log(true || false); // true
console.log(false || false); // false

const esAdmin = false;
const esModerador = true;
const esUser = false;
const tieneAcceso = esAdmin || esModerador || esUser;
console.log("Tiene acceso?", tieneAcceso); // true

// NOT (!) -> invertir el valor de boolean
console.log("!true", !true); // false
console.log("!falso", !false); // true

const estaLogueado = false;
const noEstaLogueado = !estaLogueado;
console.log("El usuario está logueado?", noEstaLogueado); // true

// Operador de negación
// !valor -> lo convierte en boolean y lo niega
// !!valor -> lo convierte a booleano sin negarlo

// COMBINACIONES
const edad3 = 17;
const tieneLicencia = true;
const puedeConducir = (edad3 >= 18) && tieneLicencia;
console.log("Puede conducir?", puedeConducir); // false

const esEstudiante = true;
const esTrabajador = false;
const tieneDescuento = esEstudiante || esTrabajador;
console.log("¿Tiene descuento?:", tieneDescuento); // true

// Operador incremento y decremento
console.clear();
let contador = 0;
console.log("contador", contador);

contador++;
contador++;
contador++;
console.log("contador incremento 1", contador);

// decremento
let vidas2 = 5;
console.log("vidas: ", vidas2);

vidas2--;
console.log("vidas decremento 1", vidas2);

// delante o después:
let a = 5;
console.log("a++", a++); // 5 (muestra el valor, y luego lo incremente)
console.log("a++", a); // 6

let b = 5;
console.log("++b", ++b); 
console.log("b final:", b);