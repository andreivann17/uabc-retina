import * as ort from "onnxruntime-web";

// (Opcional pero recomendado) fuerza WASM (suele ser más estable en desktop/electron)
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
// ort.env.wasm.wasmPaths = "/models/"; // si luego necesitas rutas custom para wasm

let _session = null;

async function getSession() {
  if (_session) return _session;

  const url = new URL("/models/model.onnx", window.location.origin).toString();
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

  _session = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
  
  return _session;
}

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export function decodeClassification(logits, id2label) {
  const probs = softmax(logits);

  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }

  const label = id2label?.[String(bestIdx)] ?? String(bestIdx);
  const confidence = probs[bestIdx]; // 0..1

  return {
    label,
    confidence,
    probs,
    bestIdx,
  };
}


// IMPORTANTE:
// Ajusta estos 4 valores a lo que tu modelo espera:
// - inputName (si no lo sabes, lo sacamos del session.inputNames[0])
// - tamaño (224/512/etc)
// - normalización (0..1, mean/std, etc)
// - orden (NCHW vs NHWC) -> ONNX casi siempre NCHW
export async function predictDRStageFromImageUrl(imageUrl) {
  const session = await getSession();

  const inputName = session.inputNames[0]; // típico
  const size = 224; // AJUSTA AL ENTRENAMIENTO DE TU MODELO

  // 1) cargar imagen en canvas
  const img = await loadImage(imageUrl);
  const { data, width, height } = drawToCanvasAndGetRGB(img, size, size);

  // 2) a Float32 NCHW en rango 0..1 (AJUSTA NORMALIZACION SI TU MODELO LO REQUIERE)
  // data viene como RGBA uint8 -> tomamos RGB
  const chw = new Float32Array(1 * 3 * size * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // NCHW: [1,3,H,W]
      const idx = y * size + x;
      chw[idx] = r;
      chw[size * size + idx] = g;
      chw[2 * size * size + idx] = b;
      p++;
    }
  }

  const inputTensor = new ort.Tensor("float32", chw, [1, 3, size, size]);

  // 3) run
  const outputs = await session.run({ [inputName]: inputTensor });

  // 4) escoger salida principal
  const outputName = session.outputNames[0];
  const logits = outputs[outputName].data;

  // 5) stage = argmax
  const probs = softmax(Array.from(logits));
  const stageIdx = probs.indexOf(Math.max(...probs));
  const confidence = probs[stageIdx];
const id2label = {
  "0": "diabetic",
  "1": "normal",
};

const label = id2label[String(stageIdx)] ?? String(stageIdx);

return {
  stageIdx,
  label,
  confidence,
  confidencePct: +(confidence * 100).toFixed(1),
  probs,
};
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

function drawToCanvasAndGetRGB(img, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return { data: imageData.data, width: w, height: h };
}
