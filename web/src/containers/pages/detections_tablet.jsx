import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../assets/css/detections.css";
import { actionDetectionsCards } from "../../redux/actions/detections/detections";
import { useDispatch, useSelector } from "react-redux";
import { notification } from "antd";
/**
 * Ajusta esto a tu backend real:
 * - Si sirves uploads en /uploads/{filename}
 * - o en /static/uploads/{filename}
 */
const API_BASE = "http://localhost:8000";
const UPLOADS_PATH = "/backend/uploads/detections";

function Detection() {
  const dispatch = useDispatch();



const detectionsSlice = useSelector((state) => state.detections || {});
  const loading = Boolean(detectionsSlice?.loading);
const payload = detectionsSlice?.data || {};
const items = Array.isArray(payload?.items) ? payload.items : [];
const total = Number(payload?.total ?? items.length ?? 0);

// tu error viene como { error: "..." }
const error =
  detectionsSlice?.error?.error ||
  detectionsSlice?.error ||
  "";

  // Soporta varias formas de reducer:
  // - state.detections = { items, count, total }
  // - state.detections.payload = { items, count, total }


  // UI state
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | healthy | mild | moderate | severe
  const [expandedId, setExpandedId] = useState(null);
 const wsRef = useRef(null);
  const lastNotifAtRef = useRef(0);
  const pendingNotifRef = useRef(null);

const notifyDetectionUpdate = useCallback((text) => {
    const now = Date.now();
    const cooldownMs = 1500;

    
    if (now - lastNotifAtRef.current < cooldownMs) {
      if (pendingNotifRef.current) clearTimeout(pendingNotifRef.current);
      pendingNotifRef.current = setTimeout(() => {
        lastNotifAtRef.current = Date.now();
        notification.info({
          message: "Detección actualizada",
          description: text || "Se detectaron cambios en la detección.",
          key: "detection_update",
        });
        pendingNotifRef.current = null;
      }, cooldownMs);
      return;
    }

    lastNotifAtRef.current = now;
    notification.info({
      message: "Detección actualizada",
      description: text || "Se detectaron cambios en la detección.",
      key: "detection_update",
    });
  }, []);


  useEffect(() => {
    dispatch(actionDetectionsCards());
  }, [dispatch]);
const reconnectTimerRef = useRef(null);

const connectWS = useCallback(() => {
  const url = "ws://localhost:8000/ws/detections";
  const ws = new WebSocket(url);
  wsRef.current = ws;

  ws.onopen = () => {
    try {
      console.log("WS OPEN")
      ws.send(JSON.stringify({ type: "HELLO", page: "detections" }));
    } catch {}
  };

  ws.onmessage = (ev) => {
    let msg = ev.data;
    console.log("WS MSG", msg)
    try {
      msg = JSON.parse(ev.data);
    } catch {}

    if (msg?.type === "NEW_INFERENCE") {
      // refresca cards respetando filtros actuales
      dispatch(actionDetectionsCards({ query, filter: activeFilter }));
      // si quieres notificación, úsala aquí:
      // notifyDetectionUpdate(msg?.message || "Nueva inferencia registrada.");
    }
  };

  ws.onerror = () => {
    try {
      ws.close();
    } catch {}
  };

  ws.onclose = () => {
    // reconexión simple (evita múltiples timers)
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      connectWS();
    }, 1000);
  };
}, [dispatch, query, activeFilter]); // <-- IMPORTANTE
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

  const normalized = useMemo(() => {
    return items.map((det) => normalizeDetection(det));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return normalized
      .filter((r) => {
        if (!q) return true;
        const haystack = [
          r.code,
          r.deviceType,
          r.osName,
          r.browserName,
          r.primaryTitle,
          r.primaryStageLabel,
          r.primaryDiseaseLabel,
          r.imgFilename,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .filter((r) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "healthy") return r.primaryStageKey === "healthy";
        if (activeFilter === "mild") return r.primaryStageKey === "mild";
        if (activeFilter === "moderate") return r.primaryStageKey === "moderate";
        if (activeFilter === "severe") return r.primaryStageKey === "severe";
        return true;
      });
  }, [normalized, query, activeFilter]);

  const footerCount = useMemo(() => {
    return filtered.length;
  }, [filtered]);
  useEffect(() => {
    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWS]);
  return (
    <div className="rr-page">
      <div className="rr-shell">
        <header className="rr-header">
          <div className="rr-container">
            <div className="rr-headerStack">
              <div className="rr-searchWrap">
                <div className="rr-search">
                  <span className="rr-icon rr-iconSearch" aria-hidden="true">
                    <SearchIcon />
                  </span>

                  <input
                    className="rr-searchInput"
                    placeholder="Search records..."
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  <button
                    className="rr-iconBtn"
                    type="button"
                    aria-label="Filters"
                    onClick={() => {
                      // Placeholder: aquí puedes abrir modal de filtros reales
                      // Por ahora no hace nada.
                    }}
                  >
                    <TuneIcon />
                  </button>
                </div>
              </div>

              <div className="rr-pills">
                <button
                  className={`rr-pill ${activeFilter === "all" ? "rr-pillActive" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter("all")}
                >
                  All Scans
                </button>

                <button
                  className={`rr-pill ${activeFilter === "healthy" ? "rr-pillActive" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter("healthy")}
                >
                  Healthy
                </button>

                <button
                  className={`rr-pill ${activeFilter === "mild" ? "rr-pillActive" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter("mild")}
                >
                  Mild DR
                </button>

                <button
                  className={`rr-pill ${activeFilter === "moderate" ? "rr-pillActive" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter("moderate")}
                >
                  Moderate
                </button>

                <button
                  className={`rr-pill ${activeFilter === "severe" ? "rr-pillActive" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter("severe")}
                >
                  Severe
                </button>
              </div>

              {/* Estado */}
              <div className="rr-statusRow">
                {loading ? <span className="rr-statusText">Loading…</span> : null}
                {!loading && error ? (
                  <span className="rr-statusText rr-statusError">{String(error)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="rr-main">
            <div className="rr-scroll">
          <div className="rr-container">
            <div className="rr-grid">
              {filtered.map((rec) => (
                <RecordCard
                  key={rec.idDetection}
                  rec={rec}
                  expanded={expandedId === rec.idDetection}
                  onToggle={() => setExpandedId((prev) => (prev === rec.idDetection ? null : rec.idDetection))}
                />
              ))}
            </div>

            <footer className="rr-footer">
              <div className="rr-footerLeft">
                <div className="rr-sync">
                  <span className="rr-dot" aria-hidden="true" />
                  <span className="rr-footerText">ACTIVE SYNC</span>
                </div>
                <span className="rr-sep" aria-hidden="true" />
                <span className="rr-footerText">
                  {footerCount.toLocaleString()} / {total.toLocaleString()} RECORDS
                </span>
              </div>

              <div className="rr-footerRight">
                <span>UABC RETINA</span>
                <span className="rr-dotSoft" aria-hidden="true" />
                <span>2024</span>
              </div>
            </footer>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Detection;

function RecordCard({ rec, expanded, onToggle }) {
  return (
    <div className={`rr-card ${expanded ? "rr-cardExpanded" : ""}`}>
      <div className="rr-badgeWrap">
        <span className={`rr-badge rr-badge--${rec.primaryStageKey}`}>{rec.primaryStageLabel}</span>
      </div>

      <div className="rr-thumb" role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => e.key === "Enter" && onToggle()}>
        <div className="rr-thumbGrad" />
        {rec.imgUrl ? (
          <img className={`rr-img ${rec.glow ? "rr-imgGlow" : ""}`} src={rec.imgUrl} alt={rec.primaryTitle} />
        ) : (
          <div className="rr-imgFallback">
            <div className="rr-imgFallbackText">NO IMAGE</div>
          </div>
        )}
      </div>

      <div className="rr-meta">
        <div className="rr-metaTop">
          <div>
            <div className="rr-id">ID: {rec.code || rec.idDetection}</div>
            <div className="rr-title">{rec.primaryTitle}</div>
          </div>

          <button className="rr-arrowBtn" type="button" onClick={onToggle} aria-label="Open details">
            <span className={`rr-arrow ${expanded ? "rr-arrowOpen" : ""}`} aria-hidden="true">
              <ArrowIcon />
            </span>
          </button>
        </div>

        <div className="rr-date">{rec.datetimeHuman}</div>

        <div className="rr-submeta">
          <div className="rr-submetaItem">
            <span className="rr-submetaLabel">Modality</span>
            <span className="rr-submetaValue">{rec.modalityLabel}</span>
          </div>
          <div className="rr-submetaItem">
            <span className="rr-submetaLabel">Inference</span>
            <span className="rr-submetaValue">{rec.totalInferenceSec}s</span>
          </div>
          <div className="rr-submetaItem">
            <span className="rr-submetaLabel">Biomarkers</span>
            <span className="rr-submetaValue">{rec.biomarkersDetectedCount}</span>
          </div>
        </div>

        {expanded ? (
          <div className="rr-details">
            <div className="rr-detailsGrid">
              <DetailRow label="Device" value={rec.deviceType || "-"} />
              <DetailRow label="OS" value={rec.osName || "-"} />
              <DetailRow label="IP" value={rec.ipPublic || "-"} />
              <DetailRow label="Browser" value={rec.browserName || "-"} />
            </div>

            <div className="rr-section">
              <div className="rr-sectionTitle">Primary disease signal</div>
              <div className="rr-chipRow">
                <span className={`rr-chip ${rec.primaryDiseasePresent ? "rr-chipOn" : "rr-chipOff"}`}>
                  {rec.primaryDiseaseLabel}
                </span>
                <span className="rr-chip rr-chipScore">score: {rec.primaryDiseaseScore}</span>
              </div>
            </div>

            <div className="rr-section">
              <div className="rr-sectionTitle">Models</div>
              <div className="rr-modelList">
                {rec.models.map((m) => (
                  <div className="rr-modelItem" key={m.id_detection_model}>
                    <div className="rr-modelTop">
                      <div className="rr-modelTitle">
                        Model #{m.id_model} · Task #{m.id_task}
                      </div>
                      <div className="rr-modelTime">{safeFixed(m.time_inference)}s</div>
                    </div>

                    {Array.isArray(m.diseases) && m.diseases.length > 0 ? (
                      <div className="rr-modelBlock">
                        <div className="rr-miniTitle">Diseases</div>
                        <div className="rr-miniList">
                          {m.diseases.map((d) => (
                            <div className="rr-miniRow" key={d.id_detection_disease}>
                              <span className={`rr-miniDot ${Number(d.summary) === 1 ? "on" : "off"}`} />
                              <span className="rr-miniText">
                                disease #{d.id_detection_disease} · summary {Number(d.summary)}
                              </span>
                              <span className="rr-miniScore">{safeFixed(d.score)}</span>
                            </div>
                          ))}
                        </div>

                        {m.diseases.some((d) => Array.isArray(d.stages) && d.stages.length) ? (
                          <div className="rr-miniBlock">
                            <div className="rr-miniTitle">Stages</div>
                            {m.diseases
                              .filter((d) => Array.isArray(d.stages) && d.stages.length)
                              .map((d) => (
                                <div className="rr-miniList" key={`stages-${d.id_detection_disease}`}>
                                  {d.stages.map((s) => (
                                    <div className="rr-miniRow" key={s.id_detection_stage}>
                                      <span className={`rr-miniDot ${Number(s.summary) === 1 ? "on" : "off"}`} />
                                      <span className="rr-miniText">
                                        stage #{s.id_detection_stage} · summary {Number(s.summary)}
                                      </span>
                                      <span className="rr-miniScore">{safeFixed(s.score)}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        ) : null}

                        {m.diseases.some((d) => Array.isArray(d.biomarkers) && d.biomarkers.length) ? (
                          <div className="rr-miniBlock">
                            <div className="rr-miniTitle">Biomarkers</div>
                            {m.diseases
                              .filter((d) => Array.isArray(d.biomarkers) && d.biomarkers.length)
                              .map((d) => (
                                <div className="rr-miniList" key={`bio-${d.id_detection_disease}`}>
                                  {d.biomarkers.map((b) => (
                                    <div className="rr-miniRow" key={b.id_detection_biomarker}>
                                      <span className={`rr-miniDot ${Number(b.summary) === 1 ? "on" : "off"}`} />
                                      <span className="rr-miniText">
                                        biomarker #{b.id_detection_biomarker} · summary {Number(b.summary)}
                                      </span>
                                      <span className="rr-miniScore">{safeFixed(b.score)}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rr-modelEmpty">No disease data in this model.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rr-detailRow">
      <div className="rr-detailLabel">{label}</div>
      <div className="rr-detailValue">{String(value)}</div>
    </div>
  );
}

/**
 * Normaliza tu JSON a algo usable por UI.
 * IMPORTANT:
 * - stageKey se deduce desde el primer disease que tenga stages, buscando el stage con summary=1 y mayor score.
 * - si no hay stage => "healthy"
 * - disease principal => el disease con mayor score (o summary=1 si existe)
 */
function normalizeDetection(det) {
  const idDetection = Number(det?.id_detection || 0);
  const code = det?.code || "";
  const datetimeRaw = det?.datetime || "";
  const datetimeHuman = formatDateTime(datetimeRaw);

  const deviceType = det?.device_type || "";
  const osName = det?.os_name || "";
  const browserName = det?.browser_name || "";
  const ipPublic = det?.ip_public || "";

  const imgFilename =
    det?.img ||
    det?.modalities?.[0]?.img ||
    "";

  const imgUrl = imgFilename ? `${API_BASE}${UPLOADS_PATH}/${encodeURIComponent(imgFilename)}` : "";

  const modalityLabel = det?.id_modality ? `Modality #${det.id_modality}` : "Modality";

  const models = Array.isArray(det?.models) ? det.models : [];

  const totalInferenceSec = safeFixed(
    models.reduce((acc, m) => acc + Number(m?.time_inference || 0), 0),
    2
  );

  // Flatten diseases/stages/biomarkers
  const allDiseases = [];
  const allStages = [];
  const allBiomarkers = [];

  for (const m of models) {
    if (Array.isArray(m?.diseases)) {
      for (const d of m.diseases) {
        allDiseases.push(d);
        if (Array.isArray(d?.stages)) allStages.push(...d.stages);
        if (Array.isArray(d?.biomarkers)) allBiomarkers.push(...d.biomarkers);
      }
    }
  }

  // Biomarkers detected count (summary==1)
  const biomarkersDetectedCount = allBiomarkers.filter((b) => Number(b?.summary) === 1).length;

  // Disease principal: prioriza summary==1; si no, max score
  const primaryDisease = pickPrimaryDisease(allDiseases);

  const primaryDiseasePresent = Number(primaryDisease?.summary) === 1;
  const primaryDiseaseScore = safeFixed(primaryDisease?.score, 3);
  const primaryDiseaseLabel = primaryDiseasePresent ? "Disease positive" : "Disease negative";

  // Stage principal: toma stage con summary==1 y mayor score; si no hay => healthy
  const stageInfo = pickPrimaryStage(allStages);

  const primaryStageKey = stageInfo.stageKey;
  const primaryStageLabel = stageInfo.stageLabel;

  // Title principal: usa algo que sea real y no inventado
  // Si hay disease positivo => "Detection #ID" y etapa
  // Si no => "Scan #ID"
  const primaryTitle = primaryDiseasePresent ? `Detection #${idDetection}` : `Scan #${idDetection}`;

  // Glow: solo para healthy (como en tu HTML)
  const glow = primaryStageKey === "healthy";

  return {
    idDetection,
    code,
    datetimeRaw,
    datetimeHuman,
    deviceType,
    osName,
    browserName,
    ipPublic,
    imgFilename,
    imgUrl,
    modalityLabel,
    totalInferenceSec,
    biomarkersDetectedCount,
    primaryDiseasePresent,
    primaryDiseaseScore,
    primaryDiseaseLabel,
    primaryStageKey,
    primaryStageLabel,
    primaryTitle,
    glow,
    models,
  };
}

function pickPrimaryDisease(diseases) {
  if (!Array.isArray(diseases) || diseases.length === 0) return null;

  // 1) si hay alguno summary==1, elige el de mayor score entre esos
  const positives = diseases.filter((d) => Number(d?.summary) === 1);
  if (positives.length) {
    return positives.reduce((best, cur) => (Number(cur?.score || 0) > Number(best?.score || 0) ? cur : best), positives[0]);
  }

  // 2) si no, elige el de mayor score
  return diseases.reduce((best, cur) => (Number(cur?.score || 0) > Number(best?.score || 0) ? cur : best), diseases[0]);
}

function pickPrimaryStage(stages) {
  // Si no hay stages, lo tomamos como healthy
  if (!Array.isArray(stages) || stages.length === 0) {
    return { stageKey: "healthy", stageLabel: "Healthy" };
  }

  // Preferimos summary==1
  const positives = stages.filter((s) => Number(s?.summary) === 1);
  const candidates = positives.length ? positives : stages;

  // Mayor score
  const best = candidates.reduce((a, b) => (Number(b?.score || 0) > Number(a?.score || 0) ? b : a), candidates[0]);

  // IMPORTANT: aquí NO tienes nombre de clase, solo ids.
  // Entonces usamos una heurística:
  // - Si hay 4 stages, asumimos orden: [Mild, Moderate, Severe, Proliferative]
  // - Si cae en Proliferative, lo mostramos como Severe (tu UI no tiene pill "Proliferative")
  const idx = stageIndexGuess(stages, best);

  if (idx === 0) return { stageKey: "mild", stageLabel: "Mild" };
  if (idx === 1) return { stageKey: "moderate", stageLabel: "Moderate" };
  if (idx === 2) return { stageKey: "severe", stageLabel: "Severe" };
  if (idx === 3) return { stageKey: "severe", stageLabel: "Severe" };

  // fallback
  return { stageKey: "healthy", stageLabel: "Healthy" };
}

function stageIndexGuess(fullStages, chosenStage) {
  // Si el "chosenStage" existe dentro del array, usa su índice real
  const i = fullStages.findIndex((s) => Number(s?.id_detection_stage) === Number(chosenStage?.id_detection_stage));
  if (i >= 0) return i;

  // Si no lo encuentra, asume 0
  return 0;
}

function safeFixed(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

function formatDateTime(iso) {
  if (!iso) return "-";
  // El backend manda "2026-01-29T22:44:35"
  // Lo dejamos legible sin librerías
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/* SVGs */
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path d="M10.5 18.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path d="M4 7h10M18 7h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17h2M10 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
