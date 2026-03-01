// ============================================
// FUNCIONES AVANZADAS
// ============================================
console.log("funciones avanzadas");


// ============================================
// 1. PARÁMETROS PREDETERMINADOS (Defaults)
// ============================================

function greetOld(name) {

  if (name === undefined) {
    name = "Guest";
  }
  console.log(`Hola ${name}`);
}

greetOld("Pedro");
greetOld();

// Hay una manera mejor (ES6):
function greet(name = "Guest Predet", rol = "user") {
  console.log(`Hola ${name}, tu rol es ${rol}`);
}

greet("Angel", "admin");
greet();

// MÚLTIPLES parámetros con defaults
function createUser(name = "anonymous", role = "user", active = true) {

  return {
    name,
    role,
    active: active
  }
}

console.log(createUser());
console.log(createUser("Adriana"));
console.log(createUser("Laura", "moderator", false)); // Todos especificados


// IMPORTANTE: Orden de parámetros
function configure(host = "localhost", port = 3000, debug = false) {
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Debug: ${debug}`);
}

// ¿Cómo especificar solo el tercer parámetro?
configure(undefined, undefined, true); // Usar undefined para saltar -> no usar 0, null o false...

// CASO PRÁCTICO: Función de descuento
function calculatePrice(price, discount = 0, tax = 0.21) {
  const afterDiscount = price - (price * discount);
  const total = afterDiscount * (1 + tax);
  return total;
}

console.log("Precio sin descuento:", calculatePrice(100));
console.log("Con 10% descuento:", calculatePrice(100, 0.10));
console.log("Con descuento y sin IVA:", calculatePrice(100, 0.10, 0));


// CASO PRÁCTICO: Conexión a base de datos -> usa destructuring y valores por defecto, pero hay dos niveles distintos de "por defecto" que conviene diferenciar:
// config es un parámetro, si no llevase las llaves vacías, daría error al llamarlo a primera vez. Por otra parte está desestructurando el objeto, y lo que dice es, si host o port... es undefined, usa el parámetro definido.
function connectDatabase(config = {}) {

  const {
    host = "localhost",
    port = 5432,
    database = "myapp",
    user = "admin",
    password
  } = config;

  console.log("Conectando a la base de datos:");
  console.log(`Host: ${host}, Puerto: ${port}, Database: ${database}, userName: ${user}`);
  console.log(` Password: ${password ? "***" : "No especificado"}`)
}

connectDatabase(); // Todo por defecto -> aqui hacer ejemplo borrando las llaves del parámetro config de la función.
connectDatabase({ password: "secret1234" });  // Solo password
connectDatabase({
  host: 'production.db',
  port: 3306,
  password: "prod123"
});


// VALORES DINÁMICOS como defaults
// new Date();
function logMessage(message, timestamp = new Date().toISOString()) {

  console.log(`[${timestamp}]: ${message}`);
}

logMessage("Primera llamada");
logMessage("Segunda llamada");

console.clear();


// ============================================
// 2. PARÁMETROS REST (...)
// ============================================
// Agrupar parámetros en un array

function sum(a, b) {
  return a + b;
}

console.log(sum(2, 3));
console.log(sum(2, 3, 7));

function sum1(...numbers) {

  console.log(`${numbers}`);

  let total = 0;
  for (let num of numbers) {
    total += num;
  }

  return total;

}

console.log(sum1(5, 10));
console.log(sum1(1, 2, 5, 10, 34));
console.log(sum());               // 0 (array vacío)


// CASO PRÁCTICO: Función de multiplicación
function multiply(...numbers) {
  if (numbers.length === 0) return 0;

  let result = 1;
  for (let num of numbers) {
    result *= num;
  }
  return result;
}

console.log("2 x 3:", multiply(2, 3));
console.log("2 x 3 x 4:", multiply(2, 3, 4));
console.log("2 x 3 x 4 x 5:", multiply(2, 3, 4, 5));

console.clear();

// COMBINANDO parámetros normales con rest
function createTeam(leader, ...members) {
  console.log("Líder:", leader);
  console.log("Miembros:", members);

  return {
    leader: leader,
    members: members,
    size: members.length + 1
  };
}

const team1 = createTeam("Ana", "Carlos", "Laura", "Pedro");
console.log(team1);

const team2 = createTeam("Boss");
console.log(team2);

// IMPORTANTE: Rest DEBE ser el último parámetro
// function invalid(a, ...rest, b) {} // ERROR de sintaxis
function valid(a, b, ...rest) {      // Correcto
  console.log("a:", a);
  console.log("b:", b);
  console.log("rest:", rest);
}

valid(1, 2, 3, 4, 5);


// CASO PRÁCTICO: Calcular promedio
function average(...grades) {
  if (grades.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let grade of grades) {
    sum += grade;
  }

  return sum / grades.length;
}

console.log("Promedio de 85, 90, 78:", average(85, 90, 78));
console.log("Promedio de 100, 95, 88, 92:", average(100, 95, 88, 92));

// CASO PRÁCTICO: Encontrar máximo
function max(...numbers) {
  if (numbers.length === 0) {
    return undefined;
  }

  let maximum = numbers[0];
  for (let num of numbers) {
    if (num > maximum) {
      maximum = num;
    }
  }
  return maximum;
}

console.log("Max de 5, 2, 9, 1:", max(5, 2, 9, 1));
console.log("Max de 100, 200, 50:", max(100, 200, 50));


// REST vs SPREAD (importante diferenciar)

// REST: en PARÁMETROS (agrupa argumentos en array)
function restExample(...args) {
  console.log("REST - agrupa en array:", args);
}

restExample(1, 2, 3);

// SPREAD: en LLAMADAS (expande array en argumentos)
const numbers2 = [1, 2, 3];
console.log("SPREAD - expande array:", ...numbers2);

// Usar ambos juntos
const nums = [5, 2, 9, 1, 7];
console.log("Máximo usando spread:", max(...nums)); // Expandir array en argumentos



// ============================================
// 3. CLOSURES (CIERRES)
// ============================================

// Es una función que "recuerda" las variables de su entorno

function outer() {

  const message = "Hola desde fuera";

  function inner() {
    console.log(message); // inner puede acceder a message
  }

  return inner;
}

const myFunction = outer();
myFunction();


// DENTRO DE OBJETOS PUEDO GUARDAR LO QUE SEA, INCLUSO FUNCIONES  
// Caso práctico -> contador
function createCounter() {

  let count = 0; // variable privada

  return {
    increment: function () {
      count++;
      console.log("Count:", count);
    },
    decrement: function () {
      count--;
      console.log("Count:", count);
    },
    getCount: function () {
      return count;
    }
  }
}

const counter1 = createCounter();
counter1.increment();
counter1.increment();
counter1.increment();
counter1.decrement();
counter1.increment();
counter1.increment();
console.log("Valor actual:", counter1.getCount());

const counter2 = createCounter();
counter2.increment();
counter2.increment();
counter2.increment();

console.clear();


// CASO PRÁCTICO: Factory de funciones

function createMultiplier(factor) {
  // 'factor' queda guardado en el closure
  return function (number) {
    return number * factor;
  };
}

const double = createMultiplier(2);
const triple = createMultiplier(3);
const times10 = createMultiplier(10);

console.log("double(5):", double(5));     // 10
console.log("triple(5):", triple(5));     // 15
console.log("times10(5):", times10(5));   // 50


// CASO PRÁCTIC: Sistema de autenticación
function createAuth() {

  let isAuthenticated = false;
  let currentUser = null;

  return {

    login: function (username, password) {
      if (password === "secret123") {
        isAuthenticated = true;
        currentUser = username;
        console.log(`${username} is logged in`)
        return true;
      } else {
        console.log("Invalid crendentials");
        return false;
      }
    },
    logout: function () {
      if (isAuthenticated) {
        console.log(`Bye ${currentUser} logged out`);
        isAuthenticated = false;
        currentUser = null;
      }
    },
    getCurrentUser: function () {
      if (isAuthenticated) {
        return currentUser;
      } else {
        return null;
      }
    },
    isLoggedIn: () => isAuthenticated // return implícito
  }
}

const auth = createAuth();
console.log("Logged in?", auth.isLoggedIn());
auth.login("ana", "wrong");
auth.login("ana", "secret123");
console.log("Current user:", auth.getCurrentUser());
auth.logout();

const auth2 = createAuth();
auth2.login("pepe", "secret123");
auth2.logout();


// ============================================
// EJERCICIO PRÁCTICO INTEGRADOR
// ============================================

// EJERCICIO PRÁCTICO: CARRITO DE COMPRAS

function createShoppingCart() {
  let items = []; // Array privado
  let discountRate = 0; // Descuento privado

  return {
    addItem: function (name, price, quantity = 1) {
      items.push({ name, price, quantity });
      console.log(`✅ Added: ${quantity}x ${name} ($${price})`);
    },

    removeItem: function (name) {
      const index = items.findIndex(item => item.name === name);
      if (index !== -1) {
        const removed = items.splice(index, 1)[0];
        console.log(`Removed: ${removed.name}`);
        return true;
      }
      console.log(`Item not found: ${name}`);
      return false;
    },

    setDiscount: function (rate) {
      discountRate = rate;
      console.log(`Discount set to ${rate * 100}%`);
    },

    getTotal: function () {
      let subtotal = 0;

      for (let item of items) {
        subtotal += item.price * item.quantity;
      }

      const discount = subtotal * discountRate;
      const total = subtotal - discount;

      return {
        subtotal: subtotal,
        discount: discount,
        total: total
      };
    },

    showCart: function () {

      if (items.length === 0) {
        console.log("(vacío)");
        return;
      }

      for (let item of items) {
        const itemTotal = item.price * item.quantity;
        console.log(`${item.quantity}x ${item.name} - $${itemTotal}`);
      }

      const totals = this.getTotal();
      console.log(`Subtotal: $${totals.subtotal}`);
      if (totals.discount > 0) {
        console.log(`Descuento: -$${totals.discount}`);
      }
      console.log(`TOTAL: $${totals.total}`);
    }
  };
}

// Usar el carrito
const cart = createShoppingCart();

cart.addItem("Laptop", 999);
cart.addItem("Mouse", 25, 2);
cart.addItem("Keyboard", 75);

cart.showCart();

cart.setDiscount(0.10); // 10% descuento
cart.showCart();

cart.removeItem("Mouse");
cart.showCart();

// Crear otro carrito independiente
const cart2 = createShoppingCart();
cart2.addItem("Monitor", 300);
cart2.showCart();
