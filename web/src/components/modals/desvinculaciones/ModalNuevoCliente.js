// ModalNuevoCliente.jsx
import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Row, Col, Segmented, Divider } from "antd";

const collapseSpaces = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const ModalNuevoCliente = ({ open, onCancel, onCreated }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // "directo" => contacto del cliente
  // "corresponsal" => datos del corresponsal
  const [tipoCliente, setTipoCliente] = useState("directo");

  useEffect(() => {
    if (open) {
      setTipoCliente("directo");
      setSaving(false);
      form.resetFields();
    } else {
      setSaving(false);
      form.resetFields();
      setTipoCliente("directo");
    }
  }, [open, form]);

  useEffect(() => {
    if (tipoCliente === "corresponsal") {
      form.setFieldsValue({
        nombre_contacto: undefined,
        correo_contacto: undefined,
        celular_contacto: undefined,
      });
    } else {
      form.setFieldsValue({
        corresponsal_nombre: undefined,
        corresponsal_nombre_abogado: undefined,
        corresponsal_correo: undefined,
        corresponsal_celular: undefined,
      });
    }
  }, [tipoCliente, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const esDirecto = tipoCliente === "directo";

      const payload = {
        cliente_nombre: collapseSpaces(values.cliente_nombre),
        razon_social: collapseSpaces(values.razon_social),

        cliente_directo: esDirecto ? 1 : 0,

        // DIRECTO: contacto cliente
        nombre_contacto: esDirecto ? collapseSpaces(values.nombre_contacto || "") : null,
        correo_contacto: esDirecto ? collapseSpaces(values.correo_contacto || "") : null,
        celular_contacto: esDirecto ? collapseSpaces(values.celular_contacto || "") : null,

        // CORRESPONSAL: datos corresponsal
        corresponsal_nombre: esDirecto ? null : collapseSpaces(values.corresponsal_nombre || ""),
        corresponsal_nombre_abogado: esDirecto ? null : collapseSpaces(values.corresponsal_nombre_abogado || ""),
        corresponsal_correo: esDirecto ? null : collapseSpaces(values.corresponsal_correo || ""),
        corresponsal_celular: esDirecto ? null : collapseSpaces(values.corresponsal_celular || ""),
      };

      onCreated?.(payload);

      setSaving(false);
      onCancel?.();
    } catch (err) {
      // validación antd
    }
  };

  const rules = {
    cliente_nombre: [{ required: true, message: "Requerido" }],
    razon_social: [{ required: true, message: "Requerido" }],

    nombre_contacto: [{ required: true, message: "Requerido" }],
    correo_contacto: [{ required: true, message: "Requerido" }],
    celular_contacto: [{ required: true, message: "Requerido" }],

    corresponsal_nombre: [{ required: true, message: "Requerido" }],
    corresponsal_correo: [{ required: true, message: "Requerido" }],
    corresponsal_celular: [{ required: true, message: "Requerido" }],
    corresponsal_nombre_abogado: [{ required: true, message: "Requerido" }],
  };

  return (
    <Modal
      title=""
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={saving}
      destroyOnClose
    >
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
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

      <Form form={form} layout="vertical" className="modal-nuevo-cliente-form">
       

        {tipoCliente === "directo" ? (
          <>
            <Divider style={{ margin: "12px 0" }} />
            <div className="modal-nuevo-cliente-section-title">Contacto del cliente</div>

            <Row gutter={[12, 12]}>
              <Col span={24}>
                <Form.Item label="Nombre" name="nombre_contacto" rules={rules.nombre_contacto}>
                  <Input placeholder="Agregar nombre del contacto" allowClear />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Correo" name="correo_contacto" rules={rules.correo_contacto}>
                  <Input placeholder="correo@dominio.com" allowClear />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Celular" name="celular_contacto" rules={rules.celular_contacto}>
                  <Input placeholder="Ej. 6531234567" allowClear />
                </Form.Item>
              </Col>
            </Row>
          </>
        ) : null}

        {tipoCliente === "corresponsal" ? (
          <>
            <Divider style={{ margin: "12px 0" }} />
            <div className="modal-nuevo-cliente-section-title">Datos del corresponsal</div>

            <Row gutter={[12, 12]}>
              <Col span={24}>
                <Form.Item label="Nombre del Despacho" name="corresponsal_nombre" rules={rules.corresponsal_nombre}>
                  <Input placeholder="Ej. Nombre del Despacho" allowClear />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item
                  label="Nombre del Abogado"
                  name="corresponsal_nombre_abogado"
                  rules={rules.corresponsal_nombre_abogado}
                >
                  <Input placeholder="Ej. Nombre del Abogado" allowClear />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Correo" name="corresponsal_correo" rules={rules.corresponsal_correo}>
                  <Input placeholder="correo@dominio.com" allowClear />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Celular" name="corresponsal_celular" rules={rules.corresponsal_celular}>
                  <Input placeholder="Ej. 6531234567" allowClear />
                </Form.Item>
              </Col>
            </Row>
          </>
        ) : null}
         <div className="modal-nuevo-cliente-section-title">Datos del patrón</div>

        <Row gutter={[12, 12]}>
          <Col span={24}>
            <Form.Item label="Nombre Comercial" name="cliente_nombre" rules={rules.cliente_nombre}>
              <Input placeholder="Ej. Nombre Comercial" allowClear />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item label="Razón social" name="razon_social" rules={rules.razon_social}>
              <Input placeholder="Ej. SA DE CV" allowClear />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <style>{`
        .modal-nuevo-cliente-section-title{
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 10px;
        }

        .modal-nuevo-cliente-form .ant-form-item-label > label{
          font-size: 12px;
          font-weight: 500;
          color: #334155;
          text-transform: none;
        }

        .segmented-tipo-cliente {
          width: 420px;
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
    </Modal>
  );
};

export default ModalNuevoCliente;
