// console.log("async await");

// CONCEPTO:
// async/await es 'azúcar sintáctico' sobre Promises.
// Hace que el código asíncrono se vea SÍNCRONO (más legible).

// REGLAS:
//   • Usar 'async' antes de la función
//   • Usar 'await' antes de una Promise
//   • await solo funciona dentro de funciones async
//   • async siempre retorna una Promise


// Ejemplo básico
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ejemploAsync() {
  console.log("Inicio");
  await esperar(1000);
  console.log("Después de 1 segundo");
  await esperar(1000);
  console.log("Después de 2 segundos");
  return "Completado";
}

ejemploAsync().then(resultado => console.log(resultado));


// COMPARACIÓN: Promises vs Async/Await
function prepararIngredientes() {

  return new Promise((resolve, reject) => {

    const ok = true;
    console.log("Preparando ingredientes...");
    setTimeout(() => {

      if (ok) {
        console.log("Ingredientes listos");
        resolve();
      } else {
        reject({
          code: 404,
          msg: "No hay ingredientes"
        })
      }

    }, 1000);
  })
}

function cocinarPlato() {

  return new Promise((resolve) => {
    console.log("Cocinando...");
    setTimeout(() => {
      console.log("Plato cocinado");
      resolve();
    }, 1500)
  })
}

function servirPlato() {

  return new Promise((resolve) => {
    console.log("Sirviendo...");
    setTimeout(() => {
      console.log("Plato servido!");
      resolve();
    }, 500);
  })
}


// Then ... catch
function cocinarConPromises() {
  console.log("cocinar con promesas:")
  return prepararIngredientes()
    .then(() => cocinarPlato())
    .then(() => servirPlato())
    .then(() => {
      console.log("Comida lista")
    })
    .catch(error => {
      console.log("Error", error)
    })
}
cocinarConPromises();


// ASYNC - AWAIT

async function cocinarConAsync() {
  console.log("Cocinando con Async/Await")
  try {
    await prepararIngredientes();
    await cocinarPlato();
    await servirPlato();
    console.log('Comida lista!');
  } catch (error) {
    // CAPTURAR EL ERROR
    console.error(" Esto ha fallado con error: ", error.msg);
  } finally {
    console.log("Todo ha finalizado, limpiar cocina");
  }
}
cocinarConAsync();


// CASO PRÁCTICO: Fetch de API

async function obtenerUsuario(userId) {
  try {
    console.log(`Obteniendo usuario ${userId}...`);

    // Simular petición a API
    await esperar(1000);

    if (userId <= 0) {
      throw new Error("ID de usuario inválido");
    }

    const usuario = {
      id: userId,
      name: "Usuario " + userId,
      email: `user${userId}@example.com`
    };

    console.log("Usuario obtenido:", usuario);
    return usuario;

  } catch (error) {
    console.log("Error:", error.message);
    throw error; // Re-lanzar el error
  }
}

// Usar la función async
(async () => {
  const user = await obtenerUsuario(1);
  console.log("Usuario procesado:", user.name);
})();


// CASO PRÁCTICO: Cargar datos en paralelo

async function cargarDatos() {
  console.log("Cargando datos de dashboard...");

  try {
    // MAL: Esperar una por una (secuencial - lento)
    console.log("Forma secuencial (lenta):");
    const inicio1 = Date.now();

    const users = await fetchAPI("/api/users", 1000);
    const posts = await fetchAPI("/api/posts", 1000);
    const comments = await fetchAPI("/api/comments", 1000);

    const tiempo1 = Date.now() - inicio1;
    console.log(`  Tiempo total: ${tiempo1}ms`); // ~3000ms

    // BIEN: Lanzar todas a la vez (paralelo - rápido)
    console.log("\n✅ Forma paralela (rápida):");
    const inicio2 = Date.now();

    const [users2, posts2, comments2] = await Promise.all([
      fetchAPI("/api/users", 1000),
      fetchAPI("/api/posts", 1000),
      fetchAPI("/api/comments", 1000)
    ]);

    const tiempo2 = Date.now() - inicio2;
    console.log(`Tiempo total: ${tiempo2}ms`); // ~1000ms

  } catch (error) {
    console.log("Error cargando datos:", error);
  }
}


// TRY/CATCH con async/await
// new Error

async function procesarPago(cantidad) {

  try {
    console.log(`Procesando pago de ${cantidad}`);

    await esperar(1000);

    if (cantidad <= 0) {
      throw new Error("Cantidad inválida");
    }

    if (cantidad > 1000) {
      throw new Error("Fondos insufcientes");
    }

    console.log("Pago procesado exitosamente");
    return { ok: true, cantidad, code: 200 }

  } catch (error) {
    console.error("Error en pago", error.message);
    return { ok: false, error }
  } finally {
    console.log("Cerrando conexión con el banco");
  }
}

(async () => {
  const process1 = await procesarPago(500);

  console.log(process1.ok);

  if (process1.ok) {
    alert("Todo ha ido bien, majo!")
  }

  // await procesarPago(1500);
  // await procesarPago(-100);
})();



// ============================================
// EJERCICIO PRÁCTICO INTEGRADOR
// ============================================

// Simular base de datos
const database = {
  users: {
    1: { id: 1, name: "Ana", email: "ana@example.com", saldo: 500 },
    2: { id: 2, name: "Carlos", email: "carlos@example.com", saldo: 200 }
  },
  products: {
    101: { id: 101, name: "Laptop", price: 1000, stock: 5 },
    102: { id: 102, name: "Mouse", price: 25, stock: 50 },
    103: { id: 103, name: "Keyboard", price: 75, stock: 0 }
  }
};

// Funciones async para el sistema
async function buscarUsuario(userId) {
  console.log(`Buscando usuario ${userId}...`);
  await esperar(500);

  const user = database.users[userId];
  if (!user) {
    throw new Error(`Usuario ${userId} no encontrado`);
  }

  console.log(`✅ Usuario encontrado: ${user.name}`);
  return user;
}

async function buscarProducto(productId) {
  console.log(`Buscando producto ${productId}...`);
  await esperar(500);

  const product = database.products[productId];
  if (!product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  console.log(`Producto encontrado: ${product.name}`);
  return product;
}

async function verificarStock(product) {
  console.log(`Verificando stock de ${product.name}...`);
  await esperar(300);

  if (product.stock === 0) {
    throw new Error(`${product.name} agotado`);
  }

  console.log(`Stock disponible: ${product.stock} unidades`);
  return true;
}

async function procesarPagoUsuario(user, amount) {
  console.log(`Procesando pago de ${amount}€ para ${user.name}...`);
  await esperar(800);

  if (user.saldo < amount) {
    throw new Error("Saldo insuficiente");
  }

  user.saldo -= amount;
  console.log(`Pago procesado. Nuevo saldo: ${user.saldo}€`);
  return { success: true, newBalance: user.saldo };
}

async function generarFactura(user, product) {
  console.log("Generando factura...");
  await esperar(400);

  const invoice = {
    invoiceId: Math.random().toString(36).substr(2, 9),
    user: user.name,
    product: product.name,
    price: product.price,
    date: new Date().toISOString()
  };

  console.log("Factura generada:", invoice.invoiceId);
  return invoice;
}

// Función principal que orquesta todo
async function realizarPedido(userId, productId) {
  console.log(`NUEVO PEDIDO: Usuario ${userId}, Producto ${productId}`);

  try {
    // 1. Buscar usuario y producto en paralelo
    const [user, product] = await Promise.all([
      buscarUsuario(userId),
      buscarProducto(productId)
    ]);

    // 2. Verificar stock
    await verificarStock(product);

    // 3. Procesar pago
    await procesarPagoUsuario(user, product.price);

    // 4. Actualizar stock
    product.stock--;
    console.log(`Stock actualizado: ${product.stock} unidades restantes`);

    // 5. Generar factura
    const invoice = await generarFactura(user, product);

    console.log("PEDIDO COMPLETADO EXITOSAMENTE");
    console.log(` Factura: ${invoice.invoiceId}`);
    console.log(` Total: $${product.price}`);

    return invoice;

  } catch (error) {
    console.log("ERROR EN PEDIDO:", error.message);
    console.log("Revirtiendo cambios...");
    throw error;
  }
}

// Ejecutar varios pedidos
setTimeout(async () => {
  // Pedido 1: Exitoso
  try {
    await realizarPedido(1, 102);
  } catch (e) { }

  // Pedido 2: Producto agotado
  try {
    await realizarPedido(2, 103);
  } catch (e) { }

  // Pedido 3: Saldo insuficiente
  try {
    await realizarPedido(2, 101);
  } catch (e) { }
}, 8000);



// ============================================
// RESUMEN
// ============================================

// JavaScript es de un solo hilo (single-threaded)
// Asincronía permite ejecutar tareas 'en paralelo' sin bloquear
// CALLBACKS:
//   - Forma antigua de manejar asincronía
//   - Problema: Callback hell (anidación excesiva)
// PROMISES:
//   - Estados: pending, fulfilled, rejected
//   - Métodos: .then(), .catch(), .finally()
//   - Promise.all(): Espera a todas
//   - Promise.allSettled(): Espera a todas (sin fallar)
//   - Promise.race(): La primera que termine
//   - Promise.any(): La primera exitosa
// ASYNC/AWAIT:
//   - Sintaxis moderna sobre Promises
//   - Código más legible (parece síncrono)
//   - try/catch para errores
//   - Combinar con Promise.all para paralelismo
// CUÁNDO USAR:
//   • Peticiones HTTP → async/await con fetch
//   • Múltiples operaciones paralelas → Promise.all
//   • Timeout/delays → setTimeout con Promises
//   • Operaciones que pueden fallar → try/catch