// src/components/conciliacion/AudienciaPrejudicialModal.jsx
import React from "react";
import {
  Modal,
  Row,
  Col,
  Card,
  Form,
  Input,
  InputNumber,
  Typography,
  Divider,
  Alert,
} from "antd";

const { Title, Text } = Typography;

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function AudienciaPrejudicialModal({
  open,
  onCancel,
  expediente = {},
}) {
  const initialValues = {
    nombre_trabajador: expediente.nombre_trabajador || "",
    nombre_patron:
      expediente.nombre_empresa || expediente.nombre_patron || "",
    fecha_calculo: fmtDate(new Date()),
    fecha_ingreso: fmtDate(expediente.fecha_ingreso_trabajador),
    fecha_egreso: fmtDate(expediente.ultimo_dia_laboral),
    salario_diario: expediente.ultimo_salario_diario || "",
    salario_integrado: expediente.ultimo_salario_integrado || "",
    dias_anio_laborados: "",
    prop_aguinaldo: "",
    dias_vac_ley: "",
    prop_vacaciones: "",
    aguinaldo_monto: 0,
    vac_prim_monto: 0,
    indem_monto: 0,
    prima_antig_monto: 0,
    salarios_pend_monto: 0,
    otros_monto: 0,
    total_monto: 0,
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={onCancel}
      width={1200}
      title="Resumen orientativo de finiquito y prestaciones"
      okText="Cerrar"
      cancelButtonProps={{ style: { display: "none" } }}
      bodyStyle={{ maxHeight: "80vh", overflowY: "auto" }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 18 }}
        message="Vista amigable del cálculo"
        description={
          <Text>
            Usa este formulario como hoja de trabajo rápida para la audiencia
            prejudicial: puedes escribir, ajustar salarios, días laborados y
            montos por concepto sin salir del expediente.
          </Text>
        }
      />

      <Form
        layout="vertical"
        initialValues={initialValues}
        style={{ width: "100%" }}
      >
        {/* BLOQUE 1: Datos laborales base */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card size="small" bordered>
              <Title level={5} style={{ marginBottom: 8 }}>
                Datos laborales base
              </Title>


           

              <Form.Item label="Fecha de cálculo" name="fecha_calculo">
                <Input placeholder="Ej. 15 de noviembre de 2025" />
              </Form.Item>

              <Form.Item label="Fecha de ingreso" name="fecha_ingreso">
                <Input placeholder="Escribe la fecha de ingreso" />
              </Form.Item>

              <Form.Item
                label="Fecha de egreso (último día laboral)"
                name="fecha_egreso"
              >
                <Input placeholder="Escribe la fecha de egreso" />
              </Form.Item>

              <Form.Item label="Salario diario" name="salario_diario">
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="0.00"
                />
              </Form.Item>

              <Form.Item
                label="Salario diario integrado (SDI)"
                name="salario_integrado"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="0.00"
                />
              </Form.Item>
            </Card>
          </Col>

          {/* BLOQUE 2: Aguinaldo y vacaciones */}
          <Col xs={24} md={12}>
            <Card size="small" bordered>
              <Title level={5} style={{ marginBottom: 8 }}>
                Aguinaldo y vacaciones (año actual)
              </Title>

              <Form.Item
                label="Días del año laborados"
                name="dias_anio_laborados"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="Ej. 300"
                />
              </Form.Item>

              <Form.Item
                label="Proporción de aguinaldo (en días)"
                name="prop_aguinaldo"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="Ej. 14.96"
                />
              </Form.Item>

              <Form.Item
                label="Días de vacaciones por ley"
                name="dias_vac_ley"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="Ej. 14"
                />
              </Form.Item>

              <Form.Item
                label="Proporción de vacaciones (en días)"
                name="prop_vacaciones"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="Ej. 17.49"
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* BLOQUE 3: Montos por concepto */}
        <Card size="small" bordered>
          <Title level={5} style={{ marginBottom: 8 }}>
            Resumen orientativo de conceptos
          </Title>

          <Row gutter={[16, 8]}>
            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Aguinaldo proporcional"
                name="aguinaldo_monto"
                extra="Calculado con los días del año laborados."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Vacaciones y prima vacacional"
                name="vac_prim_monto"
                extra="Días de vacaciones + 25% de prima."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Indemnización constitucional (3 meses)"
                name="indem_monto"
                extra="Depende del tipo de despido y antigüedad."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Prima de antigüedad"
                name="prima_antig_monto"
                extra="12 días por año con tope de SDI."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Salarios pendientes"
                name="salarios_pend_monto"
                extra="Días o quincenas no pagadas."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Otros conceptos (bonos, comisiones, etc.)"
                name="otros_monto"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Form.Item
                label="Total estimado"
                name="total_monto"
                extra="Suma orientativa de todos los conceptos."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="$0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Text type="secondary" style={{ fontSize: 11 }}>
            Esta hoja es solo de apoyo visual para la audiencia. El cálculo
            definitivo se respalda con tu archivo de Excel o sistema de nómina.
          </Text>
        </Card>
      </Form>
    </Modal>
  );
}
