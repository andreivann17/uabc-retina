import React, { useEffect, useMemo, useState } from "react";
import { Modal, Tabs, Descriptions, Tag, Space, Button, Typography, Spin, Alert } from "antd";
import { DownloadOutlined, FilePdfOutlined } from "@ant-design/icons";
import { actionExpedienteGetById, actionExpedienteGetPdfBlob } from "../../../redux/actions/expedientes/expedientes";

const { Text } = Typography;

const tipoExpMap = { 1: "Convenios", 2: "Diferimiento", 3: "Archivo por Incomparecencia", 4: "No conciliación" };
const statusTagColor = (status) => {
  switch (status) { case "CONCLUIDO": return "success"; case "REVISAR": return "processing"; case "RIESGO": return "error"; case "NEGOCIAR": return "warning"; default: return "default"; }
};

export default function ViewExpedienteModal({ open, onClose, expedienteId }) {
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [row, setRow] = useState(null);
  const [activeKey, setActiveKey] = useState("info");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  useEffect(() => {
    if (!open || !expedienteId) return;
    (async () => {
      try {
        setLoadingInfo(true);
        const data = await actionExpedienteGetById(expedienteId)();
        setRow(data);
      } finally { setLoadingInfo(false); }
    })();
  }, [open, expedienteId]);

  useEffect(() => {
    if (!open || activeKey !== "pdf" || !expedienteId) return;
    (async () => {
      try {
        setPdfLoading(true); setPdfError(null);
        if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
        const blob = await actionExpedienteGetPdfBlob(expedienteId);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (e) {
        setPdfError(e?.response?.data?.detail || e?.message || "No se pudo cargar el PDF");
      } finally { setPdfLoading(false); }
    })();
  }, [open, activeKey, expedienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const infoItems = useMemo(() => {
    const r = row || {};
    return (
      <Descriptions bordered column={1} size="small" labelStyle={{ width: 220, fontWeight: 600 }}>
        <Descriptions.Item label="Expediente">{r.exp}</Descriptions.Item>
        <Descriptions.Item label="Año">{r.anio}</Descriptions.Item>
        <Descriptions.Item label="Tipo de Expediente">{tipoExpMap[r.id_tipo_expediente] || r.id_tipo_expediente}</Descriptions.Item>
        <Descriptions.Item label="Actor">{r.actor}</Descriptions.Item>
        <Descriptions.Item label="Autoridad">{r.autoridad || "-"}</Descriptions.Item>
        <Descriptions.Item label="Empresa">{r.empresa_nombre}</Descriptions.Item>
        <Descriptions.Item label="Razón social">{r.razon_social_nombre || "-"}</Descriptions.Item>
        <Descriptions.Item label="Específico">{r.especifico || "-"}</Descriptions.Item>
        <Descriptions.Item label="Responsable">{r.abogado || "-"}</Descriptions.Item>
        <Descriptions.Item label="Ciudad">{r.ciudad || "-"}</Descriptions.Item>
        <Descriptions.Item label="Status">{r.status ? <Tag color={statusTagColor(r.status)}>{r.status}</Tag> : "-"}</Descriptions.Item>
        <Descriptions.Item label="Código">{r.code || "-"}</Descriptions.Item>
        <Descriptions.Item label="Fecha de registro">{r.datetime ? String(r.datetime).replace("T", " ") : "-"}</Descriptions.Item>
        <Descriptions.Item label="Cargado desde Excel">{Number(r.excel) === 1 ? "Sí" : "No"}</Descriptions.Item>
        <Descriptions.Item label="IP">{r.ip || "-"}</Descriptions.Item>
        <Descriptions.Item label="Lugar">{r.lugar || "-"}</Descriptions.Item>
      </Descriptions>
    );
  }, [row]);

  const pdfTabContent = () => {
    if (pdfLoading) return <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>;
    if (pdfError) return <Alert type="error" showIcon message={pdfError} style={{ margin: 12 }} />;
    if (!pdfUrl) return <div style={{ padding: 24 }}><Text type="secondary">No hay PDF disponible o aún no se ha cargado.</Text></div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 0" }}>
          <a href={pdfUrl} download={`expediente_${expedienteId}.pdf`}><Button icon={<DownloadOutlined />}>Descargar PDF</Button></a>
        </div>
        <iframe title="pdf-expediente" src={pdfUrl} style={{ width: "100%", height: "70vh", border: "1px solid #eee", borderRadius: 8 }} />
      </div>
    );
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={900} destroyOnClose
      title={<Space><FilePdfOutlined /><span>Ver expediente</span></Space>}>
      {loadingInfo ? <div style={{ padding: 24, textAlign: "center" }}><Spin /></div> :
        <Tabs activeKey={activeKey} onChange={setActiveKey}
          items={[{ key: "info", label: "Información", children: <div style={{ paddingTop: 8 }}>{infoItems}</div> },
                  { key: "pdf", label: "PDF", children: pdfTabContent() }]} />}
    </Modal>
  );
}
