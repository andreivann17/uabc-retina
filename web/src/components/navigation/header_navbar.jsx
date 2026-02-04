import React, { useState, useEffect, useMemo } from "react";
import {
  Layout,
  Popover,
  Button,
  Typography,
  Dropdown,
} from "antd";
import "../../assets/css/header.css";
import { connect } from "react-redux";
import logo from "./../../assets/img/logo2.png";
import { useNavigate, useLocation } from "react-router-dom";
import { LogoutOutlined, ToolFilled } from "@ant-design/icons";
import { actionMateriasGet } from "../../redux/actions/materias/materias";

const { Header } = Layout;
const { Text } = Typography;

// Traduce segmentos de la URL a texto legible
const normalizeSegment = (seg) => {
  if (seg === "home") return "Home";
  if (seg === "materias") return "Materias";
  if (seg === "materia") return "Materia";
  if (seg === "laboral") return "Materia laboral";
  if (seg === "centro-conciliacion") return "Centro de conciliación";
  if (seg === "agenda") return "Agenda";
  if (seg === "empresas") return "Empresas";
  if (seg === "catalogos") return "Catálogos";

  // id numérico → expediente
  if (/^\d+$/.test(seg)) return `Expediente ${seg}`;

  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const Headercomp = ({ materias, actionMateriasGet }) => {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (actionMateriasGet) {
      actionMateriasGet();
    }
  }, [actionMateriasGet]);

  const onClose = () => setOpen(false);
  const showDrawer = () => setOpen(true);
  const handleVisibleChange = (v) => setVisible(v);

  // ---------- TÍTULO DINÁMICO SEGÚN URL ----------
  const pageTitle = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "Panel principal";

    if (segments[0] === "materias" && segments[1] === "laboral") {
      return "Materia laboral";
    }

    let last = segments[segments.length - 1];
    if (/^\d+$/.test(last) && segments.length > 1) {
      last = segments[segments.length - 2];
    }

    return normalizeSegment(last);
  }, [location.pathname]);

  // ---------- ESTADO ACTIVO EN NAV ----------
  const pathname = location.pathname || "/";

  const isMateriaActive =
    pathname.startsWith("/materias") || pathname.startsWith("/materia");
  const isAgendaActive = pathname.startsWith("/agenda");
  const isEmpresasActive = pathname.startsWith("/empresas");
  const isCatalogosActive = pathname.startsWith("/catalogos");
  const isHomeActive = pathname.startsWith("/home");

  // ---------- DROPDOWN MATERIA ----------
  const materiasList = Array.isArray(materias?.items) ? materias.items : [];


  const materiaMenuItems = materiasList.map((m) => ({
    key: m.id,
    label: (
      <span
        onClick={() => {
          navigate(`/materia/${m.id}`);
        }}
      >
        {m.nombre}
      </span>
    ),
  }));

  
  return (
    <>
      <div
        className="d-flex align-items-center img_logo_home"
        style={{
          width: "100%",
          position: "fixed",
          top: 44,
          zIndex: "100",
          background: "#0b1b2b",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{ paddingLeft: "40px", paddingRight: "30px" }}
          className="d-flex justify-content-between align-items-center w-100"
        >
          {/* IZQUIERDA: TÍTULO ACTUAL */}
          <div
            className="d-flex align-items-center text-light"
            style={{ marginBottom: "3px" }}
          >
            <span className="header-page-title">{pageTitle}</span>
          </div>

          {/* DERECHA: MATERIA (DROPDOWN) + LINKS */}
          <div
            className="d-flex align-items-center text-light"
            style={{ marginBottom: "5px" }}
          >
         
              <a
              style={{ cursor: "pointer",marginRight:10}}
              className={`styled-link nav-link text-light ${
                isHomeActive ? "nav-link--active" : ""
              }`}
              onClick={() => navigate("/home")}
            >
              Inicio
            </a>
            <a
              style={{ cursor: "pointer",marginRight:10}}
              className={`styled-link nav-link text-light ${
                isMateriaActive ? "nav-link--active" : ""
              }`}
              onClick={() => navigate("/materias")}
            >
              Materia
            </a>
            <a
              style={{ cursor: "pointer",marginRight:10}}
              className={`styled-link nav-link text-light ${
                isAgendaActive ? "nav-link--active" : ""
              }`}
              onClick={() => navigate("/agenda")}
            >
              Agenda
            </a>

            <a
              style={{ cursor: "pointer",marginRight:10}}
              className={`styled-link nav-link text-light ${
                isEmpresasActive ? "nav-link--active" : ""
              }`}
          
            >
              Empresas
            </a>

            <a
              style={{ cursor: "pointer",marginRight:10}}
              className={`styled-link nav-link text-light ${
                isCatalogosActive ? "nav-link--active" : ""
              }`}
             
            >
              Catalogos
            </a>
          </div>
        </div>
      </div>

      {/* Estilos de animación y dropdown adaptados al sistema */}
      <style>
        {`
.header-page-title {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #ffffff;
}

/* Links de navegación superiores */
.nav-link {
  position: relative;
  display: inline-block;
  padding: 0 12px;
  font-size: 13px;
  text-decoration: none;          /* sin underline blanco */
}

/* evitar subrayado por defecto en hover/focus */
.nav-link:hover,
.nav-link:focus,
.nav-link:active {
  text-decoration: none;
}

/* Línea animada amarilla abajo */
.nav-link::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -3px;
  height: 2px;
  width: 0;
  background-color: #ffd400;
  transition: width 0.18s ease-out;
}

/* Hover: subrayado suave */
.nav-link:hover::after {
  width: 100%;
}

/* Activo: subrayado permanente */
.nav-link--active::after {
  width: 100%;
}

/* Opcional: énfasis en el activo */
.nav-link--active {
  font-weight: 600;
}

/* Dropdown de Materia adaptado al tema oscuro del header */
.header-materia-menu {
  background-color: #102a43;
  border-radius: 10px;
  padding: 4px 0;
  min-width: 180px;
}

.header-materia-menu .ant-dropdown-menu-item {
  color: #f5f7fa;
  font-size: 13px;
}

.header-materia-menu .ant-dropdown-menu-item:hover {
  background-color: #173a5e;
  color: #ffd400;
}
        `}
      </style>
    </>
  );
};

const mapStateToProps = (state) => ({
  materias: state.materias?.data ?? { items: [], count: 0 },
});

export default connect(mapStateToProps, { actionMateriasGet })(Headercomp);
