from PIL import Image
import time

import torch
import torch.nn.functional as F
from transformers import ViTForImageClassification, ViTImageProcessor

# =========================
# CONFIG
# =========================
MODEL_DIR = r"app/models/model_vit_diabetic_retinopathy"

DISEASES = [
    {
        "id_disease": 1,
        "name": "Normal",
    },
    {
        "id_disease": 2,
        "name": "Diabetic Retinopathy",

    },
]

ID_MODEL = 1

model_map = {}

def init_models_local():
    global model_map

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = ViTForImageClassification.from_pretrained(MODEL_DIR)
    image_processor = ViTImageProcessor.from_pretrained(MODEL_DIR)

    model.to(device)
    model.eval()

    model_map = {
        "id_model": ID_MODEL,
        "model_dir": MODEL_DIR,
        "model": model,
        "image_processor": image_processor,
        "diseases": DISEASES,
        "device": device,
    }

def preprocess_image(image_path, image_processor, device):
    image = Image.open(image_path).convert("RGB")
    inputs = image_processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    return inputs

def predict_image(image_path, filename=None):
    if not model_map:
        init_models_local()

    start_time = time.time()

    device = model_map["device"]
    device_str = "GPU" if device.type == "cuda" else "CPU"

    model = model_map["model"]
    inputs = preprocess_image(image_path, model_map["image_processor"], device)

    with torch.no_grad():
        outputs = model(**inputs)

    inference_time = round((time.time() - start_time) * 1000, 2)

    logits = outputs.logits
    probs = F.softmax(logits, dim=-1)

    predicted_class_idx = int(torch.argmax(logits, dim=-1).item())
    predicted_label = model.config.id2label.get(predicted_class_idx, str(predicted_class_idx))

    summary_results = ["0"] * len(model.config.id2label)
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
        "labels": model.config.id2label,
        "vector_probs": probs.squeeze().tolist(),
        "time_inference": inference_time,
        "filename": filename,
    }
