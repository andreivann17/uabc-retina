// src/pages/materias/laboral/LaboralProcedimientoPage/useExpedientesProcedimiento.js

import { useEffect, useMemo } from "react";

const collapseSpaces = (str) => String(str || "").replace(/\s+/g, " ").trim();

export default function useExpedientesProcedimiento({
  concSlice,
  search,

  // Mantengo firma para no romper tu flujo actual (aunque aquí ya no se usan)
  statusFilter,
  fueroFilter,
  empresaFilter,
  empresaId,
  dateRange,

  currentPage,
  pageSize,
  setCurrentPage,
}) {
  // ====== 1) Items base (EMPRESAS) ======
  const empresasItems = useMemo(() => {
    const raw = concSlice?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.items)) return raw.items;
    return [];
  }, [concSlice]);

  // ====== Helpers ======
  const normalize = (v) => collapseSpaces(v).toLowerCase();

  const extractRazonesText = (emp) => {
    const rs = Array.isArray(emp?.razones_sociales) ? emp.razones_sociales : [];
    if (rs.length === 0) return "";
    // Une nombre + code por cada razón social
    return rs
      .map((r) => `${r?.nombre || ""} ${r?.code || ""}`.trim())
      .filter(Boolean)
      .join(" | ");
  };

  // ====== 2) Búsqueda por texto (empresa + razones sociales) ======
  const searchedEmpresas = useMemo(() => {
    const term = normalize(search);
    if (!term) return empresasItems;

    return empresasItems.filter((emp) => {
      const campos = [
        emp?.nombre,
        emp?.code,
        emp?.id,
        emp?.nombre_corresponsal,
        extractRazonesText(emp),
      ];

      return campos.some((v) => normalize(v).includes(term));
    });
  }, [search, empresasItems]);

  // ====== 3) Filtros importantes (sin inventar lógica de expediente) ======
  // Aquí solo aplico filtros que sí existen en tu objeto de empresa:
  // - active
  // - cliente_directo
  //
  // NOTA: como no me pasaste UI de filtros, los dejo "auto" (no filtra)
  // si no vienen en concSlice o no los usas. Pero ya está listo.

  const filteredEmpresas = useMemo(() => {
    let list = [...searchedEmpresas];

    // Si en algún punto decides filtrar activos/inactivos, puedes mandar:
    // statusFilter = "activos" | "inactivos" | "todos"
    if (statusFilter && statusFilter !== "todos") {
      list = list.filter((emp) => {
        const isActive = Number(emp?.active) === 1;
        if (statusFilter === "activos") return isActive;
        if (statusFilter === "inactivos") return !isActive;
        return true;
      });
    }

    // Si en algún punto decides filtrar cliente_directo/corresponsal, puedes mandar:
    // fueroFilter = "directo" | "corresponsal" | "todos"
    if (fueroFilter && fueroFilter !== "todos") {
      list = list.filter((emp) => {
        const isDirecto = Number(emp?.cliente_directo) === 1;
        if (fueroFilter === "directo") return isDirecto;
        if (fueroFilter === "corresponsal") return !isDirecto;
        return true;
      });
    }

    return list;
  }, [searchedEmpresas, statusFilter, fueroFilter]);

  // ====== 4) Reset página cuando cambia el filtro/búsqueda ======
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, fueroFilter, setCurrentPage]);

  // ====== 5) Paginación ======
  const paginatedEmpresas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmpresas.slice(start, start + pageSize);
  }, [filteredEmpresas, currentPage, pageSize]);

  return {
    // lo dejo por compatibilidad con tu page (no te rompe nada)
    statusCounts: null,

    filteredExpedientes: filteredEmpresas,
    paginatedExpedientes: paginatedEmpresas,
    totalExp: filteredEmpresas.length,
  };
}
