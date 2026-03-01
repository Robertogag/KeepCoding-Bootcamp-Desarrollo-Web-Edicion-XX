console.log('Programación funcional');

// COMPARACIÓN Imperative vs Funcional
const numbers = [1, 2, 3, 4, 5];

// tarea duplicar cada número

// Imperativa:
const doubled1 = [];
for (let i = 0; i < numbers.length; i++) {

  doubled1.push(numbers[i] * 2);
}

console.log("original", numbers);
console.log("duplicado imperativo:", doubled1);

// Estilo funcional: (le decimos QUÉ queremos)
const doubled2 = numbers.map(num => num * 2);
console.log("Duplicado funcional", doubled2);

// Código es más legible, a priori es menos propenso a errores

console.clear();
// CALLBACK FUNCTIONS
// Una función que se pasa como argumento a otra función, para ser ejecutada después

function greet(name) {
  console.log(`Hello ${name}`);
}

function processUser(username, callback) {

  console.log("Procesando usuario...");

  callback(username);
};

processUser("Ulises", greet);

const functionName = name => console.log(`Hola ${name}`);
processUser("Laura", functionName);

console.clear();

// === array.forEach()

// Ejecuta una función para cada elemento de un array

const fruits = ["apple", "banana", "orange"];

fruits.forEach(function (fruit) {
  console.log(fruit);
})

fruits.forEach(fruit => console.log(`Mi fruta: ${fruit}`));

// Con índice y array completo
console.log("Parámetros completos:");
fruits.forEach((fruit, index, array) => {
  console.log(`[${index}] ${fruit} (total: ${array.length})`);
});


// CASO PRÁCTICO: Mostrar productos
const products = [
  { name: "Laptop", price: 999 },
  { name: "Mouse", price: 25 },
  { name: "Keyboard", price: 75 }
];

console.log("CATÁLOGO DE PRODUCTOS:");
products.forEach((product, index) => {
  console.log(`${index + 1}. ${product.name} - $${product.price}`);
});


// ⚠️ IMPORTANTE: forEach NO retorna nada
const result1 = fruits.forEach(fruit => fruit.toUpperCase());
console.log("Resultado de forEach:", result1); // undefined

// === array.map()

// Transformar cada elemento -> DEVUELVE UN ARRAY NUEVO

const students = [
  { name: "Pepe", nota: 85 },
  { name: "Lucía", nota: 90 },
  { name: "Carlos", nota: 40 }
];

const studentsName = students.map(student => student.name);

console.log("Estudiantes completos", students);
console.log("Nombres de estudiantes", studentsName);


// CASO PRÁCTICO: Formatear precios
const prices = [19.99, 45.5, 12, 8.99];

const formattedPrices = prices.map((price) => {
  return `${price.toFixed(2)} €`
});

console.log(formattedPrices);


// CASO PRÁCTICO: Añadir propiedades a un array  de objetos:

const orders = [
  { id: 1, total: 100 },
  { id: 2, total: 250 },
  { id: 3, total: 50 },
];

const ordersWithTax = orders.map(order => ({
  ...order,
  tax: order.total * 0.21,
  finalTotal: order.total * 1.21,
}));

console.log("Pedidos originales", orders);
console.log("Pedidos con IVA", ordersWithTax);


// CASO PRÁCTICO: Normalizar datos
const userEmails = ["Ana@EXAMPLE.com", "  carlos@example.com  ", "LAURA@example.COM"];

const normalizedEmails = userEmails.map(email => email.trim().toLowerCase());

console.log("Emails originales:", userEmails);
console.log("Emails normalizados:", normalizedEmails);


// Con índice
const letters = ["a", "b", "c"];

const indexed = letters.map((letter, index) => `${index}: ${letter}`);
console.log("Con índice:", indexed);

console.clear();

// === array.filter()
// Filtrar elementos y crea un NUEVO array con los elementos que cumplan una condición, retorna un array que puede ser más pequeño que el original. Se usa cuando queremos seleccionar elementos específicos


const numbers2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const numerosPares = numbers2.filter(num => num % 2 === 0);
console.log(numerosPares);


// CASO PRÁCTICO: Filtrar por edad
const allUser = [
  { name: "Ana", age: 25 },
  { name: "Carlos", age: 17 },
  { name: "Laura", age: 30 },
  { name: "Pedro", age: 16 },
];

// Obtener los usuarios +18
const adults = allUser.filter((user) => user.age >= 18);
console.log(adults);


// CASO PRÁCTICO: Filtrar por stock
const inventory = [
  { name: "Laptop", stock: 5 },
  { name: "Mouse", stock: 0 },
  { name: "Keyboard", stock: 10 },
  { name: "Monitor", stock: 0 }
];

const available = inventory.filter(product => product.stock > 0);
const outOfStock = inventory.filter(product => product.stock === 0);

console.log("Disponibles:", available);
console.log("Sin stock:", outOfStock);


// CASO PRÁCTICO: Búsqueda
const allProducts = [
  { name: "MacBook Pro", category: "laptops" },
  { name: "Magic Mouse", category: "accessories" },
  { name: "ipad pro", category: "tablets" },
  { name: "AirPods", category: "accessories" }
];

const searchTerm = "pro";

const searchResults = allProducts.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()));
console.log(searchResults);


// CASO PRÁCTICO: Filtrar valores válidos
const mixedData = [1, null, 2, undefined, 3, "", 4, 0, 5, false];

const validNumbers = mixedData.filter(item =>
  typeof item === "number" && !isNaN(item) && item !== 0
);

console.log("Datos mezclados:", mixedData);
console.log("Solo números válidos:", validNumbers);


console.clear();


// array.reduce()
// Sintaxis: array.reduce((accumulator, currentValue) => {...}, initialValue )

// reduce() 'reduce' un array a un ÚNICO valor.
// Puede ser un número, string, objeto, array, etc.
// Se usa cuando queremos ACUMULAR o COMBINAR datos.

const nums = [1, 2, 3, 4, 5];

const sum = nums.reduce((acc, num) => {
  return acc + num;
}, 0);

console.log(`Suma total: ${sum}`);


// CASO PRÁCTICO: Calcular total de carrito
const cart = [
  { name: "Laptop", price: 999, quantity: 1 },
  { name: "Mouse", price: 25, quantity: 2 },
  { name: "Keyboard", price: 75, quantity: 1 }
];

const totalCart = cart.reduce((total, item) => {

  return total + (item.price * item.quantity);
}, 0);

console.log("carrito", cart);
console.log("total carrito:", totalCart);


// CASO PRÁCTICO: Encontrar máximo
const scores = [85, 92, 78, 95, 88];

const maxScore = scores.reduce((max, score) => {
  return score > max ? score : max;
});

console.log(`Score máximo: ${maxScore}`);


// CASO PRÁCTICO: Contar ocurrencias
const votes = ["Ana", "Carlos", "Ana", "Laura", "Ana", "Carlos", "Laura", "Ana"];

const voteCount = votes.reduce((counts, vote) => {
  counts[vote] = (counts[vote] || 0) + 1;
  return counts;
}, {});

console.log("Votos:", votes);
console.log("Conteo:", voteCount);


// CASO PRÁCTICO: Agrupar por categoría
const store = [
  { name: "laptop", category: "electronics" },
  { name: "shirt", category: "clothing" },
  { name: "mouse", category: "electronics" },
  { name: "pants", category: "clothing" },
  { name: "monitor", category: "electronics" },
  { name: "Lego", category: "toys" }
];

const grouped = store.reduce((groups, product) => {

  const category = product.category;

  if (!groups[category]) {
    groups[category] = [];
  }

  groups[category].push(product.name);
  return groups;

}, {});

console.log("Productos agrupados", grouped);

// Object.groupBy()

const mercado = [
  { nombre: "manzana", tipo: "fruta" },
  { nombre: "plátano", tipo: "fruta" },
  { nombre: "zanahoria", tipo: "verdura" }
];

const agrupado = Object.groupBy(mercado, (producto) => producto.tipo);
console.log(agrupado);

/**
 * const agrupado = [
 * {fruta: [{}, {} ]},
 * {verdura: [{}]}
 * ]
 *
 */

console.clear();


// === COMBINANDO MÉTODOS
// Podemos encadenar métodos para crear 'pipelines' de transformación. Cada método retorna un nuevo array que alimenta al siguiente.

// CASO PRÁCTICO: Pipeline completo
const sales = [
  { product: "Laptop", price: 999, quantity: 2, category: "electronics" },
  { product: "Shirt", price: 30, quantity: 5, category: "clothing" },
  { product: "Mouse", price: 25, quantity: 10, category: "electronics" },
  { product: "Pants", price: 50, quantity: 3, category: "clothing" },
  { product: "Monitor", price: 300, quantity: 1, category: "electronics" }
];

console.log("Ventas:", sales);

// Objetivo: Total de ventas de electrónica
const electronicsTotal = sales
  .filter(sale => sale.category === "electronics")  // Solo electrónica
  .map(sale => sale.price * sale.quantity)           // Calcular subtotales
  .reduce((total, subtotal) => total + subtotal, 0);  // Sumar todo

console.log("Total ventas de electrónica: " + electronicsTotal);

// Paso a paso (para entender):

const step1 = sales.filter(sale => sale.category === "electronics");
console.log("1. Filtrar electrónica:", step1);

const step2 = step1.map(sale => sale.price * sale.quantity);
console.log("2. Calcular subtotales:", step2);

const step3 = step2.reduce((total, subtotal) => total + subtotal, 0);
console.log("3. Sumar total:", step3);

// === array.find()
// Devuelve el PRIMER ELEMENTO que cumple la condición. Si no encuentra nada, devuelve undefined. Para en cuanto encuentra el primero


const nums3 = [23, 7, 12, 5, 20];
const primerMayor10 = nums3.find(num => num > 10);

console.log(primerMayor10);

// CASO PRÁCTICO: Arrays de objetos — buscar por id
const users = [
  { id: 1, name: "Victor", active: true },
  { id: 2, name: "Luis", active: false },
  { id: 3, name: "Marta", active: true },
];

const user = users.find(u => u.id === 2);
console.log(user); // { id: 2, nombre: 'Luis', activo: true }
console.log(user.nombre); // 'Luis'

const primerActivo = users.find(u => u.active === true);
console.log(primerActivo.name);

console.log(user);
console.clear();

// === array.some(...)
// Devuelve true si al menos un elemento cumple la condición, y devuelve false si ninguno la cumple
// Para la ejecución cuando encuentra la primera coincidencia

const edades = [14, 17, 22, 15, 78, 90];

const hayAdulto = edades.some(e => e >= 18);
console.log("Hay adulto?", hayAdulto);

const hayNegativo = edades.some(e => e < 0);
console.log(hayNegativo); // false  ← ninguno cumple

// CASO PRÁCTICO — carrito de compras
const carrito = [
  { producto: "libro", precio: 15, en_oferta: false },
  { producto: "curso", precio: 50, en_oferta: true },
  { producto: "teclado", precio: 120, en_oferta: false }
];

const tieneOferta = carrito.some(item => item.en_oferta);
console.log(`Tiene oferta? ${tieneOferta}`);

const hayCaros = carrito.some(item => item.precio > 100);
console.log(hayCaros);


// CASO PRÁCTICO — validación de formulario
const campos = [
  { nombre: 'email', valor: 'juan@mail.com', requerido: true },
  { nombre: 'telefono', valor: '', requerido: false },
  { nombre: 'nombre', valor: '', requerido: true },
];

const hayErrores = campos.some(c => c.requerido && c.valor === '');
console.log(hayErrores); // true  ← 'nombre' está vacío y es requerido


// CASO PRÁCTICO — permisos
const permisosUsuario = ['leer', 'escribir', 'comentar'];
const permisosAdmin = ['leer', 'eliminar'];

const compartePermiso = permisosAdmin.some(p => permisosUsuario.includes(p));
console.log(compartePermiso); // true  ← comparten 'leer'

console.clear();


// === array.every()
// Devuelve TRUE si TODOS los elementos cumplen la condición
// Devuelve FALSE si alguno NO la cumple
// Para en cuanto encuentra el primero que NO cumple

const notas = [85, 90, 78, 92, 88];

// Esto es para saber si todos aprobaron
const todosAprobaron = notas.every(n => n >= 60);
console.log('Todos aprobaron?', todosAprobaron);


// CASO PRÁCTICO: Control de inventario
const inventario = [
  { producto: "manzana", stock: 50 },
  { producto: "pera", stock: 30 },
  { producto: "uva", stock: 0 },
];


const todoDisponible = inventario.every(p => p.stock > 0);
console.log("Todos disponibles", todoDisponible);

const datosValidos = inventario.every(p => p.stock >= 0);
console.log("Datos válidos", datosValidos);

// CASO PRÁCTICO — validación estricta
const registros = [
  { nombre: 'Ana', email: 'ana@mail.com', edad: 25 },
  { nombre: 'Bob', email: 'bob@mail.com', edad: 30 },
  { nombre: 'Carol', email: '', edad: 22 },
];

const datosCompletos = registros.every(u => u.nombre && u.email && u.edad > 0);
console.log(datosCompletos); // false  ← Carol no tiene email


// CASO PRÁCTICO — estado del equipo
const equipo = [
  { nombre: 'Dev1', rol: 'developer', activo: true },
  { nombre: 'Dev2', rol: 'developer', activo: true },
  { nombre: 'Dev3', rol: 'developer', activo: false },
];

const equipoActivo = equipo.every(m => m.activo);
console.log(equipoActivo); // false  ← Dev3 está inactivo

const todosSonDevs = equipo.every(m => m.rol === 'developer');
console.log(todosSonDevs); // true

// ─────────────────────────────────────────────────────────────
//  RESUMEN COMPARATIVO
// ─────────────────────────────────────────────────────────────
//
//  find()   → ¿Cuál es el primero que cumple X?  →  el elemento / undefined
//  some()   → ¿Hay alguno que cumpla X?          →  true / false
//  every()  → ¿Todos cumplen X?                  →  true / false
//
//  Usa find()  cuando necesitas el objeto/valor en sí.
//  Usa some()  cuando solo necesitas saber si existe alguno.
//  Usa every() cuando necesitas confirmar que no hay excepciones.
// ─────────────────────────────────────────────────────────────



// ============================================
// EJERCICIO PRÁCTICO INTEGRADOR
// ============================================

// ANÁLISIS DE DATOS

const transactions = [
  { id: 1, type: "income", amount: 1000, category: "salary", date: "2026-01-01" },
  { id: 2, type: "expense", amount: 50, category: "food", date: "2026-01-02" },
  { id: 3, type: "expense", amount: 200, category: "rent", date: "2026-01-03" },
  { id: 4, type: "income", amount: 500, category: "freelance", date: "2026-01-05" },
  { id: 5, type: "expense", amount: 30, category: "food", date: "2026-01-07" },
  { id: 6, type: "expense", amount: 100, category: "utilities", date: "2026-01-10" },
  { id: 7, type: "income", amount: 200, category: "freelance", date: "2026-01-12" }
];

console.log("Transacciones:", transactions);

// 1. Calcular balance total
const balance = transactions.reduce((total, transaction) => {
  if (transaction.type === "income") {
    return total + transaction.amount;
  } else {
    return total - transaction.amount;
  }
}, 0);

console.log("Balance: " + balance + " €");

// 2. Total de ingresos
const totalIncome = transactions
  .filter(t => t.type === "income")
  .reduce((sum, t) => sum + t.amount, 0);

console.log("Ingresos totales: " + totalIncome + " €");

// 3. Total de gastos
const totalExpenses = transactions
  .filter(t => t.type === "expense")
  .reduce((sum, t) => sum + t.amount, 0);

console.log("Gastos totales: " + totalExpenses + " €");

// 4. Gastos por categoría
const expensesByCategory = transactions
  .filter(t => t.type === "expense")
  .reduce((categories, t) => {
    categories[t.category] = (categories[t.category] || 0) + t.amount;
    return categories;
  }, {});

console.log("Gastos por categoría:", expensesByCategory);

// 5. Categoría con más gastos
const maxCategory = Object.entries(expensesByCategory)
  .reduce((max, [category, amount]) => {
    return amount > max.amount ? { category, amount } : max;
  }, { category: "", amount: 0 });

console.log(`Categoría con más gastos: ${maxCategory.category} (${maxCategory.amount} €)`);