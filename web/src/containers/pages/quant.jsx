import { useEffect, useMemo, useState } from "react";
import "../../assets/css/quant.css";
import img1 from "../../assets/img/IEEE_IES_LogoColorRGB_300ppi.png";
import img2 from "../../assets/img/logo.png";
import imgexample from "../../assets/img/0f882877bf13.png";
import noQuantData from "./data/no_quant.json";
import quantData from "./data/quant.json";

import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FireOutlined,
  ExportOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

/* =========================
   HELPERS
   ========================= */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}
function toGBfromMB(mb) {
  if (mb == null || Number.isNaN(mb)) return null;
  return mb / 1024;
}
function fmtSec(s) {
  if (s == null || Number.isNaN(s)) return "—";
  if (s < 1) return s.toFixed(2);
  return s.toFixed(1);
}
function fmtGB(gb) {
  if (gb == null || Number.isNaN(gb)) return "—";
  return gb.toFixed(1);
}

/* =========================
   STREAM + INDEX HOOK
   ========================= */
function useStreamReplay(rawText, timingsSec) {
  const timings = useMemo(() => safeArr(timingsSec), [timingsSec]);
  const [visibleText, setVisibleText] = useState("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setVisibleText("");
    setIdx(0);
  }, [rawText, timingsSec]);

  useEffect(() => {
    if (!rawText) return;

    if (!timings.length) {
      setVisibleText(rawText);
      return;
    }

    if (idx >= timings.length) {
      setVisibleText(rawText);
      return;
    }

    const timer = setTimeout(() => {
      const step = Math.max(1, Math.ceil(rawText.length / timings.length));
      setVisibleText(rawText.slice(0, (idx + 1) * step));
      setIdx((p) => p + 1);
    }, Math.max(0, timings[idx]) * 1000);

    return () => clearTimeout(timer);
  }, [idx, rawText, timings]);

  return { visibleText, idx, total: timings.length };
}

/* =========================
   LIVE METRICS (per step)
   ========================= */
function useLiveMetrics({ idx, stats, mode }) {
  const arr = useMemo(() => safeArr(stats), [stats]);
  const i = clamp(idx - 1, 0, Math.max(0, arr.length - 1));
  const cur = arr.length ? arr[i] : null;

  const dt = cur?.dt_s ?? null;
  const rssGB = toGBfromMB(cur?.rss_mb ?? null);

  const instRate = dt && dt > 0 ? 1 / dt : null;

  const maxDt = useMemo(() => {
    let m = 0;
    for (const s of arr) {
      const v = s?.dt_s;
      if (typeof v === "number" && v > m) m = v;
    }
    return m || null;
  }, [arr]);

  const maxRssGB = useMemo(() => {
    let m = 0;
    for (const s of arr) {
      const gb = toGBfromMB(s?.rss_mb);
      if (typeof gb === "number" && gb > m) m = gb;
    }
    return m || null;
  }, [arr]);

  const dtPct = maxDt && dt != null ? clamp((dt / maxDt) * 100, 6, 100) : 10;
  const rssPct =
    maxRssGB && rssGB != null ? clamp((rssGB / maxRssGB) * 100, 6, 100) : 10;

  const unit = mode === "token" ? "token" : "token";

  return { unit, dt, rssGB, instRate, dtPct, rssPct };
}

export default function QuantizationComparison() {
  // streaming
  const noQ = useStreamReplay(noQuantData.raw_text, noQuantData.chunk_times);
  const q = useStreamReplay(quantData.raw_text, quantData.token_times);

  // stats source
  const noQStats = useMemo(() => safeArr(noQuantData.per_chunk_stats), []);
  const quantHasTokenStats = safeArr(quantData.per_token_stats).length > 0;
  const qStats = useMemo(() => {
    return quantHasTokenStats
      ? safeArr(quantData.per_token_stats)
      : safeArr(quantData.per_chunk_stats);
  }, [quantHasTokenStats]);

  // live cards
  const noQLive = useLiveMetrics({ idx: noQ.idx, stats: noQStats, mode: "chunk" });
  const qLive = useLiveMetrics({
    idx: q.idx,
    stats: qStats,
    mode: quantHasTokenStats ? "token" : "chunk",
  });

  // footer summary
  const noQTotal = (noQuantData.time_ms ?? 0) / 1000;
  const qTotal = (quantData.time_ms ?? 0) / 1000;
  const speedup = qTotal > 0 ? noQTotal / qTotal : null;

  const noQLastGB = toGBfromMB(safeArr(noQuantData.per_chunk_stats).at(-1)?.rss_mb);
  const qLastGB = toGBfromMB(safeArr(qStats).at(-1)?.rss_mb);
  const memSaved =
    noQLastGB && qLastGB && noQLastGB > 0 ? (1 - qLastGB / noQLastGB) * 100 : null;


  return (
    <div className="qc-root">
      <div className="qc-leak-tl"></div>
      <div className="qc-leak-br"></div>

      <div className="qc-bg">
        <div className="qc-radial"></div>
        <div className="qc-gridDots"></div>
      </div>
{/* LOGOS FIXED */}
<div className="qc-corner qc-corner-left">
  <img className="qc-cornerLogo" style={{height:84}} src={img1} alt="IEEE" />
</div>
<div className="qc-corner qc-corner-right">
  <img className="qc-cornerLogo" src={img2} style={{height:90}} alt="UABC" />
</div>

      <main className="qc-main">
        {/* HEADER */}
        <header className="qc-header">
          <div>
            <h1 className="qc-title">Quantization Performance Comparison</h1>
            <p className="qc-subtitle">Model Benchmark: LLaMA 2 7B</p>
          </div>

         
        </header>

        {/* PANELS */}
        <div className="qc-panels">
          {/* NO QUANT */}
          <section className="glass qc-panel">
            <div className="qc-panelHead">
              <div>
                <span className="qc-kicker">Process Run 01</span>
                <div className="qc-h2">
                  Non-Quantized{" "}
                  <span className="qc-h2Muted">(Full Precision)</span>
                </div>
              </div>
              <div className="qc-pill qc-pillSoft">FP16</div>
            </div>

            <div className="qc-imageWrap qc-imageWrapDim">
              <img className="qc-image" src={imgexample} alt="Retina" />
              <div className="qc-imageOverlay"></div>
              <div className="qc-badge qc-badgeRed">
                <span className="qc-dot qc-dotRed"></span>
                <span>Processing...</span>
              </div>
            </div>
<div className="qc-question">
  <span className="qc-questionLabel">Question</span>
  <span className="qc-questionText">
    Do I have hard exudates in my retina?
  </span>
</div>

            <div className="qc-terminal">
              <div className="qc-terminalInner">
                <pre className="qc-pre">
                  {noQ.visibleText}
                  <span className="qc-cursor">|</span>
                </pre>
              </div>
            </div>

            <div className="qc-metrics">
              <div className="status">
                <div className="qc-metricHead">
                  <ClockCircleOutlined className="qc-metricIcon" />
                  <div className="qc-metricLabel">
                    {noQLive.unit.toUpperCase()} LATENCY
                  </div>
                </div>
                <div className="qc-metricValue">
                  {fmtSec(noQLive.dt)}
                  <span className="qc-unit">s</span>
                </div>
                <div className="qc-bar">
                  <div
                    className="qc-barFill qc-barFillWarn"
                   style={{ width: `${noQLive.dtPct}%` }}

                  ></div>
                </div>
              </div>

              <div className="status">
                <div className="qc-metricHead">
                  <DatabaseOutlined className="qc-metricIcon" />
                  <div className="qc-metricLabel">RAM</div>
                </div>
                <div className="qc-metricValue">
                  {fmtGB(noQLive.rssGB)}
                  <span className="qc-unit">GB</span>
                </div>
                <div className="qc-bar">
                  <div
                    className="qc-barFill qc-barFillDanger"
                    style={{ width: `${noQLive.rssPct}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </section>

          {/* QUANT */}
          <section className="glass qc-panel qc-panelAccent">
            <div className="qc-blob"></div>

            <div className="qc-panelHead">
              <div>
                <span className="qc-kicker qc-kickerAccent">Process Run 02</span>
                <div className="qc-h2">
                  4-bit Quantized{" "}
                  <span className="qc-h2Accent">(Optimized)</span>
                </div>
              </div>
              <div className="qc-pill qc-pillAccent">INT4</div>
            </div>

            <div className="qc-imageWrap qc-imageWrapAccent">
              <img className="qc-image" src={imgexample} alt="Retina" />
              <div className="qc-imageOverlay qc-imageOverlayGreen"></div>
              <div className="qc-carbon"></div>
              <div className="qc-badge qc-badgeGreen">
                <span className="qc-dot qc-dotGreen"></span>
                <span>Fast Engine</span>
              </div>
            </div>
<div className="qc-question">
  <span className="qc-questionLabel">Question</span>
  <span className="qc-questionText">
    Do I have hard exudates in my retina?
  </span>
</div>

            <div className="qc-terminal qc-terminalAccent">
              <div className="qc-terminalInner">
                <pre className="qc-pre qc-preBright">
                  {q.visibleText}
                  <span className="qc-cursor">|</span>
                </pre>
              </div>
            </div>

            <div className="qc-metrics">
              <div className="status">
                <div className="qc-metricHead">
                  <FireOutlined className="qc-metricIcon" />
                  <div className="qc-metricLabel qc-metricLabelAccent">
                    {qLive.unit.toUpperCase()} LATENCY
                  </div>
                </div>
                <div className="qc-metricValue qc-metricValueAccent">
                  {fmtSec(qLive.dt)}
                  <span className="qc-unit qc-unitAccent">s</span>
                </div>
                <div className="qc-bar qc-barAccent">
                  <div
                    className="qc-barFill qc-barFillAccent"
                    style={{ width: `${qLive.dtPct}%` }}
                  ></div>
                </div>
              </div>

              <div className="status">
                <div className="qc-metricHead">
                  <DatabaseOutlined className="qc-metricIcon" />
                  <div className="qc-metricLabel qc-metricLabelAccent">
                    RAM
                  </div>
                </div>
                <div className="qc-metricValue qc-metricValueAccent">
                  {fmtGB(qLive.rssGB)}
                  <span className="qc-unit qc-unitAccent">GB</span>
                </div>
                <div className="qc-bar qc-barAccent">
                  <div
                    className="qc-barFill qc-barFillAccent"
                    style={{ width: `${qLive.rssPct}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="qc-footer">
          <div className="qc-footerLeft">
            <div>
              <div className="qc-statLabel">Overall Speedup</div>
              <div className="qc-statValue">
                {speedup ? `${speedup.toFixed(2)}x Faster` : "—"}
              </div>
            </div>

            <div className="qc-dividerV"></div>

            <div>
              <div className="qc-statLabel">Memory Efficiency</div>
              <div className="qc-statValue">
                {memSaved != null ? `${memSaved.toFixed(0)}% Saved` : "—"}
              </div>
            </div>
          </div>

          <div className="qc-footerRight">
            <button className="qc-btn qc-btnGhost">
              <ExportOutlined style={{ marginRight: 8 }} />
              Export Report
            </button>

            <button className="qc-btn qc-btnPrimary">
              <PlayCircleOutlined style={{ marginRight: 8 }} />
              New Analysis
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
