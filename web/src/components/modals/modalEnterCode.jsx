import React, { useRef, useState } from "react";
import {
  Modal,
  Button,
  Input,
  Form,
  Typography,
  Space,
  notification,
} from "antd";
import { KeyOutlined, SafetyOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";

import Modalmensaje from "./modalMensaje";
import Modalnewpass from "./modalNewPassword";
import { actionCodigo } from "../../redux/actions/login/login";

const { Title, Text } = Typography;

function Home({ show, setShow, clave, correo }) {
  const [code, setCode] = useState("");
  const [showpass, setShowpass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const inputRef = useRef(null);

  const close = () => {
    if (loading) return;
    setShow(false);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const codeValue = (values?.code || "").trim();

      setLoading(true);

      const parametros = {
        clave,
        code: codeValue,
        email: correo,
      };

      dispatch(
        actionCodigo(
          parametros,
          (value) => {
            setLoading(false);

            if (value?.status) {
              setShow(false);
              setShowpass(true);
              return;
            }

            notification.error({
              message: "Código inválido",
              description: "Verifica el código e inténtalo de nuevo.",
              placement: "top",
            });
          },
          (err) => {
            setLoading(false);
            notification.error({
              message: "No se pudo validar",
              description:
                typeof err === "string"
                  ? err
                  : "Ocurrió un error al validar el código.",
              placement: "top",
            });
          }
        )
      );
    } catch {
      // validación
    }
  };

  return (
    <>
      <Modalnewpass
  show={showpass}
  setShow={setShowpass}
  correo={correo}
  code={code}
/>

      <Modal
        open={show}
        centered
        closable={!loading}
        maskClosable={!loading}
        onCancel={close}
        width={560}
        footer={null}
        styles={{
          content: {
            padding: 0,
            borderRadius: 16,
            overflow: "hidden",
            background:
              "linear-gradient(180deg, rgba(250, 250, 252, 1) 0%, rgba(255, 255, 255, 1) 60%)",
            boxShadow: "0 24px 80px rgba(0,0,0,.18)",
          },
        }}
      >
        {/* Header estilo consistente con el primer modal */}
        <div
          style={{
            padding: "18px 22px",
            background:
              "linear-gradient(135deg, rgba(30, 58, 138, .10) 0%, rgba(59, 130, 246, .06) 55%, rgba(255,255,255,0) 100%)",
            borderBottom: "1px solid rgba(0,0,0,.06)",
          }}
        >
          <Space size={12} align="center">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background:
                  "linear-gradient(135deg, rgba(30, 58, 138, .16) 0%, rgba(59, 130, 246, .12) 100%)",
                border: "1px solid rgba(0,0,0,.06)",
              }}
            >
              <SafetyOutlined style={{ fontSize: 18 }} />
            </div>

            <div style={{ flex: 1 }}>
              <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
                Verificación de seguridad
              </Title>
              <Text type="secondary">
                Ingresa el código que se envió a tu correo para continuar.
              </Text>

              {/* “detalle” discreto: a qué correo se mandó */}
              <div style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 12, color: "rgba(0,0,0,.55)" }}>
                  Correo: <b>{correo || "-"}</b>
                </Text>
              </div>
            </div>
          </Space>
        </div>

        <div style={{ padding: "18px 22px 22px" }}>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ code: code || "" }}
          >
            <Form.Item
              label="Código"
              name="code"
              rules={[
                { required: true, message: "El código es obligatorio." },
                { max: 10, message: "El código no puede exceder 10 caracteres." },
              ]}
              style={{ marginBottom: 14 }}
            >
              <Input
                ref={inputRef}
                size="large"
                prefix={<KeyOutlined />}
                placeholder="Ej. 123456"
                maxLength={10}
                autoFocus
                disabled={loading}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onPressEnter={submit}
                style={{
                  borderRadius: 12,
                  background: "rgba(30, 58, 138, .04)",
                  border: "1px solid rgba(0,0,0,.10)",
                  letterSpacing: 1,
                }}
              />
            </Form.Item>

            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button
                onClick={close}
                disabled={loading}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.14)",
                }}
              >
                Cancelar
              </Button>

              <Button
                type="primary"
                loading={loading}
                onClick={submit}
                style={{
                  borderRadius: 12,
                  border: "none",
                  background:
                    "linear-gradient(135deg, rgba(37, 99, 235, 1) 0%, rgba(30, 58, 138, 1) 100%)",
                  boxShadow: "0 10px 24px rgba(30, 58, 138, .28)",
                }}
              >
                Validar
              </Button>
            </Space>

            <div style={{ marginTop: 14 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Si no recibiste el código, revisa spam o solicita un reenvío desde la pantalla anterior.
              </Text>
            </div>
          </Form>
        </div>
      </Modal>
    </>
  );
}

export default Home;
