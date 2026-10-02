"""Download the two pinned OpenCV Zoo weights and verify their Git LFS OIDs."""

import hashlib
import os
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent / "models"
BASE = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        f"{BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "human_segmentation_pphumanseg_2023mar.onnx": (
        f"{BASE}/human_segmentation_pphumanseg/human_segmentation_pphumanseg_2023mar.onnx",
        "552d8a984054e59b5d773d24b9b12022b22046ceb2bbc4c9aaeaceb36a9ddf24",
    ),
    "ppmattingv2-stdc1-human_512.onnx": (
        "https://huggingface.co/pstic/spatialthings-onnx/resolve/main/ppmattingv2-stdc1-human_512.onnx",
        "448d0a5d143426057e6cedbd1711ee8059b4f7057e030f0a33cab3a1ed141567",
    ),
}


def main(verify_only=False):
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in MODELS.items():
        destination = ROOT / name
        if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == digest:
            continue
        if verify_only:
            raise ValueError(f"Missing or mismatched pinned model: {name}")
        temporary = ROOT / (name + ".tmp")
        try:
            with urlopen(url, timeout=90) as response, temporary.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            if hashlib.sha256(temporary.read_bytes()).hexdigest() != digest:
                raise ValueError(f"Checksum mismatch for {name}")
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main("--verify-only" in sys.argv[1:])
