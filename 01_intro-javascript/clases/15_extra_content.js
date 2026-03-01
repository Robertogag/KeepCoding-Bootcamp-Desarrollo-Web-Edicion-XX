
console.log("Extra content");

// 1. Date -> para trabajar con fechas y horas

// Fecha actual
const ahora = new Date();
console.log("Fecha actual:", ahora);

// Fecha específica (año, mes, día, hora, minuto, segundo)
// IMPORTANTE: Los meses van de 0 (enero) a 11 (diciembre)
const fecha1 = new Date(2026, 0, 17);
console.log(fecha1);

const fecha2 = new Date(2026, 0, 17, 14, 30, 0); // Con hora
console.log(fecha2);

const fecha3 = new Date("2026-01-17");
console.log("fecha desde string:", fecha3);

const fecha4 = new Date("January 17, 2026");
console.log("Desde string (formato texto):", fecha4);

// Desde timestamp (milisegundos)
const fecha5 = new Date(1737158400000);
console.log("Desde timestamp:", fecha5);


// Obtener componentes de una fecha
const hoy = new Date();

console.log("Año:", hoy.getFullYear());
console.log("Mes:", hoy.getMonth()); // 0-11
console.log("Mes (nombre):", ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][hoy.getMonth()]);
console.log("Día del mes:", hoy.getDate()); // 1-31
console.log("Día de la semana:", hoy.getDay()); // 0 (domingo) - 6 (sábado)
console.log("Hora:", hoy.getHours());
console.log("Minutos:", hoy.getMinutes());
console.log("Segundos:", hoy.getSeconds());
console.log("Milisegundos:", hoy.getMilliseconds());


// CASO PRÁCTICO: Formatear fecha
function formatearFecha(fecha) {
  const dia = fecha.getDate().toString().padStart(2, '0');
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const año = fecha.getFullYear();

  return `${dia}/${mes}/${año}`;
}

console.log("Fecha formateada:", formatearFecha(new Date()));

// Modificar fechas
const modificable = new Date(2026, 0, 17);
console.log("Fecha original:", formatearFecha(modificable));

modificable.setDate(modificable.getDate() + 7); // Sumar 7 días
console.log("+ 7 días:", formatearFecha(modificable));

modificable.setMonth(modificable.getMonth() + 2); // Sumar 2 meses
console.log("+ 2 meses:", formatearFecha(modificable));

modificable.setFullYear(modificable.getFullYear() + 1); // Sumar 1 año
console.log("+ 1 año:", formatearFecha(modificable));

// Comparar fechas
const fechaA = new Date(2026, 0, 17);
const fechaB = new Date(2026, 0, 20);

if (fechaA < fechaB) {
  console.log("fechaA es anterior a fechaB");
}

if (fechaA.getTime() === fechaB.getTime()) {
  console.log("Las fechas son iguales");
}


// CASO PRÁCTICO: Calcular edad

function calcularEdad(fechaNacimiento) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNacimiento = nacimiento.getMonth();

  // Si aún no cumplió años este año
  if (mesActual < mesNacimiento ||
    (mesActual === mesNacimiento && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }

  return edad;
}

console.log("Edad de alguien nacido el 15/03/1990:", calcularEdad("1990-03-15"), "años");
console.log("Edad de alguien nacido el 15/03/2000:", calcularEdad("2000-03-15"), "años");

// ===== REGEX() ====

// Expresiones regulares, son patrones para busca y manipular texto de forma avanzada


// Crear regex

// Forma 1: Literal
const regex1 = /hola/;
console.log("Regex literal", regex1);

// Forma 2: Constructor
const regex2 = new RegExp("hola");
console.log("Regex con constructor:", regex2);


// Métodos básicos
const texto = "Hola mundo. Hola a todos.";
const patron = /hola/i; //i = case insensitive

// test() - Retorna true/false
console.log("test():", patron.test(texto)); // true

// match() - Retorna las coincidencias
console.log("match():", texto.match(patron));

// replace() - Reemplazar
console.log("replace():", texto.replace(patron, "Adiós"));

// PATRONES BÁSICOS

// . = cualquier carácter
console.log("/.ola/:", "hola".match(/.ola/)); // Coincide
console.log("/.ola/:", "bola".match(/.ola/)); // Coincide

// ^ = inicio de string
console.log("/^Hola/:", "Hola mundo".match(/^Hola/)); // Coincide
console.log("/^Hola/:", "Mundo Hola".match(/^Hola/)); // No coincide

// $ = fin de string
console.log("/mundo$/:", "Hola mundo".match(/mundo$/)); // Coincide

// [] = conjunto de caracteres
console.log("/[aeiou]/:", "hola".match(/[aeiou]/)); // Primera vocal

// [^] = negación
console.log("/[^aeiou]/:", "hola".match(/[^aeiou]/)); // Primera consonante

// * = 0 o más veces
console.log("/ho*la/:", "hla".match(/ho*la/)); // Coincide (0 'o')
console.log("/ho*la/:", "hoola".match(/ho*la/)); // Coincide (2 'o')

// + = 1 o más veces
console.log("/ho+la/:", "hla".match(/ho+la/)); // No coincide
console.log("/ho+la/:", "hoola".match(/ho+la/)); // Coincide

// ? = 0 o 1 vez
console.log("/colou?r/:", "color".match(/colou?r/)); // Coincide
console.log("/colou?r/:", "colour".match(/colou?r/)); // Coincide

// {n} = exactamente n veces
console.log("/o{2}/:", "foo".match(/o{2}/)); // Coincide (oo)

// {n,m} = entre n y m veces
console.log("/o{1,3}/:", "foooo".match(/o{1,3}/)); // ooo

// FLAGS
console.log("\n🔹 Flags importantes:");

const textoMulti = "Hola\nmundo\nHola\nde\nnuevo";

// g = global (todas las coincidencias)
console.log("Sin g:", textoMulti.match(/Hola/));
console.log("Con g:", textoMulti.match(/Hola/g));

// i = case insensitive
console.log("Sin i:", "HOLA".match(/hola/));
console.log("Con i:", "HOLA".match(/hola/i));

// m = multiline
console.log("Con m:", textoMulti.match(/^Hola/gm));

// CARACTERES ESPECIALES
console.log("\n🔹 Caracteres especiales:");

// \d = dígito (0-9)
console.log("\\d:", "abc123".match(/\d/g)); // ['1', '2', '3']

// \D = no dígito
console.log("\\D:", "abc123".match(/\D/g)); // ['a', 'b', 'c']

// \w = palabra (letras, números, _)
console.log("\\w:", "hola_123".match(/\w/g));

// \W = no palabra
console.log("\\W:", "hola mundo!".match(/\W/g)); // [' ', '!']

// \s = espacio en blanco
console.log("\\s:", "hola mundo".match(/\s/g)); // [' ']

// \S = no espacio
console.log("\\S:", "hola mundo".match(/\S/g));


function validarEmail(email) {
  // Patrón más completo para emails
  const patron = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return {
    valido: patron.test(email),
    email
  }
}

console.log(validarEmail("ana@example.com"));
console.log(validarEmail("carlos.garcia@empresa.co.uk"));
console.log(validarEmail("invalid-email"));
console.log(validarEmail("@example.com"));
console.log(validarEmail("user@"));
console.clear();

// CASO PRÁCTICO: Validar teléfono español

function validarTelefonoES(telefono) {
  // Acepta: +34 612345678, 612345678, 612 34 56 78, 612-345-678
  const patron = /^(\+34|0034)?[\s.-]?[6-7]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}$/;

  if (patron.test(telefono)) {
    // Limpiar el teléfono
    const limpio = telefono.replace(/[\s.-]/g, '').replace(/^(\+34|0034)/, '');
    return {
      valido: true,
      telefono: telefono,
      normalizado: `+34 ${limpio}`
    };
  }

  return {
    valido: false,
    telefono: telefono
  };
}

console.log(validarTelefonoES("+34 612 345 678"));
console.log(validarTelefonoES("612345678"));
console.log(validarTelefonoES("612-34-56-78"));
console.log(validarTelefonoES("512345678")); // Inválido (no empieza por 6 o 7)


// CASO PRÁCTICO: Validar contraseña
function validatePwd(password) {

  const requirements = {
    longitud: password.length >= 8,
    mayuscula: /[A-Z]/.test(password),
    minusculas: /[a-z]/.test(password),
    numero: /\d/.test(password),
    especial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }

  const valid = Object.values(requirements).every(r => r)

  return {
    valid,
    requirements,
    message: valid ? "Contraseña segura" : "Contraseña débil"
  }
}

console.log(validatePwd("abc123"));
console.log(validatePwd("Abc12345"));
console.log(validatePwd("Abc12345@!"));
console.clear();


// CASO PRÁCTICO: Extraer información

function extraerDatos(texto) {
  // Extraer emails
  const emails = texto.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

  // Extraer teléfonos
  const telefonos = texto.match(/(\+34|0034)?\s?[6-7]\d{8}/g);

  // Extraer URLs
  const urls = texto.match(/https?:\/\/[^\s]+/g);

  return {
    emails: emails || [],
    telefonos: telefonos || [],
    urls: urls || []
  };
}

const contactData = `
  Contacto: ana@example.com o carlos@empresa.com
  Teléfono: +34 612345678 o 698765432
  Web: https://example.com y http://otro.com
`;

console.log(extraerDatos(contactData));
console.clear();



// JSON - JavaScript Object Notation

// JSON es un formato de texto para intercambiar datos.
// Es el estándar para APIs y almacenamiento de datos.
// REGLAS DE JSON:
//   • Las claves DEBEN estar entre comillas dobles
//   • Los strings DEBEN usar comillas dobles
//   • No puede tener funciones ni undefined
//   • No puede tener comentarios
//   • Solo tipos: string, number, boolean, array, object, null


// JSON.stringify() - Objeto a JSON

const usuario = {
  name: "Ana",
  age: 25,
  email: "ana@example.com",
  active: true,
  hobbies: ["reading", "coding"],
  address: {
    city: "Madrid",
    country: "Spain"
  }
};

const jsonString = JSON.stringify(usuario);
console.log("Objeto original:", usuario);
console.log("JSON string:", jsonString);
console.log("Tipo:", typeof jsonString); // "string"

// JSON.stringify con formato
const jsonFormatted = JSON.stringify(usuario, null, 2); // 2 espacios de indentación
console.log("JSON formateado:");
console.log(jsonFormatted);

// JSON.parse() - JSON a Objeto

const jsonData = '{"name":"Carlos","age":30,"active":true}';
const objeto = JSON.parse(jsonData);

console.log("JSON string:", jsonData);
console.log("Objeto parseado:", objeto);
console.log("Tipo:", typeof objeto); // "object"
console.log("Acceder a propiedades:", objeto.name);


// 4. OTROS TEMAS ÚTILES (pinceladas)

// TEMPLATE LITERALS avanzados

const nombre = "Ana";
const edad = 25;

// Multilínea
const mensaje = `
  Hola ${nombre},
  Tienes ${edad} años.
  ${edad >= 18 ? 'Eres mayor de edad' : 'Eres menor'}
`;

console.log(mensaje);

// Tagged templates -> NO necesario
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] ? `**${values[i]}**` : '');
  }, '');
}

const resultado = highlight`Usuario: ${nombre}, Edad: ${edad}`;
console.log(resultado);


// OPTIONAL CHAINING (?.)

const user1 = {
  name: "Ana",
  address: {
    city: "Madrid"
  }
};

const user2 = {
  name: "Carlos"
  // Sin address
};

// Sin optional chaining
// console.log(user2.address.city); // Error

// Con optional chaining
console.log("user1 city:", user1.address?.city); // "Madrid"
console.log("user2 city:", user2.address?.city); // undefined (no error)

// Con arrays
const users = [
  { name: "Ana", posts: [{ title: "Post 1" }] },
  { name: "Carlos" }
];

console.log(users[0]?.posts?.[0]?.title); // "Post 1"
console.log(users[1]?.posts?.[0]?.title); // undefined


// DESESTRUCTURACIÓN avanzada

// Valores por defecto anidados
const {
  name: userName = "Guest",
  address: { city = "Unknown" } = {}
} = user2;
console.log("User name:", userName);
console.log("City:", city);

// Rest en objetos anidados
const producto = {
  id: 1,
  name: "Laptop",
  price: 999,
  specs: {
    ram: 16,
    storage: 512,
    processor: "Intel i7"
  }
};

const { specs: { ram, ...otherSpecs } } = producto;

console.log("RAM:", ram);
console.log("Other specs:", otherSpecs);

// SET - Colección de valores únicos
const numeros = [1, 2, 2, 3, 3, 3, 4, 5, 5];
const unicos = new Set(numeros);
console.log("Array original:", numeros);
console.log("Set (únicos):", unicos);
console.log("De vuelta a array:", [...unicos]);

// Usar Set para eliminar duplicados
const duplicados = ["apple", "banana", "apple", "orange", "banana"];
const sinDuplicados = [...new Set(duplicados)];
console.log("Sin duplicados:", sinDuplicados);