console.log("Funciones");

// ============================================
// FUNCIONES EN JAVASCRIPT
// ============================================


// Declaración de funciones
/*
  function nombreDeFunción(){
  // Código...
  }
 */

// CASO PRÁCTICO: Sistema de saludos en una app
function saludo() {
  console.log("Hola y bienvenido a Keepcoding");
}

saludo(); // Mostrar mensaje de bienvenida cuando el usuario entra

// En una app real, esto se ejecutaría cuando:
// - El usuario inicia sesión
// - Se carga la página principal
// - Se abre un modal de bienvenida



// ============================================
// 2. PARÁMETROS Y ARGUMENTOS
// ============================================


// CASO PRÁCTICO: Personalizar mensajes de bienvenida
function saludarUsuario(nombre) {
  console.log(`Hola, ${nombre}, bienvenido!!`);
}

saludarUsuario("Alicia");
saludarUsuario("Zoe");
saludarUsuario("Guille");

// CASO PRÁCTICO: Calcular precio con descuento
function calcularDescuento(precio, descuento) {

  if (descuento === 100) {
    console.log("Enhorabuena, este producto es gratis");
    return;
  }

  const precioFinal = precio - (precio * descuento / 100);

  console.log(`Precio original: ${precio} €. Descuento: ${descuento} %. Precio final: ${precioFinal} €`);
}

calcularDescuento(100, 10);
calcularDescuento(100, 25);
calcularDescuento(95, 100);



// ============================================
// 3. RETURN - Devolver valores
// ============================================

// MAL: Solo muestra, no podemos usar el resultado
function mostrarTotal(precio, cantidad) {
  console.log(precio * cantidad);
}

mostrarTotal(10, 3); // Muestra 30

let invoice1 = mostrarTotal(10, 3); // Muestra 30, pero invoice1 es undefined
console.log("invoice1", invoice1); // undefined - No podemos hacer nada con esto


// BIEN: Retorna el valor para poder usarlo
function calcularTotal(precio, cantidad) {
  return precio * cantidad;
}

let invoice2 = calcularTotal(10, 3);
console.log("invoice2", invoice2); // 30

// Ahora podemos usar el resultado en operaciones más complejas
let subtotal = calcularTotal(10, 3);
let tax = subtotal * 0.21;
let total = subtotal + tax;

console.log(`Subtotal: ${subtotal} €. Tax: ${tax.toFixed(2)}. Total: ${total.toFixed(2)}`);


// CASO PRÁCTICO: Sistema de autenticación
// comprobar que la contraseña tenga longitud mínima 8 caracteres, tenga números del 0 al 9, que contenga mayúscula

function comprobarPassword(password) {

  // 1. verificar que tiene longitud mínima 8 caracteres
  if (password.length < 8) {
    return "Contraseña muy corta!";
  }

  let hasNumber = false;
  if (password.includes("0") || password.includes("1") || password.includes("2") || password.includes("3") || password.includes("4") || password.includes("5") || password.includes("6") || password.includes("7") || password.includes("8") || password.includes("9")) {
    hasNumber = true;
  }

  if (!hasNumber) {
    return "La contraseña debe tener un número al menos";
  }

  // 3. Verificar si contine mayúsculas
  // Truco: si el password es diferente a su versión en minúsculas, significa que tiene al menos una mayúscula
  const hasUpperCase = password !== password.toLowerCase();

  if (!hasUpperCase) {
    return "Contraseña debe tener al menos una mayúscula";
  }

  return "Contraseña es válida";
}

console.log(comprobarPassword("abc"));
console.log(comprobarPassword("aabcdefghc"));
console.log(comprobarPassword("abcdefgh1"));
console.log(comprobarPassword("Abcdefgh1"));


// Return vacío:
/*
Un "return vacío" es simplemente:

return;

Sin devolver ningún valor.

Sirve para:
- Salir inmediatamente de la función.
- Detener su ejecución.
*/

// Early return: salida temprana de una función
function ejemploVacio() {
  console.log("Paso 1");

  return;
  console.log("Paso 2"); // Nunca se ejecuta
}

ejemploVacio();

// Esto evita realizar else innecesarios
function validarEdad(edad) {
  if (edad < 18) {
    console.log("Eres menor de edad");
    return; // Salimos inmediatamente
  }

  console.log("Puedes continuar");
}

validarEdad(15);
validarEdad(25);

// para evitar if encadenados: Se trata de una salida temprana (early return) de una función
function procesarPago(cantidad) {

  let mensaje;

  if (cantidad <= 0) {
    mensaje = "Cantidad inválida";
    return mensaje; // Cortamos ejecución
  }

  if (cantidad > 1000) {
    mensaje = "No puedo procesar tanto dinero";
    return mensaje;
  }

  return mensaje = `Procesando pago de ${cantidad} €`;
}

console.log(procesarPago(0));
console.log(procesarPago(3000));
console.log(procesarPago(400));

// Es más limpio
// Reduce anidaciones if...else if...else if...else
// Hace el código más legible

console.clear();


// ============================================
// 4. SCOPE (ÁMBITO)
// ============================================

// CASO PRÁCTICO: Configuración global de una app
let appName = "Plataforma Keepcoding";
let maxLoginAttempts = 3;

function showAppInfo() {
  console.log(`App Name: ${appName}`);
  console.log(`Max login attempts: ${maxLoginAttempts}`);
}

showAppInfo();

// CASO PRÁCTICO: Contador de intentos de login (variable local)
function validarLogin(username, password) {
  let attempts = 0; // Variable LOCAL - cada ejecución tiene su propio contador (pasar arriba para que s vea el efecto), luego volver a pasar aqui para hacer el ejemplo de abajo
  let correctPassword = "secret123";

  attempts++;

  if (password === correctPassword) {
    return `Welcome ${username}! (Attempt ${attempts})`;
  } else {
    return `Wrong password (Attempt ${attempts})`;
  }
}

console.log("\nLogin attempts:");
console.log(validarLogin("Ana", "wrong"));     // Attempt 1
console.log(validarLogin("Ana", "wrong2"));    // Attempt 1 (se reinicia!)
console.log(validarLogin("Ana", "secret123")); // Attempt 1 (se reinicia!)


// ⚠️ PROBLEMA: attempts se reinicia cada vez
// Solución: usar una variable global o closure (lo veremos después)

// CASO PRÁCTICO: Contador global persistente
let sessionAttempts = 0;

function validarLoginGlobal(username, password) {
  let correctPassword = "secret123";

  sessionAttempts++; // Modifica la variable GLOBAL

  // Esto se llama early return:
  if (sessionAttempts > maxLoginAttempts) {
    return "Account locked - too many attempts";
  }

  if (password === correctPassword) {
    return `Welcome ${username}! (Total attempts: ${sessionAttempts})`;
  } else {
    return `Wrong password (Attempt ${sessionAttempts} of ${maxLoginAttempts})`;
  }
}
console.clear();


// ============================================
// 5. FUNCIONES FLECHA (Arrow Functions)
// ============================================

/*Las funciones flecha son una forma más moderna y corta
de escribir funciones en JavaScript.

Sintaxis básica:

(parametros) => {
  // código
}

Se introdujeron en ES6.
*/


function saludarTradicional(nombre) {
  return "Hola " + nombre;
}

console.log(saludarTradicional("Pepe"));

// quitamos la palabr function, añadimos =>, la guardamos normalmente en una variable.
// Función flecha equivalente
const saludarFlecha = nombre => {
  return "Hola " + nombre;
}

console.log(saludarFlecha("Juanito"));

// Los paréntesis son opcionales si solo hay un parámetro
const saludarSimple = nombre => {
  return "Hola " + nombre;
};

console.log(saludarSimple("Carlos"));


// Podemos quitar las llaves
// Y el return se hace automático (implícito)

const sumar = (a, b) => a + b;

console.log(sumar(5, 3));

// Sin parámetros, los paréntesis son OBLIGATORIOS
const mostrarMensaje = () => {
  console.log("Hola mundo");
};

mostrarMensaje();

// Validacion rápida
const esAdulto = age => age >= 18;

console.log("es adulto:", esAdulto(15));

const esEmailValido = (email) => email.includes("@") && email.includes(".");

console.log("email es válido", esEmailValido("test@email.com"));

const esVacio = string => string.trim().length === 0;

console.log("es vacio", esVacio("  "));


/*
========================================
EJERCICIO: Detectar errores en funciones flecha
Hay varios errores en este código.
Encuéntralos y corrígelos.
========================================
*/

// 1. Error con return implícito
const sumarError = (a, b) => a + b;

console.log("Suma:", sumarError(4, 6));


// 2. Error con paréntesis faltantes
const saludar = (nombre, apellido) => {
  return "Hola " + nombre + " " + apellido;
};

console.log(saludar("Ana", "López"));


// 3. Error llamando antes de definir

// Primero definimos
const multiplicar = (a, b) => a * b;

// Luego la usamos
console.log(multiplicar(3, 5));


/// Con funciones tradicionlas si funciona llamarla antes de declararla
console.log(dividir(10, 2));

function dividir(a, b) {
  return a / b;
}


// 4. Error lógico
const esPar = numero => {
  if (numero % 2 === 0) {
    return "Es par";
  } else {
    return "Es impar";
  }
};

console.log(esPar(4));

console.clear();


// ============================================
// 6. FUNCIONES COMO VALORES - Una función puede guardarse en una variable y como tal, podemos pasarla como parámetro a otra función
// ============================================

console.log("\n--- 6. FUNCIONES COMO VALORES ---");


// Función como parámetro:
const decirHola = () => {
  return "Hola";
};

console.log(decirHola);   // Muestra la función
console.log(decirHola()); // Ejecuta la función

// Entonces, esta función recibe otra, y la ejecuta:
function ejecutarAccion(accion) {
  accion();
}

const saludarParam = () => {
  console.log("Hola!");
};

const despedirParam = () => {
  console.log("Adiós!");
};

ejecutarAccion(saludarParam);
ejecutarAccion(despedirParam);

// También podemos pasarle parámetros:
function ejecutarOperacion(numero, operacion) {
  return operacion(numero);
}

const duplicar = numero => numero * 2;
const triplicar = numero => numero * 3;

console.log(ejecutarOperacion(5, duplicar));   // 10
console.log(ejecutarOperacion(5, triplicar));  // 15


// CASO PRÁCTICO: Sistema de notificaciones con diferentes tipos
const enviarEmail = mensaje => {
  console.log("Sending email:", mensaje);
};

const enviarSMS = mensaje => {
  console.log("Sending SMS:", mensaje);
};

function enviarNotificacion(tipo, mensaje) {

  if (tipo === "email") {
    enviarEmail(mensaje);
  } else if (tipo === "sms") {
    enviarSMS(mensaje);
  } else {
    console.log("❌ Unknown type");
  }
}


console.log("\nNotification system:");
enviarNotificacion("email", "Welcome to Keepcoding!");
enviarNotificacion("sms", "Your code is 1234");
enviarNotificacion("push", "New message received");

/*
========================================
IIFE (Immediately Invoked Function Expression)
========================================

IIFE significa:
Immediately Invoked Function Expression

Es una función que:
1. Se define
2/ Se ejecuta inmediatamente

Sintaxis básica:
(function() {
  // código
})();
*/

// No hace falta llamarla, se ejecuta en el momento que se define
(function () {
  console.log("Esta función se ejecuta automáticamente");
})();

(function (nombre) {
  console.log(`Hola ${nombre}`)
})("Augusto");

// Simular config inicial
const usuario = "Carlos";

(function (nombre) {

  console.log("Iniciando sesión para " + nombre);

  if (nombre === "Carlos") {
    console.log("acceso concedido")
  } else {
    console.log("Acceso denegado")
  }
})(usuario);

console.clear();


// EJERCICIO MINI-VALIDADOR RESERVA HOTEL
/*
Vamos a crear un sistema sencillo para validar una reserva de hotel.

Un cliente quiere reservar una habitación y debemos comprobar:

Su nombre

Número de noches

Precio por noche

Si tiene código de descuento
*/

// Nombre: validar que sea mayor de 3 caracteres y que no sea vacío
// Número de noches: mayor de 0
// Precio por noche: mayor de 0
// Código de descuento, si existe y es DESC10, aplicar un 10% descuento al precio total

const nombre = "Laura";
const noches = 3;
const precioPorNoche = 100;
const codigoDescuento = "DESC10";

function validarNombre(nombre) {
  return nombre.trim().length >= 3;
}

function validarNoches(noches) {
  return noches > 0;
}

function validarPrecio(precio) {
  return precio > 0;
}

function calcularTotalHotel(noches, precio) {
  return noches * precio;
}

function aplicarDescuento(total, codigo) {

  if (codigo === "DESC10") {
    return total * 0.9;
  }

  return total;
}

function procesarReserva(nombre, noches, precio, codigo) {

  if (!validarNombre(nombre)) {
    console.log("Nombre inválido");
    return;
  }

  if (!validarNoches(noches)) {
    console.log("Número de noches inválido");
    return;
  }

  if (!validarPrecio(precio)) {
    console.log("Precio inválido");
    return;
  }

  let total = calcularTotalHotel(noches, precio);
  total = aplicarDescuento(total, codigo);

  console.log(`Reserva confirmada para ${nombre}`);
  console.log(`Total a pagar: ${total}`);
}


procesarReserva(nombre, noches, precioPorNoche, codigoDescuento);