// src/pages/laboral/expedientes/FormCentroConciliacion.jsx
import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
} from "react";
import {
  Form,
  Input,
  Select,
  Upload,
  Typography,
  Row,
  Col,
  Alert,
  notification,
  DatePicker,
  Divider,
  Space,
  Button,
  Switch,
  Spin,
} from "antd";
import { InboxOutlined, PlusOutlined, CalendarOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import {
  actionConciliacionCreate,
  actionConciliacionUpdate,
} from "../../../redux/actions/conciliacion/conciliacion";
import { actionEmpresasGet } from "../../../redux/actions/empresas/empresas";
import { actionMedioNotificacionGet } from "../../../redux/actions/medio_notificacion/medio_notificacion";
import { actionAbogadosGet } from "../../../redux/actions/abogados/abogados";
import { actionObjetosGet } from "../../../redux/actions/objetos/objetos";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

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
  value: value ?? collapseSpaces(label || ""),
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

/* ========= Date helpers ========= */
// UI -> backend
const normalizeFechaDDMMYYYY_to_YYYYMMDD = (str) => {
  if (!str) return null;
  const digits = String(str).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const dd = digits.substring(0, 2);
  const mm = digits.substring(2, 4);
  const yyyy = digits.substring(4, 8);
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeFechaHoraDDMMYYYYHHmm_to_YYYYMMDD_HHMM = (str) => {
  if (!str) return null;
  const digits = String(str).replace(/\D/g, "");
  if (digits.length !== 12) return null;
  const dd = digits.substring(0, 2);
  const mm = digits.substring(2, 4);
  const yyyy = digits.substring(4, 8);
  const HH = digits.substring(8, 10);
  const MM = digits.substring(10, 12);
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
};

const buildExpedienteFormat = (raw) => {
  if (raw === null || raw === "") return null;
  const s = String(raw).trim().toUpperCase();
  return s.replace(/\//g, "-");
};

// Detecta si initialValues ya trae data real (no {} / no placeholders)
const hasMeaningfulInitialValues = (iv) => {
  if (!iv || typeof iv !== "object") return false;
  const keys = Object.keys(iv);
  if (!keys.length) return false;

  // campos que suelen venir en EDIT si ya cargó detalle
  const probes = [
    iv.exp,
    iv.empresa_nombre,
    iv.fecha_emision_expediente,
    iv.fecha_audiencia,
    iv.trabajador_nombre,
  ];

  return probes.some((x) => String(x ?? "").trim() !== "");
};

const FormCentroConciliacion = React.forwardRef(
  (
    {
      initialValues = {},
      onSaved,
      onCancel,
      idAutoridad,
      idCiudad,
      nombreIdentificacionCiudad,
      isEdit = false,
      idExpediente = null,
            showTopActions = true,

    },
    ref
  ) => {
    console.log(nombreIdentificacionCiudad)
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    // Documentos (solo citatorio)
    const [documentsMap, setDocumentsMap] = useState({ citatorio: null });
    const [docErrors, setDocErrors] = useState({});
    const [hasExistingCitatorio, setHasExistingCitatorio] = useState(false);

    const [medioNotifOptions, setMedioNotifOptions] = useState([]);
    const [loadingMedios, setLoadingMedios] = useState(false);

    const fechaEmisionSel = Form.useWatch("fecha_emision_expediente", form);

    const expedienteYear = useMemo(() => {
      if (!fechaEmisionSel) return dayjs().year();
      const parsed = dayjs(fechaEmisionSel, "DD/MM/YYYY", true);
      if (!parsed.isValid()) return dayjs().year();
      return parsed.year();
    }, [fechaEmisionSel]);

    /* ==== Cargar catálogos al montar ==== */
    useEffect(() => {
      dispatch(actionEmpresasGet());
      dispatch(actionAbogadosGet());
      dispatch(actionObjetosGet());

      (async () => {
        try {
          setLoadingMedios(true);
          const result = await dispatch(actionMedioNotificacionGet());

          let items = [];
          if (Array.isArray(result)) items = result;
          else if (result && Array.isArray(result.items)) items = result.items;
          else {
            notification.error({
              message: "Error al cargar medios de notificación",
              description:
                typeof result === "string"
                  ? result
                  : "Respuesta inesperada del servidor",
              placement: "bottomRight",
            });
            return;
          }

          const opts = items
            .filter((m) => m && m.id != null)
            .map((m) => ({
              label: m.nombre || m.descripcion || `Medio ${m.id}`,
              value: m.id,
            }));

          setMedioNotifOptions(opts);
        } catch (e) {
          notification.error({
            message: "Error inesperado al cargar medios de notificación",
            description: e?.message || "Sin detalle",
            placement: "bottomRight",
          });
        } finally {
          setLoadingMedios(false);
        }
      })();
    }, [dispatch]);

    // Slices
    const empresasSlice = useSelector((state) => state?.empresas ?? {});
    const abogadosSlice = useSelector((state) => state.abogados || {});
    const objetosSlice = useSelector((state) => state.objetos || {});

    // Items
    const empresasItems = useMemo(
      () => coerceEmpresasArray(empresasSlice),
      [empresasSlice]
    );
    const empresasIndex = useMemo(
      () => buildEmpresasIndex(empresasItems),
      [empresasItems]
    );

    const empresaNombreOptionsBase = useMemo(() => {
      const names = Array.from(empresasIndex.keys());
      return names
        .map((n) => ({ label: n, value: n }))
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
    }, [empresasIndex]);

    const abogadosItems = useMemo(
      () => coerceItemsFromSlice(abogadosSlice),
      [abogadosSlice]
    );
    const objetosItems = useMemo(
      () => coerceItemsFromSlice(objetosSlice),
      [objetosSlice]
    );

    const abogadoOptionsBase = useMemo(
      () =>
        abogadosItems
          .map((a) => ({
            label: collapseSpaces(a?.nombre_abogado || ""),
            value: collapseSpaces(a?.nombre_abogado || ""),
            _id: a?.id,
          }))
          .filter((o) => o.label),
      [abogadosItems]
    );

    const objetosOptions = useMemo(
      () =>
        objetosItems
          .map((a) => ({
            label: collapseSpaces(a?.nombre || ""),
            value: collapseSpaces(a?.nombre || ""),
            _id: a?.id,
          }))
          .filter((o) => o.label),
      [objetosItems]
    );

    // === Estados para selects con creación dinámica ===
    const [empresaCustomNames, setEmpresaCustomNames] = useState([]);
    const [empresaNewName, setEmpresaNewName] = useState("");
    const [razonCustomByEmpresa, setRazonCustomByEmpresa] = useState({});
    const [razonNewName, setRazonNewName] = useState("");
    const [abogadoCustomNames, setAbogadoCustomNames] = useState([]);
    const [abogadoNewName, setAbogadoNewName] = useState("");

    const empresaInputRef = useRef(null);
    const razonInputRef = useRef(null);
    const abogadoInputRef = useRef(null);

    // ==== Refs para navegación con Enter (como Tab) ====
    const expRef = useRef(null);
    const fechaEmisionRef = useRef(null);
    const fechaAudienciaRef = useRef(null);
    const empresaNombreRef = useRef(null);
    const razonSocialRef = useRef(null);

    const clienteDirectoSwitchRef = useRef(null);
    const corresponsalNombreRef = useRef(null);
    const corresponsalCelRef = useRef(null);
    const corresponsalCorreoRef = useRef(null);

    const trabajadorNombreRef = useRef(null);
    const objetoSolicitudRef = useRef(null);
    const abogadoRef = useRef(null);

    const formaNotifRef = useRef(null);
    const origenActuarioRef = useRef(null);
    const fechaRecepcionRef = useRef(null);
    const medioNotifRef = useRef(null);

    const focusOrder = [
      expRef,
      fechaEmisionRef,
      fechaAudienciaRef,
      empresaNombreRef,
      razonSocialRef,
      clienteDirectoSwitchRef,
      corresponsalNombreRef,
      corresponsalCelRef,
      corresponsalCorreoRef,
      trabajadorNombreRef,
      objetoSolicitudRef,
      abogadoRef,
      formaNotifRef,
      origenActuarioRef,
      fechaRecepcionRef,
      medioNotifRef,
    ];

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

    const empresaNombre = Form.useWatch("empresa_nombre", form);
    const formaNotifSel = Form.useWatch("forma_notificacion", form);

    // RS base según empresa
    const razonSocialOptionsBase = useMemo(() => {
      if (!empresaNombre) return [];
      const bucket = empresasIndex.get(empresaNombre);
      if (!bucket) return [];
      return bucket.razones;
    }, [empresaNombre, empresasIndex]);

    // RS base + creadas
    const razonSocialOptions = useMemo(() => {
      const extra = razonCustomByEmpresa[empresaNombre] || [];
      return [...razonSocialOptionsBase, ...extra];
    }, [razonSocialOptionsBase, razonCustomByEmpresa, empresaNombre]);

    // Empresas base + creadas
    const empresaNombreOptions = useMemo(() => {
      const extra = empresaCustomNames.map((n) => ({ label: n, value: n }));
      return [...empresaNombreOptionsBase, ...extra];
    }, [empresaNombreOptionsBase, empresaCustomNames]);

    // Abogados base + creados
    const abogadoOptions = useMemo(() => {
      const extra = abogadoCustomNames.map((n) => ({ label: n, value: n }));
      return [...abogadoOptionsBase, ...extra];
    }, [abogadoOptionsBase, abogadoCustomNames]);

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

    /* ======================= Validaciones ======================= */
    const rules = {
      exp: [
        { required: true, message: "Requerido" },
        {
          pattern: /^[A-Za-z0-9_.\/\- ]{1,50}$/,
          message: "Solo letras, números y _ . / - y espacios.",
        },
      ],
      empresa_nombre: [{ required: true, message: "Selecciona una Empresa" }],
      fecha_emision_expediente: [{ required: true, message: "Selecciona la fecha" }],
      fecha_audiencia: [{ required: true, message: "Selecciona fecha y hora" }],
      fecha_hora_cita_recepcion: [{ required: true, message: "Selecciona fecha y hora" }],
      empresa_razon_social_id: [{ required: true, message: "Selecciona una razón social" }],
      trabajador_nombre: [
        { required: true, message: "Requerido" },
        {
          pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]{1,100}$/,
          message: "Solo letras, espacios y ' . -",
        },
      ],
      objeto_solicitud: [{ required: true, message: "Selecciona el objeto" }],
      forma_notificacion: [{ required: true, message: "Selecciona la forma de notificación" }],
      origen_actuario: [],
      id_medio_notificacion: [{ required: true, message: "Selecciona el medio de notificación" }],
    };

    /* ======================= Handlers creación dinámica ======================= */
    const handleAddEmpresa = (e) => {
      e.preventDefault();
      const raw = (empresaNewName || "").trim();
      if (!raw) return;
      const clean = raw.replace(/_/g, "");
      if (!clean) return;

      const existsBase = empresaNombreOptionsBase.some(
        (o) => o.label.toLowerCase() === clean.toLowerCase()
      );
      const existsExtra = empresaCustomNames.some(
        (n) => n.toLowerCase() === clean.toLowerCase()
      );
      if (existsBase || existsExtra) {
        setEmpresaNewName("");
        return;
      }

      setEmpresaCustomNames((prev) => [...prev, clean]);
      setEmpresaNewName("");
      form.setFieldsValue({
        empresa_nombre: clean,
        empresa_razon_social_id: [],
        empresa_id: null,
      });

      setTimeout(() => {
        empresaInputRef.current?.focus();
      }, 0);
    };

    const handleAddRazonSocial = (e) => {
      e.preventDefault();
      if (!empresaNombre) {
        notification.error({
          message: "Selecciona primero el citado (empresa).",
          placement: "bottomRight",
        });
        return;
      }
      const raw = (razonNewName || "").trim();
      if (!raw) return;
      const sanitized = raw.replace(/_/g, "");
      if (!sanitized) return;

      const key = sanitized.replace(/\s+/g, "_");
      const label = sanitized;

      const existing = razonSocialOptions.some(
        (o) =>
          o.label.toLowerCase() === label.toLowerCase() ||
          String(o.value) === key
      );
      if (existing) {
        setRazonNewName("");
        return;
      }

      const bucket = empresasIndex.get(empresaNombre);
      let empresaIdFromBucket = null;
      if (bucket && bucket.empresaIds.size >= 1)
        empresaIdFromBucket = Array.from(bucket.empresaIds)[0];

      const newOption = { label, value: key, empresa_id: empresaIdFromBucket };

      setRazonCustomByEmpresa((prev) => {
        const current = prev[empresaNombre] || [];
        return { ...prev, [empresaNombre]: [...current, newOption] };
      });

      const prevVal = form.getFieldValue("empresa_razon_social_id") || [];
      form.setFieldsValue({ empresa_razon_social_id: [...prevVal, key] });

      setRazonNewName("");
      setTimeout(() => {
        razonInputRef.current?.focus();
      }, 0);
    };

    const handleAddAbogado = (e) => {
      e.preventDefault();
      const raw = (abogadoNewName || "").trim();
      if (!raw) return;
      const clean = raw.replace(/_/g, "");
      if (!clean) return;

      const existsBase = abogadoOptionsBase.some(
        (o) => o.label.toLowerCase() === clean.toLowerCase()
      );
      const existsExtra = abogadoCustomNames.some(
        (n) => n.toLowerCase() === clean.toLowerCase()
      );
      if (existsBase || existsExtra) {
        setAbogadoNewName("");
        return;
      }

      setAbogadoCustomNames((prev) => [...prev, clean]);
      setAbogadoNewName("");
      form.setFieldsValue({ abogado: clean });

      setTimeout(() => {
        abogadoInputRef.current?.focus();
      }, 0);
    };

    /* ======================= onChange RS: actualizar empresa_id ======================= */
    const handleChangeRazonSocial = (valueList) => {
      const empresaNombreVal = form.getFieldValue("empresa_nombre") || "";
      if (!empresaNombreVal) return;

      const bucket = empresasIndex.get(empresaNombreVal);
      if (!bucket) return;

      const customForEmpresa = razonCustomByEmpresa[empresaNombreVal] || [];
      const rsOptionsFull = [
        ...(bucket?.razones?.map((o) => ({ ...o })) ?? []),
        ...customForEmpresa,
      ];

      const arr = Array.isArray(valueList) ? valueList : [valueList];
      if (!arr.length) return;

      const principal = arr[0];
      const chosen = rsOptionsFull.find(
        (o) => String(o.value) === String(principal)
      );

      let empresaId = null;
      if (chosen?.empresa_id != null) empresaId = chosen.empresa_id;
      else if (bucket.empresaIds.size >= 1)
        empresaId = Array.from(bucket.empresaIds)[0];

      if (empresaId != null) form.setFieldsValue({ empresa_id: empresaId });
    };

    /* ======================= Cliente Directo / Corresponsal ======================= */
    const empresaEsNueva = useMemo(() => {
      if (!empresaNombre) return false;
      const baseExists = empresaNombreOptionsBase.some(
        (o) => (o.value || "").toLowerCase() === empresaNombre.toLowerCase()
      );
      const extraExists = empresaCustomNames.some(
        (n) => n.toLowerCase() === empresaNombre.toLowerCase()
      );
      return !baseExists && extraExists;
    }, [empresaNombre, empresaNombreOptionsBase, empresaCustomNames]);

    const [clienteDirecto, setClienteDirecto] = useState(true);
    const [corresponsalNombre, setCorresponsalNombre] = useState("No hay corresponsal");
    const [corresponsalCel, setCorresponsalCel] = useState("");
    const [corresponsalCorreo, setCorresponsalCorreo] = useState("");

    useEffect(() => {
      if (!empresaNombre) {
        setClienteDirecto(true);
        setCorresponsalNombre("No hay corresponsal");
        setCorresponsalCel("");
        setCorresponsalCorreo("");
        return;
      }

      if (empresaEsNueva) return;

      const nombreNormalizado = collapseSpaces(empresaNombre);
      const empresaMatch = empresasItems.find((e) => {
        const n = collapseSpaces(pickCompanyName(e));
        return n.toLowerCase() === nombreNormalizado.toLowerCase();
      });

      if (empresaMatch) {
        const esDirecto = Number(empresaMatch.cliente_directo ?? 1) === 1;
        setClienteDirecto(esDirecto);

        const nombreCorr = collapseSpaces(
          empresaMatch.nombre_corresponsal || "No hay corresponsal"
        );
        setCorresponsalNombre(nombreCorr);
      } else {
        setClienteDirecto(true);
        setCorresponsalNombre("No hay corresponsal");
        setCorresponsalCel("");
        setCorresponsalCorreo("");
      }
    }, [empresaNombre, empresaEsNueva, empresasItems]);

    useEffect(() => {
      if (!empresaEsNueva) return;

      if (clienteDirecto) {
        setCorresponsalNombre("No hay corresponsal");
        setCorresponsalCel("");
        setCorresponsalCorreo("");
      } else {
        setCorresponsalNombre("");
        setCorresponsalCel("");
        setCorresponsalCorreo("");
      }
    }, [clienteDirecto, empresaEsNueva]);

    /* ======================= Inputs con calendario ======================= */
    const [openFechaEmisionPicker, setOpenFechaEmisionPicker] = useState(false);
    const [openFechaAudienciaPicker, setOpenFechaAudienciaPicker] = useState(false);
    const [openFechaRecepcionPicker, setOpenFechaRecepcionPicker] = useState(false);

    const fechaEmisionValue = Form.useWatch("fecha_emision_expediente", form);
    const fechaAudienciaValue = Form.useWatch("fecha_audiencia", form);
    const fechaRecepcionValue = Form.useWatch("fecha_hora_cita_recepcion", form);

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
      let formatted = v;
      if (v.length > 2) formatted = v.slice(0, 2) + "/" + v.slice(2);
      if (v.length > 4) formatted = formatted.slice(0, 5) + "/" + formatted.slice(5);
      if (v.length > 8) formatted = formatted.slice(0, 10) + " " + formatted.slice(10);
      if (v.length > 10) formatted = formatted.slice(0, 13) + ":" + formatted.slice(13);
      formatted = formatted.slice(0, 16);
      e.target.value = formatted;
      form.setFieldsValue({ [fieldName]: formatted });
    };

    const handleFechaEmisionCalendarChange = (value) => {
      const formatted = value ? value.format("DD/MM/YYYY") : "";
      form.setFieldsValue({ fecha_emision_expediente: formatted });
    };

    const handleFechaAudienciaCalendarChange = (value) => {
      const formatted = value ? value.format("DD/MM/YYYY HH:mm") : "";
      form.setFieldsValue({ fecha_audiencia: formatted });
    };

    const handleFechaRecepcionCalendarChange = (value) => {
      const formatted = value ? value.format("DD/MM/YYYY HH:mm") : "";
      form.setFieldsValue({ fecha_hora_cita_recepcion: formatted });
    };

    /* ======================= Inicial (CORREGIDO: NO PISA MIENTRAS ESCRIBES) ======================= */
    const didInitRef = useRef(false);
    const lastAppliedKeyRef = useRef(null);

    useEffect(() => {
      // CREATE: inicializa 1 sola vez
      if (!isEdit) {
        if (didInitRef.current) return;

        const baseInit = {
          abogado_contrario: "",
          trabajador_nombre: "",
          forma_notificacion: undefined,
          origen_actuario: undefined,
          id_medio_notificacion: undefined,
          fecha_hora_cita_recepcion: undefined,
          ...initialValues,
        };

        form.setFieldsValue(baseInit);

        setDocumentsMap({ citatorio: null });
        setDocErrors({});
        setHasExistingCitatorio(false);

        didInitRef.current = true;
        lastAppliedKeyRef.current = "CREATE";
        return;
      }

      // EDIT: solo aplica cuando initialValues ya tiene datos reales
      const editKey = String(idExpediente ?? "");
      const hasData = hasMeaningfulInitialValues(initialValues);

      if (!editKey) return;
      if (!hasData) return;

      // evita re-aplicar sobre el mismo expediente
      if (lastAppliedKeyRef.current === editKey && didInitRef.current) return;

      const baseInit = {
        abogado_contrario: "",
        trabajador_nombre: "",
        forma_notificacion: undefined,
        origen_actuario: undefined,
        id_medio_notificacion: undefined,
        fecha_hora_cita_recepcion: undefined,
        ...initialValues,
      };

      form.setFieldsValue(baseInit);

      setDocErrors({});
      setHasExistingCitatorio(false);

      didInitRef.current = true;
      lastAppliedKeyRef.current = editKey;
    }, [initialValues, form, isEdit, idExpediente]);

    /* ======================= Guardado (create / update) ======================= */
    const buildAndSend = async (values) => {
      if (!values.empresa_nombre) {
        notification.error({ message: "Selecciona una Empresa.", placement: "bottomRight" });
        return;
      }

      if (!idAutoridad) {
        notification.error({
          message: "Falta la autoridad (idAutoridad en la ruta).",
          placement: "bottomRight",
        });
        return;
      }

      const _empIndex = buildEmpresasIndex(empresasItems);
      let empresa_id = values.empresa_id ?? null;
      const empresaNombreVal = values.empresa_nombre || "";
      const bucket = _empIndex.get(empresaNombreVal);

      const customForEmpresa = razonCustomByEmpresa[empresaNombreVal] || [];
      const rsOptions = [
        ...(bucket?.razones?.map((o) => ({ ...o })) ?? []),
        ...customForEmpresa,
      ];

      const rsRaw = values.empresa_razon_social_id ?? [];
      const rsArr = Array.isArray(rsRaw) ? rsRaw : [rsRaw];

      // ✅ soporta [1389] o [{value:1389,label:"..."}]
      const rsValues = rsArr
        .map((v) => {
          if (v == null) return null;
          if (typeof v === "object") return v.value ?? null;
          return v;
        })
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => Number(v));


      if (!empresa_id && bucket) {
        const bucketIds = Array.from(bucket.empresaIds || []);
        if (rsValues.length) {
          const principalRS = rsValues[0];
          const chosen = rsOptions.find(
            (o) => String(o.value) === String(principalRS)
          );
          if (chosen?.empresa_id != null) empresa_id = chosen.empresa_id;
          else if (bucketIds.length) empresa_id = bucketIds[0];
        } else if (bucketIds.length) {
          empresa_id = bucketIds[0];
        }
      }

      const clean = {
        exp: sanitizeByField("exp", values.exp),
        abogado: sanitizeByField("abogado", values.abogado),
        abogado_contrario: sanitizeByField("abogado_contrario", values.abogado_contrario),
        trabajador_nombre: sanitizeByField("trabajador_nombre", values.trabajador_nombre),

        forma_notificacion: values.forma_notificacion || null,
        origen_actuario: values.origen_actuario || null,

        fecha_emision_expediente: normalizeFechaDDMMYYYY_to_YYYYMMDD(values.fecha_emision_expediente),
        fecha_audiencia: normalizeFechaHoraDDMMYYYYHHmm_to_YYYYMMDD_HHMM(values.fecha_audiencia),
        fecha_hora_cita_recepcion: normalizeFechaHoraDDMMYYYYHHmm_to_YYYYMMDD_HHMM(
          values.fecha_hora_cita_recepcion
        ),

        id_medio_notificacion: values.id_medio_notificacion
          ? Number(values.id_medio_notificacion)
          : null,
      };

      const id_abogado =
        abogadoOptionsBase.find((a) => a.value === clean.abogado)?._id ?? null;

      const objetoNombre = values.objeto_solicitud || null;
      const objetoMatch = objetosOptions.find((o) => o.value === objetoNombre);
      const id_objeto = objetoMatch ? objetoMatch._id : null;

      const id_autoridad = idAutoridad ? Number(idAutoridad) : null;

      const esEmpresaNueva = empresaCustomNames.some(
        (n) => n.toLowerCase() === empresaNombreVal.toLowerCase()
      );

      const esAbogadoNuevo = abogadoCustomNames.some(
        (n) => n.toLowerCase() === (clean.abogado || "").toLowerCase()
      );

      const baseRsOptions = bucket?.razones?.map((o) => ({ ...o })) ?? [];
      const idsBase = new Set(baseRsOptions.map((o) => String(o.value || "")));
      const customMap = new Map(customForEmpresa.map((o) => [String(o.value || ""), o.label]));

      const rsIdsExistentes = [];
      const rsNuevasLabels = [];

      for (const v of rsValues) {
        const key = String(v);
        if (idsBase.has(key)) rsIdsExistentes.push(v);
        else if (customMap.has(key)) rsNuevasLabels.push(customMap.get(key));
      }

      const requiredErrors = [];
      if (!clean.exp) requiredErrors.push("expediente");
      if (bucket && rsOptions.length > 0 && rsValues.length === 0) requiredErrors.push("razones_sociales_ids");
      if (bucket && !empresa_id && !esEmpresaNueva) requiredErrors.push("id_empresa");
      if (!id_objeto) requiredErrors.push("id_objeto");
      if (!id_autoridad) requiredErrors.push("id_autoridad");

      if (clean.forma_notificacion && !clean.origen_actuario) requiredErrors.push("origen_actuario");

      if (clean.forma_notificacion === "actuario" && !clean.fecha_hora_cita_recepcion) {
        requiredErrors.push("fecha_hora_cita_recepcion");
      }

      if (clean.forma_notificacion === "actuario") {
        clean.id_medio_notificacion = 1;
      }

      if (clean.forma_notificacion === "trabajador" && !clean.id_medio_notificacion) {
        requiredErrors.push("id_medio_notificacion");
      }

      if (requiredErrors.length > 0) {
        notification.error({
          message: "Faltan campos obligatorios: " + requiredErrors.join(", "),
          placement: "bottomRight",
        });
        return;
      }

      const backendPayload = {
        expediente: `${nombreIdentificacionCiudad}/${expedienteYear}/` + clean.exp,
        id_ciudad:idCiudad,

        id_empresa:
          empresa_id != null && !Number.isNaN(Number(empresa_id))
            ? Number(empresa_id)
            : null,
        empresa_nombre_nueva: esEmpresaNueva ? empresaNombreVal : null,

        fecha_emision_expediente: clean.fecha_emision_expediente,
        fecha_audiencia: clean.fecha_audiencia,

        id_abogado: id_abogado ?? null,
        abogado_nuevo_nombre: esAbogadoNuevo ? clean.abogado : null,

        abogado_contrario: toNullIfEmptyEffective(clean.abogado_contrario) ?? "",
        nombre_trabajador: toNullIfEmptyEffective(clean.trabajador_nombre),

        id_autoridad: id_autoridad,
        id_objeto: id_objeto,

        forma_notificacion: clean.forma_notificacion,
        origen_actuario: clean.origen_actuario,
        fecha_hora_cita_recepcion: clean.fecha_hora_cita_recepcion,
        id_medio_notificacion: clean.id_medio_notificacion,

        razones_sociales_ids: rsIdsExistentes,
        razones_sociales_nuevas: rsNuevasLabels,

        cliente_directo: clienteDirecto ? 1 : 0,
        corresponsal_nombre: clienteDirecto ? "No hay corresponsal" : corresponsalNombre,
        corresponsal_celular: clienteDirecto ? null : corresponsalCel,
        corresponsal_correo: clienteDirecto ? null : corresponsalCorreo,
      };

      const filesMap = {};
      if (documentsMap.citatorio) filesMap.citatorio = documentsMap.citatorio;

      try {
        setSubmitting(true);

        if (isEdit) {
          if (!idExpediente) {
            notification.error({
              message: "Falta idExpediente para editar (no se puede actualizar).",
              placement: "bottomRight",
            });
            return;
          }

          await dispatch(
            actionConciliacionUpdate(
              idExpediente,
              backendPayload,
              () => onSaved?.(),
              filesMap
            )
          );

          notification.success({
            message: "Expediente actualizado",
            description: "Los cambios se guardaron correctamente.",
            placement: "bottomRight",
          });
        } else {
          await dispatch(
            actionConciliacionCreate(backendPayload, () => onSaved?.(), filesMap)
          );

          notification.success({
            message: "Expediente creado",
            description: "El expediente se guardó correctamente.",
            placement: "bottomRight",
          });
        }

        const expedienteFormat = buildExpedienteFormat(backendPayload.expediente);
        if (expedienteFormat) navigate(`/materias/laboral/centro-conciliacion/${expedienteFormat}`);
        else onSaved?.();
      } finally {
        setSubmitting(false);
      }
    };

    const handleSaveClick = async () => {
      try {
        const values = await form.validateFields();

        if (values.forma_notificacion && !values.origen_actuario) {
          notification.error({
            message: "Selecciona a quién se le notificó.",
            placement: "bottomRight",
            duration: 3,
          });
          return;
        }

        if (values.forma_notificacion === "actuario" && !values.fecha_hora_cita_recepcion) {
          notification.error({
            message: "Selecciona la fecha y hora de recepción del citatorio.",
            placement: "bottomRight",
            duration: 3,
          });
          return;
        }

        if (values.forma_notificacion === "trabajador" && !values.id_medio_notificacion) {
          notification.error({
            message: "Selecciona el medio de notificación.",
            placement: "bottomRight",
            duration: 3,
          });
          return;
        }

        await buildAndSend(values);
      } catch (err) {
        const errorFields = err?.errorFields || [];
        if (errorFields.length) {
          notification.error({
            message: "Faltan campos obligatorios.",
            placement: "bottomRight",
            duration: 3,
          });
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
        if (expRef.current && typeof expRef.current.focus === "function") expRef.current.focus();
      },
    }));

    const DocBlock = ({ label, keyName }) => (
      <div className="expediente-doc-block">
        <Text strong>{label}</Text>

        {isEdit && hasExistingCitatorio && !documentsMap[keyName] ? (
          <div style={{ marginTop: 8 }}>
            <Alert
              type="info"
              showIcon
              message="Ya existe un citatorio guardado. Si subes uno nuevo, se reemplazará."
            />
          </div>
        ) : null}

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
          <p className="ant-upload-hint">
            Se enviará al presionar {isEdit ? '"Guardar cambios"' : '"Guardar expediente"'}.
          </p>
        </Dragger>

        {docErrors[keyName] ? (
          <Alert
            style={{ marginTop: 8 }}
            type="error"
            showIcon
            message={docErrors[keyName]}
          />
        ) : null}
      </div>
    );

    return (
      <>
        <div className="expediente-form-wrapper">
          <div className="expediente-form-header">
  <div className="expediente-form-header-left">
    <div className="expediente-form-title">
      {isEdit
        ? "EDITAR EXPEDIENTE · CENTRO DE CONCILIACIÓN LABORAL"
        : "CREAR EXPEDIENTE · CENTRO DE CONCILIACIÓN LABORAL"}
    </div>
  </div>

  {showTopActions ? (
    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
      {onCancel ? <Button onClick={onCancel}>Cancelar</Button> : null}
      <Button type="primary" onClick={handleSaveClick} loading={submitting}>
        {isEdit ? "Guardar cambios" : "Guardar expediente"}
      </Button>
    </div>
  ) : null}
</div>


          <div className="expediente-form-card">
            <Spin
              spinning={submitting}
              tip={isEdit ? "Guardando cambios..." : "Guardando expediente..."}
            >
              <div className="expediente-section-title">Datos de expediente</div>

              <Form form={form} layout="vertical" className="expediente-ant-form">
                <Form.Item name="empresa_id" hidden>
                  <Input />
                </Form.Item>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="NÚM. IDENTIFICACIÓN ÚNICO"
                      name="exp"
                      rules={rules.exp}
                      normalize={makeNormalizer("exp")}
                    >
                      <Input
                        addonBefore={`${nombreIdentificacionCiudad}/${expedienteYear}/`}
                        ref={expRef}
                        placeholder="Solo escribe el folio"
                        allowClear
                        maxLength={50}
                        onKeyDown={makeEnterHandler(expRef)}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="FECHA DE EMISIÓN DEL CITATORIO"
                      name="fecha_emision_expediente"
                      rules={rules.fecha_emision_expediente}
                    >
                      <div style={{ position: "relative" }}>
                        <Input
                          ref={fechaEmisionRef}
                          placeholder="DD/MM/YYYY"
                          maxLength={10}
                          value={fechaEmisionValue || ""}
                          onChange={makeFechaInputHandler("fecha_emision_expediente")}
                          onKeyDown={makeEnterHandler(fechaEmisionRef)}
                          suffix={
                            <CalendarOutlined
                              style={{ cursor: "pointer", color: "#1677ff" }}
                              onClick={() => setOpenFechaEmisionPicker(true)}
                            />
                          }
                        />

                        <DatePicker
                          open={openFechaEmisionPicker}
                          onOpenChange={setOpenFechaEmisionPicker}
                          format="DD/MM/YYYY"
                          value={
                            fechaEmisionValue
                              ? dayjs(fechaEmisionValue, "DD/MM/YYYY", true)
                              : null
                          }
                          onChange={handleFechaEmisionCalendarChange}
                          style={{
                            position: "absolute",
                            inset: 0,
                            opacity: 0,
                            pointerEvents: "none",
                            width: 0,
                            height: 0,
                          }}
                          getPopupContainer={(trigger) => trigger.parentNode}
                        />
                      </div>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="FECHA Y HORA DE LA PRÓXIMA AUDIENCIA"
                      name="fecha_audiencia"
                      rules={rules.fecha_audiencia}
                    >
                      <div style={{ position: "relative" }}>
                        <Input
                          ref={fechaAudienciaRef}
                          placeholder="DD/MM/YYYY HH:mm"
                          maxLength={16}
                          value={fechaAudienciaValue || ""}
                          onChange={makeFechaHoraInputHandler("fecha_audiencia")}
                          onKeyDown={makeEnterHandler(fechaAudienciaRef)}
                          suffix={
                            <CalendarOutlined
                              style={{ cursor: "pointer", color: "#1677ff" }}
                              onClick={() => setOpenFechaAudienciaPicker(true)}
                            />
                          }
                        />

                        <DatePicker
                          open={openFechaAudienciaPicker}
                          onOpenChange={setOpenFechaAudienciaPicker}
                          format="DD/MM/YYYY HH:mm"
                          showTime={{ format: "HH:mm" }}
                          value={
                            fechaAudienciaValue
                              ? dayjs(fechaAudienciaValue, "DD/MM/YYYY HH:mm", true)
                              : null
                          }
                          onChange={handleFechaAudienciaCalendarChange}
                          style={{
                            position: "absolute",
                            inset: 0,
                            opacity: 0,
                            pointerEvents: "none",
                            width: 0,
                            height: 0,
                          }}
                          getPopupContainer={(trigger) => trigger.parentNode}
                        />
                      </div>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item label="CITADO" name="empresa_nombre" rules={rules.empresa_nombre}>
                      <Select
                        ref={empresaNombreRef}
                        placeholder="Selecciona Empresa"
                        options={empresaNombreOptions}
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        onChange={(value) => {
                          form.setFieldsValue({
                            empresa_nombre: value || null,
                            empresa_razon_social_id: [],
                            empresa_id: null,
                          });

                          setClienteDirecto(true);
                          setCorresponsalNombre("No hay corresponsal");
                          setCorresponsalCel("");
                          setCorresponsalCorreo("");
                        }}
                        filterOption={(input, option) =>
                          (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                        getPopupContainer={(trigger) => trigger.parentNode}
                        dropdownRender={(menu) => (
                          <>
                            {menu}
                            <Divider style={{ margin: "8px 0" }} />
                            <Space style={{ padding: "0 8px 4px" }}>
                              <Input
                                placeholder="Agregar empresa"
                                ref={empresaInputRef}
                                value={empresaNewName}
                                onChange={(e) => setEmpresaNewName(e.target.value.replace(/_/g, ""))}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                              <Button type="text" icon={<PlusOutlined />} onClick={handleAddEmpresa}>
                                Agregar
                              </Button>
                            </Space>
                          </>
                        )}
                        onKeyDown={makeEnterHandler(empresaNombreRef)}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="RAZÓN SOCIAL"
                      name="empresa_razon_social_id"
                      rules={rules.empresa_razon_social_id}
                    >
                      <Select
                        ref={razonSocialRef}
                        placeholder="Selecciona Razón social"
                        options={razonSocialOptions}
                        showSearch
                        allowClear
                        mode="multiple"
                        optionFilterProp="label"
                        disabled={!empresaNombre}
                        notFoundContent={empresaNombre ? "Sin razones sociales" : "Selecciona empresa"}
                        onChange={handleChangeRazonSocial}
                        filterOption={(input, option) =>
                          (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                        getPopupContainer={(trigger) => trigger.parentNode}
                        dropdownRender={(menu) => (
                          <>
                            {menu}
                            {empresaNombre && (
                              <>
                                <Divider style={{ margin: "8px 0" }} />
                                <Space style={{ padding: "0 8px 4px" }}>
                                  <Input
                                    placeholder="Agregar razón social"
                                    ref={razonInputRef}
                                    value={razonNewName}
                                    onChange={(e) => setRazonNewName(e.target.value.replace(/_/g, ""))}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  />
                                  <Button
                                    type="text"
                                    icon={<PlusOutlined />}
                                    onClick={handleAddRazonSocial}
                                  >
                                    Agregar
                                  </Button>
                                </Space>
                              </>
                            )}
                          </>
                        )}
                        onKeyDown={makeEnterHandler(razonSocialRef)}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item label="CORRESPONSAL">
                      <Input
                        disabled
                        placeholder={clienteDirecto ? "No hay corresponsal" : ""}
                        value={clienteDirecto ? "No hay corresponsal" : corresponsalNombre}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {empresaEsNueva && (
                  <>
                    <Row gutter={[12, 12]}>
                      <Col xs={24} md={6}>
                        <Form.Item label="¿CLIENTE DIRECTO?">
                          <Switch
                            ref={clienteDirectoSwitchRef}
                            checked={clienteDirecto}
                            onChange={setClienteDirecto}
                            onKeyDown={makeEnterHandler(clienteDirectoSwitchRef)}
                          />
                        </Form.Item>
                      </Col>

                      {!clienteDirecto && (
                        <>
                          <Col xs={24} md={6}>
                            <Form.Item label="NOMBRE DEL CORRESPONSAL">
                              <Input
                                ref={corresponsalNombreRef}
                                placeholder="Nombre del corresponsal"
                                value={corresponsalNombre}
                                onChange={(e) => setCorresponsalNombre(e.target.value)}
                                onKeyDown={makeEnterHandler(corresponsalNombreRef)}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={6}>
                            <Form.Item label="CELULAR">
                              <Input
                                ref={corresponsalCelRef}
                                placeholder="Ej. 6861234567"
                                value={corresponsalCel}
                                onChange={(e) => setCorresponsalCel(e.target.value)}
                                onKeyDown={makeEnterHandler(corresponsalCelRef)}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={6}>
                            <Form.Item label="CORREO">
                              <Input
                                ref={corresponsalCorreoRef}
                                placeholder="correo@ejemplo.com"
                                value={corresponsalCorreo}
                                onChange={(e) => setCorresponsalCorreo(e.target.value)}
                                onKeyDown={makeEnterHandler(corresponsalCorreoRef)}
                              />
                            </Form.Item>
                          </Col>
                        </>
                      )}
                    </Row>

                    <Divider />
                  </>
                )}

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="NOMBRE DEL TRABAJADOR"
                      name="trabajador_nombre"
                      rules={rules.trabajador_nombre}
                      normalize={makeNormalizer("trabajador_nombre")}
                    >
                      <Input
                        ref={trabajadorNombreRef}
                        placeholder="Nombre del trabajador"
                        allowClear
                        onKeyDown={makeEnterHandler(trabajadorNombreRef)}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      label="OBJETO DE LA SOLICITUD"
                      name="objeto_solicitud"
                      rules={rules.objeto_solicitud}
                    >
                      <Select
                        ref={objetoSolicitudRef}
                        placeholder="Selecciona el objeto de la solicitud"
                        options={[...objetosOptions]}
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        onKeyDown={makeEnterHandler(objetoSolicitudRef)}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="FORMA DE NOTIFICACIÓN"
                      name="forma_notificacion"
                      rules={rules.forma_notificacion}
                    >
                      <Select
                        ref={formaNotifRef}
                        placeholder="Selecciona"
                        showSearch
                        options={[
                          { label: "SOLICITANTE", value: "trabajador" },
                          { label: "NOTIFICADOR CCL", value: "actuario" },
                        ]}
                        onChange={(v) => {
                          if (v !== "actuario")
                            form.setFieldsValue({ fecha_hora_cita_recepcion: null });
                          if (!v) {
                            form.setFieldsValue({
                              origen_actuario: null,
                              id_medio_notificacion: null,
                              fecha_hora_cita_recepcion: null,
                            });
                          }
                        }}
                        onKeyDown={makeEnterHandler(formaNotifRef)}
                      />
                    </Form.Item>
                  </Col>

                  {formaNotifSel && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="A QUIEN SE LE NOTIFICÓ?"
                        name="origen_actuario"
                      >
                        <Select
                          ref={origenActuarioRef}
                          placeholder="Selecciona origen"
                          showSearch
                          options={[
                            { label: "Empresa", value: "empresa" },
                            { label: "Despacho", value: "despacho" },
                          ]}
                          onKeyDown={makeEnterHandler(origenActuarioRef)}
                        />
                      </Form.Item>
                    </Col>
                  )}

                  {formaNotifSel === "actuario" && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="FECHA Y HORA DE RECEPCIÓN DEL CITATORIO"
                        name="fecha_hora_cita_recepcion"
                        rules={rules.fecha_hora_cita_recepcion}
                      >
                        <div style={{ position: "relative" }}>
                          <Input
                            ref={fechaRecepcionRef}
                            placeholder="DD/MM/YYYY HH:mm"
                            maxLength={16}
                            value={fechaRecepcionValue || ""}
                            onChange={makeFechaHoraInputHandler("fecha_hora_cita_recepcion")}
                            onKeyDown={makeEnterHandler(fechaRecepcionRef)}
                            suffix={
                              <CalendarOutlined
                                style={{ cursor: "pointer", color: "#1677ff" }}
                                onClick={() => setOpenFechaRecepcionPicker(true)}
                              />
                            }
                          />

                          <DatePicker
                            open={openFechaRecepcionPicker}
                            onOpenChange={setOpenFechaRecepcionPicker}
                            format="DD/MM/YYYY HH:mm"
                            showTime={{ format: "HH:mm" }}
                            value={
                              fechaRecepcionValue
                                ? dayjs(fechaRecepcionValue, "DD/MM/YYYY HH:mm", true)
                                : null
                            }
                            onChange={handleFechaRecepcionCalendarChange}
                            style={{
                              position: "absolute",
                              inset: 0,
                              opacity: 0,
                              pointerEvents: "none",
                              width: 0,
                              height: 0,
                            }}
                            getPopupContainer={(trigger) => trigger.parentNode}
                          />
                        </div>
                      </Form.Item>
                    </Col>
                  )}

                  {formaNotifSel === "trabajador" && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="MEDIO DE NOTIFICACIÓN"
                        name="id_medio_notificacion"
                        rules={rules.id_medio_notificacion}
                      >
                        <Select
                          ref={medioNotifRef}
                          placeholder="Selecciona medio"
                          showSearch
                          loading={loadingMedios}
                          options={medioNotifOptions}
                          optionFilterProp="label"
                          notFoundContent={
                            loadingMedios ? "Cargando..." : "No hay medios disponibles"
                          }
                          onKeyDown={makeEnterHandler(medioNotifRef)}
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>

                <Divider />
                <DocBlock label="CITATORIO" keyName="citatorio" />
              </Form>
            </Spin>
          </div>
        </div>

        <style>
          {`
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
  gap: 4px;
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
  margin-bottom: 18px;
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

@media (max-width: 992px) {
  .expediente-form-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .expediente-form-card {
    padding: 20px 16px 24px;
  }
}
          `}
        </style>
      </>
    );
  }
);

export default FormCentroConciliacion;
