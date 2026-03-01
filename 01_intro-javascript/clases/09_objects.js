// ============================================
// OBJETOS EN JAVASCRIPT - LIVE CODING
// ============================================
console.log("Objetos");


// Los objetos son colecciones de datos relacionados
// Piensa en ellos como "fichas" que describen algo

// Un objeto almacena información usando pares clave-valor
// Clave (propiedad): el nombre de la información
// Valor: el dato en sí


// COMPARACIÓN: Array vs Objeto
// Array: lista ordenada por posición
const personArray = ["Ana", 25, "Madrid", "Developer"];

// Datos más organizados por propiedades
const personObject = {
  name: "Ana",
  age: 25,
  city: "madrid",
  job: "Developer"
};

console.log(personObject);
console.log("Nombre:", personObject.name);
console.log("Edad:", personObject.age);
console.log("Food:", personObject.food); // undefined


// CASO PRÁCTICO: Producto en una tienda
const product = {
  id: 1001,
  name: "laptop",
  brand: "Dell",
  price: 99.99,
  stock: 16,
  available: true,
};
console.log("\nProducto:");
console.log(product);


// ============================================
// 2. CREAR OBJETOS - Notación literal
// ============================================
// Sintaxis: { clave: valor, clave: valor }

// Objeto vacío
const emptyObject = {};
console.log("Objeto vacío:", emptyObject);

// Pero podemos añadir propiedades al objeto
emptyObject.price = 100;
emptyObject.name = "Mouse";

console.log(emptyObject);

// Valores de cualquier tipo:
const mixed = {
  text: "Hola",
  number: 42,
  boolean: true,
  nothig: null,
  list: [1, 2, 3],
  nested: {
    x: 10,
    y: 20
  }
};

console.log(mixed);

// CASO PRÁCTICO: Tarea en una lista de tareas
const task = {
  id: 1,
  title: "Estudiar JavaScript",
  description: "Completar módulo de objetos",
  completed: false,
  priority: "high",
  dueDate: "2026-01-20",
  subtask: {
    name: "Abrir VSCode",
    completed: true
  }
};

console.log("Tarea:", task);


// ============================================
// 3. ACCEDER A PROPIEDADES
// ============================================

const student = {
  name: "Pepe",
  age: 22,
  course: "Web Development",
  grade: 85,
};


// MÉTODO 1: Notación de punto (más común)
console.log(`Nombre alumno: ${student.name}`);
console.log("Edad:", student.age);
console.log("Curso:", student.course);


// MÉTODO 2: Notación de corchetes
console.log(`Nombre alumno: ${student["name"]}`);
console.log("Edad:", student["age"]);

console.log(mixed.nested);
console.log(mixed["nested"]);

// ¿Cuándo usar corchetes? Cuando la clave es dinámica o tiene caracteres especiales
// Cuando usar uno u otro
const restaurant = {
  name: "El Pollo loco",
  "opening hours": "9:00 - 22:00",
  "average-price": 25,
  "phone number": "123-456-78",
  opening: {
    firstHour: "9.00",
    lastHour: "22.00"
  }
};

// console.log(restaurant.opening hours); // No funciona
console.log(restaurant["opening hours"]);
console.log(restaurant.opening.firstHour);
console.log(restaurant["average-price"]);


const propertyName = "name";
console.log(restaurant[propertyName]);

// Acceder a propiedad que no existe
console.log("\nPropiedad inexistente:", student.phone); // undefined

console.clear();


// ============================================
// 4. MODIFICAR Y AÑADIR PROPIEDADES
// ============================================

const car = {
  brand: "Toyota",
  model: "Corolla",
  year: 2020,
  color: "white",
};

console.log("Original car", car);

car.year = 2021;
car.color = "red";
console.log("Después de modificar", car);

// añadir una NUEVA propiedad
car.price = 25000;
car.electric = false;

console.log("Después de añadir propiedades", car);

// CASO PRÁCTICO: Actualizar stock de producto
const item = {
  id: 101,
  name: "Mouse",
  stock: 25
};

console.log("Stock inicial:", item.stock);

// Vender 5 unidades
item.stock = item.stock - 5;
console.log("Después de vender 5:", item.stock);

// Operador de asignación compuesta
item.stock -= 3; // Vender 3 más
console.log("Después de vender 3 más:", item.stock);

// Recibir nuevos productos
item.stock += 20;
console.log("Después de recibir 20:", item.stock);


// ============================================
// 5. ELIMINAR PROPIEDADES - delete
// ============================================
const account = {
  username: "john_doe",
  email: "john_doe@email.com",
  password: "secret124",
  loginAttempts: 2
};

console.log("Account original", account);

delete account.loginAttempts;
delete account.password;

console.log("Después de eliminar", account);
console.clear();

// CASO PRÁCTICO: Limpiar carrito después de compra
const order = {
  items: ["Laptop", "Mouse"],
  total: 1025,
  tempDiscount: 50,
  couponCode: "TEM2024",
};

console.log("Compra inicial:", order);

// Aplicar descuento y limpiar temporales
order.total -= order.tempDiscount;
delete order.tempDiscount;
delete order.couponCode;

console.log("Orden final:", order);
console.clear();

const course = {
  name: "JS",
  hour: "19:00",
  price: 10,
};

const courseName = course.name;

delete course.name;

console.log(course);
console.log(courseName);


console.clear();


// ============================================
// 6. RECORRER OBJETOS - for...in
// ============================================

// for...in iterar sobre las CLAVES de un objeto

const book = {
  title: "Javascript Guide",
  author: "John Doe",
  pages: 350,
  published: 2024,
  available: true,
};

console.log("Libro", book);

for (let key in book) {
  console.log(`${key}: ${book[key]}`);
}

console.clear();

// Caso práctico:validar campos de form
const formData = {
  username: "zoe_dev",
  email: "zoe@example.com",
  password: "pass123",
  confirmPasswprd: "",
  terms: false,
}

let hasError = false;

for (let field in formData) {

  const value = formData[field];

  if (value === "" || value === false) {
    console.log(`${field} Campo vacío o inválido`);
    hasError = true;
  } else {
    console.log(`${field}: OK`)
  }
}

if (hasError) {
  console.log("Formulario con errores");
} else {
  console.log("Formular válido");
}

console.clear();

// CASO PRÁCTICO: Contar tipos de propiedades
const data = {
  name: "Pepe",
  age: 40,
  active: true,
  score: "100",
  city: "Madrid",
  premium: false,
}

let strings = 0;
let numbers = 0;
let booleans = 0;

for (let key in data) {

  const value = data[key];

  if (typeof value === "string") strings++;
  if (typeof value === "number") numbers++;
  if (typeof value === "boolean") booleans++;

}

console.log(`Strings: ${strings}`);
console.log(`Numbers: ${numbers}`);
console.log(`Booleans: ${booleans}`);

//  CONTEXTO:
// "Trabajas en una app de gestión de un taller de coches.
// "Necesitas modelar los datos de los vehículos que entran al taller.
// "Piensa en QUÉ información es importante guardar y CÓMO organizarla.
// "PARTE 1: MODELADO DE DATOS
// "════════════════════════════════════════════════════════════
// "Crea un objeto que represente un coche con TODA esta información:
// "DATOS BÁSICOS:
// "  • Matrícula (ej: '1234-ABC')
// "  • Marca (ej: 'Toyota')
// "  • Modelo (ej: 'Corolla')
// "  • Año de fabricación
// "  • Kilómetros totales
// "  • Color\n");
// "DATOS DEL PROPIETARIO:
// "  • Nombre completo
// "  • Teléfono
// "  • Email\n");
// "EQUIPAMIENTO DE SEGURIDAD:
// "  • ¿Tiene baliza V16? (sí/no)
// "  • Si tiene baliza: ¿está homologada? (sí/no)
// "  • Fecha de la última ITV

const car3 = {
  licensePlate: "1234-ABC",
  brand: "Seat",
  model: "Tarraco",
  year: 2019,
  kilometers: 123000,
  owner: {
    name: "Ítalo Ravina",
    phone: "+34 123 345555",
  },
  safety: {
    hasV16Beacon: true,
    v16Approved: true,
    lastITV: "2025-03-15"
  },
  tires: {
    frontLeft: 2.2,
    frontRight: 2.2,
    backLeft: 1.7,
    backRight: 2.0
  }
}

// Puede exister array de objetos
const tallerCoches = [
  {
    licensePlate: "1234-ABC",
    brand: "Toyota",
    model: "Corolla",
    year: 2019,
    kilometers: 45000,
    owner: {
      name: "Ana García",
      phone: "+34 612 345 678"
    },
    safety: {
      hasV16Beacon: true,
      v16Approved: true,
      lastITV: "2024-01-10"  // caducada (más de 1 año)
    },
    tires: {
      frontLeft: 2.2,
      frontRight: 2.2,
      rearLeft: 1.7,
      rearRight: 2.0
    },
    visits: [
      { date: "2024-01-10", service: "ITV", cost: 45, description: "ITV pasada con éxito" },
      { date: "2024-06-20", service: "Cambio de aceite", cost: 80, description: "Aceite 5W30 + filtro" }
    ]
  },
  {
    licensePlate: "5678-XYZ",
    brand: "Ford",
    model: "Focus",
    year: 2017,
    kilometers: 98000,
    owner: {
      name: "Carlos López",
      phone: "+34 699 876 543"
    },
    safety: {
      hasV16Beacon: false,
      v16Approved: false,
      lastITV: "2025-03-15"  // vigente
    },
    tires: {
      frontLeft: 1.5,  // baja presión
      frontRight: 2.1,
      rearLeft: 2.0,
      rearRight: 1.4   // baja presión
    },
    visits: [
      { date: "2025-03-15", service: "Revisión general", cost: 120, description: "Frenos + ITV" }
    ]
  },
  {
    licensePlate: "9999-ZZZ",
    brand: "Seat",
    model: "Ibiza",
    year: 2021,
    kilometers: 22000,
    owner: {
      name: "María Torres",
      phone: "+34 655 111 222"
    },
    safety: {
      hasV16Beacon: true,
      v16Approved: true,
      lastITV: "2023-11-01"  // caducada (más de 1 año)
    },
    tires: {
      frontLeft: 2.3,
      frontRight: 2.3,
      rearLeft: 2.1,
      rearRight: 2.2
    },
    visits: []
  }
];

console.clear();


// ============================================
// MÉTODOS ÚTILES DE OBJECT
// ============================================

const smartphone = {
  brand: "Samsung",
  model: "Galaxy s21",
  storage: 256,
  price: 799,
}

// Object.keys() -> Obtiene array de CLAVES

const keys = Object.keys(smartphone);
console.log(keys);

// Object.values() -> Obtiene array de VALORES
const values = Object.values(smartphone);
console.log(values);

// Object.entries() -> Obtiene array de pares [clave, valor]
const entries = Object.entries(smartphone);
console.log(entries); // [['brand', 'Samsung,], [], []]

// Caso práctico
const student3 = {
  name: "Pepe",
  city: "Madrid",
  phone: "666555444",
  username: "pepe123",
}

delete student3.name;

const studentKeys = Object.keys(student3);
console.log("student keys", studentKeys);


// CASO PRÁCTICO: Buscar valor máximo
const prices = {
  laptop: 999,
  mouse: 25,
  keyboard: 75,
  monitor: 1500
}

console.log(prices);

const priceValues = Object.values(prices);
console.log(priceValues);

let maxPrice = priceValues[0];
for (let price of priceValues) {

  if (price > maxPrice) {
    maxPrice = price
  }
}

console.log(`Precio máximo ${maxPrice}`);


// CASO PRÁCTICO: Convertir objeto a lista legible
const laptop = {
  processor: "Intel i7",
  ram: "16GB",
  storage: "512GB SSD",
  screen: "15.6 pulgadas"
};

console.log("Características del laptop:");
const characteristics = Object.entries(laptop);

for (let [key, value] of characteristics) {
  console.log(`• ${key}: ${value}`);
}

console.clear();


// CASO PRÁCTICO: Filtrar propiedades por tipo
const stats = {
  name: "Player1",
  level: 10,
  score: 1500,
  role: "warrior",
  health: 100,
  mana: 50,
};


console.log(stats);

const numericStats = {};

for (let [key, value] of Object.entries(stats)) {

  if (typeof value === "number") {
    numericStats[key] = value;
  }

}

// numericStats["killers"] = 12;

console.log(numericStats);


// ============================================
// EJERCICIO PRÁCTICO INTEGRADOR
// ============================================

// Sistema de gestión de productos
const inventory = {
  product1: {
    name: "Laptop",
    price: 999,
    stock: 10,
    category: "electronics"
  },
  product2: {
    name: "Mouse",
    price: 25,
    stock: 50,
    category: "electronics"
  },
  product3: {
    name: "Desk",
    price: 200,
    stock: 5,
    category: "furniture"
  },
  product4: {
    name: "Chair",
    price: 150,
    stock: 0,
    category: "furniture"
  }
};

console.log("Inventario completo:");
console.log(inventory);

// 1. Listar todos los productos
for (let productId in inventory) {
  const product = inventory[productId];
  console.log(`${product.name} - $${product.price} (Stock: ${product.stock})`);
}

// 2. Productos sin stock
for (let productId in inventory) {
  const product = inventory[productId];
  if (product.stock === 0) {
    console.log(`• ${product.name}`);
  }
}

// 3. Valor total del inventario
let totalValue = 0;

for (let productId in inventory) {
  const product = inventory[productId];
  const productValue = product.price * product.stock;
  totalValue += productValue;
  console.log(`${product.name}: $${product.price} × ${product.stock} = $${productValue}`);
}

console.log(`Valor total: $${totalValue}`);

// 4. Productos por categoría
const categories = {};

for (let productId in inventory) {
  const product = inventory[productId];
  const category = product.category;

  if (!categories[category]) {
    categories[category] = [];
  }

  categories[category].push(product.name);
}

for (let category in categories) {
  console.log(`${category}:`, categories[category]);
}
