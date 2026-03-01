// Broken version from the original prompt
function getUser(id) {
  let user;

  setTimeout(() => {
    if (id === 1) {
      user = { id: 1, name: "John Doe" };
    }
  }, 2000);

  return user;
}

function getUserWithPromise(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id === 1) {
        resolve({ id: 1, name: "John Doe" });
      } else {
        reject(new Error("User not found"));
      }
    }, 2000);
  });
}

async function getUserWithAsyncAwait(id) {
  return getUserWithPromise(id);
}

const brokenUser = getUser(1);
console.log("Usuario (broken):", brokenUser);

getUserWithPromise(1)
  .then((user) => {
    console.log("Usuario:", user);
  })
  .catch((error) => {
    console.log("Error (Promise):", error.message);
  });

getUserWithAsyncAwait(1)
  .then((user) => {
    console.log("Usuario (async/await):", user);
  })
  .catch((error) => {
    console.log("Error (async/await):", error.message);
  });
