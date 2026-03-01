console.log("arrays");

// ============================================
// ARRAYS EN JAVASCRIPT
// ============================================


// Un array es una lista ordenada de elementos
// Imagina una estantería con libros numerados, o una lista de tareas...


// Listado de estudiantes de una clase
const estudiante1 = "Nerea";
const estudiante2 = "Guille";

const estudiantes = ["Nerea", "Guille", "Julia", "Angel", "Ulises", "Cheryl", "Alicia", "Gala"];
console.log(estudiantes);

const carritoCompra = [19.99, 45, 8.60];
console.log(carritoCompra);

const mixed = ["Ana", 25, true, 19.99];
console.log("arary mixto", mixed);


// ============================================
// 3. ACCEDER A ELEMENTOS
// ============================================
const playList = ["Song1", "Song2", "Song3", "Song4", "Song5"];


// Los índices en un array empiezan en 0
console.log(playList[0]);
console.log(playList[1]);
console.log(playList[4]);

console.log(playList.length);
console.log(playList[playList.length - 1]);

// split() -> convierte string en array
let message = "Hola que tal".split("");
console.log(message);



// ============================================
// 4. MODIFICAR ELEMENTOS
// ============================================

const inventario = ["Laptop", "Mouse", "Teclado"];
console.log(inventario);

inventario[1] = "Mouse sin cable";
console.log("Inventario después de  modificar:", inventario);

const calificaciones = [85, 90, 75, 99, 92];

console.log("Alumno X calificacion:", calificaciones[2]);
calificaciones[2] = 95;

console.log("Nueva calificación:", calificaciones[2]);

const taskStatus = ["pending", "completed", "cancelled"];
console.log("Antes de completar tarea 1:", taskStatus);

taskStatus[0] = "completed";
console.log("Después de completar tarea 1:", taskStatus);

console.clear();


// ============================================
// 5. PROPIEDAD LENGTH - longitud de un array
// ============================================

const cities = ["Madrid", "Mallorca", "Cáceres", "Machala", " Mexico DF", "Toledo"];

console.log('Ciudades', cities);
console.log(cities.length);

const todoList = ["picar código", "dormir"];

const todoListLength = todoList.length;

if (todoListLength === 0) {
  console.log("No tienes tareas pendientes")
} else {
  console.log(`Tienes ${todoListLength} tarea por hacer`);
}


// CASO PRÁCTICO: Límite de items en carrito
const shoppingCart = ["Item 1", "Item 2", "Item 3"];
const maxItems = 5;

console.log(`Carrito: ${shoppingCart.length}/${maxItems} items`);

if (shoppingCart.length < maxItems) {
  console.log(`Puedes agregar ${maxItems - shoppingCart.length} items más`);
} else {
  console.log("Carrito lleno");
}

// Acceder al último elemento usando length
const numbers = [10, 20, 30, 40, 50];
console.log("\nNúmeros:", numbers);
console.log("Último número:", numbers[numbers.length - 1]); // 50
console.log("Penúltimo número:", numbers[numbers.length - 2]); // 40



// ============================================
// 6. MÉTODOS BÁSICOS DE ARRAYS
// ============================================

// array.push() - agregar un elemento al final de un array
cities.push("Lima");

console.log("Cities con push", cities);

cities.push("Oviedo");
console.log(cities);

const alerts = [];
alerts.push("Nuevo mensaje recibido");
alerts.push("Actualización disponible");
alerts.push("Batería baja");

console.log(alerts);


// array.pop() -> Eliminar del final

const removed = cities.pop();
console.log("Cities eliminando última ciudad:", removed);

console.log(cities);

// Deshacer acciones
const history = ["Acción 1", "Acción 2", "Acción 3"];
console.log(history);

const lastAction = history.pop();
console.log("Deshaciendo: ", lastAction);
console.log("Historial actualizado", history);


// array.unshift() - Agregar al inicio
const priorities = ["Media", "Baja"];
console.log("Prioriades", priorities);

priorities.unshift("Alta");
console.log("Prioridades actualizadas", priorities);

// CASO PRÁCTICO: Notificación urgente (se muestra primero)
const messages = ["Mensaje 1", "Mensaje 2"];
console.log("Mensajes:", messages);
messages.unshift("¡URGENTE! Reunión en 5 minutos");
console.log("Con mensaje urgente:", messages);


// array.shift() - Elimina del inicio
priorities.shift();
console.log("Tareas:", priorities);

priorities.shift();
console.log(priorities);

// CASO PRÁCTICO: Cola de impresión
const printQueue = ["Documento 1", "Documento 2", "Documento 3"];
console.log("\nCola de impresión:", printQueue);
console.log("Imprimiendo:", printQueue.shift());
console.log("En cola:", printQueue);
console.log("Imprimiendo:", printQueue.shift());
console.log("En cola:", printQueue);


console.clear();


// ============================================
// 7. BUSCAR ELEMENTOS
// ============================================

const menu = ["Hotdog", "Burger", "Pizza", "Salad", "Pizza"];
console.log("Manu:", menu);

// array.indexOf("elemento") - Encontrar la posición
console.log(menu.indexOf("Pasta")); // 2
console.log("Pizzas:", menu.indexOf("Pizza")); // 0 -> Devuelve la posición del primer elemento que encuentre
console.log(menu.indexOf("Sushi")); // -1


// CASO PRÁCTICO: Verificar disponibilidad de producto
const tienda = ["Laptop", "Mouse", "Keyboard", "Monitor"];
const productoBuscar = "Phone";
const posicion = tienda.indexOf(productoBuscar);

if (posicion !== -1) {
  console.log(`${productoBuscar} encontrado! en posicion ${posicion}`);
} else {
  console.log(`${productoBuscar} no disponible`);
}

// array.includes("") - Verificar si existe devuelve true o false
const allowedUser = ["admin", "user1", "user2", "moderator"];

console.log(allowedUser.includes("admin"));
console.log(allowedUser.includes("guest"));

// Función de sistemas de permisos

function checkAccess(username) {

  const authorizedUsers = ["alice", "bob", "charlie"];

  if (authorizedUsers.includes(username)) {
    return `Acceso concedido a ${username}`;
  } else {
    return `Acceso DENEGADO a ${username}`;
  }
}

console.log(checkAccess("alice")); // Permitido
console.log(checkAccess("charlie")); // Permitido
console.log(checkAccess("hacker")); // Denegado

// Verificar lista de ingredientes alérgenos
const ingredients = ["flour", "eggs", "milk", "sugar", "nuts"];
const allergies = ["nuts", "shellfish"];

let hasDanger = false;
if (ingredients.includes(allergies[0]) || ingredients.includes[1]) {
  hasDanger = true;
}

if (hasDanger) {
  console.log("Contiene ingredientes alérgenos");
} else {
  console.log("Producto seguro para este usuario");
}

console.clear();


// ============================================
// 8. ARRAYS BIDIMENSIONALES (2D)
// ============================================

// Un array 2D es como una tabla o matriz
// Cada dato se ubica en 2 posiciones [fila][columna]. Imaginen una hoja de Excel o un tablero de ajedrez. Cada casilla tiene una posición: fila y columna. Un array bidimensional funciona igual.

/**
 * [ 5 8 3 ]
 * [ 1 4 5 ]
 * [ 8 8 0 ]
 */

// CASO PRÁCTICO: Asientos de un cine (3 filas, 4 asientos cada una)
const cinema = [
  ["A1", "A2", "A3", "A4"], // Fila A
  ["B1", "B2", "B3", "B4"], // Fila B
  ["C1", "C2", "C3", "C4"], // Fila C
];

console.log(cinema);
console.log("Fila1:", cinema[0]);
console.log("Asiento A1:", cinema[0][0]);
console.log("Asiento B3:", cinema[1][2]);


// CASO PRÁCTICO: Tablero de tres en raya
const ticTacToe = [
  ["X", "O", "X"],
  ["O", "X", "O"],
  ["O", "X", "X"]
];

console.log("Fila 1:", ticTacToe[0]);
console.log("Fila 2:", ticTacToe[1]);
console.log("Fila 3:", ticTacToe[2]);

console.log("\nCasilla [0][0]:", ticTacToe[0][0]); // "X"
console.log("Casilla [1][1]:", ticTacToe[1][1]);   // "X"
console.log("Casilla [2][2]:", ticTacToe[2][2]);   // "X"


// Modificar datos
const seatStatus = [
  ["libre", "libre", "libre"],
  ["libre", "libre", "ocupado"],
  ["ocupado", "libre", "libre"],
];

console.log("Estado antes:", seatStatus[1][1]);
seatStatus[1][1] = "ocupado";
console.log("Estado después:", seatStatus[1][1]);
console.log(seatStatus[1]);


// Suma los elementos y calcula la media de cada estudiante. Imprímelo por consola.
let notas = [
  [8, 7, 9],
  [6, 5, 7],
  [10, 9, 8]
];

let prom1 = (notas[0][0] + notas[0][1] + notas[0][2]) / 3;
let prom2 = (notas[1][0] + notas[1][1] + notas[1][2]) / 3;
let prom3 = (notas[2][0] + notas[2][1] + notas[2][2]) / 3;

console.log("Promedio Estudiante 1:", prom1);
console.log("Promedio Estudiante 2:", prom2);
console.log("Promedio Estudiante 3:", prom3);


// ============================================
// 9. ARRAYS MULTIDIMENSIONALES (3D)
// ============================================

// Array 3D: Piensa en un edificio con pisos, filas y asientos

const building = [
  // Piso 0 
  [
    ["Desk0-0-0", "Desk0-0-1", "Desk0-0-2", "Desk0-0-3"], // Oficina 0
    ["Desk0-1-0", "Desk0-1-1", "Desk0-1-2", "Desk0-1-3"], // Oficina 1
  ],
  // Piso 1
  [
    ["Desk1-0-0", "Desk1-0-1", "Desk1-0-2", "Desk1-0-3"],
    ["Desk1-1-0", "Desk1-1-1", "Desk1-1-2", "Desk1-1-3"],
  ],
  // Piso 3
  [
    ["Desk2-0-0", "Desk2-0-1", "Desk2-0-2", "Desk2-0-3"],
    ["Desk2-1-0", "Desk2-1-1", "Desk2-1-2", "Desk2-1-3"],
  ]
];

console.log("Planta 1, Ofician 0, Escritorio 3", building[1][0][2]);


// CASO PRÁCTICO: Inventario por tienda, categoría y producto
const inventory3D = [
  // Tienda 1
  [
    [10, 5, 8],   // Electrónica: Laptops, Phones, Tablets
    [15, 20, 12]  // Ropa: Camisetas, Pantalones, Zapatos
  ],
  // Tienda 2
  [
    [8, 12, 6],
    [10, 15, 8]
  ]
];

console.log("Inventario:");
console.log("Tienda 1, Electrónica, Laptops:", inventory3D[0][0][0]); // 10 unidades
console.log("Tienda 2, Ropa, Pantalones:", inventory3D[1][1][1]);     // 15 unidades


// ============================================
// EJERCICIOS PARA PRACTICAR
// ============================================


// 1. CALCULADORA DE CARRITO"
// Dado este carrito de compras:
const shoppingPrices = [29.99, 15.50, 8.99, 42.00, 12.50];

//   Calcula:
//   a) El total a pagar (suma de todos)
//   b) El precio promedio
//   c) El producto más caro
//   d) Cuántos productos cuestan más de 20€


// 2. GESTIÓN DE PLAYLIST
const myPlaylist = ["Song A", "Song B", "Song C"];

//   Implementa:
//   a) Agregar 'Song D' al final
//   b) Agregar 'Song Zero' al inicio
//   c) Verificar si 'Song B' está en la lis
//   d) Encontrar la posición de 'Song C'


// 3. TABLERO DE AJEDREZ SIMPLIFICADO
//    Crea un tablero 8x8 donde:
const chessBoard = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"]
];
//  a) Accede a la pieza en [0][4] (Rey negro)
//  b) Mueve el peón blanco de [6][4] a [4][4]
//  c) Verifica si la posición [2][2] está vacía


// ============================================
// SOLUCIONES
// ============================================

// Solución 1: Calculadora de carrito
const prices = [29.99, 15.50, 8.99, 42.00, 12.50];

// a) Total a pagar
const total = prices[0] + prices[1] + prices[2] + prices[3] + prices[4];
console.log("a) Total a pagar: $" + total.toFixed(2));

// b) Precio promedio
const average = total / prices.length;
console.log("b) Precio promedio: $" + average.toFixed(2));

// c) Producto más caro
let maxPrice = prices[0];
if (prices[1] > maxPrice) maxPrice = prices[1];
if (prices[2] > maxPrice) maxPrice = prices[2];
if (prices[3] > maxPrice) maxPrice = prices[3];
if (prices[4] > maxPrice) maxPrice = prices[4];
console.log("c) Producto más caro: $" + maxPrice);

// d) Productos que cuestan más de 20€ (sin bucles, pero más efectivo usar bucles para este tipo de operaciones o con otros métodos)
let expensive = 0;
if (prices[0] > 20) expensive++;
if (prices[1] > 20) expensive++;
if (prices[2] > 20) expensive++;
if (prices[3] > 20) expensive++;
if (prices[4] > 20) expensive++;
console.log("d) Productos > 20€:", expensive);



// Solución 2: Gestión de Playlist
const playlist = ["Song A", "Song B", "Song C"];
console.log("Playlist inicial:", playlist);

// a) Agregar al final
playlist.push("Song D");
console.log("a) Después de push:", playlist);

// b) Agregar al inicio
playlist.unshift("Song Zero");
console.log("b) Después de unshift:", playlist);

// c) Verificar si existe
const exists = playlist.includes("Song B");
console.log("c) ¿Tiene 'Song B'?", exists);

// d) Encontrar posición
const position2 = playlist.indexOf("Song C");
console.log("d) Posición de 'Song C':", position2);


// Solución 3: Tablero de ajedrez
const chess = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"]
];

// a) Acceder al rey negro
console.log("a) Pieza en [0][4]:", chess[0][4]); // "♚"

// b) Mover peón blanco
const piece = chess[6][4];
chess[4][4] = piece;
chess[6][4] = " ";
console.log("b) Peón movido de [6][4] a [4][4]");

// c) Verificar si está vacía
const isEmpty = chess[2][2] === " ";
console.log("c) ¿Posición [2][2] vacía?", isEmpty);
