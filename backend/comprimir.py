import subprocess
from pathlib import Path


GS_PATH = r"C:\Program Files\gs\gs10.06.0\bin\gswin64c.exe"

def compress_pdf(input_pdf, output_pdf, quality="ebook"):
    in_path = Path(input_pdf)
    out_path = Path(output_pdf)

    if not in_path.exists():
        raise FileNotFoundError(in_path)

    presets = {
        "screen": "/screen",
        "ebook": "/ebook",
        "printer": "/printer",
        "prepress": "/prepress",
        "default": "/default",
    }

    preset = presets.get(quality, "/ebook")

    cmd = [
        GS_PATH,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={preset}",
        "-dNOPAUSE",
        "-dBATCH",
        "-dQUIET",
        f"-sOutputFile={out_path}",
        str(in_path),
    ]

    subprocess.run(cmd, check=True)


#if __name__ == "__main__":
    #compress_pdf(r"uploads/desvinculaciones/22/1766303372775.pdf", r"uploads/desvinculaciones/22/1766303372775-comprmido.pdf", quality="ebook")
