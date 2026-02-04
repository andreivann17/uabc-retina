// FormDesvinculaciones.jsx
import React, { useMemo, useState, useEffect, useRef, useImperativeHandle } from "react";
import {
  Form,
  Input,
  Select,
  Upload,
  Typography,
  Row,
  Col,
  Alert,
  InputNumber,
  AutoComplete,
  notification,
  DatePicker,
  Divider,
  Button,
  Spin,
  Cascader,
  Tag,
} from "antd";

import { InboxOutlined, CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import ModalNuevoCliente from "../../modals/desvinculaciones/ModalNuevoCliente";

import {
  actionDesvinculacionCreate,
  actionDesvinculacionUpdateById,
} from "../../../redux/actions/desvinculaciones/desvinculaciones";

import axios from "axios";

const { Dragger } = Upload;
const { Text } = Typography;
const API_BASE = `/api`;

const apiServiceGet = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

const origenPrivadoOptions = [
  {
    value: "privado",
    label: "Privado",
    children: [
      { value: "centro_trabajo", label: "Centro de Trabajo" },
      { value: "despacho", label: "Despacho" },
    ],
  },
  { value: "ratificado", label: "Ratificado" },
];

const authHeader = () => {
  const token = localStorage.getItem("tokenadmin") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ========= Utils ========= */
const collapseSpaces = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normLabel = (txt) => collapseSpaces(txt || "").trim().toLowerCase();

const toNullIfEmptyEffective = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return v;
  return v.replace(/\s/g, "") === "" ? null : v;
};

const sanitizeByField = (name, v) => {
  const s = collapseSpaces(v);
  switch (name) {
    case "solicitante":
    case "empresa_nombre":
      return s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]/g, "").slice(0, 120);
    case "notas":
      return s.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 1000);
    default:
      return s;
  }
};

const normalizeFechaDDMMYYYYHHMM_to_YYYYMMDD_HHMMSS = (str) => {
  if (!str) return null;

  const s = String(str).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return null;

  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  const HH = m[4] ?? "07";
  const MM = m[5] ?? "00";

  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:00`;
};


const normalizeFechaDDMMYYYY_to_YYYYMMDD = (str) => {
  if (!str) return null;
  const digits = String(str).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const dd = digits.substring(0, 2);
  const mm = digits.substring(2, 4);
  const yyyy = digits.substring(4, 8);
  return `${yyyy}-${mm}-${dd}`;
};

const isoToDDMMYYYY = (v) => {
  if (!v) return "";
  const d = dayjs(v);
  return d.isValid() ? d.format("DD/MM/YYYY") : "";
};

const dedupRazones = (arr = []) => {
  const map = new Map();
  for (const r of arr) {
    const key = `${normLabel(r.label)}|${r.empresa_id ?? "null"}`;
    const existing = map.get(key);
    if (!existing) map.set(key, r);
    else if (existing.value == null && r.value != null) map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
};

const pickCompanyName = (it) =>
  it?.nombre ??
  it?.nombre_cliente ??
  it?.empresa ??
  it?.name ??
  it?.razon_social ??
  it?.empresa_nombre ??
  "";

const coerceBool01 = (v, defaultVal = true) => {
  if (v === undefined || v === null || v === "") return defaultVal;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "si" || s === "sí") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return Boolean(v);
};

const pickFirst = (obj, keys) => {
  for (const k of keys) {
    const val = obj?.[k];
    const clean = collapseSpaces(val || "");
    if (clean) return clean;
  }
  return "";
};

const coerceIntOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const FormDesvinculaciones = React.forwardRef(
  (
    {
      variant = "context_view",
      initialValues = {},
      onSaved,
      idCiudad,
      ctxEmpresaId,
      onCancel,
      isEdit = false,
      idDesvinculacion = null,
      showTopActions = true,
      ctxRazonSocialIds,
      onSubmit = null,
      id_empresa,
      catalogCiudadOptions = [],
      catalogEmpresaNombreOptionsBase = [],
      catalogEmpresasIndex = new Map(),
      catalogEmpresasItems = [],
    },
    ref
  ) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [form] = Form.useForm();

    const [submitting, setSubmitting] = useState(false);
    const [openNuevoCliente, setOpenNuevoCliente] = useState(false);

    const [empleadosCount, setEmpleadosCount] = useState(1);
    const empleadosWatch = Form.useWatch("empleados", form);

    const isStandaloneFull = variant === "standalone_full";

    // ========= NUEVO: origen del cliente =========
    const [clienteSource, setClienteSource] = useState("search"); // "search" | "modal"
    const [nuevoClienteData, setNuevoClienteData] = useState(null); // payload del modal

    const isClienteDesdeModal = clienteSource === "modal" && !!nuevoClienteData;

    // Documento principal
    const [documentsMap, setDocumentsMap] = useState({ documento: null });
    const [docErrors, setDocErrors] = useState({});

    // ===== Refs para Enter->Next =====
    const solicitanteRef = useRef(null);
    const fechaEncargoRef = useRef(null);
    const fechaSolicitudRef = useRef(null);
    const viaRef = useRef(null);
    const notasRef = useRef(null);

    const ciudadRef = useRef(null);
    const empresaRef = useRef(null);
    const razonRef = useRef(null);

    const origenPrivadoRef = useRef(null);

    const focusOrder = useMemo(() => {
      if (isStandaloneFull) {
        return [
          ciudadRef,
          empresaRef,
          razonRef,
          solicitanteRef,
          fechaEncargoRef,
          fechaSolicitudRef,
          viaRef,
          origenPrivadoRef,
          notasRef,
        ];
      }
      return [solicitanteRef, fechaEncargoRef, fechaSolicitudRef, viaRef, origenPrivadoRef, notasRef];
    }, [isStandaloneFull]);

    const focusNext = (currentRef) => {
      const idx = focusOrder.indexOf(currentRef);
      if (idx === -1) return;
      for (let i = idx + 1; i < focusOrder.length; i++) {
        const r = focusOrder[i];
        if (r && r.current && typeof r.current.focus === "function") {
          r.current.focus();
          return;
        }
      }
    };

    const makeEnterHandler = (fieldRef) => (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        focusNext(fieldRef);
      }
    };

    // ===== Inputs de fecha con calendario =====
    const [openFechaEncargoPicker, setOpenFechaEncargoPicker] = useState(false);
    const [openFechaSolicitudPicker, setOpenFechaSolicitudPicker] = useState(false);

    const fechaEncargoValue = Form.useWatch("fecha_encargo", form);
    const fechaSolicitudValue = Form.useWatch("fecha_solicitud", form);

    // ============================
    // Buscador empresa/razon/corresponsal
    // ============================
    const [empresaSearchValue, setEmpresaSearchValue] = useState("");
    const [empresaSearchOptions, setEmpresaSearchOptions] = useState([]);
    const [empresaSearching, setEmpresaSearching] = useState(false);
    const empresaSearchTimeoutRef = useRef(null);

    const empresaHitsMapRef = useRef(new Map());
    const empresaOptionMetaRef = useRef(new Map());

    // 2 inputs disabled a la derecha
    const [empresaDisabledNombre, setEmpresaDisabledNombre] = useState("");
    const [corresponsalDisabledNombre, setCorresponsalDisabledNombre] = useState("");

    const fetchEmpresas = async (q) => {
      const query = (q || "").trim();
      if (!query) return [];

      try {
        setEmpresaSearching(true);
        const { data } = await apiServiceGet.get("empresas/search", {
          params: { q: query, limit: 10 },
          headers: authHeader(),
        });
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Error /empresas/search:", err?.response?.status || err);
        return [];
      } finally {
        setEmpresaSearching(false);
      }
    };

    const resetEmpresaSelection = () => {
      setClienteSource("search");
      setNuevoClienteData(null);

      setEmpresaSearchValue("");
      setEmpresaSearchOptions([]);
      empresaHitsMapRef.current = new Map();
      empresaOptionMetaRef.current = new Map();

      setEmpresaDisabledNombre("");
      setCorresponsalDisabledNombre("");

      form.setFieldsValue({
        empresa_search: undefined,
        empresa_nombre: undefined,
        empresa_id: null,
        empresa_razon_social_id: [],
        empresa_razon_social_nombre: [],
        cliente_directo: true,
        corresponsal_nombre: undefined,
        corresponsal_celular: undefined,
        corresponsal_correo: undefined,

        // NUEVO: campos del modal (para que no se mezclen)
        nuevo_cliente: null,
      });
    };

    const handleEmpresaSearch = (value) => {
      if (isClienteDesdeModal) return; // bloqueado si viene del modal

      setEmpresaSearchValue(value);

      const q = (value || "").trim();
      if (!q) {
        setEmpresaSearchOptions([]);
        empresaHitsMapRef.current = new Map();
        empresaOptionMetaRef.current = new Map();
        setEmpresaDisabledNombre("");
        setCorresponsalDisabledNombre("");
        return;
      }

      if (empresaSearchTimeoutRef.current) clearTimeout(empresaSearchTimeoutRef.current);

      empresaSearchTimeoutRef.current = setTimeout(async () => {
        const hits = await fetchEmpresas(q);

        const map = new Map();
        for (const it of hits) map.set(String(it.id_empresa), it);
        empresaHitsMapRef.current = map;

        const opts = [];
        const seen = new Set();
        const MAX = 10;

        const meta = new Map();

        for (const it of hits) {
          const razones = Array.isArray(it.razones_sociales) ? it.razones_sociales : [];

          for (const r of razones) {
            if (opts.length >= MAX) break;

            const razonNombre = (r?.nombre || "").trim();
            if (!razonNombre) continue;

            const key = razonNombre.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            const empresaId = String(it.id_empresa);
            const razonId = String(r?.id ?? r?.id_razon_social ?? "");
            const optionValue = `${empresaId}|${razonId}`;

            meta.set(optionValue, { razonNombre });

            opts.push({
              value: optionValue,
              label: (
                <div>
                  <div style={{ fontWeight: 600 }}>{it.nombre || "Sin nombre"}</div>

                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Corresponsal: {it.nombre_corresponsal || "—"} • Directo:{" "}
                    {it.cliente_directo ? "Sí" : "No"}
                  </div>

                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, whiteSpace: "normal" }}>
                    Razón: {razonNombre}
                  </div>

                  {it.correo_corresponsal || it.celular_corresponsal ? (
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      {it.correo_corresponsal || ""}
                      {it.correo_corresponsal && it.celular_corresponsal ? " • " : ""}
                      {it.celular_corresponsal || ""}
                    </div>
                  ) : null}
                </div>
              ),
              empresa_id: it.id_empresa,
              empresa_nombre: it.nombre || "",
              corresponsal_nombre: it.nombre_corresponsal || "",
              corresponsal_correo: it.correo_corresponsal || "",
              corresponsal_celular: it.celular_corresponsal || "",
              cliente_directo: !!it.cliente_directo,
              razon_id: razonId,
              razon_nombre: razonNombre,
            });
          }

          if (opts.length >= MAX) break;
        }

        empresaOptionMetaRef.current = meta;
        setEmpresaSearchOptions(opts);
      }, 300);
    };

    const handleEmpresaSelect = (value, option) => {
      // si el usuario selecciona algo del search, vuelve a modo search
      setClienteSource("search");
      setNuevoClienteData(null);
      form.setFieldsValue({ nuevo_cliente: null });

      const razonNombre = option?.razon_nombre || "";

      setEmpresaSearchValue(razonNombre);

      setEmpresaDisabledNombre(option?.empresa_nombre || "");
      setCorresponsalDisabledNombre(option?.corresponsal_nombre || "");

      form.setFieldsValue({
        empresa_search: razonNombre,
        empresa_nombre: option?.empresa_nombre || undefined,
        empresa_id: option?.empresa_id || null,

        empresa_razon_social_id: option?.razon_id ? [String(option.razon_id)] : [],
        empresa_razon_social_nombre: razonNombre ? [razonNombre] : [],

        cliente_directo: !!option?.cliente_directo,
        corresponsal_nombre: option?.cliente_directo ? undefined : option?.corresponsal_nombre || undefined,
        corresponsal_correo: option?.cliente_directo ? undefined : option?.corresponsal_correo || undefined,
        corresponsal_celular: option?.cliente_directo ? undefined : option?.corresponsal_celular || undefined,
      });
    };

    const handleEmpresaChange = (val) => {
      if (isClienteDesdeModal) return;

      const v = String(val ?? "");
      setEmpresaSearchValue(v);

      if (!v.trim()) {
        resetEmpresaSelection();
      }
    };

    const makeFechaInputHandler = (fieldName) => (e) => {
      let v = e.target.value.replace(/\D/g, "");
      let formatted = v;
      if (v.length > 2) formatted = v.slice(0, 2) + "/" + v.slice(2);
      if (v.length > 4) formatted = formatted.slice(0, 5) + "/" + formatted.slice(5);
      formatted = formatted.slice(0, 10);
      e.target.value = formatted;
      form.setFieldsValue({ [fieldName]: formatted });
    };
const makeFechaHoraInputHandler = (fieldName) => (e) => {
  let v = e.target.value.replace(/\D/g, "");
  // ddmmyyyyhhmm (máximo 12 dígitos)
  v = v.slice(0, 12);

  let out = v;
  if (v.length > 2) out = v.slice(0, 2) + "/" + v.slice(2);
  if (v.length > 4) out = out.slice(0, 5) + "/" + out.slice(5);
  if (v.length > 8) out = out.slice(0, 10) + " " + out.slice(10);
  if (v.length > 10) out = out.slice(0, 13) + ":" + out.slice(13);

  // limita a "DD/MM/YYYY HH:MM" => 16 chars
  out = out.slice(0, 16);

  e.target.value = out;
  form.setFieldsValue({ [fieldName]: out });
};

    const handleFechaEncargoCalendarChange = (value) => {
      const formatted = value ? value.format("DD/MM/YYYY") : "";
      form.setFieldsValue({ fecha_encargo: formatted });
    };

    const handleFechaSolicitudCalendarChange = (value) => {
      const formatted = value ? value.format("DD/MM/YYYY") : "";
      form.setFieldsValue({ fecha_solicitud: formatted });
    };

    /* =========================
       Standalone FULL: empresas/razones dinámicas (sin cambios de tu lógica)
       ========================= */
    const [empresaCustomNames, setEmpresaCustomNames] = useState([]);
    const [empresaNewName, setEmpresaNewName] = useState("");
    const empresaInputRef = useRef(null);

    const [razonCustomByEmpresa, setRazonCustomByEmpresa] = useState({});
    const [razonNewName, setRazonNewName] = useState("");
    const razonInputRef = useRef(null);

    const empresaNombreWatch = Form.useWatch("empresa_nombre", form);
    const clienteDirectoWatch = Form.useWatch("cliente_directo", form);

    const empresaNombreOptions = useMemo(() => {
      const extra = empresaCustomNames.map((n) => ({ label: n, value: n }));
      return [...catalogEmpresaNombreOptionsBase, ...extra];
    }, [catalogEmpresaNombreOptionsBase, empresaCustomNames]);

    const razonSocialOptionsBase = useMemo(() => {
      if (!empresaNombreWatch) return [];
      const bucket = catalogEmpresasIndex.get(empresaNombreWatch);
      if (!bucket) return [];
      return bucket.razones || [];
    }, [empresaNombreWatch, catalogEmpresasIndex]);

    const razonSocialOptions = useMemo(() => {
      const extra = razonCustomByEmpresa[empresaNombreWatch] || [];
      return dedupRazones([...(razonSocialOptionsBase || []), ...extra]);
    }, [razonSocialOptionsBase, razonCustomByEmpresa, empresaNombreWatch]);

    const empresaEsNueva = useMemo(() => {
      const empresaNombreVal = form.getFieldValue("empresa_nombre") || "";
      if (!empresaNombreVal) return false;

      const baseExists = (catalogEmpresaNombreOptionsBase || []).some(
        (o) => (o.value || "").toLowerCase() === empresaNombreVal.toLowerCase()
      );
      const extraExists = (empresaCustomNames || []).some((n) => n.toLowerCase() === empresaNombreVal.toLowerCase());
      return !baseExists && extraExists;
    }, [catalogEmpresaNombreOptionsBase, empresaCustomNames, form, empresaNombreWatch]);

    useEffect(() => {
      if (!isStandaloneFull) return;
      if (isClienteDesdeModal) return;

      const empresaNombreVal = form.getFieldValue("empresa_nombre") || "";

      if (!empresaNombreVal) {
        form.setFieldsValue({
          cliente_directo: true,
          corresponsal_nombre: undefined,
          corresponsal_celular: undefined,
          corresponsal_correo: undefined,
        });
        return;
      }

      if (empresaEsNueva) {
        const directNow = !!form.getFieldValue("cliente_directo");
        if (directNow) {
          form.setFieldsValue({
            cliente_directo: true,
            corresponsal_nombre: undefined,
            corresponsal_celular: undefined,
            corresponsal_correo: undefined,
          });
        }
        return;
      }

      const nombreNormalizado = collapseSpaces(empresaNombreVal).toLowerCase();
      const bucket = catalogEmpresasIndex.get(empresaNombreVal);
      const rawList = bucket?.raw || [];

      const empresaMatch =
        rawList.find((e) => collapseSpaces(pickCompanyName(e)).toLowerCase() === nombreNormalizado) ||
        (catalogEmpresasItems || []).find((e) => collapseSpaces(pickCompanyName(e)).toLowerCase() === nombreNormalizado);

      if (!empresaMatch) {
        form.setFieldsValue({
          cliente_directo: true,
          corresponsal_nombre: undefined,
          corresponsal_celular: undefined,
          corresponsal_correo: undefined,
        });
        return;
      }

      const esDirecto = coerceBool01(empresaMatch?.cliente_directo, true);

      const nCorr = pickFirst(empresaMatch, [
        "corresponsal_nombre",
        "nombre_corresponsal",
        "nombre_corresponsal_empresa",
        "nombre_contacto",
        "contacto_nombre",
      ]);

      const cCorr = pickFirst(empresaMatch, [
        "corresponsal_celular",
        "celular_corresponsal",
        "telefono_corresponsal",
        "telefono_contacto",
        "contacto_telefono",
      ]);

      const eCorr = pickFirst(empresaMatch, [
        "corresponsal_correo",
        "correo_corresponsal",
        "email_corresponsal",
        "correo_contacto",
        "email_contacto",
        "contacto_email",
      ]);

      form.setFieldsValue({
        cliente_directo: esDirecto,
        corresponsal_nombre: esDirecto ? undefined : nCorr || undefined,
        corresponsal_celular: esDirecto ? undefined : cCorr || undefined,
        corresponsal_correo: esDirecto ? undefined : eCorr || undefined,
      });
    }, [isStandaloneFull, empresaNombreWatch, empresaEsNueva, catalogEmpresasIndex, catalogEmpresasItems, form, isClienteDesdeModal]);

    /* =========================
       Inicialización (create/edit)
       ========================= */
    const didInitRef = useRef(false);
    const lastAppliedKeyRef = useRef(null);

    const mappedInitialValues = useMemo(() => {
      const alreadyLooksDDMMYYYY = (s) => typeof s === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(s);
      const src = initialValues || {};

      const empleadosFromBackendArr = Array.isArray(src?.empleados) ? src.empleados : null;

      const empleadosIniciales =
        empleadosFromBackendArr && empleadosFromBackendArr.length
          ? empleadosFromBackendArr
              .map((e) => ({
                nombre_completo: collapseSpaces(e?.nombre_completo ?? e?.nombre ?? e?.solicitante_nombre ?? ""),
              }))
              .filter((e) => !!e.nombre_completo)
          : [
              {
                nombre_completo: collapseSpaces(src?.solicitante_nombre ?? src?.nombre_solicitante ?? ""),
              },
            ].filter((e) => !!e.nombre_completo);

      const fechaEncargoFromBackend = src?.fecha_encargo ?? "";
      const fechaSolicitudFromBackend = src?.fecha_solicitud ?? src?.fecha_solicitacion ?? "";
      const idCiudadMapped = src?.id_ciudad ?? null;

      const empresaNombre = src?.nombre_empresa ?? src?.empresa_nombre ?? src?.cliente_nombre ?? "";
      const empresaId = src?.id_empresa ?? src?.empresa_id ?? null;

      const rsId = src?.id_razon_social ?? null;
      const rsNombre = src?.nombre_razon_social ?? "";

      const clienteDirecto = src?.cliente_directo != null ? !!src?.cliente_directo : null;

      const nCorr = src?.nombre_corresponsal ?? src?.corresponsal_nombre ?? "";
      const cCorr = src?.celular_corresponsal ?? src?.corresponsal_celular ?? "";
      const eCorr = src?.correo_corresponsal ?? src?.corresponsal_correo ?? "";

      const origenPrivado = src?.origen_privado ?? null;

      return {
        ciudad: idCiudadMapped,
        empresa_nombre: empresaNombre || undefined,
        empresa_id: empresaId,
        empresa_razon_social_id: rsId ? [rsId] : [],
        empresa_razon_social_nombre: rsNombre ? [rsNombre] : [],
        cliente_directo: clienteDirecto == null ? true : !!clienteDirecto,
        corresponsal_nombre: nCorr || undefined,
        corresponsal_celular: cCorr || undefined,
        corresponsal_correo: eCorr || undefined,

        empleados: empleadosIniciales.length ? empleadosIniciales : [{ nombre_completo: "" }],

        fecha_encargo: alreadyLooksDDMMYYYY(fechaEncargoFromBackend) ? fechaEncargoFromBackend : isoToDDMMYYYY(fechaEncargoFromBackend),
        fecha_solicitud: alreadyLooksDDMMYYYY(fechaSolicitudFromBackend) ? fechaSolicitudFromBackend : isoToDDMMYYYY(fechaSolicitudFromBackend),

        via_tramite: src?.via_tramite ?? "privado",
        origen_privado: origenPrivado || undefined,
        notas: src?.notas ?? "",

        nuevo_cliente: null,
      };
    }, [initialValues]);

    useEffect(() => {
      if (!isEdit) {
        if (didInitRef.current) return;

        setClienteSource("search");
        setNuevoClienteData(null);

        form.setFieldsValue({
          ciudad: undefined,
          empresa_nombre: undefined,
          empresa_id: null,
          empresa_razon_social_id: [],
          empresa_razon_social_nombre: [],
          cliente_directo: true,
          corresponsal_nombre: undefined,
          corresponsal_celular: undefined,
          corresponsal_correo: undefined,

          empleados: [{ nombre_completo: "" }],

          fecha_encargo: "",
          fecha_solicitud: "",
          via_tramite: "privado",
          origen_privado: undefined,
          notas: "",
          nuevo_cliente: null,

          ...mappedInitialValues,
        });

        setEmpresaDisabledNombre(mappedInitialValues?.empresa_nombre || "");
        setCorresponsalDisabledNombre(mappedInitialValues?.corresponsal_nombre || "");

        const rsNombre0 =
          Array.isArray(mappedInitialValues?.empresa_razon_social_nombre) &&
          mappedInitialValues.empresa_razon_social_nombre.length
            ? mappedInitialValues.empresa_razon_social_nombre[0]
            : "";
        setEmpresaSearchValue(rsNombre0 || "");

        setDocumentsMap({ documento: null });
        setDocErrors({});
        didInitRef.current = true;
        lastAppliedKeyRef.current = "CREATE";
        return;
      }

      const editKey = String(idDesvinculacion ?? "");
      if (!editKey) return;
      if (lastAppliedKeyRef.current === editKey && didInitRef.current) return;

      setClienteSource("search");
      setNuevoClienteData(null);

      form.setFieldsValue({
        ciudad: undefined,
        empresa_nombre: undefined,
        empresa_id: null,
        empresa_razon_social_id: [],
        empresa_razon_social_nombre: [],
        cliente_directo: true,
        corresponsal_nombre: undefined,
        corresponsal_celular: undefined,
        corresponsal_correo: undefined,

        fecha_encargo: "",
        fecha_solicitud: "",
        via_tramite: "privado",
        origen_privado: undefined,
        notas: "",
        nuevo_cliente: null,

        ...mappedInitialValues,
      });

      setEmpresaDisabledNombre(mappedInitialValues?.empresa_nombre || "");
      setCorresponsalDisabledNombre(mappedInitialValues?.corresponsal_nombre || "");

      const rsNombre0 =
        Array.isArray(mappedInitialValues?.empresa_razon_social_nombre) &&
        mappedInitialValues.empresa_razon_social_nombre.length
          ? mappedInitialValues.empresa_razon_social_nombre[0]
          : "";
      setEmpresaSearchValue(rsNombre0 || "");

      setDocErrors({});
      didInitRef.current = true;
      lastAppliedKeyRef.current = editKey;
    }, [mappedInitialValues, form, isEdit, idDesvinculacion]);

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
        notification.error({ message: msg, placement: "bottomRight" });
        return Upload.LIST_IGNORE;
      }

      const maxMB = 25;
      if (file.size > maxMB * 1024 * 1024) {
        const msg = `El archivo supera ${maxMB} MB.`;
        setDocErrors((prev) => ({ ...prev, [key]: msg }));
        notification.error({ message: msg, placement: "bottomRight" });
        return Upload.LIST_IGNORE;
      }

      setDocumentsMap((prev) => ({ ...prev, [key]: file }));
      return false;
    };

    const removeDoc = (key) => {
      setDocumentsMap((prev) => ({ ...prev, [key]: null }));
      setDocErrors((prev) => ({ ...prev, [key]: "" }));
    };

    const DocBlock = ({ label, keyName }) => (
      <div className="expediente-doc-block">
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
          <p className="ant-upload-hint">Se enviará al presionar "Guardar".</p>
        </Dragger>

        {docErrors[keyName] ? (
          <Alert style={{ marginTop: 8 }} type="error" showIcon message={docErrors[keyName]} />
        ) : null}
      </div>
    );

    /* ======================= Validaciones ======================= */
    const rules = {
      ciudad: [{ required: isStandaloneFull, message: "Selecciona la ciudad" }],
      empresa_nombre: [{ required: isStandaloneFull, message: "Selecciona el cliente" }],
      empresa_razon_social_id: [{ required: isStandaloneFull, message: "Selecciona razón social" }],
      fecha_encargo: [{ required: true, message: "Selecciona la fecha" }],
      fecha_solicitud: [{ required: true, message: "Selecciona la fecha" }],
      via_tramite: [{ required: true, message: "Selecciona una opción" }],
      origen_privado: [{ required: true, message: "Selecciona trámite" }],
    };

    /* ======================= Guardado ======================= */
    const buildAndSend = async (values) => {
      // ========== Tramite (Cascader) ==========
      const tramiteArr = Array.isArray(values.origen_privado) ? values.origen_privado : [];
      const via_tramite_from_cascader = tramiteArr[0] || null;
      const origen_privado_from_cascader = tramiteArr[1] || null;

      // ========== Fechas ==========
      const fechaEncargoNorm = normalizeFechaDDMMYYYY_to_YYYYMMDD(values.fecha_encargo);
      const fechaBajaNorm = normalizeFechaDDMMYYYYHHMM_to_YYYYMMDD_HHMMSS(values.fecha_solicitud);


      const empleadosArrRaw = Array.isArray(values.empleados) ? values.empleados : [];
      const empleadosNormalized = empleadosArrRaw.map((e, idx) => {
        const raw = e?.nombre_completo || "";
        const s1 = sanitizeByField("solicitante", raw);
        const s2 = collapseSpaces(s1);
        return { nombre_completo: s2 ? s2 : `Empleado ${idx + 1}` };
      });

      const empleadosFinal =
        empleadosNormalized.length > 0 ? empleadosNormalized : [{ nombre_completo: "Empleado 1" }];

      const clean = {
        empleados: empleadosFinal,
        fecha_encargo: fechaEncargoNorm,
        fecha_solicitud: fechaBajaNorm,
        via_tramite: via_tramite_from_cascader,
        origen_privado: origen_privado_from_cascader,
        notas: toNullIfEmptyEffective(sanitizeByField("notas", values.notas)) ?? null,
      };

      // ========= IDs efectivos (solo si NO viene del modal) =========
      const idCiudadEffective =
        (isStandaloneFull ? coerceIntOrNull(values.ciudad) : null) ??
        coerceIntOrNull(idCiudad) ??
        coerceIntOrNull(initialValues?.id_ciudad) ??
        null;

      const idEmpresaEffective =
        (isStandaloneFull ? coerceIntOrNull(values.empresa_id) : null) ??
        coerceIntOrNull(ctxEmpresaId) ??
        coerceIntOrNull(initialValues?.id_empresa) ??
        coerceIntOrNull(initialValues?.empresa_id) ??
        null;

      const idRazonSocialEffective =
        (isStandaloneFull ? coerceIntOrNull((values.empresa_razon_social_id || [])[0]) : null) ??
        coerceIntOrNull((ctxRazonSocialIds || [])[0]) ??
        coerceIntOrNull(initialValues?.id_razon_social) ??
        null;

      const requiredErrors = [];
      if (!clean.empleados || !clean.empleados.length) requiredErrors.push("empleados");
      if (!clean.fecha_encargo) requiredErrors.push("fecha_encargo");
      if (!clean.fecha_solicitud) requiredErrors.push("fecha_solicitud");
      if (!clean.via_tramite) requiredErrors.push("origen_privado");
      if (clean.via_tramite === "privado" && !clean.origen_privado) requiredErrors.push("origen_privado");

      // ids obligatorios SOLO cuando es por búsqueda (empresa existente)
      if (!isClienteDesdeModal) {
        if (!idCiudadEffective) requiredErrors.push("ciudad");
        if (!idEmpresaEffective) requiredErrors.push("empresa_id");
        if (!idRazonSocialEffective) requiredErrors.push("id_razon_social");
      } else {
        // si viene del modal, al menos ciudad (si aplica tu flujo) debería existir
        if (!idCiudadEffective) requiredErrors.push("ciudad");
      }

      let ctx = {};
      if (isStandaloneFull) {
        ctx = {
          origen_captura: "standalone_full",
          isClienteNuevo: isClienteDesdeModal ? true : !!empresaEsNueva,
        };
      } else {
        ctx = { origen_captura: variant || "context_view", isClienteNuevo: isClienteDesdeModal ? true : false };
      }

      if (requiredErrors.length) {
        notification.error({
          message: "Faltan campos obligatorios: " + requiredErrors.join(", "),
          placement: "bottomRight",
        });
        return;
      }

      // ========= payload =========
      const backendPayloadBase = {
        ...ctx,

        empleados: clean.empleados,
        solicitante_nombre: clean.empleados?.[0]?.nombre_completo || null,

        fecha_encargo: clean.fecha_encargo,
        fecha_solicitud: clean.fecha_solicitud,

        via_tramite: clean.via_tramite,
        origen_privado: clean.origen_privado,

        notas: clean.notas,
      };

      const backendPayload = !isClienteDesdeModal
        ? {
            ...backendPayloadBase,
            id_ciudad: idCiudadEffective,
            id_empresa: idEmpresaEffective,
            id_razon_social: idRazonSocialEffective,
          }
        : {
            ...backendPayloadBase,
            id_ciudad: idCiudadEffective,
            id_empresa: null,
            id_razon_social: null,

            // NUEVO: datos para crear cliente/empresa desde modal
            nuevo_cliente: {
              ...(nuevoClienteData || {}),
            },
          };

      const filesMap = {};
      if (documentsMap.documento) filesMap.documento = documentsMap.documento;

      try {
        setSubmitting(true);

        if (typeof onSubmit === "function") {
          await onSubmit(backendPayload, filesMap);
          notification.success({
            message: isEdit ? "Desvinculación actualizada" : "Desvinculación creada",
            description: "Se guardó correctamente.",
            placement: "bottomRight",
          });
          onSaved?.(backendPayload, filesMap);
          return;
        }

        if (isEdit) {
          if (!idDesvinculacion) {
            notification.error({ message: "Falta idDesvinculacion para editar.", placement: "bottomRight" });
            return;
          }

          const res = await dispatch(
            actionDesvinculacionUpdateById(idDesvinculacion, backendPayload, () => onSaved?.(), filesMap)
          );

          notification.success({
            message: "Desvinculación actualizada",
            description: "Los cambios se guardaron correctamente.",
            placement: "bottomRight",
          });

          onSaved?.(backendPayload, filesMap, res);
        } else {
          const res = await dispatch(actionDesvinculacionCreate(backendPayload, () => onSaved?.(), filesMap));

          notification.success({
            message: "Desvinculación creada",
            description: "Se guardó correctamente.",
            placement: "bottomRight",
          });

          const newId = res?.id_desvinculacion ?? res?.id ?? res?.insertId ?? null;
          if (newId) navigate(`/materias/laboral/desvinculaciones/${newId}`);

          onSaved?.(backendPayload, filesMap, res);
        }
      } finally {
        setSubmitting(false);
      }
    };

    const handleSaveClick = async () => {
      try {
        await form.validateFields();
        const values = form.getFieldsValue(true);
        await buildAndSend(values);
      } catch (err) {
        const errorFields = err?.errorFields || [];
        if (errorFields.length) {
          notification.error({ message: "Faltan campos obligatorios.", placement: "bottomRight", duration: 3 });
          form.scrollToField(errorFields[0].name, { block: "center" });
          return;
        }

        notification.error({
          message: err?.message || "No se pudo procesar el formulario.",
          placement: "bottomRight",
          duration: 3,
        });
      }
    };

    useImperativeHandle(ref, () => ({
      submit: () => handleSaveClick(),
      validate: () => form.validateFields(),
      getValues: () => form.getFieldsValue(true),
      focusFirst: () => {
        const first = isStandaloneFull ? ciudadRef : solicitanteRef;
        if (first.current && typeof first.current.focus === "function") first.current.focus();
      },
    }));

    useEffect(() => {
      const arr = Array.isArray(empleadosWatch) ? empleadosWatch : [];
      const n = arr.length || 1;
      if (empleadosCount !== n) setEmpleadosCount(n);
    }, [empleadosWatch]);

    const renderCardClienteSearch = () => (
      <div className="expediente-inner-card">
        <div className="expediente-inner-card-head">
          <div className="expediente-section-title" style={{ marginBottom: 0 }}>
            Datos del cliente
          </div>

          <Button icon={<PlusOutlined />} onClick={() => setOpenNuevoCliente(true)}>
            Crear nuevo cliente
          </Button>
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
            <Form.Item label="EMPRESA / RAZÓN SOCIAL / CORRESPONSAL" name="empresa_search">
              <AutoComplete
                value={empresaSearchValue}
                options={empresaSearchOptions}
                onSearch={handleEmpresaSearch}
                onSelect={handleEmpresaSelect}
                onChange={handleEmpresaChange}
                allowClear
                notFoundContent={empresaSearching ? "Buscando..." : "Sin resultados"}
                filterOption={false}
                disabled={isClienteDesdeModal}
              >
                <Input
                  ref={empresaRef}
                  placeholder="Busca por empresa, razón social, corresponsal, correo o celular"
                  onKeyDown={makeEnterHandler(empresaRef)}
                  disabled={isClienteDesdeModal}
                />
              </AutoComplete>
            </Form.Item>
          </Col>

          <Col xs={24} md={7}>
            <Form.Item label="EMPRESA">
              <Input disabled value={empresaDisabledNombre || ""} placeholder="—" />
            </Form.Item>
          </Col>

          <Col xs={24} md={7}>
            <Form.Item label="CORRESPONSAL">
              <Input disabled value={corresponsalDisabledNombre || ""} placeholder="—" />
            </Form.Item>
          </Col>
        </Row>
      </div>
    );

    const renderCardClienteDesdeModal = () => {
      const nc = nuevoClienteData || {};
      const esDirecto = !!nc?.cliente_directo;

      return (
        <div className="expediente-inner-card cliente-modal-card">
          <div className="expediente-inner-card-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="expediente-section-title" style={{ marginBottom: 0 }}>
                Cliente nuevo
              </div>
              <Tag color="blue">{esDirecto ? "Directo" : "Corresponsal"}</Tag>
            </div>

            <Button
              onClick={() => {
                resetEmpresaSelection();
              }}
            >
              Cambiar a búsqueda
            </Button>
          </div>

          <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
            <Col xs={24} md={12}>
              <Form.Item label="Nombre Comercial">
                <Input disabled value={nc?.cliente_nombre || ""} placeholder="—" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Razón social">
                <Input disabled value={nc?.razon_social || ""} placeholder="—" />
              </Form.Item>
            </Col>

            {esDirecto ? (
              <>
                <Col xs={24} md={12}>
                  <Form.Item label="Contacto - Nombre">
                    <Input disabled value={nc?.nombre_contacto || ""} placeholder="—" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Contacto - Correo">
                    <Input disabled value={nc?.correo_contacto || ""} placeholder="—" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Contacto - Celular">
                    <Input disabled value={nc?.celular_contacto || ""} placeholder="—" />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <>
                <Col xs={24} md={12}>
                  <Form.Item label="Corresponsal - Despacho">
                    <Input disabled value={nc?.corresponsal_nombre || ""} placeholder="—" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Corresponsal - Abogado">
                    <Input disabled value={nc?.corresponsal_nombre_abogado || ""} placeholder="—" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Corresponsal - Correo">
                    <Input disabled value={nc?.corresponsal_correo || ""} placeholder="—" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Corresponsal - Celular">
                    <Input disabled value={nc?.corresponsal_celular || ""} placeholder="—" />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </div>
      );
    };

    return (
      <>
        <div className="expediente-form-wrapper">
          <div className="expediente-form-header">
            <div className="expediente-form-header-left">
              <div className="expediente-form-title">
                {isEdit ? "EDITAR · DESVINCULACIÓN" : "CREAR · DESVINCULACIÓN"}
              </div>
            </div>

            {showTopActions ? (
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {onCancel ? <Button onClick={onCancel}>Cancelar</Button> : null}
                <Button type="primary" onClick={handleSaveClick} loading={submitting}>
                  {isEdit ? "Guardar cambios" : "Guardar"}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="expediente-form-card">
            <Spin spinning={submitting} tip={isEdit ? "Guardando cambios..." : "Guardando..."}>
              <Form form={form} layout="vertical" className="expediente-ant-form">
                {/* ========= CARD 1: CLIENTE ========= */}
                {isClienteDesdeModal ? renderCardClienteDesdeModal() : renderCardClienteSearch()}

                {/* ========= CARD 2: DESVINCULACIÓN ========= */}
                <div className="expediente-inner-card">
                  <div className="expediente-section-title">Datos de la desvinculación</div>

                  <Row gutter={[16, 12]}>
                    {/* ===== Columna 1: EMPLEADOS ===== */}
                    <Col xs={24} md={10} className="empleados-col">
                      <h6 style={{ marginBottom: 10, padding: 5 }}>EMPLEADOS</h6>

                      <Form.List name="empleados">
                        {(fields, { add, remove }) => {
                          const applyCount = (nextCount) => {
                            const n = Math.max(1, Math.min(300, Number(nextCount || 1)));

                            setEmpleadosCount(n);

                            const arr = Array.isArray(form.getFieldValue("empleados"))
                              ? [...form.getFieldValue("empleados")]
                              : [];

                            if (arr.length < n) {
                              const missing = n - arr.length;
                              for (let i = 0; i < missing; i++) arr.push({ nombre_completo: "" });
                              form.setFieldsValue({ empleados: arr });
                              return;
                            }

                            if (arr.length > n) {
                              form.setFieldsValue({ empleados: arr.slice(0, n) });
                              return;
                            }
                          };

                          return (
                            <>
                              <Form.Item label="Cantidad de empleados" style={{ marginBottom: 10 }}>
                                <InputNumber
                                  min={1}
                                  max={300}
                                  value={empleadosCount}
                                  onChange={(v) => applyCount(v)}
                                  style={{ width: "100%" }}
                                />
                              </Form.Item>

                              <div className="empleados-scroll">
                                {fields.map((field, idx) => (
                                  <Row key={field.key} gutter={[8, 8]} align="middle">
                                    <Col flex="auto">
                                      <Form.Item
                                        {...field}
                                        name={[field.name, "nombre_completo"]}
                                        rules={[
                                          {
                                            pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{0,120}$/,
                                            message: "Solo letras, espacios y ' . -",
                                          },
                                        ]}
                                      >
                                        <Input
                                          ref={idx === 0 ? solicitanteRef : null}
                                          placeholder={`Empleado ${idx + 1} (nombre completo)`}
                                          allowClear
                                          onKeyDown={idx === 0 ? makeEnterHandler(solicitanteRef) : undefined}
                                          onChange={(e) => {
                                            const clean = sanitizeByField("solicitante", e.target.value);
                                            if (clean !== e.target.value) {
                                              const cur = form.getFieldValue("empleados") || [];
                                              const next = Array.isArray(cur) ? [...cur] : [];
                                              next[idx] = { ...(next[idx] || {}), nombre_completo: clean };
                                              form.setFieldsValue({ empleados: next });
                                            }
                                          }}
                                        />
                                      </Form.Item>
                                    </Col>

                                    <Col>
                                      <Button
                                        danger
                                        onClick={() => {
                                          remove(field.name);
                                          const after = (form.getFieldValue("empleados") || []).length - 1;
                                          setEmpleadosCount(Math.max(1, after));
                                        }}
                                        disabled={fields.length <= 1}
                                      >
                                        Quitar
                                      </Button>
                                    </Col>
                                  </Row>
                                ))}
                              </div>
                            </>
                          );
                        }}
                      </Form.List>
                    </Col>

                    {/* ===== Columna 2: RESTO DE DATOS ===== */}
                    <Col xs={24} md={14}>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={12}>
                          <Form.Item label="FECHA DE SOLICITUD" name="fecha_encargo" rules={rules.fecha_encargo}>
                            <div style={{ position: "relative" }}>
                              <Input
                                ref={fechaEncargoRef}
                                placeholder="DD/MM/YYYY"
                                maxLength={10}
                                value={fechaEncargoValue || ""}
                                onChange={makeFechaInputHandler("fecha_encargo")}
                                onKeyDown={makeEnterHandler(fechaEncargoRef)}
                                suffix={
                                  <CalendarOutlined
                                    style={{ cursor: "pointer", color: "#1677ff" }}
                                    onClick={() => setOpenFechaEncargoPicker(true)}
                                  />
                                }
                              />

                              <DatePicker
                                open={openFechaEncargoPicker}
                                onOpenChange={setOpenFechaEncargoPicker}
                                format="DD/MM/YYYY"
                                value={fechaEncargoValue ? dayjs(fechaEncargoValue, "DD/MM/YYYY", true) : null}
                                onChange={(value) => {
                                  const formatted = value ? value.format("DD/MM/YYYY") : "";
                                  form.setFieldsValue({ fecha_encargo: formatted });
                                }}
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  opacity: 0,
                                  width: "100%",
                                  height: "100%",
                                }}
                                getPopupContainer={() => document.body}
                              />

                            </div>
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item label="FECHA DE LA BAJA" name="fecha_solicitud" rules={rules.fecha_solicitud}>
                            <div style={{ position: "relative" }}>
                              <Input
                                ref={fechaSolicitudRef}
                             
               
                                value={fechaSolicitudValue || ""}
                               onChange={makeFechaHoraInputHandler("fecha_solicitud")}
                                  placeholder="DD/MM/YYYY HH:MM"
                                  maxLength={16}
                                onKeyDown={makeEnterHandler(fechaSolicitudRef)}
                                suffix={
                                  <CalendarOutlined
                                    style={{ cursor: "pointer", color: "#1677ff" }}
                                    onClick={() => setOpenFechaSolicitudPicker(true)}
                                  />
                                }
                              />

                             <DatePicker
                                  open={openFechaSolicitudPicker}
                                  onOpenChange={setOpenFechaSolicitudPicker}
                                  showTime={{ format: "HH:mm" }}
                                  format="DD/MM/YYYY HH:mm"
                                  value={fechaSolicitudValue ? dayjs(fechaSolicitudValue, "DD/MM/YYYY HH:mm", true) : null}
                                  onChange={(value) => {
                                    const formatted = value ? value.format("DD/MM/YYYY HH:mm") : "";
                                    form.setFieldsValue({ fecha_solicitud: formatted });
                                  }}
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    opacity: 0,
                                    width: "100%",
                                    height: "100%",
                                  }}
                                  getPopupContainer={() => document.body}
                                />

                            </div>
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={10}>
                          <Form.Item
                            label="Tramite"
                            name="origen_privado"
                            rules={rules.origen_privado}
                            getValueFromEvent={(val) => (Array.isArray(val) ? val : val ? [val] : [])}
                          >
                            <Cascader
                              options={origenPrivadoOptions}
                              placeholder="Selecciona"
                              expandTrigger="hover"
                              showSearch
                              onKeyDown={makeEnterHandler(origenPrivadoRef)}
                              allowClear
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={14}>
                          <Form.Item label="NOTAS (OPCIONAL)" name="notas">
                            <Input.TextArea
                              ref={notasRef}
                              placeholder="Detalles relevantes, instrucciones, referencia interna, domicilio de la baja, etc."
                              rows={3}
                              onKeyDown={makeEnterHandler(notasRef)}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                  </Row>

                  <Divider />
                  <DocBlock label="DOCUMENTO ADJUNTO" keyName="documento" />
                </div>
              </Form>
            </Spin>
          </div>
        </div>

        <style>{`
          .expediente-form-wrapper {
            max-width: 1200px;
            margin: 0 auto;
            padding: 16px 24px 40px;
          }

          .expediente-form-header {
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
          }

          .expediente-form-header-left {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .expediente-form-title {
            font-size: 18px;
            font-weight: 600;
            color: #0b1324;
          }

          .expediente-form-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 24px 28px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          }

          .expediente-section-title {
            font-weight: 600;
            font-size: 15px;
            color: #111827;
            margin-bottom: 14px;
          }

          .expediente-ant-form .ant-form-item {
            margin-bottom: 12px;
          }

          .expediente-ant-form .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 500;
            color: #334155;
          }

          .expediente-doc-block {
            border: 1px dashed #d9d9d9;
            border-radius: 8px;
            padding: 12px;
            background: #fafafa;
          }

          .expediente-inner-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 18px 18px 16px;
            box-shadow: 0 3px 12px rgba(15, 23, 42, 0.06);
            border: 1px solid rgba(15, 23, 42, 0.06);
          }

          .expediente-inner-card + .expediente-inner-card {
            margin-top: 14px;
          }

          .expediente-inner-card-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .empleados-col {
            border-right: 1px solid rgba(15, 23, 42, 0.06);
            padding-right: 12px;
          }

          @media (max-width: 768px) {
            .empleados-col {
              border-right: none;
              padding-right: 0;
            }
          }

          .empleados-scroll {
            max-height: 360px;
            overflow: auto;
            padding-right: 6px;
          }

          .cliente-modal-card {
            border: 1px solid rgba(22, 119, 255, 0.25);
            background: rgba(22, 119, 255, 0.03);
          }
        `}</style>

        <ModalNuevoCliente
          open={openNuevoCliente}
          onCancel={() => setOpenNuevoCliente(false)}
          onCreated={(nuevo) => {
            // ===== activar modo modal =====
            setClienteSource("modal");
            setNuevoClienteData(nuevo);

            // ===== mutear/limpiar selección existente =====
            setEmpresaSearchOptions([]);
            empresaHitsMapRef.current = new Map();
            empresaOptionMetaRef.current = new Map();

            // ===== reflejar visualmente =====
            const rs = nuevo?.razon_social || "";
            const emp = nuevo?.cliente_nombre || "";

            setEmpresaSearchValue(rs);
            setEmpresaDisabledNombre(emp);
            setCorresponsalDisabledNombre(nuevo?.corresponsal_nombre || "");

            // ===== setFieldsValue mínimo, sin ids =====
            form.setFieldsValue({
              empresa_search: rs,
              empresa_nombre: emp || undefined,
              empresa_id: null,
              empresa_razon_social_id: [],
              empresa_razon_social_nombre: [],

              cliente_directo: !!nuevo?.cliente_directo,

              corresponsal_nombre: nuevo?.cliente_directo ? undefined : nuevo?.corresponsal_nombre || undefined,
              corresponsal_correo: nuevo?.cliente_directo ? undefined : nuevo?.corresponsal_correo || undefined,
              corresponsal_celular: nuevo?.cliente_directo ? undefined : nuevo?.corresponsal_celular || undefined,

              // guardar también en form (opcional)
              nuevo_cliente: nuevo,
            });
          }}
        />
      </>
    );
  }
);

export default FormDesvinculaciones;
