import os
import torch
from transformers import ViTForImageClassification

MODEL_DIR = r"app/models/model_vit_biomarkers_diabetic_retinopathy"
ONNX_PATH = os.path.join(MODEL_DIR, "model_vit.onnx")
OPSET = 18


class ViTOnnxWrapper(torch.nn.Module):
    def __init__(self, model: ViTForImageClassification):
        super().__init__()
        self.model = model

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        out = self.model(pixel_values=pixel_values)
        return out.logits


def export_vit_to_onnx():
    device = torch.device("cpu")
    model = ViTForImageClassification.from_pretrained(MODEL_DIR).to(device)
    model.eval()

    wrapper = ViTOnnxWrapper(model).to(device)
    wrapper.eval()

    # ViT está "especializado" a un tamaño (normalmente 224x224).
    # Exportamos con ese tamaño fijo.
    dummy = torch.randn(1, 3, 224, 224, dtype=torch.float32, device=device)

    os.makedirs(os.path.dirname(ONNX_PATH), exist_ok=True)

    torch.onnx.export(
        wrapper,
        (dummy,),
        ONNX_PATH,
        input_names=["pixel_values"],
        output_names=["logits"],
        opset_version=OPSET,
        do_constant_folding=True,
        dynamic_axes={
            "pixel_values": {0: "batch"},
            "logits": {0: "batch"},
        },
    )

    print("ONNX export OK:", ONNX_PATH)


if __name__ == "__main__":
    export_vit_to_onnx()
