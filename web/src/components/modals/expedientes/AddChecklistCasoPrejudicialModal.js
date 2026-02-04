// src/components/modals/expedientes/AddExpedienteModal.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Upload,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Alert,
  Tabs,
  DatePicker,
  Radio,
  Checkbox,
  Divider,
} from "antd";
import { InboxOutlined, PlusOutlined, CheckOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import {
  actionConciliacionCreate,
  actionConciliacionUpdate, // (no usado en create, lo dejamos por compatibilidad con mode="edit")
} from "../../../redux/actions/conciliacion/conciliacion";
import { actionEmpresasGet } from "../../../redux/actions/empresas/empresas";

// Catálogos
import { actionEstadosGet } from "../../../redux/actions/estados/estados";
import { actionCiudadesGet } from "../../../redux/actions/ciudades/ciudades";
import { actionAbogadosGet } from "../../../redux/actions/abogados/abogados";
import { actionConciliacionStatusGet } from "../../../redux/actions/conciliacion_status/conciliacion_status";

import dayjs from "dayjs";

const { Dragger } = Upload;
const { Text, Title } = Typography;

/* ======================= Utilidades de saneo ======================= */
const collapseSpaces = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ");

const sanitizeByField = (name, v) => {
  const s = collapseSpaces(v);
  switch (name) {
    case "exp":
      return s.replace(/[^A-Za-z0-9_\-./ ]/g, "").slice(0, 50);
    case "actor":
    case "abogado":
    case "abogado_contrario":
    case "autoridad":
    case "trabajador_nombre":
    case "patron_nombre":
    case "puesto":
      return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]/g, "").slice(0, 100);
    case "empresa":
      return s
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,()\/\- ]/g, "")
        .slice(0, 120);
    case "estatus":
    case "especifico":
    case "motivo_baja":
    case "motivo_real":
    case "comentario":
    case "propuestas":
    case "conceptos_salario":
    case "jornada_semanal":
    case "horario":
    case "dia_descanso":
    case "cantidad_autorizada":
      return s
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,;:()\/\-# ]/g, "")
        .slice(0, 200);
    case "ciudad":
    case "estado":
      return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_\- ]/g, "").slice(0, 60);
    default:
      return s;
  }
};

const toNullIfEmptyEffective = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return v;
  return v.replace(/\s/g, "") === "" ? null : v;
};

const makeNormalizer = (field) => (v) => {
  const clean = sanitizeByField(field, v);
  return toNullIfEmptyEffective(clean) === null ? "" : clean;
};

/* ======================= Helpers Empresas/RS ======================= */
const pickCompanyName = (it) =>
  it?.nombre ??
  it?.nombre_cliente ??
  it?.empresa ??
  it?.name ??
  it?.razon_social ??
  "";

const pickCompanyId = (it) => it?.id_empresa ?? it?.id ?? null;

const buildRSOption = ({ label, value, empresa_id }) => ({
  label: collapseSpaces(label || ""),
  value: value ?? null,
  empresa_id: empresa_id ?? null,
});

const normLabel = (txt) => collapseSpaces(txt || "").trim().toLowerCase();

/* Dedup de razones sociales */
const dedupRazones = (arr = []) => {
  const map = new Map();
  for (const r of arr) {
    const key = `${normLabel(r.label)}|${r.empresa_id ?? "null"}`;
    const existing = map.get(key);
    if (!existing) map.set(key, r);
    else if (existing.value == null && r.value != null) map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es")
  );
};

const buildEmpresasIndex = (items = []) => {
  const byName = new Map();
  if (!Array.isArray(items)) return byName;

  items.forEach((it) => {
    const name = collapseSpaces(pickCompanyName(it));
    if (!name) return;

    const idEmpresa = pickCompanyId(it);
    if (!byName.has(name)) byName.set(name, { empresaIds: new Set(), razones: [] });
    const bucket = byName.get(name);
    if (idEmpresa != null) bucket.empresaIds.add(idEmpresa);

    const rsArr = Array.isArray(it?.razones_sociales) ? it.razones_sociales : [];
    rsArr.forEach((rs) => {
      const label = rs?.nombre ?? rs?.razon_social ?? rs?.name ?? "";
      const value = rs?.id_empresa_razon_social ?? rs?.id ?? null;
      const empresa_id = rs?.id_empresa ?? idEmpresa ?? null;
      if (!label) return;
      bucket.razones.push(buildRSOption({ label, value, empresa_id }));
    });

    const plainRS =
      it?.razon_social && String(it.razon_social).trim() !== ""
        ? String(it.razon_social)
        : null;
    if (plainRS)
      bucket.razones.push(
        buildRSOption({ label: plainRS, value: null, empresa_id: idEmpresa })
      );
  });

  for (const [name, bucket] of byName.entries()) {
    bucket.razones = dedupRazones(bucket.razones);
    byName.set(name, bucket);
  }
  return byName;
};

const coerceEmpresasArray = (slice) => {
  if (Array.isArray(slice)) return slice;
  if (Array.isArray(slice?.items)) return slice.items;
  if (Array.isArray(slice?.data)) return slice.data;
  if (Array.isArray(slice?.list)) return slice.list;
  if (Array.isArray(slice?.items?.data)) return slice.items.data;
  if (Array.isArray(slice?.data?.items)) return slice.data.items;
  return [];
};

/* ======================= Helper para normalizar slices genéricos ======================= */
const coerceItemsFromSlice = (slice) => {
  if (!slice) return [];
  if (Array.isArray(slice.items)) return slice.items; // { items: [...] }
  if (Array.isArray(slice.data)) return slice.data; // { data: [...] }
  if (Array.isArray(slice?.data?.items)) return slice.data.items; // { data: { items: [...] } }
  if (Array.isArray(slice?.payload?.items)) return slice.payload.items;
  return [];
};

/* ======================= Catálogo Ámbito ======================= */
const ambitoOptions = [
  { label: "Local", value: 1 },
  { label: "Federal", value: 2 },
];

/* ======================= Componente ======================= */
export default function AddExpedienteModal({
  open,
  setOpen,
  onClose,
  initialValues,
  modalTop = 32,
  forceLugar,
  mode = "create",
  recordId,
  hideImport = false,
  onSaved,
}) {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeKey, setActiveKey] = useState("form");

  // === Documentos (tab) ===
  const [documentsMap, setDocumentsMap] = useState({
    poderOriginal: null, // id_tipo_documento = 1
    copiaPoder: null, // id_tipo_documento = 2
    identificacion: null, // id_tipo_documento = 3
    contrato: null, // id_tipo_documento = 4
    citatorio: null, // id_tipo_documento = 5
  });

  const [docErrors, setDocErrors] = useState({});

  /* ======================= Cargar catálogos ======================= */
  // >>> Evitamos recargas dobles cuando open=true por StrictMode: solo cargamos una vez por apertura
  const loadedOnceForThisOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      loadedOnceForThisOpen.current = false; // reset al cerrar
      return;
    }
    if (loadedOnceForThisOpen.current) return;
    loadedOnceForThisOpen.current = true;

    dispatch(actionEmpresasGet());
    dispatch(actionEstadosGet());
    dispatch(actionCiudadesGet());
    dispatch(actionAbogadosGet());
    dispatch(actionConciliacionStatusGet());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ======================= Slices y opciones (FORMATO items[]) ======================= */
  // Empresas
  const empresasSlice = useSelector((state) => state?.empresas ?? {});
  const empresasItems = useMemo(
    () => coerceEmpresasArray(empresasSlice),
    [empresasSlice]
  );
  const empresasIndex = useMemo(
    () => buildEmpresasIndex(empresasItems),
    [empresasItems]
  );
  const empresaNombreOptions = useMemo(() => {
    const names = Array.from(empresasIndex.keys());
    return names
      .map((n) => ({ label: n, value: n }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [empresasIndex]);

  // Estados, Ciudades, Abogados
  const estadosSlice = useSelector((state) => state.estados || {});
  const ciudadesSlice = useSelector((state) => state.ciudades || {});
  const abogadosSlice = useSelector((state) => state.abogados || {});

  const estadosItems = useMemo(() => coerceItemsFromSlice(estadosSlice), [estadosSlice]);
  const ciudadesItems = useMemo(() => coerceItemsFromSlice(ciudadesSlice), [ciudadesSlice]);
  const abogadosItems = useMemo(() => coerceItemsFromSlice(abogadosSlice), [abogadosSlice]);

  // Opciones Estado
  const estadoOptions = useMemo(
    () =>
      estadosItems
        .map((e) => ({
          label: collapseSpaces(e?.nombre || ""),
          value: collapseSpaces(e?.nombre || ""),
          _id: e?.id,
        }))
        .filter((o) => o.label),
    [estadosItems]
  );

  // Mapa nombre Estado -> id
  const estadoIdByNombre = useMemo(() => {
    const m = new Map();
    estadosItems.forEach((e) => {
      const nombre = collapseSpaces(e?.nombre || "");
      if (nombre) m.set(nombre, e?.id);
    });
    return m;
  }, [estadosItems]);

  // Ciudades base
  const ciudadOptionsAll = useMemo(
    () =>
      ciudadesItems
        .map((c) => ({
          label: collapseSpaces(c?.nombre || ""),
          value: collapseSpaces(c?.nombre || ""),
          _id: c?.id,
          _id_estado: c?.id_estado,
        }))
        .filter((o) => o.label),
    [ciudadesItems]
  );

  // Filtrado por estado
  const estadoSeleccionado = Form.useWatch("estado", form);
  const ciudadOptionsFiltradas = useMemo(() => {
    if (!estadoSeleccionado) return ciudadOptionsAll;
    const idEstado = estadoIdByNombre.get(collapseSpaces(estadoSeleccionado));
    if (!idEstado) return ciudadOptionsAll;
    return ciudadOptionsAll.filter(
      (c) => String(c._id_estado) === String(idEstado)
    );
  }, [estadoSeleccionado, estadoIdByNombre, ciudadOptionsAll]);

  // Abogados
  const abogadoOptions = useMemo(
    () =>
      abogadosItems
        .map((a) => ({
          label: collapseSpaces(a?.nombre || ""),
          value: collapseSpaces(a?.nombre || ""),
          _id: a?.id,
        }))
        .filter((o) => o.label),
    [abogadosItems]
  );

  /* ====== Navegación por Enter ====== */
  const fieldOrder = useRef([
    "exp",
    "fecha_creacion_expediente",
    "fecha_cita_audiencia",
    "estado",
    "ciudad",
    "ambito",
    "autoridad",
    "trabajador_nombre",
    "patron_nombre",
    "rfc_empresa",
    "fecha_ingreso",
    "horario",
    "dia_descanso",
    "jornada_semanal",
    "ultimo_dia",
    "imss_baja",
    "imss_baja_fecha",
    "motivo_baja",
    "puesto",
    "salario_diario",
    "salario_integrado",
    "conceptos_salario",
    "renuncia_escrita",
    "finiquito_firmado",
    "motivo_real",
    "comentario",
    "propuestas",
    "cantidad_autorizada",
    "beneficios_check",
    "beneficio_otro",
    "info_nombre",
    "info_puesto",
    "info_fecha",
    "empresa_nombre",
    "empresa_razon_social_id",
    "especifico",
    "abogado_contrario",
    "abogado",
  ]);
  const fieldRefs = useRef(
    Object.fromEntries(fieldOrder.current.map((k) => [k, null]))
  );

  const focusField = (key) => {
    const r = fieldRefs.current[key];
    if (!r) return;
    if (typeof r.focus === "function") return r.focus();
    if (r.input?.focus) return r.input.focus();
    if (r.focusElement?.focus) return r.focusElement.focus();
    if (r.resizableTextArea?.textArea?.focus)
      r.resizableTextArea.textArea.focus();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    return buildAndSend(values);
  };

  const isAnySelectOpen = () =>
    !!document.querySelector(
      ".ant-select-open, .ant-select-dropdown:not(.ant-select-dropdown-hidden)"
    );
  const makeOnKeyDown = (currentKey) => async (e) => {
    if (e.key !== "Enter") return;
    if (activeKey !== "form") return;
    if (isAnySelectOpen()) return;
    e.preventDefault();
    const order = fieldOrder.current;
    theLoop: {
      const idx = order.indexOf(currentKey);
      if (idx === -1) break theLoop;
      const nextKey = order[idx + 1];
      if (nextKey) focusField(nextKey);
      else await handleSave();
    }
  };

  const handleSaveClick = async () => {
    try {
      const values = await form.validateFields();
      await buildAndSend(values);
    } catch (err) {
      const errorFields = err?.errorFields || [];
      if (errorFields.length) {
        setActiveKey("form");
        message.error("Faltan campos obligatorios.");
        form.scrollToField(errorFields[0].name, { block: "center" });
        return;
      }
      message.error(err?.message || "No se pudo procesar el formulario.");
    }
  };

  /* ====== Responsive ====== */
  const [vw, setVw] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const safeWidth = Math.min(1080, Math.max(360, vw - 32));

  /* ====== Inicial ====== */
  useEffect(() => {
    if (!open) return;
    const init = {
      imss_baja: "no",
      renuncia_escrita: "no",
      finiquito_firmado: "no",
      beneficios_check: [],
      abogado_contrario: "",
      ...initialValues,
    };
    if (init.empresa && !init.empresa_nombre) init.empresa_nombre = init.empresa;
    form.setFieldsValue(init);
    setDocumentsMap({
      poderOriginal: null,
      copiaPoder: null,
      identificacion: null,
      contrato: null,
      citatorio: null,
    });
    setDocErrors({});
    setActiveKey("form");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  /* ====== Empresa / Razón social ====== */
  const empresaNombre = Form.useWatch("empresa_nombre", form);

  const razonSocialOptions = useMemo(() => {
    if (!empresaNombre) return [];
    const bucket = empresasIndex.get(empresaNombre);
    if (!bucket) return [];
    return bucket.razones;
  }, [empresaNombre, empresasIndex]);

  const onChangeEmpresaNombre = (value) => {
    form.setFieldsValue({
      empresa_nombre: value || null,
      empresa_razon_social_id: null,
      empresa_id: null,
    });

    if (value) {
      const bucket = empresasIndex.get(value);
      if (bucket) {
        const rs = bucket.razones || [];
        if (rs.length === 1) {
          form.setFieldsValue({ empresa_razon_social_id: rs[0].value });
          if (rs[0].empresa_id != null) {
            form.setFieldsValue({ empresa_id: rs[0].empresa_id });
          } else if (bucket.empresaIds.size === 1) {
            form.setFieldsValue({
              empresa_id: Array.from(bucket.empresaIds)[0],
            });
          }
        } else if (rs.length === 0 && bucket.empresaIds.size === 1) {
          form.setFieldsValue({ empresa_id: Array.from(bucket.empresaIds)[0] });
        }
      }
    }
  };

  const onChangeRazonSocial = (value) => {
    const selected = razonSocialOptions.find((o) => o.value === value);
    if (selected?.empresa_id != null) {
      form.setFieldsValue({ empresa_id: selected.empresa_id });
    } else {
      const bucket = empresasIndex.get(empresaNombre || "");
      if (bucket && bucket.empresaIds.size === 1) {
        form.setFieldsValue({ empresa_id: Array.from(bucket.empresaIds)[0] });
      } else {
        form.setFieldsValue({ empresa_id: null });
      }
    }
  };

  /* ====== Validación de documentos ====== */
  const beforeUploadDoc = (key) => (file) => {
    setDocErrors((prev) => ({ ...prev, [key]: "" }));
    const isOkType =
      file.type === "application/pdf" ||
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      /\.pdf$/i.test(file.name) ||
      /\.(png|jpe?g)$/i.test(file.name);
    if (!isOkType) {
      const msg = "Solo PDF/JPG/PNG.";
      setDocErrors((prev) => ({ ...prev, [key]: msg }));
      message.error(msg);
      return Upload.LIST_IGNORE;
    }
    const maxMB = 25;
    if (file.size > maxMB * 1024 * 1024) {
      const msg = `El archivo supera ${maxMB} MB.`;
      setDocErrors((prev) => ({ ...prev, [key]: msg }));
      message.error(msg);
      return Upload.LIST_IGNORE;
    }
    setDocumentsMap((prev) => ({ ...prev, [key]: file }));
    return false; // no subir automáticamente
  };

  const removeDoc = (key) => {
    setDocumentsMap((prev) => ({ ...prev, [key]: null }));
    setDocErrors((prev) => ({ ...prev, [key]: "" }));
  };

  /* ====== Reglas ====== */
  const rules = {
    exp: [
      { required: true, message: "Requerido" },
      {
        pattern: /^[A-Za-z0-9_.\/\- ]{1,50}$/,
        message: "Solo letras, números y _ . / - y espacios.",
      },
    ],
    ambito: [{ required: true, message: "Selecciona el ámbito" }],
    fecha_creacion_expediente: [{ required: true, message: "Requerido" }],

    actor: [
      { required: false },
      {
        pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{0,100}$/,
        message: "Solo letras, espacios y ' . -",
      },
    ],
    autoridad: [
      {
        pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{0,100}$/,
        message: "Solo letras, espacios y ' . -",
      },
    ],
    empresa_nombre: [{ required: true, message: "Selecciona una Empresa" }],
    especifico: [
      {
        pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,;:()\/\-# ]{0,160}$/,
        message: "Caracteres no permitidos en específico.",
      },
    ],
    abogado: [
      { required: true, message: "Requerido" },
      {
        pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/,
        message: "Solo letras, espacios y ' . -",
      },
    ],
    abogado_contrario: [
      { required: true, message: "Requerido" },
      {
        pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/,
        message: "Solo letras, espacios y ' . -",
      },
    ],
    ciudad: [{ required: true, message: "Requerido" }],

    trabajador_nombre: [{ required: true, message: "Requerido" }],
    patron_nombre: [{ required: true, message: "Requerido" }],
    rfc_empresa: [{ required: true, message: "Requerido" }],
    fecha_ingreso: [{ required: true, message: "Requerido" }],
    horario: [{ required: true, message: "Requerido" }],
    dia_descanso: [{ required: true, message: "Requerido" }],
    jornada_semanal: [{ required: true, message: "Requerido" }],
    ultimo_dia: [{ required: true, message: "Requerido" }],
    imss_baja: [{ required: true, message: "Requerido" }],
    puesto: [{ required: true, message: "Requerido" }],
    salario_diario: [{ required: true, message: "Requerido" }],
    salario_integrado: [{ required: true, message: "Requerido" }],
  };

  /* ====== Guardado ====== */
  const buildAndSend = async (values) => {
    // 0) Validación documentos: TODOS obligatorios
    const missingDocs = Object.entries(documentsMap)
      .filter(([, f]) => !f)
      .map(([k]) => k);
    if (missingDocs.length > 0) {
      setActiveKey("pdf");
      message.error("Faltan documentos obligatorios: " + missingDocs.join(", "));
      return;
    }

    // 1) Empresa obligatoria + resolver empresa_id/razón social
    if (!values.empresa_nombre) {
      message.error("Selecciona una Empresa.");
      setActiveKey("form");
      return;
    }

    let empresa_id = values.empresa_id ?? null;

    if (!empresa_id) {
      const bucket = empresasIndex.get(values.empresa_nombre);
      if (bucket) {
        const rs = razonSocialOptions;
        if (rs.length > 1) {
          if (!values.empresa_razon_social_id) {
            message.error("Selecciona la Razón social para desambiguar la Empresa.");
            setActiveKey("form");
            return;
          }
          const chosen = rs.find((o) => o.value === values.empresa_razon_social_id);
          if (chosen?.empresa_id == null && bucket.empresaIds.size !== 1) {
            message.error("No se pudo inferir la Empresa. Selecciona una Razón social válida.");
            setActiveKey("form");
            return;
          }
          empresa_id =
            chosen?.empresa_id ??
            (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
        } else if (rs.length === 1) {
          empresa_id =
            rs[0].empresa_id ??
            (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
        } else {
          empresa_id =
            bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null;
        }
      }
    }

    if (!empresa_id) {
      message.error("No se pudo determinar la Empresa. Verifica tu selección.");
      setActiveKey("form");
      return;
    }

    // 2) Normalización
    const clean = {
      exp: sanitizeByField("exp", values.exp),
      autoridad: sanitizeByField("autoridad", values.autoridad),
      especifico: sanitizeByField("especifico", values.especifico),
      abogado_contrario: sanitizeByField("abogado_contrario", values.abogado_contrario),
      abogado: sanitizeByField("abogado", values.abogado),
      ciudad: sanitizeByField("ciudad", values.ciudad),
      estado: sanitizeByField("estado", values.estado),

      id_ambito: Number(values.ambito ?? 0) || null,
      fecha_creacion_expediente: values.fecha_creacion_expediente
        ? dayjs(values.fecha_creacion_expediente).format("YYYY-MM-DD")
        : null,
      fecha_cita_audiencia: values.fecha_cita_audiencia
        ? dayjs(values.fecha_cita_audiencia).format("YYYY-MM-DD")
        : null,

      trabajador_nombre: sanitizeByField("trabajador_nombre", values.trabajador_nombre),
      patron_nombre: sanitizeByField("patron_nombre", values.patron_nombre),
      rfc_empresa: sanitizeByField("rfc_empresa", values.rfc_empresa),
      fecha_ingreso: values.fecha_ingreso
        ? dayjs(values.fecha_ingreso).format("YYYY-MM-DD")
        : null,
      horario: sanitizeByField("horario", values.horario),
      dia_descanso: sanitizeByField("dia_descanso", values.dia_descanso),
      jornada_semanal: sanitizeByField("jornada_semanal", values.jornada_semanal),
      ultimo_dia: values.ultimo_dia
        ? dayjs(values.ultimo_dia).format("YYYY-MM-DD")
        : null,
      imss_baja: values.imss_baja || "no",
      imss_baja_fecha: values.imss_baja_fecha
        ? dayjs(values.imss_baja_fecha).format("YYYY-MM-DD")
        : null,
      motivo_baja: sanitizeByField("motivo_baja", values.motivo_baja),
      puesto: sanitizeByField("puesto", values.puesto),
      salario_diario: String(values.salario_diario ?? "").replace(/[^0-9.]/g, ""),
      salario_integrado: String(values.salario_integrado ?? "").replace(/[^0-9.]/g, ""),
      conceptos_salario: sanitizeByField("conceptos_salario", values.conceptos_salario),
      renuncia_escrita: values.renuncia_escrita || "no",
      finiquito_firmado: values.finiquito_firmado || "no",
      motivo_real: sanitizeByField("motivo_real", values.motivo_real),
      comentario: sanitizeByField("comentario", values.comentario),
      propuestas: sanitizeByField("propuestas", values.propuestas),
      cantidad_autorizada: sanitizeByField("cantidad_autorizada", values.cantidad_autorizada),
      beneficios_check: Array.isArray(values.beneficios_check) ? values.beneficios_check : [],
      beneficio_otro: sanitizeByField("beneficio_otro", values.beneficio_otro),
      info_nombre: sanitizeByField("info_nombre", values.info_nombre),
      info_puesto: sanitizeByField("info_puesto", values.info_puesto),
      info_fecha: values.info_fecha ? dayjs(values.info_fecha).format("YYYY-MM-DD") : null,
    };

    // 3) Resolver IDs exigidos por backend (sin status)
    const ciudadOpt = ciudadOptionsAll.find((c) => c.value === clean.ciudad);
    const id_ciudad = ciudadOpt?._id ?? null;

    const abOpt = abogadoOptions.find((a) => a.value === clean.abogado);
    const id_abogado = abOpt?._id ?? null;

    const id_razon_social =
      values.empresa_razon_social_id != null ? Number(values.empresa_razon_social_id) : null;

    // 4) Requeridos del backend (sin id_conciliacion_status, lo setea el backend en 1)
    const requiredErrors = [];
    if (!clean.exp) requiredErrors.push("expediente");
    if (!clean.id_ambito) requiredErrors.push("id_ambito");
    if (!id_ciudad) requiredErrors.push("id_ciudad");
    if (!empresa_id) requiredErrors.push("id_empresa");
    if (!id_razon_social) requiredErrors.push("id_razon_social");

    if (requiredErrors.length > 0) {
      setActiveKey("form");
      message.error("Faltan campos obligatorios: " + requiredErrors.join(", "));
      return;
    }

    // 5) Payload EXACTO (sin id_conciliacion_status)
    const backendPayload = {
      expediente: clean.exp,
      id_ambito: clean.id_ambito,
      id_ciudad: id_ciudad,
      fecha_creacion_expediente: clean.fecha_creacion_expediente,

      id_abogado: id_abogado ?? null,
      abogado_contrario:
        toNullIfEmptyEffective(clean.abogado_contrario) ?? "", // BD NOT NULL sin default

      especifico: toNullIfEmptyEffective(clean.especifico),

      nombre_patron: toNullIfEmptyEffective(clean.patron_nombre),
      fecha_ingreso_trabajador: clean.fecha_ingreso,
      horario: toNullIfEmptyEffective(clean.horario),
      dia_descanso: toNullIfEmptyEffective(clean.dia_descanso),
      jornada_semanal: toNullIfEmptyEffective(clean.jornada_semanal),
      ultimo_dia_laboral: clean.ultimo_dia,

      baja_imss: clean.imss_baja === "si" ? 1 : 0,
      fecha_baja_imss: clean.imss_baja_fecha,

      motivo_baja: toNullIfEmptyEffective(clean.motivo_baja),
      puesto_trabajador: toNullIfEmptyEffective(clean.puesto),

      ultimo_salario_diario: clean.salario_diario ? String(Number(clean.salario_diario)) : null,
      ultimo_salario_integrado: clean.salario_integrado
        ? String(Number(clean.salario_integrado))
        : null,
      conceptos_salario: toNullIfEmptyEffective(clean.conceptos_salario),

      // >>> Corrección de nombres usados en backend (evita typos "trabajdor")
      renuncia_firmada_trabajador: clean.renuncia_escrita !== "no" ? 1 : 0, // si tu backend usa 'trabajdor', deja así
      finiquito_firmado: clean.finiquito_firmado !== "no" ? 1 : 0,
      motivo_real_trabajdor: toNullIfEmptyEffective(clean.motivo_real), // idem nota de arriba

      comentario: toNullIfEmptyEffective(clean.comentario),
      propuesta_conflicto: toNullIfEmptyEffective(clean.propuestas),

      cantidad_autorizada: toNullIfEmptyEffective(clean.cantidad_autorizada),
      cantidad_autorizada_opcion: clean.beneficios_check?.length
        ? clean.beneficios_check.join(",")
        : null,

      proporcionado_nombre: toNullIfEmptyEffective(clean.info_nombre),
      proporcionado_puesto: toNullIfEmptyEffective(clean.info_puesto),
      proporcionado_fecha: clean.info_fecha,

      rfc_patron: toNullIfEmptyEffective(clean.rfc_empresa),

      id_empresa: Number(empresa_id),
      id_razon_social: Number(id_razon_social),

      // opcional audiencia
      fecha_cita_audiencia: clean.fecha_cita_audiencia
        ? `${clean.fecha_cita_audiencia} 00:00:00`
        : null,
    };

    // 6) Envío MULTIPART con los 5 docs
    const filesMap = Object.fromEntries(
      Object.entries(documentsMap).filter(([, f]) => !!f)
    );

    try {
      setSubmitting(true);
      await dispatch(
        actionConciliacionCreate(backendPayload, () => onSaved?.(), filesMap)
      );
      message.success("Expediente creado");
      onClose?.();
    } catch (e) {
      message.error(e?.message || "No se pudo crear");
    } finally {
      setSubmitting(false);
    }
  };

  /* ====== Tab: Formulario ====== */
  const formTab = (
    <Form
      form={form}
      layout="vertical"
      style={{ padding: 10 }}
      initialValues={{
        imss_baja: "no",
        renuncia_escrita: "no",
        finiquito_firmado: "no",
        beneficios_check: [],
        abogado_contrario: "",
        ...initialValues,
      }}
    >
      <Form.Item name="empresa_id" hidden>
        <Input />
      </Form.Item>

      {/* ===== Datos de expediente ===== */}
      <Title level={5}>Datos de expediente</Title>

      <Row gutter={[12, 12]}>
        {/* 1) Expediente */}
        <Col xs={24} md={8}>
          <Form.Item
            label="Expediente"
            name="exp"
            rules={rules.exp}
            normalize={makeNormalizer("exp")}
          >
            <Input
              ref={(el) => (fieldRefs.current.exp = el)}
              placeholder="Ej. EXP-00123"
              allowClear
              maxLength={50}
              onKeyDown={makeOnKeyDown("exp")}
            />
          </Form.Item>
        </Col>

        {/* 2) Fecha de creación del expediente */}
        <Col xs={24} md={8}>
          <Form.Item
            label="Fecha de emision del expediente"
            name="fecha_creacion_expediente"
            rules={rules.fecha_creacion_expediente}
          >
            <DatePicker
              ref={(el) => (fieldRefs.current.fecha_creacion_expediente = el)}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              onKeyDown={makeOnKeyDown("fecha_creacion_expediente")}
            />
          </Form.Item>
        </Col>

        {/* 3) Fecha de la cita de la audiencia */}
        <Col xs={24} md={8}>
          <Form.Item label="Fecha de la audiencia" name="fecha_cita_audiencia">
            <DatePicker
              ref={(el) => (fieldRefs.current.fecha_cita_audiencia = el)}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              onKeyDown={makeOnKeyDown("fecha_cita_audiencia")}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Segundo row: Estado, Ciudad, Ámbito, Autoridad */}
      <Row gutter={[12, 12]}>
        {/* Estado */}
        <Col xs={24} md={6}>
          <Form.Item label="Estado" name="estado">
            <Select
              ref={(el) => (fieldRefs.current.estado = el)}
              placeholder="Selecciona estado"
              options={estadoOptions}
              showSearch
              allowClear
              optionFilterProp="label"
              onChange={() => {
                form.setFieldsValue({ ciudad: null }); // al cambiar estado, limpia ciudad
              }}
              onKeyDown={makeOnKeyDown("estado")}
              getPopupContainer={(trigger) => trigger.parentNode} // >>> evita problemas de z-index en modal
            />
          </Form.Item>
        </Col>

        {/* Ciudad (filtrada por id_estado) */}
        <Col xs={24} md={6}>
          <Form.Item label="Ciudad" name="ciudad" rules={rules.ciudad}>
            <Select
              ref={(el) => (fieldRefs.current.ciudad = el)}
              placeholder="Selecciona ciudad"
              options={ciudadOptionsFiltradas}
              showSearch
              allowClear
              optionFilterProp="label"
              onKeyDown={makeOnKeyDown("ciudad")}
              getPopupContainer={(trigger) => trigger.parentNode} // >>>
            />
          </Form.Item>
        </Col>

        {/* Ámbito */}
        <Col xs={24} md={6}>
          <Form.Item label="Competencia" name="ambito" rules={rules.ambito}>
            <Select
              ref={(el) => (fieldRefs.current.ambito = el)}
              placeholder="Selecciona Competencia"
              options={ambitoOptions}
              allowClear
              onKeyDown={makeOnKeyDown("ambito")}
              getPopupContainer={(trigger) => trigger.parentNode} // >>>
            />
          </Form.Item>
        </Col>

        {/* Autoridad */}
        <Col xs={24} md={6}>
          <Form.Item
            label="Autoridad"
            name="autoridad"
            rules={rules.autoridad}
            normalize={makeNormalizer("autoridad")}
          >
            <Input
              ref={(el) => (fieldRefs.current.autoridad = el)}
              placeholder="Autoridad"
              allowClear
              onKeyDown={makeOnKeyDown("autoridad")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider />

      <Title level={5}>
        Datos generales del trabajador (para cita ante Centro de Conciliación)
      </Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Form.Item
            label="Nombre del trabajador"
            name="trabajador_nombre"
            rules={rules.trabajador_nombre}
            normalize={makeNormalizer("trabajador_nombre")}
          >
            <Input
              ref={(el) => (fieldRefs.current.trabajador_nombre = el)}
              allowClear
              onKeyDown={makeOnKeyDown("trabajador_nombre")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label="Nombre del patrón"
            name="patron_nombre"
            rules={rules.patron_nombre}
            normalize={makeNormalizer("patron_nombre")}
          >
            <Input
              ref={(el) => (fieldRefs.current.patron_nombre = el)}
              allowClear
              onKeyDown={makeOnKeyDown("patron_nombre")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Form.Item
            label="RFC de la empresa"
            name="rfc_empresa"
            rules={rules.rfc_empresa}
            normalize={makeNormalizer("rfc_empresa")}
          >
            <Input
              ref={(el) => (fieldRefs.current.rfc_empresa = el)}
              allowClear
              onKeyDown={makeOnKeyDown("rfc_empresa")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="Fecha de ingreso (dd/mm/aaaa)"
            name="fecha_ingreso"
            rules={rules.fecha_ingreso}
          >
            <DatePicker
              ref={(el) => (fieldRefs.current.fecha_ingreso = el)}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              onKeyDown={makeOnKeyDown("fecha_ingreso")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Último día laborado" name="ultimo_dia" rules={rules.ultimo_dia}>
            <DatePicker
              ref={(el) => (fieldRefs.current.ultimo_dia = el)}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              onKeyDown={makeOnKeyDown("ultimo_dia")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Form.Item
            label="Horario"
            name="horario"
            rules={rules.horario}
            normalize={makeNormalizer("horario")}
          >
            <Input
              ref={(el) => (fieldRefs.current.horario = el)}
              allowClear
              onKeyDown={makeOnKeyDown("horario")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="Día de descanso"
            name="dia_descanso"
            rules={rules.dia_descanso}
            normalize={makeNormalizer("dia_descanso")}
          >
            <Input
              ref={(el) => (fieldRefs.current.dia_descanso = el)}
              allowClear
              onKeyDown={makeOnKeyDown("dia_descanso")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="Jornada semanal"
            name="jornada_semanal"
            rules={rules.jornada_semanal}
            normalize={makeNormalizer("jornada_semanal")}
          >
            <Input
              ref={(el) => (fieldRefs.current.jornada_semanal = el)}
              allowClear
              onKeyDown={makeOnKeyDown("jornada_semanal")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Form.Item label="¿Fue dado de baja del IMSS?" name="imss_baja" rules={rules.imss_baja}>
            <Radio.Group ref={(el) => (fieldRefs.current.imss_baja = el)} onKeyDown={makeOnKeyDown("imss_baja")}>
              <Radio value="si">Sí</Radio>
              <Radio value="no">No</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item noStyle shouldUpdate>
            {() => (
              <Form.Item label="Fecha de baja IMSS" name="imss_baja_fecha">
                <DatePicker
                  ref={(el) => (fieldRefs.current.imss_baja_fecha = el)}
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  disabled={form.getFieldValue("imss_baja") !== "si"}
                  onKeyDown={makeOnKeyDown("imss_baja_fecha")}
                />
              </Form.Item>
            )}
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="Motivo de la baja"
            name="motivo_baja"
            normalize={makeNormalizer("motivo_baja")}
          >
            <Input
              ref={(el) => (fieldRefs.current.motivo_baja = el)}
              allowClear
              onKeyDown={makeOnKeyDown("motivo_baja")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Form.Item
            label="Puesto desempeñado"
            name="puesto"
            rules={rules.puesto}
            normalize={makeNormalizer("puesto")}
          >
            <Input
              ref={(el) => (fieldRefs.current.puesto = el)}
              allowClear
              onKeyDown={makeOnKeyDown("puesto")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Último salario (diario)" name="salario_diario" rules={rules.salario_diario}>
            <InputNumber
              ref={(el) => (fieldRefs.current.salario_diario = el)}
              style={{ width: "100%" }}
              min={0}
              step="0.01"
              stringMode
              onKeyDown={makeOnKeyDown("salario_diario")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Salario integrado" name="salario_integrado" rules={rules.salario_integrado}>
            <InputNumber
              ref={(el) => (fieldRefs.current.salario_integrado = el)}
              style={{ width: "100%" }}
              min={0}
              step="0.01"
              stringMode
              onKeyDown={makeOnKeyDown("salario_integrado")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="Conceptos con los que se integra el salario"
        name="conceptos_salario"
        normalize={makeNormalizer("conceptos_salario")}
      >
        <Input.TextArea
          ref={(el) => (fieldRefs.current.conceptos_salario = el)}
          allowClear
          rows={2}
          onKeyDown={makeOnKeyDown("conceptos_salario")}
        />
      </Form.Item>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Form.Item
            label="¿Tenemos la renuncia por escrito firmada por el trabajador?"
            name="renuncia_escrita"
          >
            <Radio.Group
              ref={(el) => (fieldRefs.current.renuncia_escrita = el)}
              onKeyDown={makeOnKeyDown("renuncia_escrita")}
            >
              <Radio value="si_original">Sí, original</Radio>
              <Radio value="si_copia">Sí, copia</Radio>
              <Radio value="no">No</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label="¿Tenemos el finiquito firmado por escrito?"
            name="finiquito_firmado"
          >
            <Radio.Group
              ref={(el) => (fieldRefs.current.finiquito_firmado = el)}
              onKeyDown={makeOnKeyDown("finiquito_firmado")}
            >
              <Radio value="si_original">Sí, original</Radio>
              <Radio value="si_copia">Sí, copia</Radio>
              <Radio value="no">No</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="Motivo real por el que ya no se encuentra al servicio de la empresa"
        name="motivo_real"
        normalize={makeNormalizer("motivo_real")}
      >
        <Input.TextArea
          ref={(el) => (fieldRefs.current.motivo_real = el)}
          rows={2}
          allowClear
          onKeyDown={makeOnKeyDown("motivo_real")}
        />
      </Form.Item>

      <Form.Item
        label="Comentario que desea agregar"
        name="comentario"
        normalize={makeNormalizer("comentario")}
      >
        <Input.TextArea
          ref={(el) => (fieldRefs.current.comentario = el)}
          rows={2}
          allowClear
          onKeyDown={makeOnKeyDown("comentario")}
        />
      </Form.Item>

      <Form.Item
        label="Propuestas u opciones para solucionar el conflicto"
        name="propuestas"
        normalize={makeNormalizer("propuestas")}
      >
        <Input.TextArea
          ref={(el) => (fieldRefs.current.propuestas = el)}
          rows={2}
          allowClear
          onKeyDown={makeOnKeyDown("propuestas")}
        />
      </Form.Item>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Form.Item
            label="Cantidad autorizada"
            name="cantidad_autorizada"
            normalize={makeNormalizer("cantidad_autorizada")}
          >
            <Input
              ref={(el) => (fieldRefs.current.cantidad_autorizada = el)}
              allowClear
              onKeyDown={makeOnKeyDown("cantidad_autorizada")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          {/* >>> En Form.Item para Checkbox.Group NO hace falta valuePropName; por defecto usa "value".
                 Lo quité para evitar warnings. */}
          <Form.Item label="Beneficios / conceptos" name="beneficios_check">
            <Checkbox.Group ref={(el) => (fieldRefs.current.beneficios_check = el)}>
              <Space wrap>
                <Checkbox value="30_dias">30 días</Checkbox>
                <Checkbox value="45_dias">45 días</Checkbox>
                <Checkbox value="90_dias">90 días</Checkbox>
                <Checkbox value="prima_antiguedad">Prima de antigüedad</Checkbox>
                <Checkbox value="aguinaldo">Aguinaldo</Checkbox>
                <Checkbox value="vacaciones">Vacaciones</Checkbox>
                <Checkbox value="otro">Otro</Checkbox>
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item
            label="Especifique 'Otro' (si aplica)"
            name="beneficio_otro"
            normalize={makeNormalizer("beneficio_otro")}
          >
            <Input
              ref={(el) => (fieldRefs.current.beneficio_otro = el)}
              allowClear
              onKeyDown={makeOnKeyDown("beneficio_otro")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider />

      <Title level={5}>Información proporcionada por</Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={10}>
          <Form.Item label="Nombre" name="info_nombre" normalize={makeNormalizer("info_nombre")}>
            <Input
              ref={(el) => (fieldRefs.current.info_nombre = el)}
              allowClear
              onKeyDown={makeOnKeyDown("info_nombre")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Form.Item label="Puesto" name="info_puesto" normalize={makeNormalizer("info_puesto")}>
            <Input
              ref={(el) => (fieldRefs.current.info_puesto = el)}
              allowClear
              onKeyDown={makeOnKeyDown("info_puesto")}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={4}>
          <Form.Item label="Fecha" name="info_fecha">
            <DatePicker
              ref={(el) => (fieldRefs.current.info_fecha = el)}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              onKeyDown={makeOnKeyDown("info_fecha")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider />

      <Title level={5}>Vinculación con empresa y etiquetas</Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Form.Item label="Empresa" name="empresa_nombre" rules={rules.empresa_nombre}>
            <Select
              ref={(el) => (fieldRefs.current.empresa_nombre = el)}
              placeholder="Selecciona Empresa"
              options={empresaNombreOptions}
              showSearch
              allowClear
              optionFilterProp="label"
              onChange={onChangeEmpresaNombre}
              onKeyDown={makeOnKeyDown("empresa_nombre")}
              notFoundContent="Sin datos"
              getPopupContainer={(trigger) => trigger.parentNode} // >>>
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Razón social" name="empresa_razon_social_id">
            <Select
              ref={(el) => (fieldRefs.current.empresa_razon_social_id = el)}
              placeholder={
                empresaNombre
                  ? "Selecciona Razón social (si aplica)"
                  : "Selecciona primero Empresa"
              }
              options={razonSocialOptions}
              showSearch
              allowClear
              optionFilterProp="label"
              onChange={onChangeRazonSocial}
              disabled={!empresaNombre}
              onKeyDown={makeOnKeyDown("empresa_razon_social_id")}
              notFoundContent={empresaNombre ? "Sin razones sociales" : "Selecciona empresa"}
              getPopupContainer={(trigger) => trigger.parentNode} // >>>
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Form.Item
            label="Específico"
            name="especifico"
            rules={rules.especifico}
            normalize={makeNormalizer("especifico")}
          >
            <Input
              ref={(el) => (fieldRefs.current.especifico = el)}
              placeholder="Detalle específico"
              allowClear
              maxLength={160}
              onKeyDown={makeOnKeyDown("especifico")}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label="Abogado contrario"
            name="abogado_contrario"
            rules={rules.abogado_contrario}
            normalize={makeNormalizer("abogado_contrario")}
          >
            <Input
              ref={(el) => (fieldRefs.current.abogado_contrario = el)}
              placeholder="Nombre del abogado de la parte contraria"
              allowClear
              onKeyDown={makeOnKeyDown("abogado_contrario")}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        {/* Abogado (SELECT por nombre, desde items[]) */}
        <Col xs={24} md={12}>
          <Form.Item
            label="Abogado"
            name="abogado"
            rules={rules.abogado}
            normalize={makeNormalizer("abogado")}
          >
            <Select
              ref={(el) => (fieldRefs.current.abogado = el)}
              placeholder="Selecciona abogado"
              options={abogadoOptions}
              showSearch
              allowClear
              optionFilterProp="label"
              onKeyDown={makeOnKeyDown("abogado")}
              getPopupContainer={(trigger) => trigger.parentNode} // >>>
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  /* ====== Tab: Documentos ====== */
  const DocBlock = ({ label, keyName }) => (
    <div style={{ border: "1px dashed #d9d9d9", borderRadius: 8, padding: 12 }}>
      <Text strong>{label}</Text>
      <Dragger
        multiple={false}
        maxCount={1}
        accept=".pdf,.png,.jpg,.jpeg"
        beforeUpload={beforeUploadDoc(keyName)}
        onRemove={() => {
          removeDoc(keyName);
          return true;
        }}
        fileList={
          documentsMap[keyName]
            ? [
                {
                  uid: `-${keyName}`,
                  name: documentsMap[keyName].name,
                  status: "done",
                },
              ]
            : []
        }
        style={{ marginTop: 8 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Haz clic o arrastra aquí el archivo</p>
        <p className="ant-upload-hint">Se enviará al presionar “Guardar”.</p>
      </Dragger>
      {docErrors[keyName] ? (
        <Alert style={{ marginTop: 8 }} type="error" showIcon message={docErrors[keyName]} />
      ) : null}
    </div>
  );

  const pdfTab = (
    <Space direction="vertical" size={12} style={{ width: "100%", padding: 10 }}>
      <Text type="secondary">
        Adjunta los documentos requeridos. Formatos permitidos: <b>PDF/JPG/PNG</b> (máx. 25 MB c/u).
      </Text>

      <DocBlock label="Poder original" keyName="poderOriginal" />
      <DocBlock label="Copia del poder original" keyName="copiaPoder" />
      <DocBlock label="Identificación oficial (INE)" keyName="identificacion" />
      <DocBlock label="Contrato / Documento base" keyName="contrato" />
      <DocBlock label="Citatorio / Cita" keyName="citatorio" />
    </Space>
  );

  const titleText =
    mode === "edit"
      ? `Editar expediente${recordId ? ` #${recordId}` : ""}`
      : "Creando Cita Prejudicial";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={safeWidth}
      destroyOnClose
      title={titleText}
      maskClosable={!submitting}
      footer={[
        <Button
          key="save"
          type="primary"
          className="custom-button"
          icon={mode === "edit" ? <CheckOutlined /> : <PlusOutlined />}
          loading={submitting}
          disabled={submitting}
          onClick={handleSaveClick}
        >
          {mode === "edit" ? "Guardar cambios" : "Guardar"}
        </Button>,
      ]}
    >
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          { key: "form", label: "Información Cita", children: formTab },
          { key: "pdf", label: "Documentos", children: pdfTab },
        ]}
      />
    </Modal>
  );
}
