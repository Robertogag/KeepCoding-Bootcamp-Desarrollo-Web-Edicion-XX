// ============================================
// MUTABILIDAD, SPREAD Y DESTRUCTURING
// ============================================
console.log("mutability");

// Mutabilidad
// Tipo de datos primitivos: son INMUTABLES (no se pieden cambiar);

let x = 10;
let y = x; // y copia el VALOR

console.log("x:", x);
console.log("y:", y);

x = 20;
console.log("x:", x);
console.log("y:", y);


// MUTABILIDAD EN ARRAYS -> si son mutables, apunta al MISMO array

const arr1 = [1, 2, 3];
const arr2 = arr1; // No copia el array, sino que crea una REFERENCIA (apunta al mismo array);

console.log("arr1:", arr1);
console.log("arr2:", arr2);

arr1.push(4);

console.log("arr1", arr1);
console.log("arr2", arr2);


// Objetos tambien trabajan por referencia (MUTABLES)
const obj1 = { name: "Miriam", age: 37 };
const obj2 = obj1;

obj1.age = 26;

console.log("obj1", obj1);
console.log("obj2", obj2);

console.clear();


// CASO PRÁCTICO: Bug común
const cartOriginal = [
  { name: "laptop", price: 999 },
  { name: "mouse", price: 25 },
];

console.log("Carrito original", cartOriginal);

// carrito de descuento:
const cartDiscount = cartOriginal;

for (let item of cartDiscount) {

  item.price = item.price * 0.9;
}

console.log("carrito original", cartOriginal);
console.log("carrito descuento", cartDiscount);


// INMUTABILIDAD DE UN OBJETO - MÉTODO ÚTIL

const user = {
  name: "Ana",
  age: 30,
};

user.age = 31; // Se puede modificar
user.city = "Madrid"; // Se puede añadir
// delete user.name; // Se puede eliminar

// console.log(user); // ha cambiado
Object.freeze(user);

user.age = 32; // No cambia
user.city = "Zaragoza"; // No se añade
delete user.name; // No se elimina

console.log(user);

// Object.freeze es superficial, es decir si un objeto tiene objetos dentro, estos si mutan:
const car = {
  brand: "Seat",
  owner: {
    name: "Italo",
  }
};

Object.freeze(car);

car.brand = "Toyota";
car.owner.name = "Zoe";

console.log(car);

console.clear();


// ============================================
//  SPREAD OPERATOR (...)
// ============================================

// SPREAD EN ARRAYS -> crea copias
const original = [1, 2, 3];
const copy = [...original]; // copia del array original

console.log(original);
console.log(copy);

copy.push(4); // Modificar la copia

console.log(original);
console.log(copy);

// SPREAD EN OBJETOS:
const person1 = { name: "Carlos", age: "30" };
const person2 = { ...person1 };

person2.age = 45;

console.log(person1);
console.log(person2);

console.clear();

// WARNING: Hace copias superficiales
// Se queda en el primer nivel;
// El primer es copia y los siguientes son referencias

const cart1 = {
  user: 'pepe',
  name: 'carrito1',
  products: [
    {
      name: "laptop", price: 999, discout: 15,
      views: {
        monday: '2',
      }
    },
    { name: "mouse", price: 25 }
  ]
};

const cart2Wrong = { ...cart1 }; // copia el array, pero los objeto son referencia

cart2Wrong.name = "carrito2";
cart2Wrong.products[0].name = "monitor";

console.log('cart1', cart1);
console.log('cart2Wrong: ', cart2Wrong);

const productsCopy = { ...cart1.products };

productsCopy[1].name = "keyboard";

console.log(productsCopy);

console.log(cart1.products.views);

// SOLUCIÓN: copia profunda manual
const copyCart = structuredClone(cart1);

copyCart.products[0].views = { monday: '45' };
console.log(copyCart.products[0].views);

console.log(copyCart);

console.clear();


// EXPANDIR arrays
const arr3 = [1, 2, 3];
const arr4 = [4, 5, 6];

// Combinar arrays
const combined = [...arr3, ...arr4];
console.log("Combinado:", combined); // [1, 2, 3, 4, 5, 6]

// Añadir elementos al principio y al final
const withExtras = [0, ...arr3, 999];
console.log("Con extras:", withExtras); // [0, 1, 2, 3, 999]

// CASO PRÁCTICO: Añadir items sin modificar original
const todoList = ["Estudiar", "Hacer ejercicio"];
console.log("Lista original:", todoList);

// MAL: Modifica el original
// todoList.push("Cocinar");

// BIEN: Crear nueva lista
const newTodoList = [...todoList, "Cocinar"];
console.log("Lista original:", todoList);    // No cambió
console.log("Nueva lista:", newTodoList);     // Con el item nuevo

// EXPANDIR objetos
const defaults = {
  theme: "light",
  language: "en",
  notifications: true
};

const userPrefs = {
  theme: "dark",
  fontSize: 16
};

// Combinar objetos (las propiedades de userPrefs sobrescriben defaults)
const finalConfig = { ...defaults, ...userPrefs };
console.log("Config final:", finalConfig);
// { theme: "dark", language: "en", notifications: true, fontSize: 16 }

// CASO PRÁCTICO: Actualizar producto sin mutarlo
const product = {
  id: 1,
  name: "Laptop",
  price: 999,
  stock: 10
};

console.log("Producto original:", product);

// MAL: Mutar directamente
// product.stock = product.stock - 1;

// BIEN: Crear nuevo objeto con cambios
const updatedProduct = {
  ...product,
  stock: product.stock - 1,
  lastUpdate: "2026-01-17"
};

console.log("Producto original:", product);    // No cambió
console.log("Producto actualizado:", updatedProduct); // Con cambios

// CASO PRÁCTICO: Merge de configuraciones
const serverConfig = {
  host: "localhost",
  port: 3000,
  secure: false
};

const productionOverrides = {
  host: "api.example.com",
  secure: true,
  ssl: {
    cert: "/path/to/cert",
    key: "/path/to/key"
  }
};

const prodConfig = { ...serverConfig, ...productionOverrides };
console.log("Configuración de producción:", prodConfig);



// ============================================
// 3. DESTRUCTURING - Extraer valores o elementos de una forma más elegante
// ============================================

// No modifica el array o el objeto

const colors = ["red", "green", "blue"];

const colors1 = colors[0];
const colors2 = colors[1];
const colors3 = colors[2];

console.log(colors1, colors2, colors3);

const [first, secondColor, third] = colors;

console.log(first, secondColor, third);

// saltar elementos:
const numbers = [1, 2, 3, 4, 5];
const [uno, , tres, , cinco] = numbers;

console.log(uno);
console.log(tres);
console.log(cinco);

const coord = [10, 20];

// x2 = 10
const [x2, y2] = coord;
console.log(`Coordenadas: x= ${x2}, y = ${y2}`);


// CASO PRÁCTICO: Funciones que retornan arrays
function getMinMax(numbers) {
  let min = numbers[0];
  let max = numbers[0];

  for (let num of numbers) {
    if (num < min) min = num;
    if (num > max) max = num;
  }

  return [min, max];
}

const valores = [5, 2, 9, 1, 7];
const [minimo, maximo] = getMinMax(valores);

console.log(`Mínimo: ${minimo}, Máximo: ${maximo}`);


// DESTRUCTURING DE OBJETOS
const user4 = {
  username: "ana_dev",
  email: "ana@example.com",
  age: 34,
  city: "Madrid",
};

// Forma tradicional
const username4 = user4.username;
console.log(username4);

const email = "mail@mail.com";

// Con los dos puntos se renombran las variables del destructuring
const { username, email: emailNuevo, age, city } = user4;

console.log(emailNuevo);

// Valores por defecto:
const settings = {
  theme: "dark",
  language: "es",
};

// settings.notifications = true
const { theme, language, notifications = true } = settings;

console.log(theme, language, notifications);


// Rest de objeto usando destructuring

const fullUser = {
  id: 1,
  name: "Carlos",
  email: "carlos@email.com",
  password: "secret",
  role: "admin",
};

const { password, ...tutu } = fullUser;

console.log(`Password extraída: ${password}`);
console.log("Datos públicos:", tutu); // Sin password

console.clear();


// CASO PRÁCTICO: Extraer datos anidados
const car45 = {
  brand: "Toyota",
  model: "Corolla",
  owner: {
    name: "pedro",
    phone: "+345556566"
  },
  specs: {
    year: 2020,
    color: " white"
  }
};

const nameNormal = car45.owner.name;

// destructuring anidado:
let {
  brand,
  owner: { name: ownerName, phone },
  specs: { year }
} = car45;


ownerName = "Gloria";

console.log(`Marca: ${brand}`);
console.log("Propietario:", ownerName);
console.log(`Año: ${year}`);

console.log(car45);


// ============================================
// 4. PROBLEMAS COMUNES Y SOLUCIONES
// ============================================

// PROBLEMA 1: Copia superficial
const userData = {
  name: "Ana",
  address: {
    city: "Madrid",
    street: "Gran Vía"
  }
};

const userCopy = { ...userData }; // Copia superficial

userCopy.address.city = "Barcelona"; // Modificar objeto anidado

console.log("Original:", userData);      // City cambió a Barcelona
console.log("Copia:", userCopy);

//SOLUCIÓN: Copia profunda manual
const userCopy2 = {
  ...userData,
  address: { ...userData.address } // Copiar objeto anidado también
};

userCopy2.address.city = "Valencia";

console.log("Original:", userData);      // Sigue siendo Madrid
console.log("Copia profunda:", userCopy2); // Valencia

// PROBLEMA 2: Arrays de objetos
const students = [
  { name: "Ana", grade: 85 },
  { name: "Carlos", grade: 90 }
];

const studentsCopy = [...students]; // Copia el array, pero...

studentsCopy[0].grade = 95; // Los objetos dentro son referencias

console.log("Original:", students);      // Grade de Ana cambió
console.log("Copia:", studentsCopy);

// SOLUCIÓN: Copiar objetos también
const studentsCopy2 = students.map(student => ({ ...student }));

studentsCopy2[0].grade = 100;

console.log("Original:", students);      // No cambió
console.log("Copia correcta:", studentsCopy2); // Cambió solo la copia

// PROBLEMA 3: Pasar objetos a funciones

function addDiscount(product) {
  product.price = product.price * 0.9; // Muta el original
  return product;
}

const originalProduct = { name: "Laptop", price: 1000 };
const discountedProduct = addDiscount(originalProduct);

console.log("Original:", originalProduct);      // Cambió
console.log("Con descuento:", discountedProduct);

// No mutar, retornar nuevo objeto

function addDiscountSafe(product) {
  return {
    ...product,
    price: product.price * 0.9 // Crear nuevo objeto
  };
}

const originalProduct2 = { name: "Mouse", price: 100 };
const discountedProduct2 = addDiscountSafe(originalProduct2);

console.log("Original:", originalProduct2);      // No cambió
console.log("Con descuento:", discountedProduct2);

