import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../assets/css/RetinaAnalysisProgress.css";

export default function RetinaAnalysisProgress() {
  const navigate = useNavigate();
  const location = useLocation();

  const file = location?.state?.file || null;
  const imageUrlFromState = location?.state?.imageUrl || "";

  const objectUrlRef = useRef("");

  // Forzar dark mode como en el HTML original
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  // Validación dura
  useEffect(() => {
    if (!file && !imageUrlFromState) {
      navigate("/home", { replace: true });
    }
  }, [file, imageUrlFromState, navigate]);

  const imageUrl = useMemo(() => {
    if (imageUrlFromState) return imageUrlFromState;
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      return url;
    }
    return "";
  }, [file, imageUrlFromState]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function callDiagnosticAPI(file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(
      `http://${window.location.hostname}:8000/diagnostic/`,
      { method: "POST", body: fd }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || `HTTP ${res.status}`);
    }

    return await res.json();
  }

  // Delay visual + backend
  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          if (!file) throw new Error("No file provided");

          const api = await callDiagnosticAPI(file);

          navigate("/home", {
            replace: true,
            state: {
              file,
              imageUrl,
              apiResults: api.results,
              apiMeta: api.meta,
            },
          });
        } catch (err) {
          navigate("/home", {
            replace: true,
            state: {
              homeError: `Error backend diagnostic: ${err?.message || err}`,
            },
          });
        }
      })();
    }, 900);

    return () => clearTimeout(t);
  }, [navigate, file, imageUrl]);

  return (
    <main className="ra-dark-root">
      <div className="light-leak-tl" />
      <div className="light-leak-br" />

      <section className="ra-center">
        <header className="ra-header">
          <h1 className="ra-title">
            Retinopatía Diabética Detección
          </h1>
          <p className="ra-subtitle">
            UABC x VISUM Clínica
          </p>
        </header>

        {/* CORE VISUAL */}
        <div className="retina-container">
          <div className="retina-core" />
          <div className="glow-ring" />
          <div className="glow-ring ring-rev" />
          <div className="glow-ring ring-soft" />

          <div className="retina-center">
            <div className="retina-eye">
              <span className="material-symbols-outlined eye-icon">
                adjust
              </span>
              <div className="eye-glow" />
            </div>
          </div>

          {/* particles */}
          <span className="particle p1" />
          <span className="particle p2" />
          <span className="particle p3" />
          <span className="particle p4" />

          {/* neural paths */}
          <svg className="neural-svg" viewBox="0 0 100 100">
            <path d="M50 50 Q70 20 90 50" />
            <path d="M50 50 Q30 80 10 50" />
            <path d="M50 50 Q80 80 50 90" />
            <path d="M50 50 Q20 20 50 10" />
          </svg>
        </div>

        <div className="ra-status">
          <div className="ra-status-row">
            <span className="dot-ping" />
            <p className="ra-status-text">
              Analizando biomarcadores...
            </p>
          </div>

          <p className="ra-status-sub">
            Sincronizando visión con redes neuronales clínicas
          </p>
        </div>

        <div className="ra-divider">
          <span />
        </div>

        <footer className="ra-footer">
          <div className="ra-footer-inner">
            <span>Secure Data Analysis</span>
            <span className="footer-dot" />
            <span>Visum Neural Core v2.0</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
