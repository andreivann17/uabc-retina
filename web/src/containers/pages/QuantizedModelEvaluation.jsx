import React from "react";
import "../../assets/css/quant-eval.css";
import img2 from "../../assets/img/IEEE_IES_LogoColorRGB_300ppi.png";
import img1 from "../../assets/img/logo.png";
import { ArrowRightOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

export default function QuantizedModelEvaluation({
  onStart = () => {},
  leftLabel = "UABC",
  rightLabel = "IEE IES",
  titleTop = "Quantized Model",
  titleBottom = "Evaluation",
  statusText = "Ready for Evaluation",
}) {
    const navigate = useNavigate();

  return (
    <div className="qe-root">
      {/* Fondo glow */}
      <div className="qe-glow" />

  
      {/* Contenido */}
      <main className="qe-main">
        {/* Logos center */}
        <div className="qe-brandRow">
          <div className="qe-brand">
            <div className="qe-brandIconBox">
  <img className="qc-logo" style={{height:84}} src={img1} alt="IEEE" />
            </div>
            <div className="qe-brandLabel">{leftLabel}</div>
          </div>

          <div className="qe-brandDivider" />

          <div className="qe-brand">
            <div className="qe-brandIconBox">
                <img className="qc-logo" src={img2} style={{height:90}} alt="UABC" />

            </div>
            <div className="qe-brandLabel">{rightLabel}</div>
          </div>
        </div>

       

        {/* Title */}
        <h1 className="qe-title">
          {titleTop}
          <br />
          <span className="qe-title2">{titleBottom}</span>
        </h1>

        {/* CTA */}
        <div className="qe-ctaRow">
          <button
  type="button"
  className="qe-btn"
  onClick={() => navigate("/quant")}
>
  <span className="qe-btnText">Start Evaluation</span>
  <ArrowRightOutlined className="qe-btnIcon" />
</button>

        </div>
      </main>
    </div>
  );
}
