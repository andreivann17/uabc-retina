import React, { useRef, useState } from "react";
import {
  Modal,
  Button,
  Form,
  Input,
  Typography,
  Space,
  notification,
} from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";

import Modalenter from "./modalEnterCode";
import { actionCorreo } from "../../redux/actions/login/login";

const { Title, Text } = Typography;

function Home({ show, setShow }) {
  const [correo, setCorreo] = useState("");
  const [showenter, setShowenter] = useState(false);
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);

  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const inputRef = useRef(null);

  const submit = async () => {
    try {
      const { email } = await form.validateFields();
      setLoading(true);

      dispatch(
        actionCorreo(
          { email },
          (value) => {
            setLoading(false);

            if (!value?.status) {
              callbackError();
              return;
            }

            setShow(false);
            setShowenter(true);
            setClave(value.clave);
          },
          () => {
            setLoading(false);
            callbackError();
          }
        )
      );
    } catch {
      // validación
    }
  };

  const callbackError = () => {
    notification.error({
      message: "No se pudo continuar",
      description: "El correo no existe o no está registrado.",
      placement: "top",
    });
  };

  return (
    <>
      <Modalenter
        show={showenter}
        setShow={setShowenter}
        clave={clave}
        correo={correo}
      />

      <Modal
        open={show}
        centered
        closable={!loading}
        maskClosable={!loading}
        onCancel={() => !loading && setShow(false)}
        width={520}
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
              <LockOutlined style={{ fontSize: 18 }} />
            </div>

            <div>
              <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
                Recuperación de contraseña
              </Title>
              <Text type="secondary">
                Ingresa el correo asociado a tu cuenta para continuar.
              </Text>
            </div>
          </Space>
        </div>

        <div style={{ padding: "18px 22px 22px" }}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item
              label="Correo electrónico"
              name="email"
              rules={[
                { required: true, message: "El correo es obligatorio." },
                { type: "email", message: "Escribe un correo válido." },
              ]}
              style={{ marginBottom: 14 }}
            >
              <Input
                ref={inputRef}
                size="large"
                prefix={<MailOutlined />}
                placeholder="tu_correo@dominio.com"
                maxLength={100}
                autoFocus
                disabled={loading}
                onChange={(e) => setCorreo(e.target.value)}
                onPressEnter={submit}
                style={{
                  borderRadius: 12,
                  background: "rgba(30, 58, 138, .04)",
                  border: "1px solid rgba(0,0,0,.10)",
                }}
              />
            </Form.Item>

            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button
                onClick={() => setShow(false)}
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
                Enviar
              </Button>
            </Space>

            <div style={{ marginTop: 14 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Si no recuerdas tu correo, contacta al administrador del sistema.
              </Text>
            </div>
          </Form>
        </div>
      </Modal>
    </>
  );
}

export default Home;
