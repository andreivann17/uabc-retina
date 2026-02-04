// src/pages/materias/laboral/LaboralProcedimientoPage/useExpedientesProcedimiento.js

import { useEffect, useMemo } from "react";
import dayjs from "dayjs";

export default function useExpedientesProcedimiento({
  concSlice,
  search,
  statusFilter,
  fueroFilter,
  empresaId,          // ← CAMBIO CLAVE
  dateRange,
  currentPage,
  pageSize,
  setCurrentPage,
}) {
  const expedientesItems = useMemo(() => {
    const raw = concSlice?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.items)) return raw.items;
    return [];
  }, [concSlice]);

const searchedExpedientes = useMemo(() => {
  const term = search.trim().toLowerCase();
  if (!term) return expedientesItems;

  return expedientesItems.filter((exp) => {
    const campos = [
      exp.numero_expediente,
      exp.folio,
      exp.id,
      exp.parte_actora,
      exp.parte_demandada,
      exp.nombre_solicitante,
      exp.solicitante,
    ];

    return campos.some(
      (v) => v && String(v).toLowerCase().includes(term)
    );
  });
}, [search, expedientesItems]);

  const statusCounts = useMemo(() => {
    const base = {
      activos: 0,
      convenios: 0,
      diferimientos: 0,
      archivo: 0,
      noConciliacion: 0,
    };

    searchedExpedientes.forEach((exp) => {
      const raw = `${exp.status_nombre || exp.status || exp.estatus || ""}`.toLowerCase();

      if (raw.includes("activo")) base.activos += 1;
      else if (raw.includes("convenio")) base.convenios += 1;
      else if (raw.includes("diferim")) base.diferimientos += 1;
      else if (raw.includes("archivo")) base.archivo += 1;
      else if (raw.includes("no concili")) base.noConciliacion += 1;
    });

    return base;
  }, [searchedExpedientes]);

  const filteredExpedientes = useMemo(() => {
    let list = [...searchedExpedientes];

    if (statusFilter !== "todos") {
      list = list.filter((exp) => {
        const raw = `${exp.status_nombre || exp.status || exp.estatus || ""}`.toLowerCase();
        if (statusFilter === "activos") return raw.includes("activo");
        if (statusFilter === "convenios") return raw.includes("convenio");
        if (statusFilter === "diferimientos") return raw.includes("diferim");
        if (statusFilter === "archivo") return raw.includes("archivo");
        if (statusFilter === "noConciliacion") return raw.includes("no concili");
        return true;
      });
    }

    if (fueroFilter !== "todos") {
      list = list.filter((exp) => {
        const raw = `${exp.competencia || exp.fuero || exp.tipo_competencia || ""}`.toLowerCase();
        if (fueroFilter === "local") return raw.includes("local");
        if (fueroFilter === "federal") return raw.includes("federal");
        return true;
      });
    }

    // ===== FILTRO CORRECTO POR EMPRESA (ID) =====
    if (empresaId) {
      list = list.filter((exp) => {
        const idEmp =
          exp.id_empresa ??
          exp.empresa_id ??
          exp.empresa?.id ??
          exp.id_empresa_demandada;

        return String(idEmp) === String(empresaId);
      });
    }

    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange;
      list = list.filter((exp) => {
        const fechaRaw =
          exp.fecha ||
          exp.fecha_audiencia ||
          exp.fecha_conciliacion ||
          exp.fecha_registro ||
          exp.created_at;

        if (!fechaRaw) return false;
        const d = dayjs(fechaRaw);
        return (
          d.isValid() &&
          (d.isSame(start, "day") || d.isAfter(start, "day")) &&
          (d.isSame(end, "day") || d.isBefore(end, "day"))
        );
      });
    }

    return list;
  }, [
    searchedExpedientes,
    statusFilter,
    fueroFilter,
    empresaId,
    dateRange,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, fueroFilter, empresaId, dateRange]);

  const paginatedExpedientes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpedientes.slice(start, start + pageSize);
  }, [filteredExpedientes, currentPage, pageSize]);

  return {
    statusCounts,
    filteredExpedientes,
    paginatedExpedientes,
    totalExp: filteredExpedientes.length,
  };
}
