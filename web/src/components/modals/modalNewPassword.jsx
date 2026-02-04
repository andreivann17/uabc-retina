import React, { useRef, useState } from "react";
import {
  Modal,
  Button,
  Form,
  Typography,
  Space,
  notification,
  Input,
} from "antd";
import {
  LockOutlined,
  SafetyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useDispatch } from "react-redux";

import { actionNewPassword } from "../../redux/actions/login/login";
import Toast from "../toasts/toast";

const { Title, Text } = Typography;

function Home({ show, setShow, correo, code }) {
  const [loading, setLoading] = useState(false);
  const [showtoast, setShowToast] = useState(false);
  const [msg, setMsg] = useState("");

  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const inputRef = useRef(null);
  const inputRef2 = useRef(null);

  const close = () => {
    if (loading) return;
    setShow(false);
  };

  const submit = async () => {
    try {
      const { newPassword, confirmPassword } = await form.validateFields();

      if (newPassword !== confirmPassword) {
        notification.error({
          message: "Las contraseñas no coinciden",
          description: "Verifica que ambas contraseñas sean iguales.",
          placement: "top",
        });
        return;
      }

      if (!correo || !code) {
        notification.error({
          message: "Información incompleta",
          description: "Falta el correo o el código de verificación.",
          placement: "top",
        });
        return;
      }

      setLoading(true);

      dispatch(
        actionNewPassword(
          {
            email: correo,
            code: code,
            password: newPassword,
          },
          () => {
            setLoading(false);
            setShow(false);
            setMsg("Tu contraseña fue actualizada correctamente.");
            setShowToast(true);
            form.resetFields();
          },
          (err) => {
            setLoading(false);
            notification.error({
              message: "No se pudo actualizar",
              description:
                typeof err === "string"
                  ? err
                  : "Ocurrió un error al actualizar la contraseña.",
              placement: "top",
            });
          }
        )
      );
    } catch {
      // validación del form
    }
  };

  return (
    <>
      <Toast show={showtoast} msg={msg} setShow={setShowToast} />

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
                Crear nueva contraseña
              </Title>
              <Text type="secondary">
                Define una nueva contraseña para tu cuenta.
              </Text>

              <div style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 12, color: "rgba(0,0,0,.55)" }}>
                  Correo: <b>{correo || "-"}</b>
                </Text>
              </div>
            </div>
          </Space>
        </div>

        <div style={{ padding: "18px 22px 22px" }}>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              label="Nueva contraseña"
              name="newPassword"
              rules={[
                { required: true, message: "La contraseña es obligatoria." },
                { max: 15, message: "La contraseña no puede exceder 15 caracteres." },
                { min: 6, message: "Usa al menos 6 caracteres." },
              ]}
              style={{ marginBottom: 14 }}
            >
              <Input.Password
                ref={inputRef}
                size="large"
                prefix={<LockOutlined />}
                placeholder="Nueva contraseña"
                maxLength={15}
                autoFocus
                disabled={loading}
                onPressEnter={() => inputRef2.current?.focus()}
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
                style={{
                  borderRadius: 12,
                  background: "rgba(30, 58, 138, .04)",
                  border: "1px solid rgba(0,0,0,.10)",
                }}
              />
            </Form.Item>

            <Form.Item
              label="Confirmar contraseña"
              name="confirmPassword"
              rules={[
                { required: true, message: "Confirma la contraseña." },
                { max: 15, message: "La contraseña no puede exceder 15 caracteres." },
                { min: 6, message: "Usa al menos 6 caracteres." },
              ]}
              style={{ marginBottom: 14 }}
            >
              <Input.Password
                ref={inputRef2}
                size="large"
                prefix={<LockOutlined />}
                placeholder="Repite la contraseña"
                maxLength={15}
                disabled={loading}
                onPressEnter={submit}
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
                style={{
                  borderRadius: 12,
                  background: "rgba(30, 58, 138, .04)",
                  border: "1px solid rgba(0,0,0,.10)",
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
                Guardar
              </Button>
            </Space>

            <div style={{ marginTop: 14 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Recomendación: usa una contraseña única. Evita reutilizar contraseñas anteriores.
              </Text>
            </div>
          </Form>
        </div>
      </Modal>
    </>
  );
}

export default Home;
