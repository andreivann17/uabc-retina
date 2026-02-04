from PIL import Image
import torch
import torch.nn.functional as F
import time
from ..tasks.stages_ViT import predict_image as predict_image_stages
from ..tasks.diseases_ViT import predict_image as predict_image_disease
from ..tasks.biomarkers_vit import predict_image as predict_image_biomarkers
tok = None
model = None


def predict_image(image_path,filename):
    start_time = time.time()
    data_biomarkers = predict_image_biomarkers(image_path)
    if data_biomarkers["predicted_labels"]:  # Si hay al menos 1 biomarcador
        data_stages = {}  # para retorno coherente
    else:
        data_stages = predict_image_stages(image_path)
    inference_time = round((time.time() - start_time) * 1000, 2)

    return {
    "labels_stage": data_stages.get("labels", {}),
    "labels_biomarkers": data_biomarkers.get("labels", {}),
    "summary_stage": data_stages.get("summary", []),
    "summary_biomarkers": data_biomarkers.get("summary", []),
    "time_inference": inference_time
}
