import * as ort from "onnxruntime-web";

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

const _sessions = {};

async function getSession(modelFile) {
  if (_sessions[modelFile]) return _sessions[modelFile];

  const url = new URL(`/models/${modelFile}`, window.location.origin).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Model fetch failed: ${res.status} ${res.statusText}`);

  const contentType = res.headers.get("content-type") || "";
  const buf = await res.arrayBuffer();

  if (contentType.includes("text/html") || buf.byteLength < 1024) {
    const head = new TextDecoder().decode(new Uint8Array(buf).slice(0, 200));
    throw new Error(
      `Model is not binary ONNX. content-type="${contentType}", bytes=${buf.byteLength}, head="${head}"`
    );
  }

  const session = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
  _sessions[modelFile] = session;
  return session;
}

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function drawToCanvasAndGetRGBA(img, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return imageData.data; // Uint8ClampedArray RGBA
}

function rgbaToNHWCFloat32(rgba, size, normalize = "0_1") {
  // [1, H, W, 3]
  const nhwc = new Float32Array(1 * size * size * 3);

  let p = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      let r = rgba[i];
      let g = rgba[i + 1];
      let b = rgba[i + 2];

      // Normalización
      if (normalize === "0_1") {
        r /= 255;
        g /= 255;
        b /= 255;
      }

      // NHWC: RGB consecutivo
      nhwc[p++] = r;
      nhwc[p++] = g;
      nhwc[p++] = b;
    }
  }

  return nhwc;
}

async function runClassificationSoftmax({ modelFile, imageUrl, size, id2label }) {
  const session = await getSession(modelFile);
  const inputName = session.inputNames[0];

  const img = await loadImage(imageUrl);
  const rgba = drawToCanvasAndGetRGBA(img, size, size);
  const chw = rgbaToNHWCFloat32(rgba, size, "0_1");

  const inputTensor = new ort.Tensor("float32", chw, [1, 3, size, size]);
  const outputs = await session.run({ [inputName]: inputTensor });

  const outName = session.outputNames[0];
  const logits = Array.from(outputs[outName].data);
  const probs = softmax(logits);

  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  const label = id2label?.[String(bestIdx)] ?? String(bestIdx);
  const confidence = probs[bestIdx];

  return {
    bestIdx,
    label,
    confidence,
    confidencePct: +(confidence * 100).toFixed(1),
    probs,
    logits,
  };
}

async function runMultiLabelSigmoid({ modelFile, imageUrl, size, labels, threshold = 0.5 }) {
  const session = await getSession(modelFile);
  const inputName = session.inputNames[0];

  const img = await loadImage(imageUrl);
  const rgba = drawToCanvasAndGetRGBA(img, size, size);
  const chw = rgbaToNHWCFloat32(rgba, size, "0_1");

  const inputTensor = new ort.Tensor("float32", chw, [1, 3, size, size]);
  const outputs = await session.run({ [inputName]: inputTensor });

  const outName = session.outputNames[0];
  const logits = Array.from(outputs[outName].data);

  const probs = logits.map(sigmoid);
  const hits = probs
    .map((p, i) => ({ i, p, label: labels?.[i] ?? String(i) }))
    .filter((x) => x.p >= threshold)
    .sort((a, b) => b.p - a.p);

  return {
    threshold,
    probs,
    hits: hits.map((x) => ({
      idx: x.i,
      label: x.label,
      confidence: x.p,
      confidencePct: +(x.p * 100).toFixed(1),
    })),
  };
}

// ==========================
// EXPORTS: tu pipeline
// ==========================

export async function predictIsRetina(imageUrl) {
  // CLASES SEGUN TU INDICACION:
  // 1 = retina, 0 = no retina
  const id2label = { "0": "not_retina", "1": "retina" };

  const r = await runClassificationSoftmax({
    modelFile: "model_retina.onnx",
    imageUrl,
    size: 224,
    id2label,
  });

  const isRetina = r.bestIdx === 1;
  return { ...r, isRetina };
}

export async function predictDisease(imageUrl) {
  // segun tu config anterior:
  const id2label = { "0": "diabetic", "1": "normal" };

  return runClassificationSoftmax({
    modelFile: "model_disease.onnx",
    imageUrl,
    size: 224,
    id2label,
  });
}

export async function predictStage(imageUrl, id2labelStages) {
  // id2labelStages: pásalo tú (NO lo invento)
  return runClassificationSoftmax({
    modelFile: "model_stages.onnx",
    imageUrl,
    size: 224,
    id2label: id2labelStages,
  });
}

export async function predictBiomarkers(imageUrl, biomarkerLabels) {
  // biomarkerLabels: pásalo tú (NO lo invento)
  return runMultiLabelSigmoid({
    modelFile: "model_biomarkers.onnx",
    imageUrl,
    size: 224,
    labels: biomarkerLabels,
    threshold: 0.5,
  });
}
