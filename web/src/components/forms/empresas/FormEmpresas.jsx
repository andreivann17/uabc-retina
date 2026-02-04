import React, { useEffect, useMemo, useState, useImperativeHandle } from "react";
import {
  Form,
  Input,
  Row,
  Col,
  Button,
  Divider,
  Segmented,
  Tag,
  Space,
  Typography,
  notification,
} from "antd";

const { Text } = Typography;

const collapseSpaces = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toNullIfEmpty = (v) => {
  const s = collapseSpaces(v);
  return s ? s : null;
};

const onlyPhoneDigits = (v) => String(v || "").replace(/\D/g, "").slice(0, 15);

const FormEmpresas = React.forwardRef(
  ({ isEdit = false, initialValues = {}, onCancel, onSaved, onSubmit }, ref) => {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    // directo / corresponsal
    const [tipoCliente, setTipoCliente] = useState("directo");

    // ====== map inicial (para EDIT) ======
    const mappedInitialValues = useMemo(() => {
      const src = initialValues || {};

      const nombre = src?.nombre ?? "";

      const esDirecto =
        src?.cliente_directo != null
          ? String(src.cliente_directo) === "1" || src.cliente_directo === true
          : true;

      // ✅ DB unificada: nombre_contacto / correo / celular
      const nombre_contacto_db = src?.nombre_contacto ?? "";
      const correo_db = src?.correo ?? "";
      const celular_db = src?.celular ?? "";

      // Si es directo, estos van al bloque directo
      // Si es corresponsal, los mismos valores van al bloque corresponsal
      const nombre_contacto = esDirecto ? nombre_contacto_db : "";
      const correo_contacto = esDirecto ? correo_db : "";
      const celular_contacto = esDirecto ? celular_db : "";

      const corresponsal_nombre = esDirecto ? "" : nombre_contacto_db;
      const corresponsal_correo = esDirecto ? "" : correo_db;
      const corresponsal_celular = esDirecto ? "" : celular_db;

      // Si NO guardas abogado en DB, déjalo vacío (solo UI)
      const corresponsal_nombre_abogado = src?.corresponsal_nombre_abogado ?? "";

      // razones sociales
      let razones = [];
      if (Array.isArray(src?.razones_sociales)) {
        razones = src.razones_sociales
          .map((r) => ({
            nombre: collapseSpaces(r?.nombre ?? r?.code ?? r ?? ""),
          }))
          .filter((x) => x.nombre);
      }

      if (!razones.length) razones = [{ nombre: "" }];

      return {
        nombre,
        cliente_directo: esDirecto ? 1 : 0,

        // directo
        nombre_contacto,
        correo_contacto,
        celular_contacto,

        // corresponsal
        corresponsal_nombre,
        corresponsal_nombre_abogado,
        corresponsal_correo,
        corresponsal_celular,

        razones_sociales: razones,
      };
    }, [initialValues]);

    // init form
    useEffect(() => {
      form.setFieldsValue(mappedInitialValues);

      const direct = Number(mappedInitialValues?.cliente_directo) === 1;
      setTipoCliente(direct ? "directo" : "corresponsal");
    }, [form, mappedInitialValues]);

    // al cambiar Directo/Corresponsal: limpia el bloque contrario
    useEffect(() => {
      const esDirecto = tipoCliente === "directo";

      form.setFieldsValue({
        cliente_directo: esDirecto ? 1 : 0,

        ...(esDirecto
          ? {
              corresponsal_nombre: undefined,
              corresponsal_nombre_abogado: undefined,
              corresponsal_correo: undefined,
              corresponsal_celular: undefined,
            }
          : {
              nombre_contacto: undefined,
              correo_contacto: undefined,
              celular_contacto: undefined,
            }),
      });
    }, [tipoCliente, form]);

    const rules = {
      nombre: [{ required: true, message: "Requerido" }],

      // directo
      nombre_contacto: [{ required: true, message: "Requerido" }],
      correo_contacto: [{ required: true, message: "Requerido" }],
      celular_contacto: [{ required: true, message: "Requerido" }],

      // corresponsal
      corresponsal_nombre: [{ required: true, message: "Requerido" }],
      corresponsal_nombre_abogado: [{ required: false }],
      corresponsal_correo: [{ required: true, message: "Requerido" }],
      corresponsal_celular: [{ required: true, message: "Requerido" }],
    };

    const buildPayload = (values) => {
      const esDirecto = tipoCliente === "directo";
      const nombre = collapseSpaces(values.nombre);

      const rsArrRaw = Array.isArray(values.razones_sociales) ? values.razones_sociales : [];
      const rsClean = rsArrRaw
        .map((r) => collapseSpaces(r?.nombre || ""))
        .filter((s) => !!s);

      if (!rsClean.length) {
        throw new Error("Debes capturar al menos una razón social.");
      }

      // ✅ payload alineado a DB (unificado)
      return {
        nombre,
        cliente_directo: esDirecto ? 1 : 0,

        nombre_contacto: toNullIfEmpty(
          esDirecto ? values.nombre_contacto : values.corresponsal_nombre
        ),

        correo: toNullIfEmpty(esDirecto ? values.correo_contacto : values.corresponsal_correo),

        celular: toNullIfEmpty(
          onlyPhoneDigits(esDirecto ? values.celular_contacto : values.corresponsal_celular)
        ),

        razones_sociales: rsClean,
      };
    };

    const handleSave = async () => {
      try {
        await form.validateFields();

        const values = form.getFieldsValue(true);
        const payload = buildPayload(values);

        setSubmitting(true);

        if (typeof onSubmit === "function") {
          await onSubmit(payload);
        }

        notification.success({
          message: isEdit ? "Empresa actualizada" : "Empresa creada",
          placement: "bottomRight",
        });

        onSaved?.(payload);
      } catch (err) {
        const errorFields = err?.errorFields || [];
        if (errorFields.length) {
          notification.error({
            message: "Faltan campos obligatorios.",
            placement: "bottomRight",
          });
          return;
        }

        notification.error({
          message: err?.message || "No se pudo guardar.",
          placement: "bottomRight",
        });
      } finally {
        setSubmitting(false);
      }
    };

    useImperativeHandle(ref, () => ({
      submit: () => handleSave(),
      validate: () => form.validateFields(),
      getValues: () => form.getFieldsValue(true),
    }));

    return (
      <>
        <div className="empresa-form-wrapper">
          <div className="empresa-form-header">
            <div className="empresa-form-title">
              {isEdit ? "EDITAR · EMPRESA" : "CREAR · EMPRESA"}
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {onCancel ? <Button onClick={onCancel}>Cancelar</Button> : null}
              <Button type="primary" onClick={handleSave} loading={submitting}>
                {isEdit ? "Guardar cambios" : "Guardar"}
              </Button>
            </div>
          </div>

          <div className="empresa-form-card">
            <Form form={form} layout="vertical">
              <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
                <Segmented
                  value={tipoCliente}
                  onChange={setTipoCliente}
                  className="segmented-tipo-cliente"
                  options={[
                    { label: "Directo", value: "directo" },
                    { label: "Corresponsal", value: "corresponsal" },
                  ]}
                />
              </div>

              {/* ===== Card datos del cliente / corresponsal ===== */}
              <div className="inner-card">
                <div className="section-title">
                  {tipoCliente === "directo" ? "Contacto del cliente" : "Datos del corresponsal"}
                </div>

                {tipoCliente === "directo" ? (
                  <Row gutter={[12, 12]}>
                    <Col span={24}>
                      <Form.Item label="Nombre" name="nombre_contacto" rules={rules.nombre_contacto}>
                        <Input placeholder="Agregar nombre del contacto" allowClear />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Correo" name="correo_contacto" rules={rules.correo_contacto}>
                        <Input placeholder="correo@dominio.com" allowClear />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Celular" name="celular_contacto" rules={rules.celular_contacto}>
                        <Input
                          placeholder="Ej. 6531234567"
                          allowClear
                          onChange={(e) => {
                            const clean = onlyPhoneDigits(e.target.value);
                            form.setFieldsValue({ celular_contacto: clean });
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : (
                  <Row gutter={[12, 12]}>
                    <Col span={24}>
                      <Form.Item label="Nombre del Despacho" name="corresponsal_nombre" rules={rules.corresponsal_nombre}>
                        <Input placeholder="Ej. Nombre del Despacho" allowClear />
                      </Form.Item>
                    </Col>

                    <Col span={24}>
                      <Form.Item label="Nombre del Abogado" name="corresponsal_nombre_abogado" rules={rules.corresponsal_nombre_abogado}>
                        <Input placeholder="Ej. Nombre del Abogado" allowClear />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Correo" name="corresponsal_correo" rules={rules.corresponsal_correo}>
                        <Input placeholder="correo@dominio.com" allowClear />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Celular" name="corresponsal_celular" rules={rules.corresponsal_celular}>
                        <Input
                          placeholder="Ej. 6531234567"
                          allowClear
                          onChange={(e) => {
                            const clean = onlyPhoneDigits(e.target.value);
                            form.setFieldsValue({ corresponsal_celular: clean });
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                )}
              </div>

              <Divider />

              {/* ===== Card patrón: empresa + razones sociales ===== */}
              <div className="inner-card">
                <div className="inner-card-head">
                  <div className="section-title" style={{ marginBottom: 0 }}>
                    Datos del patrón
                  </div>

                  <Space size={8}>
                    <Text type="secondary">Tipo:</Text>
                    <Tag color={tipoCliente === "directo" ? "blue" : "geekblue"}>
                      {tipoCliente === "directo" ? "Directo" : "Corresponsal"}
                    </Tag>
                  </Space>
                </div>

                <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
                  <Col span={24}>
                    <Form.Item label="Nombre Comercial" name="nombre" rules={rules.nombre}>
                      <Input placeholder="Ej. Nombre Comercial" allowClear />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.List name="razones_sociales">
                      {(fields, { add, remove }) => (
                        <>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>
                              Razones sociales
                            </div>

                            <Button onClick={() => add({ nombre: "" })} type="dashed" size="small">
                              Agregar razón social
                            </Button>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            {fields.map((field, idx) => (
                              <Row key={field.key} gutter={[8, 8]} align="middle">
                                <Col flex="auto">
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "nombre"]}
                                    rules={[{ required: true, message: "Requerido" }]}
                                  >
                                    <Input placeholder={`Razón social ${idx + 1} (Ej. SA DE CV)`} allowClear />
                                  </Form.Item>
                                </Col>

                                <Col>
                                  <Button danger onClick={() => remove(field.name)} disabled={fields.length <= 1}>
                                    Quitar
                                  </Button>
                                </Col>
                              </Row>
                            ))}
                          </div>
                        </>
                      )}
                    </Form.List>
                  </Col>
                </Row>
              </div>
            </Form>
          </div>
        </div>

        <style>{`
          .empresa-form-wrapper {
            max-width: 980px;
            margin: 0 auto;
            padding: 8px 0 26px;
          }
          .empresa-form-header {
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
          }
          .empresa-form-title {
            font-size: 18px;
            font-weight: 600;
            color: #0b1324;
          }
          .empresa-form-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 22px 22px 22px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          }
          .inner-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 18px 18px 16px;
            box-shadow: 0 3px 12px rgba(15, 23, 42, 0.06);
            border: 1px solid rgba(15, 23, 42, 0.06);
          }
          .inner-card-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .section-title {
            font-weight: 600;
            font-size: 13px;
            color: #111827;
            margin-bottom: 10px;
          }
          .segmented-tipo-cliente {
            width: 520px;
            display: flex;
            justify-content: center;
          }
          .segmented-tipo-cliente .ant-segmented-group {
            display: flex;
            width: 100%;
          }
          .segmented-tipo-cliente .ant-segmented-item {
            flex: 1;
            text-align: center;
            font-weight: 500;
          }
          .segmented-tipo-cliente .ant-segmented-item-selected {
            background: #1677ff !important;
            color: #fff !important;
          }
          .segmented-tipo-cliente .ant-segmented-thumb {
            background: #1677ff !important;
          }
        `}</style>
      </>
    );
  }
);

export default FormEmpresas;
