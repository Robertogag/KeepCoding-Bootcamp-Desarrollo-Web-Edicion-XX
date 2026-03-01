// ============================================
// CLASE 01 - INTRODUCCIÓN A JAVASCRIPT
// Variables y Tipos de Datos
// ============================================

/*
JavaScript es un lenguaje de programación que permite dar vida 
e interactividad a las páginas web.

LOS TRES PILARES DEL DESARROLLO WEB:

┌─────────────────────────────────────────┐
│  HTML  →  Estructura (los huesos)       │
│  CSS   →  Estilos (la piel y la ropa)   │
│  JS    →  Interactividad (el cerebro)   │
└─────────────────────────────────────────┘

CARACTERÍSTICAS:
- Lenguaje interpretado (se ejecuta directamente)
- Orientado a eventos (reacciona a acciones del usuario)
- Dinámico y flexible
- Multiplataforma (funciona en cualquier navegador)

¿QUÉ PUEDES HACER CON JAVASCRIPT?
- Validar formularios
- Crear animaciones
- Mostrar/ocultar contenido
- Hacer peticiones a servidores (APIs)
- Crear aplicaciones web completas
- Y mucho más...

IMPORTANTE: JavaScript ≠ Java (son lenguajes diferentes)
*/

console.log(" === 01. VARIABLES Y TIPOS DE DATOS ===");

/*
Una VARIABLE es como una "caja" donde guardamos información.
*/

// Declarar una variable (crear la caja)
let nombre;

// Asignar un valor (meter algo en la caja
nombre = "Ana";

// Declarar y asignar en una línea
let apellido = "García";

// Mostrar el valor
console.log(nombre);
console.log(apellido);
console.log(nombre, apellido);

// let, const, var

// LET - Variable que PUEDE cambiar
let edad = 25;
console.log("Edad inicial:", edad);

edad = 26; // Puedo cambiarla
console.log("Edad después de cumpleaños:", edad);

// CONST - Variable que NO puede cambiar (constante)
const edad2 = 36;
console.log("Valor edad2:", edad2);
// edad2 = 37; // ERROR: No puedo cambiar una constante

// VAR - forma antigua no recomendada
var ciudad = "Madrid";
console.log(ciudad);

/*
¿CUÁNDO USAR CADA UNA?

USA CONST por defecto (si el valor NO va a cambiar)
- Nombres de personas
- Configuraciones fijas
- URLs de APIs
- Valores matemáticos (PI)

USA LET cuando el valor PUEDE cambiar
- Contadores
- Acumuladores
- Variables de control en bucles

NO USES VAR (es la forma antigua, tiene problemas a la hora de posicionarse en el código -> "Hoisting")
*/

// ============================================
// Reglas para nombras variables

let miNombre = "ítalo"; // camelCase
let mi_nombre = "carlos"; // snake_case
let nombre3 = "María"; // con número (no al inicio)
let _privado = "secreto"; // guion al inicio
let $precio = 23; // con signo dólar

/*
EJEMPLOS INVÁLIDOS:
let 2nombre = "error"; // empieza con número
let mi-nombre = "error"; // guion no permitido
const let = "error"; // palabra reservada
*/

// las variables de tipo CONST NO SE RE-DECLARAR
const modulo = "Intro JS";
// modulo = "React" -> error
const modulo3 = "HTML y CSS";

console.log(modulo);
console.log(modulo3);


/*
BUENAS PRÁCTICAS (convenciones):

1. USA camelCase (primera palabra minúscula, siguientes con mayúscula)
  nombreCompleto, edadUsuario, precioTotal

2. Nombres descriptivos (que se entienda qué guardan)
  precioProducto (claro)
  p (¿qué es p?)
   
3. Constantes en MAYÚSCULAS
  const MAX_INTENTOS = 3;
  const API_URL = "https://api.com";
*/

const nombreUsuario = "Kevin";
const edadUsuario = 25;
const emailUsuario = "kevin@email.com";
const estaActivo = true;

console.log("Usuario: ", nombreUsuario);
console.log("Edad:", edadUsuario);
console.log("Email:", emailUsuario);

const userName = "Kevin", userAge = 24, userEmail = "kevin@email.com";

console.log("User email:", userEmail);
// console.clear();


// ============================================
// TIPOS DE DATOS PRIMITIVOS
// ============================================

/* 
1. Number (números)
2. String (texto)
3. Boolean (verdarero/falso)
4. Undefined (sin valor asignado)
5. Null (valor vacío intencional)
*/

// 1. Tipo Number
console.log("Tipo Number");

const entero = 42;
const decimal = 34.1;
const negativo = -7;
const big = 1000000;

console.log("entero:", entero);
console.log("decimal:", decimal);
console.log("negativo:", negativo);
console.log("big:", big);

// Valores especiales
const infinito = Infinity;
const noEsNumero = NaN;  // Not a Number

console.log("Infinito:", infinito);
console.log("NaN:", noEsNumero);

// 2. Tipo String
const name1 = "Miriam"; // comillas dobles
const apellido2 = 'San Antonio'; // comillas simples
const frase = "Hola a todos mi nombre es Ítalo"; // espacios - frase
let stringVacio = ""; // string vacío

console.log(name1, apellido2, frase);

// Template literals y concatenación
const nombreCompleto = "Laura Martínez";
const edadPersona = 28;

// Concatenación de strings con el símbolo +
console.log("Hola mi nombre es " + nombreCompleto + "y tengo " + edadPersona + "años");

// Template literals (comillas invertidas)
const mensaje = `Hola 

mi nombre es ${nombreCompleto} y

tengo ${edadPersona} años`;

console.log(mensaje);

// 3. Tipo boolean
console.log("Boolean (verdaro/falso)");

const esVerdadero = true;
const esFalso = false;

const mayorDeEdad = true;
const tienePermiso = false;

console.log("Es mayor de edad?", mayorDeEdad);
console.log("tiene permiso para salir", tienePermiso);

// 4. Undefined
let sinValor;
console.log("Variable sin valor:", sinValor); // undefined

let otraVariable;
console.log("Otra sin valor:", otraVariable); // undefined

// 5. NULL
const valorNulo = null;
console.log("valor nulo:", valorNulo);

/*
DIFERENCIA ENTRE UNDEFINED Y NULL:

undefined = JavaScript dice "no sé qué valor tiene" (no has asignado nada)

null = Tú dices "sé que no tiene valor" (asignas vacío intencionalmente)
Es la ausencia de valor, una variable que existe, pero su contenido es nada
*/

// console.clear();

// ============================================
// TYPEOF - Conocer el tipo de dato
// ============================================

/*
El operador TYPEOF nos dice de qué tipo es un valor.

SINTAXIS:
typeof valor
typeof(valor)  // También funciona con paréntesis
*/

console.log("typeof 42:", typeof 42); // number
console.log("typeof 3.14:", typeof 3.14); //number
console.log("typeof hola:", typeof "hola"); // string
console.log("typeof true:", typeof true); // boolean
console.log("typeof undefined:", typeof undefined); // undefined
console.log("typeof null:", typeof null); // objeto (bug histórico)

let valueNull = null;
console.log(valueNull === null); // true
console.log(typeof valueNull === null); // false

// con variables
const miNumero = 100;
const miTexto = "Javascript";
const miBoolean = true;

console.log(typeof miNumero); // number
console.log(typeof miTexto); // string
console.log(typeof miBoolean); // boolean

// "Caso práctico"
// Validación de datos
const nombreInput = "Ana García";
const edadInput = 25;
const emailInput = "ana.garcia@email.com";
const onlineInput = true;

console.log("validando datos de usuario...");
console.log("Nombre es texto?", typeof nombreInput === "string");
console.log("Edad es número?", typeof edadInput === "number");
console.log("está online?", typeof onlineInput === "boolean");


// Conversión de tipos

// String a number
const textoNumero = "42";
console.log(typeof textoNumero); //string

const numero = Number(textoNumero);
console.log(typeof numero);

// Number a String
const valor = 100;
console.log("valor:", typeof valor);

const valorTexto = String(100);
console.log("valorTexto:", typeof valorTexto);

// conversión automática
console.log(" '5' + 3: ", "5" + 3); // "53" (concatena)
console.log(" '5' + 3: ", "5" - 3); // 2 (5 lo convierte a número)
console.log(" '5' * 2: ", "5" * 2);           // 10 (convierte a número)
