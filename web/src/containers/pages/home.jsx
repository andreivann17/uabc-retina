// src/pages/Home.jsx
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { notification } from "antd";

import "../../assets/css/home.css";
import uabcLogo from "../../assets/img/logo.png";
import ieeeLogo from "../../assets/img/visum_2.png";
import FIMLogo from "../../assets/img/fim2.png";

function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  const [api, contextHolder] = notification.useNotification();

  // Forzar modo dark como en el HTML original
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  // NOTIFICATIONS por state (success / error)
  useEffect(() => {
    const st = location?.state || null;
    console.log("STATE EN HOME:", st);
    if (!st) return;

    // Error desde RetinaAnalysisProgress
    if (st.homeError) {
      api.error({
        message: "Diagnóstico falló",
        description: st.homeError,
        placement: "topRight",
        duration: 6,
      });

      // limpiar state para que no se repita
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    // Success con resultados
    
    if (st.apiMeta) {
      api.success({
        message: "Diagnóstico completado",
        description: "Resultados cargados correctamente.",
        placement: "topRight",
        duration: 4,
      });

      // limpiar state para que no se repita
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
  }, [location, api, navigate]);

  const onSelectFiles = () => {
    const input = document.getElementById("uabc-file-input");
    if (input) input.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    navigate("/retina/progress", {
      state: { file, imageUrl },
    });

    e.target.value = "";
  };

  return (
    <main className="uabc-dark-root">
      {contextHolder}

      {/* Light leaks */}
      <div className="light-leak-tl" />
      <div className="light-leak-br" />

      <section className="uabc-center">
        <header className="uabc-header">
          <div className="uabc-logosRow">
            <img className="uabc-logo" src={uabcLogo} alt="UABC" />
            <div className="uabc-logosDivider" />
             <img className="uabc-logo" src={FIMLogo} alt="FIM" />
            <div className="uabc-logosDivider" />
            <img className="uabc-logo" src={ieeeLogo} alt="IEEE" />
          </div>

          <h1 className="uabc-title">Retinopatía Diabética</h1>

          <p className="uabc-desc">
            Sube una imagen de retina para obtener un análisis automático y un resumen clínico de hallazgos.
          </p>

          <p className="uabc-subtitle">Proyecto en conjunto: UABC x VISUM Clínica</p>
        </header>

        <div className="uabc-upload-wrapper">
          <button className="upload-glass" onClick={onSelectFiles} type="button">
            <div className="upload-icon-wrapper">
              <span className="material-symbols-outlined upload-icon">visibility</span>
              <div className="upload-icon-glow" />
            </div>

            <h2 className="upload-title">Cargar Imágenes de Retina</h2>

            <p className="upload-hint">
              Arrastra y suelta tus archivos aquí o haz clic para explorar los registros clínicos.
            </p>

            <div className="upload-features">
              <div className="upload-feature">
                <span className="material-symbols-outlined">image</span>
                <span>JPG / PNG</span>
              </div>
              <div className="upload-feature">
                <span className="material-symbols-outlined">bolt</span>
                <span>Respuesta rápida</span>
              </div>
              <div className="upload-feature">
                <span className="material-symbols-outlined">encrypted</span>
                <span>Transmisión segura</span>
              </div>
            </div>

            <div className="upload-dots">
              <span />
              <span />
              <span />
            </div>
          </button>

          <input
            id="uabc-file-input"
            type="file"
            accept="image/png,image/jpeg"
            onChange={onFileChange}
            hidden
          />
        </div>

        <div className="uabc-examples">
          <a href="#" onClick={(e) => e.preventDefault()}>
            ¿No tienes imágenes? Ver ejemplos
          </a>
        </div>

  
      </section>
    </main>
  );
}

export default Home;
