import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

from pathlib import Path
import tensorflow as tf
import tf2onnx

# Usa Keras legacy (Keras 2 API) para cargar H5 viejo
import tf_keras as keras


H5_PATH = r"app/models/model_biomarker.h5"
ONNX_PATH = r"app/models/model_biomarker.onnx"
OPSET = 17


def main():
    h5_path = Path(H5_PATH)
    onnx_path = Path(ONNX_PATH)
    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    # Carga con legacy keras (esto es lo que evita el error de "dense recibe 2 inputs")
    model = keras.models.load_model(str(h5_path), compile=False)

    # input signature
    input_signature = []
    for inp in model.inputs:
        input_signature.append(
            tf.TensorSpec(
                shape=[None] + list(inp.shape[1:]),
                dtype=inp.dtype,
                name=inp.name.split(":")[0],
            )
        )

    # warmup build
    _ = model(*[tf.zeros([1] + list(i.shape[1:]), dtype=i.dtype) for i in model.inputs])

    tf2onnx.convert.from_keras(
        model,
        input_signature=input_signature,
        opset=OPSET,
        output_path=str(onnx_path),
    )

    print("ONNX exportado correctamente")
    print("Ruta:", onnx_path)


if __name__ == "__main__":
    main()
