// console.log("promises");


// ¿QUÉ ES ASINCRONÍA?

// CONCEPTO - JAVASCRIPT ES DE UN SOLO HILO:
// JavaScript ejecuta código en UN SOLO HILO (single-threaded).
// Imagina una carretera de UN SOLO CARRIL:
// Si un coche se para, TODOS los demás deben esperar:
//           (pinchó)  (esperando...)


// CÓDIGO SÍNCRONO (Bloqueante):
// Todo se ejecuta en ORDEN, una tarea tras otra.

// PROBLEMA:
// Durante la 'tarea pesada', NADA más puede ejecutarse.
// La interfaz se congela, el usuario no puede hacer nada.

// SOLUCIÓN: ASINCRONÍA
// Las tareas pesadas pueden 'salir a una carretera secundaria'

// Las operaciones ASÍNCRONAS se ejecutan 'en segundo plano'
// y notifican cuando terminan, SIN BLOQUEAR el hilo principal.


// ============================================
// CALLBACKS - La forma antigua
// ============================================

// Una función que se ejecuta cuando termina una operación, y es la forma antigua de manejar asincronía

// setTimeout -> contra tiempo para ejecutar función

console.log("1. Inicio");

setTimeout(() => {
  console.log("2. Esto se ejecuta después de un segudo");
}, 2000);

console.log("3. Esto se ejecuta, pero sale ANTES del timeout");

console.clear();


// CASO PRÁCTICO: Cadena de montaje de un coche

function ensamblarChasis(callback) {
  console.log("Ensamblando chasis...");
  setTimeout(() => {
    console.log("Chasis listo");
    callback();
  }, 1000);
}

function instalarMotor(callback) {
  console.log("Instalando motor...");
  setTimeout(() => {
    console.log("Motor listo!");
    callback();
  }, 1000);
}

function montarRuedas(callback) {
  console.log("Montando ruedas...");
  setTimeout(() => {
    console.log("Ruedas montadas!");
    callback();
  }, 1000)
}

function pintarCoche(callback) {
  console.log("Pintando coche...");
  setTimeout(() => {
    console.log("Coche pintado!");
    callback();
  }, 1000);
}

ensamblarChasis(() => {
  instalarMotor(() => {
    montarRuedas(() => {
      pintarCoche(() => {
        console.log("Coche completado!");
      })
    })
  })
});

console.clear();



// ============================================
// PROMISES - La solución moderna
// ============================================

// CONCEPTO:
// Una Promise representa el resultado FUTURO de una operación asíncrona.
// Es como un 'recibo' que te dan cuando pides algo.
//
// ANALOGÍA: Pedir comida a domicilio
//   1. Haces el pedido → Recibes un 'número de pedido' (Promise)
//   2. La comida se está preparando → PENDING (pendiente)
//   3a. La comida llega → FULFILLED (resuelta)
//   3b. Se cancela el pedido → REJECTED (rechazada)

// ESTADOS DE UNA PROMISE:
//  • PENDING (pendiente): Operación en curso
//  • FULFILLED (resuelta): Operación exitosa
//  • REJECTED (rechazada): Operación falló


// Crear una Promise básica
const miPromesa = new Promise((resolve, reject) => {

  const exito = true;

  setTimeout(() => {

    if (exito) {
      resolve("Operación exitosa!");
    } else {
      reject("Algo salió mal");
    }
  }, 1000)

});

console.log("Promesa creada:", miPromesa);

// Consumir la Promise
// then, catch y finally

miPromesa
  .then(resultado => {
    console.log("Then:", resultado);
  })
  .catch(error => {
    console.error("Catch:", error);
  })
  .finally(() => {
    console.log("Promesa finalizada");
  });


// CASO PRÁCTICO: Viaje a Disney
function planificarViajeDisney() {
  return new Promise((resolve, reject) => {
    console.log("Planificando viaje...");
    setTimeout(() => {
      const tienePresupuesto = true;
      const hayVuelos = false;

      if (tienePresupuesto && hayVuelos) {
        resolve({
          destino: "Disneyland Paris",
          fecha: "07-12-2026",
          pasajeros: 3,
          hotel: "Disneyland Hotel"
        })
      } else {
        reject({
          code: 404,
          msg: "No hay presupuesto"
        })
      }

    }, 1500);
  })
}

planificarViajeDisney()
  .then(viaje => {
    console.log("Viaje confirmado!");
    console.log('Destino:', viaje.destino);
    console.log("Fecha", viaje.fecha)
  })
  .catch(error => {
    console.warn("Viaje cancelado", error)
  });


// REFACTOR CADENA MONTAJE COCHES:

function ensamblarChasisPromise() {

  return new Promise((resolve) => {

    console.log("Ensamblando chasis...");

    setTimeout(() => {
      console.log("Chasis listo");
      resolve("chasis")
    }, 1000);
  })
}

function instalarMotorPromise() {

  return new Promise((resolve) => {

    console.log("Instalando motor...");

    setTimeout(() => {
      console.log("Motor listo!");
      resolve("motor");
    }, 1000);
  })
}

function montarRuedasPromise() {

  return new Promise((resolve) => {
    console.log("Montando ruedas...");

    setTimeout(() => {
      console.log("Ruedas montadas!");
      resolve("ruedas");
    }, 1000)
  })
}

function pintarCochePromise() {

  return new Promise((resolve, reject) => {
    console.log("Pintando coche...");

    setTimeout(() => {
      console.log("Coche pintado!");
      resolve("pintura");
    }, 1000);
  })
}


// Encadenar las promesas (muchos más legible)

ensamblarChasisPromise()
  .then(() => instalarMotorPromise())
  .then(() => montarRuedasPromise())
  .then(() => pintarCochePromise())
  .then(() => {
    console.log("Coche completado!");
  })
  .catch(error => {
    console.log("Error:", error);
  })


// CASO PRÁCTICO: Reservar hotel
console.log("\n\n--- Caso práctico: Sistema de reservas ---");

function verificarDisponibilidad(hotel, fechas) {
  return new Promise((resolve, reject) => {
    console.log(`Verificando disponibilidad en ${hotel}...`);

    setTimeout(() => {
      const disponible = Math.random() > 0.3; // 70% probabilidad

      if (disponible) {
        resolve({
          hotel: hotel,
          fechas: fechas,
          precio: 150,
          habitacion: "Suite Deluxe"
        });
      } else {
        reject(`No hay disponibilidad en ${hotel} para esas fechas`);
      }
    }, 1000);
  });
}

verificarDisponibilidad("Hotel Paradise", "15-20 Julio")
  .then(reserva => {
    console.log("Habitación disponible:");
    console.log("   Hotel:", reserva.hotel);
    console.log("   Fechas:", reserva.fechas);
    console.log("   Precio: " + reserva.precio + "€/noche");
    console.log("   Tipo:", reserva.habitacion);
  })
  .catch(error => {
    console.log("Error:", error);
  });

console.clear();


// ============================================
// 4. MÉTODOS DE PROMESAS - Múltiples promesas
// ============================================

// === PROMISE.ALL - Esperar a que TODAS se resuelvan - array de promesas

function descargarImagen(nombre, tiempo) {
  return new Promise((resolve) => {
    console.log(`Descargando ${nombre}...`);
    setTimeout(() => {
      console.log(`${nombre} descargada!`);
      resolve(nombre);
    }, tiempo)
  })
}

const descargas = [
  descargarImagen("foto1.png", 1000),
  descargarImagen("foto2.png", 1500),
  descargarImagen("foto3.jpg", 800)
];

Promise.all(descargas)
  .then(resultados => {
    console.log("Todas las imágenes descargardas:", resultados)
  })
  .catch(error => {
    console.error("Error en la descarga", error);
  })


// === PROMISE.ALLSETTLED - Espera a todas las promesas (incluso si fallan)


function fetchAPI(url, tiempoRespuesta, falla = false) {
  return new Promise((resolve, reject) => {
    console.log("fetching url:", url);
    setTimeout(() => {
      if (falla) {
        console.log(`${url} falló`);
        reject(`Error en ${url}`);
      } else {
        console.log(`${url} OK`);
        resolve(`Datos obtenidos de ${url}`)
      }
    }, tiempoRespuesta)
  })
}

const peticiones = [
  fetchAPI("/api/users", 1000),
  fetchAPI("/api/posts", 1500, true),
  fetchAPI("/api/comments", 800)
];

Promise.allSettled(peticiones)
  .then(resultados => {
    console.log("Resultados de todas las peticiones:");
    resultados.forEach((resultado, index) => {
      if (resultado.status === "fulfilled") {
        console.log(` ${index + 1}. Éxito:`, resultado.value);
      } else {
        console.log(` ${index + 1}. Error:`, resultado.reason);
      }
    });
  });


// === PROMISE.RACE - La primera que termine

function servidorRespuesta(nombre, tiempo) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`${nombre} respondió`);
      resolve(nombre);
    }, tiempo)
  })
}

const servidores = [
  servidorRespuesta("Servidor EU", 1500),
  servidorRespuesta("Servidor US", 1000),
  servidorRespuesta("Servidor Asia", 2000)
];

Promise.race(servidores)
  .then(ganador => {
    console.log(`Servidor más rápido: ${ganador}`);
  })


// ==== PROMISE.ANY - La primera que se resuelva (ignora reject)

function intentarConexion(servidor, exito, tiempo) {

  return new Promise((resolve, reject) => {

    setTimeout(() => {
      if (exito) {
        console.log(`${servidor} conectado`);
        resolve(servidor)
      } else {
        console.log(`${servidor} falló`);
        reject(`Error en ${servidor}`)
      }
    }, tiempo);
  })
}

const intentos = [
  intentarConexion("Servidor 1", false, 500),
  intentarConexion("Servidor 2", true, 1000),
  intentarConexion("Servidor 3", false, 1500)
];

Promise.any(intentos)
  .then(exitoso => {
    console.log(`Conectado a ${exitoso}`)
  })
  .catch(() => {
    console.log("Todos los servidores fallaron")
  })
