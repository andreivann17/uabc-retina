from PIL import Image
import time
import os
import numpy as np
import onnxruntime as ort


# =========================
# CONFIG
# =========================
MODEL_DIR = r"app/models"
ONNX_PATH = os.path.join(MODEL_DIR, "model_comprobar_retina_inceptionv3.onnx")

RETINA = [
    {"id_retina": 1, "name": "No Retina"},
    {"id_retina": 2, "name": "Retina"},
]

ID_MODEL = 1
model_map = {}

# Si tu modelo entrenó con otro tamaño, cámbialo aquí.
IMG_SIZE = 224  # InceptionV3 típico


def init_models_local():
    global model_map

    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    available = ort.get_available_providers()
    providers = [p for p in providers if p in available]
    if not providers:
        providers = ["CPUExecutionProvider"]

    ort_session = ort.InferenceSession(ONNX_PATH, providers=providers)

    # Lee info del modelo ONNX (input/output names)
    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name

    model_map = {
        "id_model": ID_MODEL,
        "model_dir": MODEL_DIR,
        "retina": RETINA,
        "ort_session": ort_session,
        "providers": providers,
        "input_name": input_name,
        "output_name": output_name,
        # Labels: tu CNN es binaria, así que lo dejamos fijo
        "id2label": {0: "Normal", 1: "Diabetic Retinopathy"},
        "num_labels": 2,
    }


def preprocess_inceptionv3(image_path: str) -> np.ndarray:
    """
    Preproceso consistente con tf.keras.applications.inception_v3.preprocess_input:
    - RGB
    - resize a 299x299
    - float32
    - escala a [-1, 1] usando (x/127.5) - 1
    - NCHW (porque ONNX normalmente sale así cuando exportas desde PyTorch,
      pero desde Keras muchas veces es NHWC. Aquí lo detectamos abajo.)
    """
    img = Image.open(image_path).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)

    x = np.asarray(img, dtype=np.float32)  # [H,W,3] 0..255
    x = (x / 127.5) - 1.0                  # [-1,1] igual a preprocess_input de InceptionV3
    x = np.expand_dims(x, axis=0)          # [1,H,W,3] NHWC

    return x


def _maybe_to_model_layout(x_nhwc: np.ndarray, ort_session: ort.InferenceSession, input_name: str) -> np.ndarray:
    """
    Keras suele exportar ONNX en NHWC, pero depende del export.
    Detectamos la forma esperada del input ONNX:
      - si espera NCHW -> convertimos.
      - si espera NHWC -> dejamos.
    """
    inp = ort_session.get_inputs()[0]
    shape = inp.shape  # puede traer None o strings dinámicos

    # Si la forma parece [N,3,H,W] => NCHW
    if len(shape) == 4 and shape[1] == 3:
        return np.transpose(x_nhwc, (0, 3, 1, 2)).astype(np.float32)

    # Si parece [N,H,W,3] => NHWC
    return x_nhwc.astype(np.float32)


def _softmax_np(logits: np.ndarray) -> np.ndarray:
    logits = logits.astype(np.float32)
    logits = logits - np.max(logits, axis=-1, keepdims=True)
    exp = np.exp(logits)
    return exp / np.sum(exp, axis=-1, keepdims=True)


def predict_image(image_path, filename=None):
    if not model_map:
        init_models_local()

    start_time = time.time()

    ort_session = model_map["ort_session"]
    providers = model_map["providers"]
    device_str = "GPU" if "CUDAExecutionProvider" in providers else "CPU"

    x = preprocess_inceptionv3(image_path)
    x = _maybe_to_model_layout(x, ort_session, model_map["input_name"])

    ort_inputs = {model_map["input_name"]: x}
    y = ort_session.run([model_map["output_name"]], ort_inputs)[0]

    inference_time = round((time.time() - start_time) * 1000, 2)

    # --- Interpretación de salida ---
    # Caso A: salida shape [B,2] logits o probs
    # Caso B: salida shape [B,1] prob (sigmoid) o logit
    y = np.asarray(y)

    if y.ndim == 2 and y.shape[1] == 2:
        # Si no sabes si ya viene softmax, aplica softmax igual (no rompe si ya son probs casi)
        probs = _softmax_np(y)
        predicted_class_idx = int(np.argmax(probs, axis=-1)[0])
        vector_probs = probs[0].tolist()

    elif y.ndim == 2 and y.shape[1] == 1:
        # Asumimos salida binaria tipo sigmoid o logit.
        # Si viene logit, sigmoidea; si ya viene prob, esto lo deja casi igual si está 0..1.
        p = 1.0 / (1.0 + np.exp(-y.astype(np.float32)))
        p = float(p[0, 0])
        # Convención: clase 1 = DR si p>=0.5
        predicted_class_idx = 1 if p >= 0.5 else 0
        vector_probs = [1.0 - p, p]

    else:
        raise RuntimeError(f"Salida ONNX inesperada: shape={y.shape}")

    id2label = model_map["id2label"]
    predicted_label = id2label.get(predicted_class_idx, str(predicted_class_idx))

    summary_results = ["0"] * model_map["num_labels"]
    summary_results[predicted_class_idx] = "1"

    retina_list = model_map["retina"]
    id_retina = retina_list[predicted_class_idx]["id_retina"]

    return {
        "device": device_str,
        "predicted_label": predicted_label,
        "retina": retina_list,
        "id_model": model_map["id_model"],
        "summary": summary_results,
        "id_retina": id_retina,
        "labels": id2label,
        "vector_probs": vector_probs,
        "time_inference": inference_time,
        "filename": filename,
    }
