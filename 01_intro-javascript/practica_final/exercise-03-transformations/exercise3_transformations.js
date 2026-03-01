const data = [
  {
    id: 1,
    nombre: "Juan",
    habilidades: ["JavaScript", "HTML", "CSS"],
    proyectos: [
      { id: 1, nombre: "Proyecto 1" },
      { id: 2, nombre: "Proyecto 2" },
    ],
  },
  {
    id: 2,
    nombre: "Maria",
    habilidades: ["Python", "SQL", "Django"],
    proyectos: [
      { id: 3, nombre: "Proyecto 3" },
      { id: 4, nombre: "Proyecto 4" },
    ],
  },
  {
    id: 4,
    nombre: "Miriam",
    habilidades: ["UX", "Figma", "HTML", "JavaScript"],
    proyectos: [
      { id: 5, nombre: "Proyecto 1" },
      { id: 6, nombre: "Proyecto 4" },
    ],
  },
];

const javascriptDevelopers = data.filter((developer) =>
  developer.habilidades.includes("JavaScript")
);

const projectsNames = [];

data.forEach((developer) => {
  developer.proyectos.forEach((project) => {
    if (!projectsNames.includes(project.nombre)) {
      projectsNames.push(project.nombre);
    }
  });
});

console.log("const javascriptDevelopers =", JSON.stringify(javascriptDevelopers, null, 2));
console.log("const projectsNames =", JSON.stringify(projectsNames));
