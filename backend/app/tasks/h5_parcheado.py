import json
import shutil
from pathlib import Path

import h5py


H5_IN = r"app/models/model_comprobar_retina_inceptionv3.h5"
H5_OUT = r"app/models/model_comprobar_retina_inceptionv3_fixed.h5"


def _fix_axis(obj):
    if isinstance(obj, dict):
        # caso típico: {"axis":[3]} -> {"axis":3}
        if "axis" in obj and isinstance(obj["axis"], list) and len(obj["axis"]) == 1:
            v = obj["axis"][0]
            if isinstance(v, int):
                obj["axis"] = v

        for k, v in obj.items():
            obj[k] = _fix_axis(v)
        return obj

    if isinstance(obj, list):
        return [_fix_axis(x) for x in obj]

    return obj


def main():
    src = Path(H5_IN)
    dst = Path(H5_OUT)
    dst.parent.mkdir(parents=True, exist_ok=True)

    # copia de seguridad
    shutil.copy2(src, dst)

    with h5py.File(dst, "r+") as f:
        if "model_config" not in f.attrs:
            raise RuntimeError("El archivo .h5 no trae 'model_config' en attrs. No es un H5 de Keras estándar.")

        raw = f.attrs["model_config"]
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")

        cfg = json.loads(raw)
        cfg_fixed = _fix_axis(cfg)

        f.attrs["model_config"] = json.dumps(cfg_fixed).encode("utf-8")

    print("OK. H5 parchado:", str(dst))


if __name__ == "__main__":
    main()
