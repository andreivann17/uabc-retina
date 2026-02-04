// ElectronView.jsx — Header de 2 niveles para Electron
import React, { useEffect, useState } from "react";
import { Button, Popover, Space, Drawer, Typography } from "antd";
import logoPng from "./assets/img/logo.png";
import "./styles.css";

export default function ElectronView({ hideUserPopover }) {

  const [userOpen, setUserOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hideUserPopover && userOpen) setUserOpen(false);
  }, [hideUserPopover, userOpen]);

  useEffect(() => {
    if (!token && userOpen) setUserOpen(false);
  }, [token, userOpen]);

  return (
    <>
      <div className="electron-header">
        <div className="eh-row eh-top">
          <div className="eh-left">
            <img src={logoPng} alt="Logo" className="eh-logo" />
           UABC Retina
          </div>

          <div className="eh-right electron-no-drag">
        

            <div className="win-controls">
              <button
                className="electron-btn"
                title="Minimizar"
                onClick={() => window.electronAPI?.minimize?.()}
              >
                🗕
              </button>
              <button
                className="electron-btn"
                title="Maximizar/Restaurar"
                onClick={() => window.electronAPI?.maximize?.()}
              >
                🗖
              </button>
              <button
                className="electron-btn electron-btn-close"
                title="Cerrar"
                onClick={() => window.electronAPI?.close?.()}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      <Drawer title="Settings" onClose={() => setSettingsOpen(false)} open={settingsOpen}>
        <p>Configuración…</p>
      </Drawer>
    </>
  );
}
