from PIL import Image
import time
import os
import numpy as np
import onnxruntime as ort


# =========================
# CONFIG
# =========================
MODEL_DIR = r"app/models"
ONNX_PATH = os.path.join(MODEL_DIR, "model_biomarker.onnx")

# 4 clases (biomarkers) en el mismo orden que entrenaste
BIOMARKERS = [
    {"id_biomarker": 0, "name": "Microaneurysms"},
    {"id_biomarker": 1, "name": "Hemorrhages"},
    {"id_biomarker": 2, "name": "Hard Exudates"},
    {"id_biomarker": 3, "name": "Soft Exudates"},
]

ID_MODEL = 1
model_map = {}

# Ajusta SOLO si tu ONNX espera otro tamaño
IMG_SIZE = 224
THRESHOLD_DEFAULT = 0.5


def _sigmoid_np(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)
    return 1.0 / (1.0 + np.exp(-x))


def init_models_local():
    global model_map

    providers_pref = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    available = ort.get_available_providers()
    providers = [p for p in providers_pref if p in available] or ["CPUExecutionProvider"]

    ort_session = ort.InferenceSession(ONNX_PATH, providers=providers)

    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name

    id2label = {i: BIOMARKERS[i]["name"] for i in range(len(BIOMARKERS))}

    model_map = {
        "id_model": ID_MODEL,
        "model_dir": MODEL_DIR,
        "biomarkers": BIOMARKERS,
        "ort_session": ort_session,
        "providers": providers,
        "input_name": input_name,
        "output_name": output_name,
        "id2label": id2label,
        "num_labels": len(BIOMARKERS),
    }


def preprocess_inception_style(image_path: str) -> np.ndarray:
    """
    Preproceso estilo Inception:
      - RGB
      - resize a IMG_SIZE
      - float32
      - escala a [-1, 1] con (x/127.5)-1
      - devuelve NHWC: [1,H,W,3]
    """
    img = Image.open(image_path).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)

    x = np.asarray(img, dtype=np.float32)  # [H,W,3] 0..255
    x = (x / 127.5) - 1.0                  # [-1,1]
    x = np.expand_dims(x, axis=0)          # [1,H,W,3]
    return x


def _maybe_to_model_layout(x_nhwc: np.ndarray, ort_session: ort.InferenceSession) -> np.ndarray:
    """
    Si el ONNX espera NCHW ([N,3,H,W]) convierte.
    Si espera NHWC ([N,H,W,3]) deja igual.
    """
    shape = ort_session.get_inputs()[0].shape  # puede traer None o strings dinámicos

    # Caso típico NCHW: [N, 3, H, W]
    if len(shape) == 4 and shape[1] == 3:
        return np.transpose(x_nhwc, (0, 3, 1, 2)).astype(np.float32)

    # Caso típico NHWC: [N, H, W, 3]
    return x_nhwc.astype(np.float32)


def predict_image(image_path, filename=None, threshold=THRESHOLD_DEFAULT):
    if not model_map:
        init_models_local()

    start_time = time.time()

    ort_session = model_map["ort_session"]
    providers = model_map["providers"]
    device_str = "GPU" if "CUDAExecutionProvider" in providers else "CPU"

    x = preprocess_inception_style(image_path)
    x = _maybe_to_model_layout(x, ort_session)

    ort_inputs = {model_map["input_name"]: x}
    y = ort_session.run([model_map["output_name"]], ort_inputs)[0]
    y = np.asarray(y)

    inference_time = round((time.time() - start_time) * 1000, 2)

    # Esperamos multilabel: logits [B, num_labels] (o probs ya sigmoid)
    if y.ndim != 2 or y.shape[1] != model_map["num_labels"]:
        raise RuntimeError(
            f"Salida ONNX inesperada: shape={y.shape}. Esperaba [B,{model_map['num_labels']}]"
        )

    # MULTILABEL: sigmoid por clase
    probs = _sigmoid_np(y)[0]  # [num_labels]

    activated = [i for i, p in enumerate(probs.tolist()) if p >= float(threshold)]

    summary = ["0"] * len(probs)
    for i in activated:
        summary[i] = "1"

    id2label = model_map["id2label"]
    biomarker_names = [id2label.get(i, str(i)) for i in activated]

    # Si quieres id_biomarker(s) además de índices:
    biomarkers_list = model_map["biomarkers"]
    id_biomarkers = [biomarkers_list[i]["id_biomarker"] for i in activated] if activated else []

    return {
        "device": device_str,
        "id_model": model_map["id_model"],
        "biomarkers": biomarkers_list,
        "predicted_labels": activated,
        "biomarker_names": biomarker_names,
        "summary": summary,
        "id_biomarkers": id_biomarkers,
        "labels": {str(k): v for k, v in id2label.items()},
        "vector_probs": probs.tolist(),
        "time_inference": inference_time,
        "filename": filename,
        "threshold": float(threshold),
    }
