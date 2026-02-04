from PIL import Image
import time
import os
import numpy as np

import torch
from transformers import ViTForImageClassification, ViTImageProcessor
import onnxruntime as ort


# =========================
# CONFIG
# =========================
MODEL_DIR = r"app/models/model_vit_biomarkers_diabetic_retinopathy"
ONNX_PATH = os.path.join(MODEL_DIR, "model_vit.onnx")

# OJO: en multilabel normalmente NO quieres mapear por índice a solo 3 biomarkers,
# sino a TODAS las labels del modelo. Puedes reemplazar esto por tu orden real.
BIOMARKERS = {
    "0": "Microaneurysms",
    "1": "Hemorrhages",
    "2": "Hard Exudates",
    "3": "Soft Exudates",
}

ID_MODEL = 1
model_map = {}


def _sigmoid_np(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)
    return 1.0 / (1.0 + np.exp(-x))


def init_models_local():
    global model_map

    providers_pref = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    available = ort.get_available_providers()
    providers = [p for p in providers_pref if p in available] or ["CPUExecutionProvider"]

    ort_session = ort.InferenceSession(ONNX_PATH, providers=providers)

    # Cargamos config/processor desde HF para tener el mismo preprocesado y labels
    model_hf = ViTForImageClassification.from_pretrained(MODEL_DIR)
    image_processor = ViTImageProcessor.from_pretrained(MODEL_DIR)

    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name  # no asumas "logits"

    # labels: prioriza los del modelo si existen; si no, usa tu dict
    id2label = getattr(model_hf.config, "id2label", None) or {}
    num_labels = int(getattr(model_hf.config, "num_labels", len(id2label) or len(BIOMARKERS)))

    model_map = {
        "id_model": ID_MODEL,
        "model_dir": MODEL_DIR,
        "image_processor": image_processor,
        "ort_session": ort_session,
        "providers": providers,
        "input_name": input_name,
        "output_name": output_name,
        "id2label": id2label,
        "num_labels": num_labels,
        "labels_fallback": BIOMARKERS,  # si tu id2label no está bien, usa esto
    }


def preprocess_image(image_path, image_processor):
    image = Image.open(image_path).convert("RGB")
    inputs = image_processor(images=image, return_tensors="pt")
    pixel_values = inputs["pixel_values"]  # [1,3,H,W]
    return pixel_values.detach().cpu().numpy().astype(np.float32)


def predict_image(image_path, filename=None, threshold=0.5):
    if not model_map:
        init_models_local()

    start_time = time.time()

    ort_session = model_map["ort_session"]
    providers = model_map["providers"]
    device_str = "GPU" if "CUDAExecutionProvider" in providers else "CPU"

    pixel_values = preprocess_image(image_path, model_map["image_processor"])

    ort_inputs = {model_map["input_name"]: pixel_values}
    logits = ort_session.run([model_map["output_name"]], ort_inputs)[0]  # [B,num_labels]
    logits = np.asarray(logits)

    inference_time = round((time.time() - start_time) * 1000, 2)

    # MULTILABEL: sigmoid por clase
    probs = _sigmoid_np(logits)[0]  # [num_labels]

    activated = [i for i, p in enumerate(probs.tolist()) if p >= threshold]

    summary = ["0"] * len(probs)
    for i in activated:
        summary[i] = "1"

    # nombres (primero id2label del modelo, si no, fallback)
    id2label = model_map["id2label"] or {}
    fallback = model_map["labels_fallback"]

    biomarker_names = []
    for i in activated:
        name = None
        if isinstance(id2label, dict) and i in id2label:
            name = id2label[i]
        if name is None:
            name = fallback.get(str(i), str(i))
        biomarker_names.append(name)

    # labels dict para UI
    labels_out = {}
    for i in range(len(probs)):
        if isinstance(id2label, dict) and i in id2label:
            labels_out[str(i)] = id2label[i]
        else:
            labels_out[str(i)] = fallback.get(str(i), str(i))

    return {
        "device": device_str,
        "id_model": model_map["id_model"],
        "predicted_labels": activated,
        "biomarker_names": biomarker_names,
        "summary": summary,
        "labels": labels_out,
        "vector_probs": probs.tolist(),
        "time_inference": inference_time,
        "filename": filename,
        "threshold": threshold,
    }
