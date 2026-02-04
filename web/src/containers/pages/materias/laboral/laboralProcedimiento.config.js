// src/pages/materias/laboral/LaboralProcedimientoPage/laboralProcedimiento.config.js

export const PAGE_SIZE = 25;

// Config por tipo de procedimiento laboral
export const laboralTiposConfig = {
  "centro-conciliacion": {
    key: "centro-conciliacion",
    title: "Centro de conciliación",
    shortLabel: "Centro conciliación",
    tag: "Prejudicial",
  },
  tribunal: {
    key: "tribunal",
    title: "Tribunal laboral",
    shortLabel: "Tribunal laboral",
    tag: "Judicial",
  },
  "fuera-de-juicio": {
    key: "fuera-de-juicio",
    title: "Procedimiento fuera de juicio",
    shortLabel: "Fuera de juicio",
    tag: "Especial",
  },
  "junta-conciliacion": {
    key: "junta-conciliacion",
    title: "Junta de conciliación",
    shortLabel: "Junta conciliación",
    tag: "Histórico",
  },
  desvinculacion: {
    key: "desvinculacion",
    title: "Desvinculación",
    shortLabel: "Bajas",
    tag: "Bajas",
  },
};
