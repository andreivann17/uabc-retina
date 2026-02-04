from PIL import Image
import time
import os
import numpy as np

import torch
import torch.nn.functional as F
from transformers import ViTForImageClassification, ViTImageProcessor

import onnxruntime as ort


# =========================
# CONFIG
# =========================
MODEL_DIR = r"app/models/model_vit_diabetic_retinopathy"
ONNX_PATH = os.path.join(MODEL_DIR, "model_vit.onnx")

DISEASES = [
    {"id_disease": 1, "name": "Diabetic Retinopathy"},
    {"id_disease": 2, "name": "Normal"},
]

ID_MODEL = 1
model_map = {}


def init_models_local():
    global model_map

    # ONNXRuntime: si hay CUDA disponible, úsalo; si no, CPU.
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    available = ort.get_available_providers()
    providers = [p for p in providers if p in available]
    if not providers:
        providers = ["CPUExecutionProvider"]

    ort_session = ort.InferenceSession(ONNX_PATH, providers=providers)

    # Para labels/id2label seguimos leyendo config desde el modelo HF (ligero y confiable)
    model_hf = ViTForImageClassification.from_pretrained(MODEL_DIR)
    image_processor = ViTImageProcessor.from_pretrained(MODEL_DIR)

    model_map = {
        "id_model": ID_MODEL,
        "model_dir": MODEL_DIR,
        "image_processor": image_processor,
        "diseases": DISEASES,
        "ort_session": ort_session,
        "providers": providers,
        "id2label": model_hf.config.id2label,
        "num_labels": len(model_hf.config.id2label),
    }


def preprocess_image(image_path, image_processor):
    image = Image.open(image_path).convert("RGB")
    inputs = image_processor(images=image, return_tensors="pt")
    pixel_values = inputs["pixel_values"]  # torch tensor: [1,3,H,W]
    # ONNXRuntime requiere numpy float32
    return pixel_values.detach().cpu().numpy().astype(np.float32)


def predict_image(image_path, filename=None):
    if not model_map:
        init_models_local()

    start_time = time.time()

    ort_session = model_map["ort_session"]
    providers = model_map["providers"]
    device_str = "GPU" if "CUDAExecutionProvider" in providers else "CPU"

    pixel_values = preprocess_image(image_path, model_map["image_processor"])

    # Inferencia ONNX
    ort_inputs = {"pixel_values": pixel_values}
    logits = ort_session.run(["logits"], ort_inputs)[0]  # numpy [B, num_labels]

    inference_time = round((time.time() - start_time) * 1000, 2)

    # Softmax y argmax (puedes hacerlo con numpy o torch; aquí torch por consistencia)
    logits_t = torch.from_numpy(logits)
    probs = F.softmax(logits_t, dim=-1)

    predicted_class_idx = int(torch.argmax(logits_t, dim=-1).item())
    id2label = model_map["id2label"]
    predicted_label = id2label.get(predicted_class_idx, str(predicted_class_idx))

    summary_results = ["0"] * model_map["num_labels"]
    if 0 <= predicted_class_idx < len(summary_results):
        summary_results[predicted_class_idx] = "1"

    diseases_list = model_map.get("diseases", [])
    id_disease = None
    if 0 <= predicted_class_idx < len(diseases_list):
        id_disease = diseases_list[predicted_class_idx].get("id_disease")

    return {
        "device": device_str,
        "predicted_label": predicted_label,
        "diseases": diseases_list,
        "id_model": model_map["id_model"],
        "summary": summary_results,
        "id_disease": id_disease,
        "labels": id2label,
        "vector_probs": probs.squeeze().tolist(),
        "time_inference": inference_time,
        "filename": filename,
    }
