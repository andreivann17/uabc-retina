// src/components/modals/expedientes/AddExpedienteModal.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tabs,
  Upload,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Table,
  Popconfirm,
  Alert,
} from "antd";
import {
  InboxOutlined,
  FileAddOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import {
  actionExpedienteCreate,
  actionExpedientesImportPreview,
  actionExpedientesImportSave,
  actionExpedienteUpdate,
} from "../../../redux/actions/expedientes/expedientes";
import { actionEmpresasGet } from "../../../redux/actions/empresas/empresas";

const { Dragger } = Upload;
const { Text } = Typography;

/* ======================= Utilidades de saneo ======================= */
const collapseSpaces = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ");

const sanitizeByField = (name, v) => {
  const s = collapseSpaces(v);
  switch (name) {
    case "exp":       return s.replace(/[^A-Za-z0-9_\-./ ]/g, "").slice(0, 50);
    case "anio":      return s.replace(/[^0-9]/g, "").slice(0, 4);
    case "actor":
    case "abogado":   return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]/g, "").slice(0, 100);
    case "empresa":   return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,()\/\- ]/g, "").slice(0, 120);
    case "estatus":
    case "especifico":return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,;:()\/\-# ]/g, "").slice(0, 160);
    case "status":    return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_\- ]/g, "").slice(0, 40);
    case "ciudad":    return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_\- ]/g, "").slice(0, 60);
    default:          return s;
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

const standardizeKey = (k) => {
  const raw = String(k ?? "");
  const lower = raw.toLowerCase();
  if (lower === "sede") return "ciudad";
  if (lower === "responsable") return "abogado";
  if (lower === "anio" || lower === "año") return "anual";
  return raw;
};

const titleMap = {
  exp: "Expediente",
  anual: "Año",
  actor: "Actor",
  empresa: "Empresa",
  estatus: "Estatus",
  especifico: "Específico",
  abogado: "Abogado",
  ciudad: "Ciudad",
  status: "Status",
  total_asuntos: "Total Asuntos",
};

const excludedCols = new Set(["comentarios","comentario","comments","observaciones","observación"]);
const VALID_IMPORT_COLS = new Set(["exp","anual","actor","empresa","estatus","especifico","ciudad","status","total_asuntos"]);
const REQUIRED_IMPORT_COLS = ["exp","anual","actor"];

/* ======================= Helpers Empresas/RS ======================= */
const pickCompanyName = (it) =>
  it?.nombre ?? it?.nombre_cliente ?? it?.empresa ?? it?.name ?? it?.razon_social ?? "";

const pickCompanyId = (it) => it?.id_empresa ?? it?.id ?? null;

const buildRSOption = ({ label, value, empresa_id }) => ({
  label: collapseSpaces(label || ""),
  value: value ?? null,       // null si sintética
  empresa_id: empresa_id ?? null,
});

/* Normalizador fuerte para comparar labels (quita espacios extras y usa lower) */
// Normalizador fuerte para comparar labels (quita espacios extras y usa lower)
const normLabel = (txt) =>
  collapseSpaces(txt || "")
    .trim()
    .toLowerCase();

/* DISTINCT por LABEL (ignora empresa_id e id_rs).
   Si hay varias con el mismo label:
   - Prefiere la que tenga id real (value != null)
   - Luego la que tenga empresa_id definido
   - Si empatan, menor empresa_id
*/
const dedupByLabel = (arr = []) => {
  const map = new Map();

  const score = (r) => {
    // id real vale 2, empresa_id vale 1
    return (r.value != null ? 2 : 0) + (r.empresa_id != null ? 1 : 0);
  };

  for (const r of arr) {
    const k = normLabel(r.label);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, r);
      continue;
    }
    // Decide cuál conservar
    const sPrev = score(prev);
    const sNew  = score(r);

    if (sNew > sPrev) {
      map.set(k, r);
    } else if (sNew === sPrev) {
      const ep = prev.empresa_id ?? Number.POSITIVE_INFINITY;
      const en = r.empresa_id ?? Number.POSITIVE_INFINITY;
      if (en < ep) map.set(k, r); // menor empresa_id
      // si empatan, deja prev (estable)
    }
  }

  // Devuelve ordenado alfabéticamente
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
};


/* Dedup: colapsa por (label_normalizado + empresa_id). Si hay sintética y real, deja la real. */
const dedupRazones = (arr = []) => {
  const map = new Map();
  for (const r of arr) {
    const key = `${normLabel(r.label)}|${r.empresa_id ?? "null"}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      // Si la existente es sintética (value null) y la nueva trae id real, reemplaza.
      if ((existing.value == null) && (r.value != null)) {
        map.set(key, r);
      }
      // Si ambas tienen id distintos pero mismo label/empresa_id, conservamos la primera (evita duplicado visual).
    }
  }
  // Orden alfabético por label
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
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

    // razones reales
    const rsArr = Array.isArray(it?.razones_sociales) ? it.razones_sociales : [];
    rsArr.forEach((rs) => {
      const label = rs?.nombre ?? rs?.razon_social ?? rs?.name ?? "";
      const value = rs?.id_empresa_razon_social ?? rs?.id ?? null;
      const empresa_id = rs?.id_empresa ?? idEmpresa ?? null;
      if (!label) return;
      bucket.razones.push(buildRSOption({ label, value, empresa_id }));
    });

    // razón social plana -> sintética
    const plainRS = it?.razon_social && String(it.razon_social).trim() !== "" ? String(it.razon_social) : null;
    if (plainRS) {
      bucket.razones.push(buildRSOption({ label: plainRS, value: null, empresa_id: idEmpresa }));
    }
  });

  // Deduplicar por label_normalizado + empresa_id (prefiere opción con id real)
  for (const [name, bucket] of byName.entries()) {
    bucket.razones = dedupRazones(bucket.razones);
    byName.set(name, bucket);
  }

  return byName;
};

/* Normaliza cualquier forma del slice a array seguro */
const coerceEmpresasArray = (slice) => {
  if (Array.isArray(slice)) return slice;
  if (Array.isArray(slice?.items)) return slice.items;
  if (Array.isArray(slice?.data)) return slice.data;
  if (Array.isArray(slice?.list)) return slice.list;
  if (Array.isArray(slice?.items?.data)) return slice.items.data;
  if (Array.isArray(slice?.data?.items)) return slice.data.items;
  return [];
};

/* ======================= Componente ======================= */
export default function AddExpedienteModal({
  open,
  setOpen,
  onClose,
  catalogs = {},
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
  const [activeKey, setActiveKey] = useState("form");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(actionEmpresasGet());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empresasSlice = useSelector((state) => state?.empresas ?? {});
  const empresasItems = useMemo(() => coerceEmpresasArray(empresasSlice), [empresasSlice]);

  const empresasIndex = useMemo(() => buildEmpresasIndex(empresasItems), [empresasItems]);

  const empresaNombreOptions = useMemo(() => {
    const names = Array.from(empresasIndex.keys());
    return names.map((n) => ({ label: n, value: n }))
                .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [empresasIndex]);

  /* ====== Navegación por Enter ====== */
  const fieldOrder = useRef([
    "exp","anio","actor","empresa_nombre","empresa_razon_social_id",
    "estatus","especifico","abogado","ciudad","status",
  ]);
  const fieldRefs = useRef({
    exp:null, anio:null, actor:null, empresa_nombre:null, empresa_razon_social_id:null,
    estatus:null, especifico:null, abogado:null, ciudad:null, status:null,
  });
  const expRef = useRef(null);

  const focusField = (key) => {
    const r = fieldRefs.current[key];
    if (!r) return;
    if (typeof r.focus === "function") return r.focus();
    if (r.input?.focus) return r.input.focus();
    if (r.focusElement?.focus) return r.focusElement.focus();
    if (r.resizableTextArea?.textArea?.focus) r.resizableTextArea.textArea.focus();
  };
  const isAnySelectOpen = () =>
    !!document.querySelector(".ant-select-open, .ant-select-dropdown:not(.ant-select-dropdown-hidden)");
  const makeOnKeyDown = (currentKey) => (e) => {
    if (e.key !== "Enter") return;
    if (activeKey !== "form") return;
    if (isAnySelectOpen()) return;
    e.preventDefault();
    const order = fieldOrder.current;
    const idx = order.indexOf(currentKey);
    if (idx === -1) return;
    const nextKey = order[idx + 1];
    if (nextKey) focusField(nextKey);
    else form.submit();
  };

  /* ====== Responsive ====== */
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const safeWidth = Math.min(960, Math.max(360, vw - 32));

  /* ====== Catálogos ====== */
  const ensureOption = (options, value, field) => {
    if (!value) return options;
    const has = options.some(
      (o) => String(o?.label ?? o) === String(value) || String(o?.value ?? o) === String(value)
    );
    if (has) return options;
    return [{ label: String(value), value: sanitizeByField(field, value) }, ...options];
  };
  const ciudadOptions = ensureOption(
    (catalogs.ciudades || []).map((v) => ({ label: collapseSpaces(v), value: sanitizeByField("ciudad", v) })),
    initialValues?.ciudad,
    "ciudad"
  );
  const statusOptions = ensureOption(
    ((catalogs.statuses || []).length ? catalogs.statuses : ["CONCLUIDO","REVISAR","RIESGO","NEGOCIAR"])
      .map((v) => ({ label: collapseSpaces(v), value: sanitizeByField("status", v) })),
    initialValues?.status,
    "status"
  );

  /* ====== Inicial ====== */
  useEffect(() => {
    if (!open) return;
    const init = { status: "REVISAR", ...initialValues };
    if (init.empresa && !init.empresa_nombre) init.empresa_nombre = init.empresa;
    form.setFieldsValue(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  /* ====== Empresa / Razón social ====== */
  const empresaNombre = Form.useWatch("empresa_nombre", form);

  const razonSocialOptions = useMemo(() => {
    if (!empresaNombre) return [];
    const bucket = empresasIndex.get(empresaNombre);
    if (!bucket) return [];
    return bucket.razones; // ya viene deduplicado
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
            form.setFieldsValue({ empresa_id: Array.from(bucket.empresaIds)[0] });
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

  /* ====== Guardado ====== */
  const handleFinish = async (values) => {
    if (!values.empresa_nombre) {
      message.error("Selecciona una Empresa.");
      focusField("empresa_nombre");
      return;
    }

    let empresa_id = values.empresa_id ?? null;
    if (!empresa_id) {
      const bucket = empresasIndex.get(values.empresa_nombre);
      const rs = razonSocialOptions;
      if (bucket) {
        if (rs.length > 1) {
          if (!values.empresa_razon_social_id) {
            message.error("Selecciona la Razón social para desambiguar la Empresa.");
            focusField("empresa_razon_social_id");
            return;
          }
          const chosen = rs.find((o) => o.value === values.empresa_razon_social_id);
          if (chosen?.empresa_id == null && bucket.empresaIds.size !== 1) {
            message.error("No se pudo inferir la Empresa. Selecciona una Razón social válida.");
            focusField("empresa_razon_social_id");
            return;
          }
          empresa_id = chosen?.empresa_id ?? (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
        } else if (rs.length === 1) {
          empresa_id = rs[0].empresa_id ?? (bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null);
        } else {
          empresa_id = bucket.empresaIds.size === 1 ? Array.from(bucket.empresaIds)[0] : null;
        }
      }
    }

    if (!empresa_id) {
      message.error("No se pudo determinar la Empresa. Verifica tu selección.");
      return;
    }

    const clean = {
      exp: sanitizeByField("exp", values.exp),
      anio: sanitizeByField("anio", values.anio),
      actor: sanitizeByField("actor", values.actor),
      estatus: sanitizeByField("estatus", values.estatus),
      especifico: sanitizeByField("especifico", values.especifico),
      abogado: sanitizeByField("abogado", values.abogado),
      ciudad: sanitizeByField("ciudad", values.ciudad),
      status: sanitizeByField("status", values.status),
    };

    const payloadBase = {
      exp: toNullIfEmptyEffective(clean.exp),
      actor: toNullIfEmptyEffective(clean.actor),
      estatus: toNullIfEmptyEffective(clean.estatus),
      especifico: toNullIfEmptyEffective(clean.especifico),
      abogado: toNullIfEmptyEffective(clean.abogado),
      ciudad: toNullIfEmptyEffective(clean.ciudad),
      status: toNullIfEmptyEffective(clean.status),
      empresa_id: Number(empresa_id),
      empresa_razon_social_id: values.empresa_razon_social_id != null ? Number(values.empresa_razon_social_id) : null,
      empresa: values.empresa_nombre || null,
    };

    const anioNum = Number(clean.anio || 0) || 0;
    const anual = anioNum === 0 ? null : Math.min(2100, Math.max(1900, anioNum));
    const payload = { ...payloadBase, anual };

    try {
      setSubmitting(true);
      if (mode === "edit") {
        await dispatch(actionExpedienteUpdate(recordId, payload, () => { onSaved?.(); }));
        message.success("Expediente actualizado");
      } else {
        await dispatch(actionExpedienteCreate({ ...payload, total_asuntos: "", excel: 0, ip: "", lugar: "" }));
        message.success("Expediente creado");
        onSaved?.();
      }
      onClose?.();
    } catch (e) {
      message.error(e?.message || (mode === "edit" ? "No se pudo actualizar" : "No se pudo crear"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ====== Reglas ====== */
  const rules = {
    exp:   [{ required: true, message: "Requerido" }, { pattern: /^[A-Za-z0-9_.\/\- ]{1,50}$/, message: "Solo letras, números y _ . / - y espacios." }],
    anio:  [{ required: true, message: "Requerido" }],
    actor: [{ required: true, message: "Requerido" }, { pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/, message: "Solo letras, espacios y ' . -" }],
    empresa_nombre: [{ required: true, message: "Selecciona una Empresa" }],
    estatus: [{ pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,;:()\/\-# ]{0,160}$/, message: "Caracteres no permitidos en estatus." }],
    especifico: [{ pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,;:()\/\-# ]{0,160}$/, message: "Caracteres no permitidos en específico." }],
    abogado: [{ required: true, message: "Requerido" }, { pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/, message: "Solo letras, espacios y ' . -" }],
    ciudad: [{ required: true, message: "Requerido" }],
    status: [{ required: true, message: "Requerido" }],
  };

  /* ====== Tab Form ====== */
  const formTab = (
    <Form form={form} layout="vertical" style={{ padding: 10 }} initialValues={{ status: "REVISAR", ...initialValues }} onFinish={handleFinish}>
      <Form.Item name="empresa_id" hidden><Input /></Form.Item>

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
            <Form.Item label="Expediente" name="exp" rules={rules.exp} normalize={makeNormalizer("exp")}>
              <Input
                ref={(el) => { expRef.current = el; fieldRefs.current.exp = el; }}
                placeholder="Ej. EXP-00123" allowClear maxLength={50} onKeyDown={makeOnKeyDown("exp")}
              />
            </Form.Item>
          </Col>
                <Col xs={24} md={10}>
            <Form.Item label="Tipo de Expediente" name="empresa_razon_social_id">
              <Select
                ref={(el) => (fieldRefs.current.empresa_razon_social_id = el)}
                placeholder={empresaNombre ? "Selecciona Razón social (si aplica)" : "Selecciona primero Empresa"}
                options={razonSocialOptions}
                showSearch allowClear optionFilterProp="label"
                onChange={onChangeRazonSocial}
                disabled={!empresaNombre}
                onKeyDown={makeOnKeyDown("empresa_razon_social_id")}
                notFoundContent={empresaNombre ? "Sin razones sociales" : "Selecciona empresa"}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item label="Año" name="anio" rules={rules.anio} normalize={makeNormalizer("anio")}>
              <InputNumber ref={(el) => (fieldRefs.current.anio = el)} min={1900} max={2100} style={{ width: "100%" }} stringMode maxLength={4} onKeyDown={makeOnKeyDown("anio")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Actor" name="actor" rules={rules.actor} normalize={makeNormalizer("actor")}>
              <Input ref={(el) => (fieldRefs.current.actor = el)} placeholder="Nombre del actor" allowClear maxLength={100} onKeyDown={makeOnKeyDown("actor")} />
            </Form.Item>
          </Col>
<Col xs={24} md={12}>
            <Form.Item label="Autoridad" name="actor" rules={rules.actor} normalize={makeNormalizer("actor")}>
              <Input ref={(el) => (fieldRefs.current.actor = el)} placeholder="Nombre del actor" allowClear maxLength={100} onKeyDown={makeOnKeyDown("actor")} />
            </Form.Item>
          </Col>
       
        </Row>

        <Row gutter={[12, 12]}>
             <Col xs={24} md={12}>
            <Form.Item label="Empresa" name="empresa_nombre" rules={rules.empresa_nombre}>
              <Select
                ref={(el) => (fieldRefs.current.empresa_nombre = el)}
                placeholder="Selecciona Empresa"
                options={empresaNombreOptions}
                showSearch allowClear optionFilterProp="label"
                onChange={onChangeEmpresaNombre}
                onKeyDown={makeOnKeyDown("empresa_nombre")}
                notFoundContent="Sin datos"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Razón social" name="empresa_razon_social_id">
              <Select
                ref={(el) => (fieldRefs.current.empresa_razon_social_id = el)}
                placeholder={empresaNombre ? "Selecciona Razón social (si aplica)" : "Selecciona primero Empresa"}
                options={razonSocialOptions}
                showSearch allowClear optionFilterProp="label"
                onChange={onChangeRazonSocial}
                disabled={!empresaNombre}
                onKeyDown={makeOnKeyDown("empresa_razon_social_id")}
                notFoundContent={empresaNombre ? "Sin razones sociales" : "Selecciona empresa"}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Específico" name="especifico" rules={rules.especifico} normalize={makeNormalizer("especifico")}>
              <Input ref={(el) => (fieldRefs.current.especifico = el)} placeholder="Detalle específico" allowClear maxLength={160} onKeyDown={makeOnKeyDown("especifico")} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Abogado" name="abogado" rules={rules.abogado} normalize={makeNormalizer("abogado")}>
              <Input ref={(el) => (fieldRefs.current.abogado = el)} placeholder="Nombre del responsable o abogado" allowClear maxLength={100} onKeyDown={makeOnKeyDown("abogado")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Ciudad" name="ciudad" rules={rules.ciudad} normalize={makeNormalizer("ciudad")}>
              <Select ref={(el) => (fieldRefs.current.ciudad = el)} placeholder="Selecciona sede" options={ciudadOptions} showSearch allowClear optionFilterProp="label" onKeyDown={makeOnKeyDown("ciudad")} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Status (etiqueta de color)" name="status" rules={rules.status} normalize={makeNormalizer("status")}>
              <Select ref={(el) => (fieldRefs.current.status = el)} placeholder="Selecciona status" options={statusOptions} showSearch allowClear optionFilterProp="label" onKeyDown={makeOnKeyDown("status")} />
            </Form.Item>
          </Col>
        </Row>

        <Space style={{ justifyContent: "flex-end", width: "100%", paddingBottom: 20 }} wrap>
          <Button onClick={onClose}>Cerrar</Button>
          <Button type="primary" className="custom-button" htmlType="submit" icon={mode === "edit" ? <CheckOutlined /> : <PlusOutlined />} loading={submitting} disabled={submitting}>
            {mode === "edit" ? "Guardar cambios" : "Guardar"}
          </Button>
        </Space>
      </Space>
    </Form>
  );

  /* ======== IMPORT ======== */
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [importIssues, setImportIssues] = useState({ missing: [], unknown: [] });

  const numericCols = new Set(["anual"]);
  const editableCols = ["exp","anual","actor","empresa","estatus","especifico","abogado","ciudad","status","total_asuntos"];

  const doPreview = async () => {
    if (!file) { message.error("Selecciona un archivo .xlsx, .xls o .csv"); return; }
    try {
      setUploading(true);
      const data = await dispatch(actionExpedientesImportPreview(file));
      const normalizedColumnsRaw = (data?.normalizedColumns || ["exp","anual","actor","empresa","estatus","especifico","abogado","ciudad","status","total_asuntos"]).filter(Boolean);
      const normalizedColumns = normalizedColumnsRaw.map(standardizeKey).filter((c) => !excludedCols.has(String(c).toLowerCase()));
      const present = new Set(normalizedColumns);
      const missing = REQUIRED_IMPORT_COLS.filter((c) => !present.has(c));
      const unknown = normalizedColumns.filter((c) => !VALID_IMPORT_COLS.has(c));
      setImportIssues({ missing, unknown });

      const normRows = (data?.rows || []).map((r, i) => {
        const out = {};
        Object.entries(r || {}).forEach(([k, v]) => { const std = standardizeKey(k); if (!excludedCols.has(String(std).toLowerCase())) out[std] = v; });
        return { key: i + 1, ...out };
      });
      setPreview({ ...data, normalizedColumns });
      setRows(normRows);
      message.success(`Archivo válido. Filas detectadas: ${normRows.length}`);
    } catch (e) {
      message.error(e?.message || "No se pudo previsualizar");
    } finally {
      setUploading(false);
    }
  };

  const sanitizeForImport = (field, value) => {
    if (value == null) return null;
    if (numericCols.has(field)) {
      const digits = sanitizeByField("anio", value);
      return digits.replace(/\s/g, "") === "" ? null : Number(digits);
    }
    const map = { exp:"exp", actor:"actor", empresa:"empresa", estatus:"estatus", especifico:"especifico", abogado:"abogado", ciudad:"ciudad", status:"status", total_asuntos:"exp" };
    const key = map[field] || field;
    const clean = sanitizeByField(key, value);
    return toNullIfEmptyEffective(clean);
  };

  const updateCell = (rowIndex, field, value) => {
    const clean = sanitizeForImport(field, value);
    setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [field]: clean } : r)));
  };
  const removeRow = (rowIndex) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex).map((r, idx) => ({ ...r, key: idx + 1 })));
  };
  const clearPreview = () => {
    setPreview(null); setRows([]); setFile(null); setImportIssues({ missing: [], unknown: [] });
  };

  const buildColumns = () => {
    const cols = (preview?.normalizedColumns || ["exp","anual","actor","empresa","estatus","especifico","abogado","ciudad","status","total_asuntos"])
      .filter((c) => !excludedCols.has(String(c).toLowerCase()));
    const antdCols = cols.map((c) => ({
      title: titleMap[c] || c,
      dataIndex: c,
      key: c,
      width: 160,
      render: (val, record, index) =>
        editableCols.includes(c)
          ? (numericCols.has(c)
              ? <InputNumber value={val} onChange={(v) => updateCell(index, c, v)} style={{ width: "100%" }} stringMode />
              : <Input value={val == null ? "" : String(val)} onChange={(e) => updateCell(index, c, e.target.value)} maxLength={c === "exp" ? 50 : c === "empresa" ? 120 : 160} allowClear />)
          : <Text>{val}</Text>,
    }));
    antdCols.push({
      title: "Acciones",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, __, index) => (
        <Popconfirm title="Eliminar fila" onConfirm={() => removeRow(index)} okText="Sí" cancelText="No">
          <Button danger type="link" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    });
    return antdCols;
  };

  const doSave = async () => {
    if (!rows.length) { message.error("No hay filas para guardar"); return; }
    if (importIssues.missing?.length) { message.error("No puedes guardar: faltan columnas requeridas."); return; }
    try {
      setUploading(true);
      const rowsClean = rows.map(({ key, ...rest }) => {
        const out = {};
        Object.entries(rest).forEach(([k, v]) => {
          const stdK = standardizeKey(k);
          if (!excludedCols.has(String(stdK).toLowerCase())) out[stdK] = sanitizeForImport(stdK, v);
        });
        return out;
      });
      await dispatch(actionExpedientesImportSave(rowsClean, { lugar: forceLugar }));
      message.success("Importación guardada");
      onSaved?.();
      onClose?.();
    } catch (e) {
      message.error(e?.message || "No se pudo guardar la importación");
    } finally {
      setUploading(false);
    }
  };

  const importProblemsBanner = () => {
    const { missing, unknown } = importIssues || {};
    if ((!missing || missing.length === 0) && (!unknown || unknown.length === 0)) return null;
    const hasMissing = missing && missing.length > 0;
    const hasUnknown = unknown && unknown.length > 0;
    return (
      <Alert
        type={hasMissing ? "error" : "warning"}
        showIcon
        message={hasMissing ? "Faltan columnas requeridas" : "Columnas no reconocidas"}
        description={
          <div style={{ lineHeight: 1.6 }}>
            {hasMissing && (<div><b>Requeridas faltantes:</b> {missing.map((m) => titleMap[m] || m).join(", ")}</div>)}
            {hasUnknown && (<div><b>No usadas en el proceso:</b> {unknown.map((u) => titleMap[u] || u).join(", ")}</div>)}
          </div>
        }
        style={{ marginTop: 8 }}
      />
    );
  };

  const importTab = (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {importProblemsBanner()}
      {!preview ? (
        <>
          <Text type="secondary">Importa un archivo <b>.xlsx/.xls</b> o <b>.csv</b></Text>
          <Dragger
            name="file" multiple={false} maxCount={1} accept=".xlsx,.xls,.csv"
            beforeUpload={(f) => { setFile(f); return false; }}
            onRemove={() => setFile(null)} disabled={uploading} style={{ padding: vw < 576 ? 8 : 12 }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Haz clic o arrastra el archivo aquí</p>
            <p className="ant-upload-hint">Luego presiona “Previsualizar”</p>
          </Dragger>
          <Space style={{ justifyContent: "flex-end", width: "100%" }} wrap>
            <Button onClick={onClose}>Cerrar</Button>
            <Button type="primary" className="custom-button" icon={<FileAddOutlined />} onClick={doPreview} loading={uploading} disabled={uploading || !file}>
              Previsualizar
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Table size="small" rowKey="key" dataSource={rows} columns={buildColumns()} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1000 }} />
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={clearPreview} disabled={uploading}>Cambiar archivo</Button>
            </Space>
            <Space wrap>
              <Button onClick={onClose}>Cerrar</Button>
              <Button type="primary" className="custom-button" icon={<CheckOutlined />} onClick={doSave} loading={uploading} disabled={uploading || rows.length === 0}>
                Aceptar y Guardar
              </Button>
            </Space>
          </Space>
        </>
      )}
    </Space>
  );

  const titleText = mode === "edit" ? `Editar expediente${recordId ? ` #${recordId}` : ""}` : "Agregar expediente";

  return (
    <Modal
      open={open} onCancel={onClose} footer={null} width={safeWidth} destroyOnClose title={titleText}
      maskClosable={!submitting && !uploading}
      styles={{ body: { maxHeight: `calc(100vh - ${modalTop + 96}px)`, overflowY: "auto" } }}
      bodyStyle={{ maxHeight: `calc(100vh - ${modalTop + 96}px)`, overflowY: "auto", overflowX: "hidden" }}
    >
      <Tabs
        activeKey={activeKey} onChange={setActiveKey}
        items={ hideImport ? [{ key: "form", label: "Formulario", children: formTab }]
               : [{ key: "form", label: "Formulario", children: formTab }, { key: "import", label: "Importar Excel", children: importTab }] }
      />
    </Modal>
  );
}
