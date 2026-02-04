// src/components/modals/expedientes/AddExpedienteModal.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Button,
  Typography,
  Row,
  Col,
  message,
  Alert,
  DatePicker,
  Divider,
} from "antd";
import { InboxOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { actionConciliacionCreate } from "../../../redux/actions/conciliacion/conciliacion";
import { actionEmpresasGet } from "../../../redux/actions/empresas/empresas";
import { actionEstadosGet } from "../../../redux/actions/estados/estados";
import { actionCiudadesGet } from "../../../redux/actions/ciudades/ciudades";
import { actionAbogadosGet } from "../../../redux/actions/abogados/abogados";
import { actionAutoridadesGet } from "../../../redux/actions/autoridades/autoridades";
import dayjs from "dayjs";

const { Dragger } = Upload;
const { Text } = Typography;

/* ========= Utils ========= */
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
    case "abogado":
    case "abogado_contrario":
    case "trabajador_nombre":
      return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]/g, "").slice(0, 100);
    case "empresa":
      return s
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,()\/\- ]/g, "")
        .slice(0, 120);
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

/* ========= Empresas / RS helpers ========= */
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

const coerceItemsFromSlice = (slice) => {
  if (!slice) return [];
  if (Array.isArray(slice.items)) return slice.items;
  if (Array.isArray(slice.data)) return slice.data;
  if (Array.isArray(slice?.data?.items)) return slice.data.items;
  if (Array.isArray(slice?.payload?.items)) return slice.payload.items;
  return [];
};

/* ========= Catálogo Ámbito ========= */
const ambitoOptions = [
  { label: "Local", value: 1 },
  { label: "Federal", value: 2 },
];

/* ========= Componente ========= */
export default function AddExpedienteModal({
  open,
  onClose,
  initialValues,
  mode = "create",
  recordId,
  onSaved,
}) {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Documentos (solo citatorio)
  const [documentsMap, setDocumentsMap] = useState({ citatorio: null });
  const [docErrors, setDocErrors] = useState({});

  /* ==== Cargar catálogos al abrir ==== */
  const loadedOnceForThisOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      loadedOnceForThisOpen.current = false;
      return;
    }
    if (loadedOnceForThisOpen.current) return;
    loadedOnceForThisOpen.current = true;

    dispatch(actionEmpresasGet());
    dispatch(actionEstadosGet());
    dispatch(actionCiudadesGet());
    dispatch(actionAbogadosGet());
    dispatch(actionAutoridadesGet());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Slices
  const empresasSlice = useSelector((state) => state?.empresas ?? {});
  const estadosSlice = useSelector((state) => state.estados || {});
  const ciudadesSlice = useSelector((state) => state.ciudades || {});
  const abogadosSlice = useSelector((state) => state.abogados || {});
  const autoridadesSlice = useSelector((state) => state.autoridades || {});

  // Items
  const empresasItems = useMemo(() => coerceEmpresasArray(empresasSlice), [empresasSlice]);
  const empresasIndex = useMemo(() => buildEmpresasIndex(empresasItems), [empresasItems]);
  const empresaNombreOptions = useMemo(() => {
    const names = Array.from(empresasIndex.keys());
    return names.map((n) => ({ label: n, value: n })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [empresasIndex]);

  const estadosItems = useMemo(() => coerceItemsFromSlice(estadosSlice), [estadosSlice]);
  const ciudadesItems = useMemo(() => coerceItemsFromSlice(ciudadesSlice), [ciudadesSlice]);
  const abogadosItems = useMemo(() => coerceItemsFromSlice(abogadosSlice), [abogadosSlice]);
  const autoridadesItems = useMemo(() => coerceItemsFromSlice(autoridadesSlice), [autoridadesSlice]);

  // Mapas para filtros internos (estado/ciudad no se muestran, pero pueden llegar por initialValues)
  const estadoIdByNombre = useMemo(() => {
    const m = new Map();
    estadosItems.forEach((e) => {
      const nombre = collapseSpaces(e?.nombre || "");
      if (nombre) m.set(nombre, e?.id);
    });
    return m;
  }, [estadosItems]);

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

  // Watchers (valores pueden venir por initialValues; campos estado/ciudad no se renderizan)
  const estadoSel = Form.useWatch("estado", form);
  const ciudadSel = Form.useWatch("ciudad", form);
  const ambitoSel = Form.useWatch("ambito", form);
  const formaNotifSel = Form.useWatch("forma_notificacion", form);
  const empresaNombre = Form.useWatch("empresa_nombre", form);

  // Autoridades filtradas por estado, ciudad y ámbito (si existen en el form)
  const autoridadOptionsFiltradas = useMemo(() => {
    const idEstado = estadoSel ? estadoIdByNombre.get(collapseSpaces(estadoSel)) : null;
    const idCiudad = ciudadSel
      ? (ciudadOptionsAll.find((c) => c.value === collapseSpaces(ciudadSel))?._id ?? null)
      : null;
    const idAmbito = Number(ambitoSel ?? 0) || null;

    return autoridadesItems
      .filter((au) => {
        if (idEstado && String(au?.id_estado || "") !== String(idEstado)) return false;
        if (idCiudad && String(au?.id_ciudad || "") !== String(idCiudad)) return false;
        if (idAmbito && String(au?.id_ambito || "") !== String(idAmbito)) return false;
        return true;
      })
      .map((au) => ({
        label: collapseSpaces(au?.nombre || ""),
        value: collapseSpaces(au?.nombre || ""),
        _id: au?.id,
      }))
      .filter((o) => o.label);
  }, [autoridadesItems, estadoSel, ciudadSel, ambitoSel, estadoIdByNombre, ciudadOptionsAll]);

  // Opciones RS dependientes de empresa
  const razonSocialOptions = useMemo(() => {
    if (!empresaNombre) return [];
    const bucket = empresasIndex.get(empresaNombre);
    if (!bucket) return [];
    return bucket.razones;
  }, [empresaNombre, empresasIndex]);

  /* ======================= Upload Documento ======================= */
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
    return false;
  };

  const removeDoc = (key) => {
    setDocumentsMap((prev) => ({ ...prev, [key]: null }));
    setDocErrors((prev) => ({ ...prev, [key]: "" }));
  };

  /* ======================= Validaciones ======================= */
  const rules = {
    exp: [
      { required: true, message: "Requerido" },
      { pattern: /^[A-Za-z0-9_.\/\- ]{1,50}$/, message: "Solo letras, números y _ . / - y espacios." },
    ],
    empresa_nombre: [{ required: true, message: "Selecciona una Empresa" }],
    fecha_creacion_expediente: [{ required: true, message: "Requerido" }],
    ambito: [{ required: true, message: "Selecciona la competencia" }],
    // ciudad ya no se muestra: no bloquees validación aquí
    ciudad: [],
    abogado: [
      { required: true, message: "Requerido" },
      { pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/, message: "Solo letras, espacios y ' . -" },
    ],
    abogado_contrario: [
      { required: true, message: "Requerido" },
      { pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/, message: "Solo letras, espacios y ' . -" },
    ],
    trabajador_nombre: [
      { required: true, message: "Requerido" },
      { pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/, message: "Solo letras, espacios y ' . -" },
    ],
    forma_notificacion: [{ required: true, message: "Selecciona la forma de notificación" }],
    origen_actuario: [],
  };

  /* ======================= Guardado ======================= */
  const buildAndSend = async (values) => {
    if (!documentsMap.citatorio) {
      message.error("Falta el documento obligatorio: citatorio");
      return;
    }

    if (!values.empresa_nombre) {
      message.error("Selecciona una Empresa.");
      return;
    }

    // Empresa/RS -> id_empresa
    const _empIndex = buildEmpresasIndex(empresasItems);
    let empresa_id = values.empresa_id ?? null;
    const empresaNombreVal = values.empresa_nombre || "";
    const bucket = _empIndex.get(empresaNombreVal);
    const rsOptions = bucket?.razones?.map((o) => ({ ...o })) ?? [];

    if (!empresa_id && bucket) {
      if (rsOptions.length > 1) {
        if (!values.empresa_razon_social_id) {
          message.error("Selecciona la Razón social para desambiguar la Empresa.");
          return;
        }
        const chosen = rsOptions.find((o) => o.value === values.empresa_razon_social_id);
        if (chosen?.empresa_id == null && bucket.empresaIds.size !== 1) {
          message.error("No se pudo inferir la Empresa. Selecciona una Razón social válida.");
          return;
        }
        empresa_id = chosen?.empresa_id ?? (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
      } else if (rsOptions.length === 1) {
        empresa_id = rsOptions[0].empresa_id ?? (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
      } else {
        empresa_id = bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null;
      }
    }
    const id_razon_social =
      values.empresa_razon_social_id != null ? Number(values.empresa_razon_social_id) : null;

    const clean = {
      exp: sanitizeByField("exp", values.exp),
      estado: sanitizeByField("estado", values.estado),
      ciudad: sanitizeByField("ciudad", values.ciudad),
      ambito: Number(values.ambito ?? 0) || null,
      abogado: sanitizeByField("abogado", values.abogado),
      abogado_contrario: sanitizeByField("abogado_contrario", values.abogado_contrario),
      trabajador_nombre: sanitizeByField("trabajador_nombre", values.trabajador_nombre),

      forma_notificacion: values.forma_notificacion || null,
      origen_actuario: values.forma_notificacion === "actuario" ? values.origen_actuario || null : null,

      fecha_creacion_expediente: values.fecha_creacion_expediente
        ? dayjs(values.fecha_creacion_expediente).format("YYYY-MM-DD HH:mm:ss")
        : null,
      fecha_cita_audiencia: values.fecha_cita_audiencia
        ? dayjs(values.fecha_cita_audiencia).format("YYYY-MM-DD HH:mm:ss")
        : null,
      autoridad: collapseSpaces(values.autoridad || ""),
    };

    const id_ciudad =
      ciudadOptionsAll.find((c) => c.value === clean.ciudad)?._id ?? null;
    const id_abogado =
      abogadoOptions.find((a) => a.value === clean.abogado)?._id ?? null;
    const id_autoridad =
      autoridadOptionsFiltradas.find((a) => a.value === clean.autoridad)?._id ?? null;

    const requiredErrors = [];
    if (!clean.exp) requiredErrors.push("expediente");
    if (!clean.ambito) requiredErrors.push("id_ambito");
    if (!id_ciudad) requiredErrors.push("id_ciudad");
    if (!empresa_id) requiredErrors.push("id_empresa");
    if (!id_razon_social) requiredErrors.push("id_razon_social");
    if (clean.forma_notificacion === "actuario" && !clean.origen_actuario) {
      requiredErrors.push("origen_actuario");
    }
    if (requiredErrors.length > 0) {
      message.error("Faltan campos obligatorios: " + requiredErrors.join(", "));
      return;
    }

    const backendPayload = {
      expediente: clean.exp,
      id_ambito: clean.ambito,
      id_ciudad,
      fecha_creacion_expediente: clean.fecha_creacion_expediente,

      id_abogado: id_abogado ?? null,
      abogado_contrario: toNullIfEmptyEffective(clean.abogado_contrario) ?? "",
      nombre_trabajador: toNullIfEmptyEffective(clean.trabajador_nombre),

      id_autoridad: id_autoridad ?? null,

      id_empresa: Number(empresa_id),
      id_razon_social: Number(id_razon_social),

      fecha_cita_audiencia: clean.fecha_cita_audiencia,

      forma_notificacion: clean.forma_notificacion,
      origen_actuario: clean.origen_actuario,
    };

    const filesMap = {};
    if (documentsMap.citatorio) filesMap.citatorio = documentsMap.citatorio;

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

  // Handlers planos y correctos (sin wrappers que devuelvan otra función)
  const onChangeRazonSocial = (value) => {
    const nombre = form.getFieldValue("empresa_nombre") || "";
    const bucket = empresasIndex.get(nombre);
    if (!bucket) return;

    const chosen = (bucket.razones || []).find(o => o.value === value);
    if (chosen?.empresa_id != null) {
      form.setFieldsValue({ empresa_id: chosen.empresa_id });
    } else if (bucket.empresaIds.size === 1) {
      form.setFieldsValue({ empresa_id: Array.from(bucket.empresaIds)[0] });
    } else {
      form.setFieldsValue({ empresa_id: null });
    }
  };

  const onChangeEmpresa = (value) => {
    // Limpia RS e inicializa empresa_id
    form.setFieldsValue({
      empresa_nombre: value || null,
      empresa_razon_social_id: null,
      empresa_id: null,
    });

    const bucket = empresasIndex.get(value || "");
    if (!bucket) return;

    const rs = bucket.razones || [];
    let empresaId = null;

    if (rs.length === 1) {
      empresaId = rs[0].empresa_id ?? (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
    } else if (rs.length === 0 && bucket.empresaIds.size === 1) {
      empresaId = Array.from(bucket.empresaIds)[0];
    }

    if (empresaId != null) {
      form.setFieldsValue({ empresa_id: empresaId });
    }
  };

  // Realinea RS/empresa_id cuando cambian opciones (por carga asíncrona)
  useEffect(() => {
    const empresaNombreNow = form.getFieldValue("empresa_nombre");
    if (!empresaNombreNow) return;

    const bucket = empresasIndex.get(empresaNombreNow);
    if (!bucket) return;

    const rs = bucket.razones || [];
    const currentRS = form.getFieldValue("empresa_razon_social_id");

    // Si el RS actual ya no existe en las nuevas opciones, límpialo
    if (currentRS != null && !rs.some(o => o.value === currentRS)) {
      form.setFieldsValue({ empresa_razon_social_id: null });
    }

    // Si solo hay una RS, selecciónala automáticamente
    if (rs.length === 1) {
      if (currentRS == null || currentRS !== rs[0].value) {
        form.setFieldsValue({ empresa_razon_social_id: rs[0].value });
      }
    }

    // Ajusta empresa_id de forma robusta
    let empresaId = null;
    if (rs.length === 1) {
      empresaId = rs[0].empresa_id ?? (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
    } else if (rs.length === 0 && bucket.empresaIds.size === 1) {
      empresaId = Array.from(bucket.empresaIds)[0];
    }
    if (empresaId != null && form.getFieldValue("empresa_id") !== empresaId) {
      form.setFieldsValue({ empresa_id: empresaId });
    }
  }, [razonSocialOptions, empresasIndex, form]);

  const handleSaveClick = async () => {
    try {
      const values = await form.validateFields();
      if (values.forma_notificacion === "actuario" && !values.origen_actuario) {
        message.error("Selecciona el origen del actuario (empresa o despacho).");
        return;
      }
      await buildAndSend(values);
    } catch (err) {
      const errorFields = err?.errorFields || [];
      if (errorFields.length) {
        message.error("Faltan campos obligatorios.");
        form.scrollToField(errorFields[0].name, { block: "center" });
        return;
      }
      message.error(err?.message || "No se pudo procesar el formulario.");
    }
  };

  /* ======================= Inicial ======================= */
  useEffect(() => {
    if (!open) return;
    const init = {
      abogado_contrario: "",
      trabajador_nombre: "",
      forma_notificacion: undefined,
      origen_actuario: undefined,
      ...initialValues,
    };
    if (init.empresa && !init.empresa_nombre) init.empresa_nombre = init.empresa;
    form.setFieldsValue(init);
    setDocumentsMap({ citatorio: null });
    setDocErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  /* ======================= UI ======================= */
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
            ? [{ uid: `-${keyName}`, name: documentsMap[keyName].name, status: "done" }]
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

  const titleText = mode === "edit"
    ? `Editar expediente${recordId ? ` #${recordId}` : ""}`
    : "Creando Cita Prejudicial";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnClose
      title={<span style={{ fontWeight: 600, fontSize: 16, color: "#fff" }}><i style={{marginRight:5}} className="fas fa-plus"/> {titleText}</span>}
      footer={null}
      styles={{
        header: { background: "#0b1b2b", padding: "12px 16px" },
        content: { background: "#0b1b2b", padding: 0 },
        body: { background: "#0b1b2b", padding: 16 },
        footer: { background: "#0b1b2b" },
      }}
      closeIcon={<CloseOutlined style={{ color: "#fff" }} />}
      width={Math.min(1080, Math.max(360, (typeof window !== "undefined" ? window.innerWidth : 1024) - 32))}
    >
      {/* Contenedor blanco interior */}
      <div style={{ background: "#fff", borderRadius: 10, padding: 25, marginTop: 30 }}>
        <Form form={form} layout="vertical" initialValues={{ ...initialValues }}>
          <Form.Item name="empresa_id" hidden>
            <Input />
          </Form.Item>

          <div className="d-flex justify-content-between">
            <div style={{ fontWeight: 600, marginBottom: 30 }}>Datos de expediente</div>
            <Button
              icon={mode === "edit" ? <CheckOutlined /> : <PlusOutlined />}
              loading={submitting}
              disabled={submitting}
              onClick={handleSaveClick}
              style={{
                background: "#0b1b2b",
                borderColor: "#0b1b2b",
                color: "#fff"
              }}
            >
              {mode === "edit" ? "Guardar cambios" : "Guardar"}
            </Button>
          </div>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Form.Item label="Expediente" name="exp" rules={rules.exp} normalize={makeNormalizer("exp")}>
                <Input placeholder="Ej. EXP-00123" allowClear maxLength={50} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Fecha y hora de emisión del expediente"
                name="fecha_creacion_expediente"
                rules={rules.fecha_creacion_expediente}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" showTime minuteStep={5} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Fecha y hora de la audiencia" name="fecha_cita_audiencia">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" showTime minuteStep={5} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Form.Item label="Empresa" name="empresa_nombre" rules={rules.empresa_nombre}>
                <Select
                  placeholder="Selecciona Empresa"
                  options={empresaNombreOptions}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  onChange={onChangeEmpresa}
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  getPopupContainer={(trigger) => trigger.parentNode}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Razón social" name="empresa_razon_social_id">
                <Select
                  placeholder="Selecciona Razón social (si aplica)"
                  options={razonSocialOptions}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  onChange={onChangeRazonSocial}
                  disabled={!empresaNombre}
                  notFoundContent={empresaNombre ? "Sin razones sociales" : "Selecciona empresa"}
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  getPopupContainer={(trigger) => trigger.parentNode}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Abogado"
                name="abogado"
                rules={rules.abogado}
                normalize={makeNormalizer("abogado")}
              >
                <Select
                  placeholder="Selecciona abogado"
                  options={abogadoOptions}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Abogado contrario"
                name="abogado_contrario"
                rules={rules.abogado_contrario}
                normalize={makeNormalizer("abogado_contrario")}
              >
                <Input placeholder="Nombre del abogado de la parte contraria" allowClear />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Nombre del trabajador"
                name="trabajador_nombre"
                rules={rules.trabajador_nombre}
                normalize={makeNormalizer("trabajador_nombre")}
              >
                <Input placeholder="Nombre del trabajador" allowClear />
              </Form.Item>
            </Col>
          </Row>

          {/* Estado/Ciudad ocultos visualmente; se espera vengan en initialValues si aplican */}

          {/* Fila: Competencia (izq) y Autoridad (der) */}
          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}>
              <Form.Item label="Competencia" name="ambito" rules={rules.ambito}>
                <Select
                  placeholder="Selecciona Competencia"
                  options={ambitoOptions}
                  allowClear
                  onChange={() => form.setFieldsValue({ autoridad: null })}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={18}>
              <Form.Item label="Autoridad" name="autoridad">
                <Select
                  placeholder="Selecciona autoridad"
                  options={autoridadOptionsFiltradas}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Notificación */}
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Form.Item label="Forma de notificación" name="forma_notificacion" rules={rules.forma_notificacion}>
                <Select
                  placeholder="Selecciona"
                  options={[
                    { label: "Trabajador", value: "trabajador" },
                    { label: "Actuario", value: "actuario" },
                  ]}
                  onChange={(v) => {
                    if (v !== "actuario") form.setFieldsValue({ origen_actuario: null });
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Origen del actuario" name="origen_actuario">
                <Select
                  placeholder="Selecciona origen"
                  options={[
                    { label: "Empresa", value: "empresa" },
                    { label: "Despacho", value: "despacho" },
                  ]}
                  disabled={formaNotifSel !== "actuario"}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          {/* Documentos debajo del formulario */}
          <DocBlock label="Citatorio / Cita" keyName="citatorio" />
        </Form>
      </div>
    </Modal>
  );
}
