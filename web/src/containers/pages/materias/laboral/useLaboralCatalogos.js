// src/pages/materias/laboral/LaboralProcedimientoPage/useLaboralCatalogos.js

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { actionEstadosGet } from "../../../../redux/actions/estados/estados";
import { actionCiudadesGet } from "../../../../redux/actions/ciudades/ciudades";
import { actionEmpresasGet } from "../../../../redux/actions/empresas/empresas";

export default function useLaboralCatalogos(selectedEstadoId, selectedCiudadId) {
  const dispatch = useDispatch();

  const estadosSlice = useSelector((state) => state.estados || {});
  const ciudadesSlice = useSelector((state) => state.ciudades || {});
  const empresasSlice = useSelector((state) => state.empresas || {});

  useEffect(() => {
    dispatch(actionEstadosGet({}));
    dispatch(actionCiudadesGet({}));
    dispatch(actionEmpresasGet({}));
  }, [dispatch]);

  const estadosItems = useMemo(
    () => estadosSlice?.data?.items || [],
    [estadosSlice?.data]
  );

  const ciudadesItems = useMemo(
    () => ciudadesSlice?.data?.items || [],
    [ciudadesSlice?.data]
  );

  const empresasItems = useMemo(
    () => empresasSlice?.data?.items || [],
    [empresasSlice?.data]
  );

  const estadosOptions = useMemo(
    () =>
      estadosItems.map((e) => ({
        label: e.nombre ?? e.code ?? `Estado ${e.id}`,
        value: e.id,
      })),
    [estadosItems]
  );

  const ciudadesOptions = useMemo(() => {
    if (!selectedEstadoId) return [];
    return ciudadesItems
      .filter((c) => String(c.id_estado) === String(selectedEstadoId))
      .map((c) => ({
        label: c.nombre ?? c.code ?? `Ciudad ${c.id}`,
        value: c.id,
      }));
  }, [ciudadesItems, selectedEstadoId]);

  const empresasOptions = useMemo(
    () =>
      empresasItems.map((e) => ({
        label: e.nombre || e.razon_social || e.alias || `Empresa ${e.id}`,
        value: e.id,
      })),
    [empresasItems]
  );

  const estadoSeleccionado = useMemo(
    () =>
      estadosItems.find((e) => String(e.id) === String(selectedEstadoId)) || null,
    [estadosItems, selectedEstadoId]
  );

  const ciudadSeleccionada = useMemo(
    () =>
      ciudadesItems.find((c) => String(c.id) === String(selectedCiudadId)) || null,
    [ciudadesItems, selectedCiudadId]
  );

  const estadosById = useMemo(() => {
    return estadosItems.reduce((acc, e) => {
      acc[e.id] = e;
      return acc;
    }, {});
  }, [estadosItems]);

  const ciudadesById = useMemo(() => {
    return ciudadesItems.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});
  }, [ciudadesItems]);

  return {
    estadosOptions,
    ciudadesOptions,
    empresasOptions,
    estadoSeleccionado,
    ciudadSeleccionada,
    estadosById,
    ciudadesById,
  };
}
