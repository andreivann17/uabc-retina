// src/pages/retina/RetinaDiagnosticResults.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../assets/css/RetinaDiagnosticResults.css";

const API_BASE = "http://localhost:8000";
const UPLOADS_PATH = "/backend/uploads/detections";

export default function RetinaDiagnosticResults() {
  const navigate = useNavigate();
  const location = useLocation();

  // -------------------------------------------------
  // State inicial desde navigation state
  // -------------------------------------------------
  const apiResultsFromState = location?.state?.apiResults || null;
  const apiMetaFromState = location?.state?.apiMeta || null;

  const retinaFromState = location?.state?.retina || null;
  const diseaseFromState = location?.state?.disease || null;
  const stageFromState = location?.state?.stage || null;
  const biomarkersFromState = location?.state?.biomarkers || null;

  const file = location?.state?.file || null;
  const imageUrlFromState = location?.state?.imageUrl || "";
  const drPred = location?.state?.drPred || null;

  // -------------------------------------------------
  // WS state
  // -------------------------------------------------
  const [wsPayload, setWsPayload] = useState(null);

  // refs para WS
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // -------------------------------------------------
  // Dark mode (si lo usas en tu app)
  // -------------------------------------------------
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark")
  );

  // -------------------------------------------------
  // UI state (tabs de imagen)
  // -------------------------------------------------
  const [scanTab, setScanTab] = useState("original"); // original | heatmap | filtered

  // -------------------------------------------------
  // Utils
  // -------------------------------------------------
  const normalize = (s) => String(s || "").toLowerCase().trim();

  const toPct = (p01, decimals = 1) => {
    const n = Number(p01);
    if (!Number.isFinite(n)) return null;
    const pct = n * 100;
    const pow = Math.pow(10, decimals);
    return Math.round(pct * pow) / pow;
  };

  const clampPct = (pct) => {
    const n = Number(pct);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };

  const firstFinite = (...vals) => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  // -------------------------------------------------
  // Imagen (blob o backend static)
  // -------------------------------------------------
  const imageUrl = useMemo(() => {
    if (imageUrlFromState) return imageUrlFromState;
    if (file) return URL.createObjectURL(file);
    return "";
  }, [file, imageUrlFromState]);

  // -------------------------------------------------
  // Datos a renderizar:
  // prioridad WS > state navigation
  // -------------------------------------------------
  const apiResults = useMemo(() => {
    const fromWs = wsPayload?.results_diabetic || null;
    return fromWs || apiResultsFromState || null;
  }, [wsPayload, apiResultsFromState]);

  const apiMeta = useMemo(() => {
    return wsPayload?.meta || apiMetaFromState || null;
  }, [wsPayload, apiMetaFromState]);

  const retina = useMemo(() => {
    const r = wsPayload?.results_retina || null;
    if (!r) return retinaFromState || null;

    const probs = Array.isArray(r.vector_probs) ? r.vector_probs : [];
    const idx = Number(r.summary?.[1] ?? 0);
    const conf = probs[idx] != null ? probs[idx] : null;

    return {
      label: r.predicted_label ?? "",
      confidencePct: conf != null ? toPct(conf, 1) : null,
    };
  }, [wsPayload, retinaFromState]);

  const disease = useMemo(() => {
    const d = wsPayload?.results_diabetic || null;
    if (!d) return diseaseFromState || null;

    const probs = Array.isArray(d.vector_probs) ? d.vector_probs : [];
    const idx = Number(d.summary?.[1] ?? 0);
    const conf = probs[idx] != null ? probs[idx] : null;

    return {
      label: d.predicted_label ?? "",
      confidencePct: conf != null ? toPct(conf, 1) : null,
    };
  }, [wsPayload, diseaseFromState]);

  const stage = useMemo(() => {
    const s = wsPayload?.results_stages || null;
    if (!s) return stageFromState || null;

    const probs = Array.isArray(s.vector_probs) ? s.vector_probs : [];

    let bestIdx = 0;
    if (Array.isArray(s.summary) && s.summary.length >= 2) {
      bestIdx = Number(s.summary?.[1] ?? 0);
    } else if (probs.length) {
      let mx = -Infinity;
      for (let i = 0; i < probs.length; i++) {
        if (probs[i] > mx) {
          mx = probs[i];
          bestIdx = i;
        }
      }
    }
    const conf = probs[bestIdx] != null ? probs[bestIdx] : null;

    return {
      label: s.predicted_label ?? "",
      confidencePct: conf != null ? toPct(conf, 1) : null,
    };
  }, [wsPayload, stageFromState]);

  const biomarkers = useMemo(() => {
    const b = wsPayload?.results_biomarkers || null;
    if (!b) return biomarkersFromState || null;

    if (Array.isArray(b.hits)) return b;

    const probs = Array.isArray(b.vector_probs) ? b.vector_probs : [];
    const labels = b.labels || {};
    const hits = [];

    for (let i = 0; i < probs.length; i++) {
      const p = Number(probs[i]);
      if (Number.isFinite(p) && p >= 0.5) {
        hits.push({
          idx: i,
          label: labels[i] ?? String(i),
          confidencePct: toPct(p, 1),
        });
      }
    }

    return { ...b, hits };
  }, [wsPayload, biomarkersFromState]);

  // -------------------------------------------------
  // Stage bars (usar datos reales)
  // -------------------------------------------------
  const stageBars = useMemo(() => {
    const s = wsPayload?.results_stages;
    if (!s) return null;

    const probs = Array.isArray(s.vector_probs) ? s.vector_probs : [];
    const labels = s.labels || {};

    const pairs = probs.map((p, i) => ({
      label: labels[i] ?? String(i),
      prob: Number(p) || 0,
    }));

    const pick = (key) => {
      const k = normalize(key);
      let found = pairs.find((x) => normalize(x.label).includes(k));
      if (!found) found = { label: key, prob: 0 };
      return {
        label: key,
        pct: clampPct(toPct(found.prob, 1) ?? 0),
      };
    };

    return {
      mild: pick("mild"),
      moderate: pick("moderate"),
      severe: pick("severe"),
      proliferative: pick("proliferative"),
    };
  }, [wsPayload]);

  // -------------------------------------------------
  // Biomarker cards (color + valores reales)
  // -------------------------------------------------
  const biomarkerCards = useMemo(() => {
    const b = biomarkers;
    if (!b) return null;

    const hits = Array.isArray(b.hits) ? b.hits : [];

    const findHit = (needle) => {
      const n = normalize(needle);
      return hits.find((x) => normalize(x.label).includes(n)) || null;
    };

    const micro = findHit("micro");
    const hemo = findHit("hemorr") || findHit("haemorr");

    const hardExu =
      (findHit("hard") && findHit("exud") ? findHit("hard") : null) ||
      findHit("hard exud") ||
      findHit("hard_exud");

    const softExu =
      (findHit("soft") && findHit("exud") ? findHit("soft") : null) ||
      findHit("soft exud") ||
      findHit("soft_exud");

    const exuGeneric = findHit("exud"); // fallback
    const exu = hardExu || exuGeneric;
    const soft = softExu;

    const fmtPct = (hit) => {
      const v = firstFinite(hit?.confidencePct, hit?.score, hit?.prob);
      if (v == null) return null;
      if (v > 1.0001) return Math.round(v * 10) / 10;
      return toPct(v, 1);
    };

    const cardValue = (hit) => {
      const pct = fmtPct(hit);
      return pct == null ? null : `${pct}%`;
    };

    const detectedText = (hit) => {
      const v = cardValue(hit);
      if (!hit || v == null) return { title: "Not Found", value: "" };
      return { title: "Detected", value: v };
    };

    return {
      microaneurysms: detectedText(micro),
      hemorrhages: detectedText(hemo),
      hard_exudates: detectedText(exu),
      soft_exudates: detectedText(soft),
      total: hits.length,
      hits,
    };
  }, [biomarkers]);

  // -------------------------------------------------
  // Imagen servidor (si no hay blob)
  // -------------------------------------------------
  const serverImageUrl = useMemo(() => {
    const fn =
      wsPayload?.meta?.filename ||
      apiMeta?.filename ||
      apiResults?.filename ||
      "";
    if (!fn) return "";
    return `${API_BASE}${UPLOADS_PATH}/${fn}`;
  }, [wsPayload, apiMeta, apiResults]);

  const finalImageUrl = useMemo(() => {
    if (imageUrl) return imageUrl;
    if (serverImageUrl) return serverImageUrl;
    return "";
  }, [imageUrl, serverImageUrl]);

  // -------------------------------------------------
  // WebSocket: conectar a /ws/detections
  // -------------------------------------------------
  const connectWS = useCallback(() => {
    const url = "ws://localhost:8000/ws/detections";
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: "HELLO", page: "detections" }));
      } catch {}
    };

    ws.onmessage = (ev) => {
      let msg = ev.data;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg?.type === "DIAGNOSTIC_RESULT" && msg?.payload) {
        setWsPayload(msg.payload);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };

    ws.onclose = () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connectWS();
      }, 1000);
    };
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {}
      }
      wsRef.current = null;
    };
  }, [connectWS]);

  // limpiar blob URL
  useEffect(() => {
    return () => {
      if (imageUrlFromState && String(imageUrlFromState).startsWith("blob:")) {
        URL.revokeObjectURL(imageUrlFromState);
      }
    };
  }, [imageUrlFromState]);

  const onToggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(document.documentElement.classList.contains("dark"));
  };

  // -------------------------------------------------
  // UI Helpers
  // -------------------------------------------------
  const SummaryLine = ({ label, value }) => {
    if (value == null || value === "" || value === "--") return null;
    return (
      <div className="rr-detailRow">
        <span className="rr-detailKey">{label}</span>
        <span className="rr-detailVal">{value}</span>
      </div>
    );
  };

  const BarRow = ({ name, pct, fillClass, emphasize = false }) => {
    const p = clampPct(pct ?? 0);
    return (
      <div className="rr-barRow">
        <div className={`rr-barTop ${emphasize ? "rr-barTopHot" : ""}`}>
          <span className={`rr-barName ${emphasize ? "rr-barNameHot" : ""}`}>
            {name}
          </span>
          <span className={`rr-barPct ${emphasize ? "rr-barPctHot" : ""}`}>
            {p}%
          </span>
        </div>
        <div className="rr-barTrack">
          <div className={`rr-barFill ${fillClass}`} style={{ width: `${p}%` }} />
        </div>
      </div>
    );
  };

  // -------------------------------------------------
  // Valores top summary (título + meta como tu screenshot)
  // -------------------------------------------------
  const topTitle = useMemo(() => {
    const st = stage?.label || "";
    if (!st) return "Diagnostic Summary";
    return `${st} DR`;
  }, [stage]);

  const topPredicted = useMemo(() => {
    const a = apiResults?.predicted_label;
    const d = disease?.label;
    return a || d || "";
  }, [apiResults, disease]);

  const topDevice = useMemo(() => {
    return apiResults?.device || apiMeta?.device || "CPU";
  }, [apiResults, apiMeta]);

  const topTimeMs = useMemo(() => {
    const t = apiResults?.time_inference ?? apiMeta?.time_inference ?? null;
    if (t == null) return "";
    const n = Number(t);
    if (!Number.isFinite(n)) return String(t);
    const fixed = n % 1 !== 0 ? Math.round(n * 100) / 100 : n;
    return `${fixed} ms`;
  }, [apiResults, apiMeta]);

  const scanImgSrc = useMemo(() => {
    // Si luego tienes urls reales para heatmap/filtered, cámbialas aquí.
    if (scanTab === "original") return finalImageUrl;
    if (scanTab === "heatmap") return finalImageUrl;
    if (scanTab === "filtered") return finalImageUrl;
    return finalImageUrl;
  }, [scanTab, finalImageUrl]);

  // -------------------------------------------------
  // Render
  // -------------------------------------------------
  return (
    <div className="rr-page">
      <div className="rr-shell">
        <header className="rr-header glass-panel">
          <div className="rr-headerLeft">
            <div className="rr-kicker">Diagnostic Summary</div>
            <div className="rr-title">{topTitle}</div>

            <div className="rr-submeta">
              {topPredicted ? (
                <>
                  Predicted: <span className="rr-submetaStrong">{topPredicted}</span>
                </>
              ) : null}
              {topDevice ? (
                <>
                  {topPredicted ? <span className="rr-dot">•</span> : null}
                  Device: <span className="rr-submetaStrong">{topDevice}</span>
                </>
              ) : null}
              {topTimeMs ? (
                <>
                  {(topPredicted || topDevice) ? <span className="rr-dot">•</span> : null}
                  Time: <span className="rr-submetaStrong">{topTimeMs}</span>
                </>
              ) : null}
            </div>

            {drPred ? (
              <div className="rr-submeta rr-submeta2">
                Result: <span className="rr-submetaStrong">{drPred.label}</span>
                <span className="rr-dot">•</span>
                Confidence:{" "}
                <span className="rr-submetaStrong">{drPred.confidencePct}%</span>
              </div>
            ) : null}
          </div>

          <div className="rr-headerRight">
            <button className="rr-btn rr-btnGhost" type="button">
              <span className="material-symbols-outlined rr-ic">picture_as_pdf</span>
              Export PDF
            </button>

            <button className="rr-btn rr-btnPrimary" type="button">
              <span className="material-symbols-outlined rr-ic">share</span>
              Share Report
            </button>

            <button
              className="rr-btn rr-btnIconOnly"
              type="button"
              aria-label="Toggle theme"
              onClick={onToggleDark}
              title={isDark ? "Dark" : "Light"}
            >
              <span className="material-symbols-outlined rr-ic">contrast</span>
            </button>
          </div>
        </header>

        <div className="rr-grid">
          <main className="rr-mainCol">
            <section className="rr-card glass-panel rr-scan">
              <div className="rr-cardHead">
                <div className="rr-cardHeadLeft">Fundus Retinal Scan</div>

               
              </div>

              <div className="rr-scanBody">
                {scanImgSrc ? (
                  <>
                    <img className="rr-scanImg" alt="Retinal Fundus Scan" src={scanImgSrc} />
                    <div className="rr-scanRing" />
                  </>
                ) : (
                  <div className="rr-empty">
                    <div className="rr-emptyTitle">No image</div>
                   
                  </div>
                )}
              </div>
            </section>
          </main>

          <aside className="rr-sideCol">
            <section className="rr-card glass-panel">
              <div className="rr-cardTitleRow">
                <div className="rr-cardTitle">
                  <span className="material-symbols-outlined rr-icPrimary">assessment</span>
                  Progression Analysis
                </div>
              </div>

              <div className="rr-bars">
                <BarRow
                  name="Mild DR"
                  pct={stageBars?.mild?.pct ?? 0}
                  fillClass="rr-fillPrimary"
                />
                <BarRow
                  name="Moderate DR"
                  pct={stageBars?.moderate?.pct ?? 0}
                  fillClass="rr-fillPrimary"
                />
                <BarRow
                  name="Severe DR"
                  pct={stageBars?.severe?.pct ?? 0}
                  fillClass="rr-fillOrange"
                  emphasize
                />
                <BarRow
                  name="Proliferative DR"
                  pct={stageBars?.proliferative?.pct ?? 0}
                  fillClass="rr-fillRed"
                />
              </div>
            </section>

            <div className="rr-biomSectionHead">
              <div className="rr-cardTitle">
                <span className="material-symbols-outlined rr-icPrimary">biotech</span>
                Detected Biomarkers
              </div>
            </div>

            <section className="rr-biomGrid">
              <div className="rr-biomCard glass-panel rr-biomAmber">
                <div className="rr-biomIcon rr-icAmber">
                  <span className="material-symbols-outlined">bubble_chart</span>
                </div>
                <div className="rr-biomText">
                  <div className="rr-biomK">Hard Exudates</div>
                  <div className="rr-biomV">
                    {biomarkerCards?.hard_exudates?.title ?? "Not Found"}
                    {biomarkerCards?.hard_exudates?.value
                      ? ` ${biomarkerCards.hard_exudates.value}`
                      : ""}
                  </div>
                </div>
              </div>

              <div className="rr-biomCard glass-panel rr-biomRose">
                <div className="rr-biomIcon rr-icRose">
                  <span className="material-symbols-outlined">opacity</span>
                </div>
                <div className="rr-biomText">
                  <div className="rr-biomK">Hemorrhages</div>
                  <div className="rr-biomV">
                    {biomarkerCards?.hemorrhages?.title ?? "Not Found"}
                    {biomarkerCards?.hemorrhages?.value
                      ? ` ${biomarkerCards.hemorrhages.value}`
                      : ""}
                  </div>
                </div>
              </div>

              <div className="rr-biomCard glass-panel rr-biomOrange">
                <div className="rr-biomIcon rr-icOrange">
                  <span className="material-symbols-outlined">adjust</span>
                </div>
                <div className="rr-biomText">
                  <div className="rr-biomK">Microaneurysms</div>
                  <div className="rr-biomV">
                    {biomarkerCards?.microaneurysms?.title ?? "Not Found"}
                    {biomarkerCards?.microaneurysms?.value
                      ? ` ${biomarkerCards.microaneurysms.value}`
                      : ""}
                  </div>
                </div>
              </div>

              <div className="rr-biomCard glass-panel rr-biomEmerald">
                <div className="rr-biomIcon rr-icEmerald">
                  <span className="material-symbols-outlined">flare</span>
                </div>
                <div className="rr-biomText">
                  <div className="rr-biomK">Soft Exudates</div>
                  <div className="rr-biomV">
                    {biomarkerCards?.soft_exudates?.title ?? "Not Found"}
                    {biomarkerCards?.soft_exudates?.value
                      ? ` ${biomarkerCards.soft_exudates.value}`
                      : ""}
                  </div>
                </div>
              </div>
            </section>

            <section className="rr-card glass-panel">
              <div className="rr-cardTitleRow">
                <div className="rr-cardTitle">
                  <span className="material-symbols-outlined rr-icPrimary">
                    assignment
                  </span>
                  Details
                </div>
              </div>

              <div className="rr-details">
                <SummaryLine
                  label="Retina"
                  value={
                    retina?.label
                      ? `${retina.label}${
                          retina.confidencePct != null ? ` • ${retina.confidencePct}%` : ""
                        }`
                      : ""
                  }
                />
                <SummaryLine
                  label="Disease"
                  value={
                    disease?.label
                      ? `${disease.label}${
                          disease.confidencePct != null ? ` • ${disease.confidencePct}%` : ""
                        }`
                      : ""
                  }
                />
                <SummaryLine
                  label="Stage"
                  value={
                    stage?.label
                      ? `${stage.label}${
                          stage.confidencePct != null ? ` • ${stage.confidencePct}%` : ""
                        }`
                      : ""
                  }
                />
              </div>

              <div className="rr-divider" />

              <div className="rr-miniK">Biomarkers Distribution</div>

              <div className="rr-twoCol">
                <div className="rr-miniRow">
                  <span className="rr-miniKey">Microaneurysms</span>
                  <span className="rr-miniVal">
                    {biomarkerCards?.microaneurysms?.value || "--"}
                  </span>
                </div>
                <div className="rr-miniRow">
                  <span className="rr-miniKey">Hemorrhages</span>
                  <span className="rr-miniVal">
                    {biomarkerCards?.hemorrhages?.value || "--"}
                  </span>
                </div>
                <div className="rr-miniRow">
                  <span className="rr-miniKey">Hard Exudates</span>
                  <span className="rr-miniVal">
                    {biomarkerCards?.hard_exudates?.value || "--"}
                  </span>
                </div>
                <div className="rr-miniRow">
                  <span className="rr-miniKey">Soft Exudates</span>
                  <span className="rr-miniVal">
                    {biomarkerCards?.soft_exudates?.value || "--"}
                  </span>
                </div>
              </div>

              <div className="rr-divider" />

            
            </section>
          </aside>
        </div>

        <footer className="rr-footer">
          <div>© 2024 UABC RETINA • ADVANCED DIAGNOSTICS</div>
          <div>FOR CLINICAL PROFESSIONAL USE ONLY</div>
        </footer>
      </div>
    </div>
  );
}
