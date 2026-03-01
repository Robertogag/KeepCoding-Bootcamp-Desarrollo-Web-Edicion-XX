// ============================================
// BUCLES EN JAVASCRIPT - LIVE CODING
// ============================================

console.log("Bucles");

// Los bucles nos permiten repetir código sin escribirlo múltiples veces
// Son FUNDAMENTALES para trabajar con arrays


// ============================================
// 1. FOR CLÁSICO
// ============================================
// Sintaxis: for ( inicio; condición; incremento ){ código }


// CASO BÁSICO: Contar del 1 al 5
console.log("Contar del 1 al 5:");
for (let i = 1; i <= 5; i++) {
  console.log(i);
}

const totalUsers = 3;
for (let i = 1; i <= totalUsers; i++) {
  console.log(`Enviando email ${i} de ${totalUsers}`);
}

for (let i = 1; i <= 5; i++) {
  console.log(`Código: PROMO${i}0OFF`);
}


// RECORRER UN ARRAY con for clásico
const students = ["Ana", "Carlos", "Laura", "Pedro"];

for (let i = 0; i < students.length; i++) {
  console.log(`${i + 1}. ${students[i]}`);
}

// calcular el total carrito de compra
const prices = [19.99, 45.50, 12.00, 8.99, 23.50];
let total = 0;

for (let i = 0; i < prices.length; i++) {

  console.log(`Producto ${i + 1}: ${prices[i]}€`);
  total += prices[i]
}

console.log(`Total a pagar: ${total.toFixed(2)} €`);



// ============================================
// 2. WHILE - Repetir mientras se cumpla condición
// ============================================

// Sintaxis: while (condición) { código }

let count = 1;
while (count <= 5) {
  console.log(count);
  count++;
}

// Sistema de intentos de login
let attempts = 0;
let maxAttempts = 3;
let password = "secret123";
let userInput = "wrong"; // Simular input incorrecto

while (attempts < maxAttempts && userInput !== password) {

  attempts++;
  console.log(`Intento ${attempts}: Password incorrecto`);

  // Simulamos que en el último intento pone el correcto
  if (attempts === 2) {
    userInput = "secret123";
  }
}

if (userInput === password) {
  console.log("Login exitoso")
} else {
  console.log("Cuenta bloqueada")
}

// Procesar una cola de tareas
console.log("Procesando tareas:");
const taskQueue = ["Tarea 1", "Tarea 2", "Tarea 3"];

while (taskQueue.length > 0) {
  // extraer la primera tarea
  const task = taskQueue.shift();
  console.log(`Procesando: ${task}`);
  // console.log(`Tareas restantes: ${taskQueue.length}`);
}

console.log(taskQueue);
console.log("todas las tareas completadas");

console.clear();

// Caso: buscar en un array hasta encontrar el item
const inventory = ["Laptop", "Mouse", "Keyboard", "Monitor", "Webcam"];
const searchItem = "Keyboard";

let index = 0;
let found = false;

while (index < inventory.length && !found) {

  if (inventory[index] === searchItem) {
    found = true;
    console.log(`${searchItem} encontrado en la posición ${index}`)
  } else {
    console.log(`Revisando posición ${index}`);
  }

  index++;
}

// ============================================
// 3. DO...WHILE - Ejecutar al menos una vez
// ============================================

// Sintaxis: do { código } while (condición)
// La diferencia: se ejecuta PRIMERO, luego verifica la condición


// CASO BÁSICO: Diferencia entre while y do...while
let x = 10;
while (x < 5) {
  console.log("Esto no se ejecuta");
}

console.log("while no se ejecutó");

let y = 10;
do {
  console.log(`Esto se ejecuta al menos una vez, y = ${y}`);
} while (y < 5);


// CASO PRÁCTICO: Menú de opciones (se muestra al menos una vez)
let option = 0;
let menuShow = 0;

do {
  menuShow++;
  console.log("1. Ver perfil");
  console.log("2. Configuración");
  console.log("3. Salir");
  console.log(`Mostrando menú por ${menuShow} vez`);

  // Simular que el usuario elige "salir" después de 2 intentos
  option = menuShow >= 2 ? 3 : 1;
} while (option !== 3);

console.log("Saliendo...");

console.clear();


// ============================================
// 4. FOR...OF - Recorrer arrays (más simple)
// ============================================


// Sintaxis: for (let elemento of array) { código }
// Más legible cuando solo necesitas los elementos, no los índices

const fruits = ["Manzana", "Plátano", "Naranja", "Pera", "Uvas"];

for (let fruit of fruits) {
  console.log(fruit);
}

// comparación entre for clásico y for...of
const color = ["Rojo", "Verde", "Amarillo"];
for (let i = 0; i < color.length; i++) {
  console.log(color[i]);
}

// for of
for (let colorForOf of color) {
  console.log(colorForOf);
}

// CASO PRÁCTICO: Validar emails
const emails = ["ana@mail.com", "invalid-email", "carlos@email.com", "test"];

for (let email of emails) {

  if (email.includes("@") && email.includes(".")) {
    console.log(`${email} es válido`);
  } else {
    console.log(`${email} es INválido`);
  }
}

// CASO PRÁCTICO: Calcular precio total con descuento
const products = [
  { name: "Laptop", price: 1000 },
  { name: "Mouse", price: 25 },
  { name: "Keyboard", price: 75 }
];

let subtotal = 0;
for (let product of products) {
  console.log(`${product.name}: $${product.price}`);
  subtotal += product.price;
}

const discount = 0.10; // 10% descuento
const finalTotal = subtotal * (1 - discount);

console.log(`Subtotal: $${subtotal}`);
console.log(`Descuento: ${discount * 100}%`);
console.log(`Total: $${finalTotal.toFixed(2)}`);


// CASO PRÁCTICO: Filtrar productos disponibles
console.log("\nProductos en stock:");
const stock = [
  { name: "Laptop", available: true },
  { name: "Mouse", available: false },
  { name: "Keyboard", available: true },
  { name: "Monitor", available: false }
];

for (let item of stock) {
  if (item.available) {
    console.log(`${item.name} - Disponible`);
  } else {
    console.log(`${item.name} - Agotado`);
  }
}


console.clear();


// ============================================
// 5. BREAK - Salir del bucle
// ============================================
// Break detener el bucle completamente

const users = ["Miriam", "Zoe", "Guille", "Angel", "Pepe"];
const userSearch = "Guille";

for (let user of users) {

  console.log(`Revisando: ${user}`);

  if (user === userSearch) {
    console.log("Usuario encontrado!")
    break;
  }
}

console.clear();

// CASO PRÁCTICO: Validar password (máximo 3 intentos)
const correctPassword = "keepcoding2024";
const passwordAttempts = ["wrong1", "worng2", "keepcoding2024", "wrong3"];


for (let i = 0; i < passwordAttempts.length; i++) {

  console.log(`Intento ${i + 1}: ${passwordAttempts[i]}`);

  if (passwordAttempts[i] === correctPassword) {
    console.log("Acceso concendido");
    break;
  }

  console.log("Password incorrecto");
}


// CASO PRÁCTICO: Encontrar primer producto bajo presupuesto
const catalog = [
  { name: "Laptop", price: 1000 },
  { name: "Mouse", price: 25 },
  { name: "Keyboard", price: 75 },
  { name: "USB Cable", price: 10 }
];

const budget = 50;

for (let product of catalog) {
  console.log(`Revisando: ${product.name} - ${product.price}€`);

  if (product.price <= budget) {
    console.log(`¡Encontrado! ${product.name} está dentro del presupuesto`);
    break;
  }
}

console.clear();

// ============================================
// 6. CONTINUE - Saltar a la siguiente iteración
// ============================================
// Continue salta el resto del código y pasa a la siguiente iteración

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

for (let num of numbers) {

  if (num % 2 !== 0) {
    continue; // Saltar números impares
  }

  console.log(`${num} es par`);
}

// CASO PRÁCTICO: Procesar solo emails válidos
const emailList = ["ana@mail.com", "invalid-email", "carlos@email.com", "test", "laura@email.com"];
let processedEmail = 0;

for (let email of emailList) {

  // Saltar emails inválidos
  if (!email.includes("@") || !email.includes(".")) {
    console.log(`Saltando: ${email} (inválido)`);
    continue;
  }

  processedEmail++;
  console.log(`Procesando ${email}`);

}

console.log(`Total emails procesados: ${processedEmail}`);


// CASO PRÁCTICO: Aplicar descuento solo a productos específicos
const store = [
  { name: "Laptop", category: "electronics", price: 1000 },
  { name: "Shirt", category: "clothing", price: 30 },
  { name: "Mouse", category: "electronics", price: 25 },
  { name: "Pants", category: "clothing", price: 50 },
  { name: "Monitor", category: "electronics", price: 300 }
];

const electronicDiscount = 0.15; // 15% off

for (let item of store) {
  // Saltar productos que no son electrónica
  if (item.category !== "electronics") {
    console.log(`${item.name}: $${item.price} (sin descuento)`);
    continue;
  }

  // Solo aplicar descuento a electrónica
  const discountedPrice = item.price * (1 - electronicDiscount);
  console.log(`${item.name}: $${item.price} → $${discountedPrice.toFixed(2)} (15% off)`);
}


// " EJERCICIO 3.1: FizzBuzz");
// "   Imprime números del 1 al 20, pero:");
// "   - Si es divisible por 3, imprime 'Fizz'");
// "   - Si es divisible por 5, imprime 'Buzz'");
// "   - Si es divisible por ambos, imprime 'FizzBuzz'");
// "   - Si no, imprime el número");
// "   Ejemplo: 1, 2, Fizz, 4, Buzz, Fizz, 7...");

for (let i = 1; i <= 20; i++) {
  if (i % 3 === 0 && i % 5 === 0) {
    console.log("FizzBuzz");
  } else if (i % 3 === 0) {
    console.log("Fizz");
  } else if (i % 5 === 0) {
    console.log("Buzz");
  } else {
    console.log(i);
  }
}


// ============================================
// EJERCICIO PRÁCTICO: RETO matriz 2D con BUCLES
// ============================================

// EJERCICIO: ENCONTRAR MÁXIMO EN MATRIZ
const matrix2D = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [8, 7, 6, 5],
  [4, 3, 2, 1]
];

console.log("Matriz:");
for (let row of matrix2D) {
  console.log(row);
}

// SOLUCIÓN con for clásico (acceso a índices)
// Método 1: For clásico 

let max1 = matrix2D[0][0]; // Empezar con el primer elemento
let maxRow1 = 0;
let maxCol1 = 0;

for (let i = 0; i < matrix2D.length; i++) {
  for (let j = 0; j < matrix2D[i].length; j++) {
    console.log(`Revisando [${i}][${j}] = ${matrix2D[i][j]}`);

    if (matrix2D[i][j] > max1) {
      max1 = matrix2D[i][j];
      maxRow1 = i;
      maxCol1 = j;
    }
  }
}

console.log(`Valor máximo: ${max1}`);
console.log(`Posición: [${maxRow1}][${maxCol1}]`);

// SOLUCIÓN con for...of (más simple si no necesitas índices)
// Método 2: For...of (más simple)
let max2 = matrix2D[0][0];

for (let row of matrix2D) {
  for (let value of row) {
    if (value > max2) {
      max2 = value;
    }
  }
}

console.log(`Valor máximo: ${max2}`);

// EJERCICIO EXTRA: Encontrar mínimo
let min = matrix2D[0][0];
let minRow = 0;
let minCol = 0;

for (let i = 0; i < matrix2D.length; i++) {
  for (let j = 0; j < matrix2D[i].length; j++) {
    if (matrix2D[i][j] < min) {
      min = matrix2D[i][j];
      minRow = i;
      minCol = j;
    }
  }
}

console.log(`Valor mínimo: ${min}`);
console.log(`Posición: [${minRow}][${minCol}]`);

// EJERCICIO EXTRA: Sumar todos los elementos
let sum = 0;

for (let row of matrix2D) {
  for (let value of row) {
    sum += value;
  }
}

console.log(`Suma total: ${sum}`);

// EJERCICIO EXTRA: Contar números mayores a 5
let countAbove5 = 0;

for (let row of matrix2D) {
  for (let value of row) {
    if (value > 5) {
      countAbove5++;
    }
  }
}

console.log(`Números mayores a 5: ${countAbove5}`);


// ============================================
// CASO PRÁCTICO FINAL: Sistema de inventario
// ============================================

console.log("\n=== CASO PRÁCTICO: SISTEMA DE INVENTARIO ===");

const warehouse = [
  { id: 1, name: "Laptop", stock: 15, minStock: 10 },
  { id: 2, name: "Mouse", stock: 5, minStock: 20 },
  { id: 3, name: "Keyboard", stock: 30, minStock: 15 },
  { id: 4, name: "Monitor", stock: 8, minStock: 10 },
  { id: 5, name: "Webcam", stock: 25, minStock: 5 }
];


// 1. Productos con stock bajo
console.log("Productos con stock bajo:");
for (let product of warehouse) {
  if (product.stock < product.minStock) {
    const needed = product.minStock - product.stock;
    console.log(`${product.name}: Stock ${product.stock} (necesita ${needed} más)`);
  }
}

// 2. Calcular valor total en inventario (precio fijo de $50 por unidad)
console.log("Valor total del inventario:");
const unitPrice = 50;
let totalValue = 0;

for (let product of warehouse) {
  const productValue = product.stock * unitPrice;
  totalValue += productValue;
  console.log(`${product.name}: ${product.stock} x $${unitPrice} = $${productValue}`);
}

console.log(`Total: ${totalValue}€`);

// 3. Buscar producto específico
console.log("Buscar producto por ID:");
const searchId = 3;

for (let product of warehouse) {
  if (product.id === searchId) {
    console.log(`Encontrado: ${product.name}`);
    console.log(`Stock: ${product.stock}`);
    console.log(`Stock mínimo: ${product.minStock}`);
    break; // Salir cuando lo encontramos
  }
}

// 4. Actualizar stock (simulación de ventas)
console.log("\n🛒 Simulación de ventas:");
const sales = [
  { id: 1, quantity: 3 },
  { id: 2, quantity: 2 },
  { id: 5, quantity: 5 }
];

for (let sale of sales) {
  // Buscar el producto
  for (let product of warehouse) {
    if (product.id === sale.id) {
      product.stock -= sale.quantity;
      console.log(`Vendido: ${product.name} x ${sale.quantity}`);
      console.log(`   Stock restante: ${product.stock}`);
      break;
    }
  }
}
