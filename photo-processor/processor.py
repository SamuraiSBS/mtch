"""Local CPU portrait normalization. CLI: processor.py input output-directory."""

import json
import os
import sys
import time
import warnings
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
FACE_MODEL = ROOT / "models/face_detection_yunet_2023mar.onnx"
PERSON_MATTING_MODEL = ROOT / "models/ppmattingv2-stdc1-human_512.onnx"
PERSON_SEGMENTATION_MODEL = ROOT / "models/human_segmentation_pphumanseg_2023mar.onnx"
BACKGROUND = (242, 242, 240)
MATTING_INPUT_SIZE = 512
MAX_PIXELS = 24_000_000
MIN_SIDE = 256
DETECTION_MAX_SIDE = 640
HEAD_RATIO = 0.45
TOP_MARGIN = 0.22
WEBP_QUALITY = 88
SIZES = (800, 256, 64)


class PhotoError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def select_face(faces, image_width, image_height):
    if len(faces) == 0:
        raise PhotoError("FACE_NOT_FOUND", "Не удалось обнаружить лицо на фотографии")
    largest = max(float(face[2] * face[3]) for face in faces)
    close = [face for face in faces if face[2] * face[3] >= largest * 0.88]
    return min(close, key=lambda face: (face[0] + face[2] / 2 - image_width / 2) ** 2 + (face[1] + face[3] / 2 - image_height / 2) ** 2)


def peak_memory_mb():
    if os.name == "nt":
        import ctypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_ulong), ("page_faults", ctypes.c_ulong)] + [
                (name, ctypes.c_size_t) for name in (
                    "peak_working_set", "working_set", "quota_peak_paged", "quota_paged",
                    "quota_peak_nonpaged", "quota_nonpaged", "pagefile", "peak_pagefile", "private",
                )
            ]

        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        current_process = ctypes.windll.kernel32.GetCurrentProcess
        current_process.restype = ctypes.c_void_p
        get_memory = ctypes.windll.psapi.GetProcessMemoryInfo
        get_memory.argtypes = (ctypes.c_void_p, ctypes.POINTER(Counters), ctypes.c_ulong)
        if get_memory(current_process(), ctypes.byref(counters), counters.cb):
            return round(counters.peak_working_set / 1024 / 1024, 1)
        return None
    import resource

    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(peak / (1024 if sys.platform != "darwin" else 1024 * 1024), 1)


def crop_box(face):
    x, y, width, height = [float(v) for v in face[:4]]
    side = max(width * 2.7, height / HEAD_RATIO)
    center_x = x + width / 2
    top = y - side * TOP_MARGIN
    return (round(center_x - side / 2), round(top), round(center_x + side / 2), round(top + side))


def is_grayscale(image):
    sample = np.asarray(image.resize((128, 128)), dtype=np.int16)
    return float(np.percentile(sample.max(axis=2) - sample.min(axis=2), 90)) < 8.0


def detect(image, detector):
    width, height = image.size
    scale = min(1.0, DETECTION_MAX_SIDE / max(width, height))
    array = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
    if scale < 1:
        array = cv2.resize(array, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    detector.setInputSize((array.shape[1], array.shape[0]))
    _, faces = detector.detect(array)
    if faces is None:
        return []
    return [face / np.array([scale] * 14 + [1], dtype=np.float32) for face in faces]


def normalize(image, grayscale, valid_area):
    data = np.asarray(image, dtype=np.float32)
    luminance = 0.2126 * data[:, :, 0] + 0.7152 * data[:, :, 1] + 0.0722 * data[:, :, 2]
    included = np.asarray(valid_area) > 127
    low, high = np.percentile(luminance[included], [5, 95])
    middle = float(np.median(luminance[included]))
    exposure = float(np.clip(115 / max(middle, 1), 0.82, 1.18))
    contrast = float(np.clip(170 / max(high - low, 1), 0.92, 1.08))
    data = (data - middle) * contrast + middle
    data *= exposure
    # Only a bounded, global correction on clearly neutral pixels.
    if not grayscale:
        neutral = (np.max(data, axis=2) - np.min(data, axis=2) < 10) & included
        if neutral.sum() > included.sum() * 0.05:
            means = data[neutral].mean(axis=0)
            balance = np.clip(means.mean() / np.maximum(means, 1), 0.97, 1.03)
            data *= balance
        gray = data @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        data = gray[:, :, None] + (data - gray[:, :, None]) * 1.02
    else:
        gray = data @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        data = np.repeat(gray[:, :, None], 3, axis=2)
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)))


def segmentation_mask(image, model):
    rgb = np.asarray(image)
    small = cv2.resize(rgb, (192, 192), interpolation=cv2.INTER_AREA).astype(np.float32)
    blob = cv2.dnn.blobFromImage((small / 255.0 - 0.5) / 0.5)
    model.setInput(blob)
    logits = model.forward()[0]
    if logits.shape[0] != 2:
        raise PhotoError("BACKGROUND_REMOVAL_FAILED", "Не удалось обработать фон")
    # The OpenCV Zoo model already returns two class probabilities.
    probability = logits[1]
    probability = cv2.resize(probability, image.size, interpolation=cv2.INTER_LINEAR)
    probability = np.clip((probability - 0.35) / 0.3, 0, 1)
    # The segmentation network attenuates foreground along its bottom border.
    # Continue only foreground already present just above that narrow border.
    edge = max(2, round(image.height * 0.015))
    probability[-edge:, :] = np.maximum(probability[-edge:, :], probability[-edge - 1, :][None, :])
    if float(np.max(probability)) < 0.5 or float(np.mean(probability)) < 0.02:
        raise PhotoError("BACKGROUND_REMOVAL_FAILED", "Не удалось обработать фон")
    return probability[:, :, None]


def person_mask(image, model):
    rgb = np.asarray(image)
    small = cv2.resize(rgb, (MATTING_INPUT_SIZE, MATTING_INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    tensor = ((small.astype(np.float32) / 255.0 - 0.5) / 0.5).transpose(2, 0, 1)[None, ...]
    input_name = model.get_inputs()[0].name
    output = model.run(None, {input_name: np.ascontiguousarray(tensor)})[0]
    expected_shape = (1, 1, MATTING_INPUT_SIZE, MATTING_INPUT_SIZE)
    if output.shape != expected_shape or not np.isfinite(output).all():
        raise PhotoError("BACKGROUND_REMOVAL_FAILED", "Не удалось обработать фон")
    probability = np.clip(output[0, 0], 0.0, 1.0)
    probability = cv2.resize(probability, image.size, interpolation=cv2.INTER_LINEAR)
    if float(np.max(probability)) < 0.5 or float(np.mean(probability)) < 0.02:
        raise PhotoError("BACKGROUND_REMOVAL_FAILED", "Не удалось обработать фон")
    return probability[:, :, None]


def process(source, destination):
    started = time.monotonic()
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    try:
        with Image.open(source) as original:
            if original.format not in {"JPEG", "PNG", "WEBP"}:
                raise PhotoError("UNSUPPORTED_FORMAT", "Неподдерживаемый формат")
            if min(original.size) < MIN_SIDE or original.width * original.height > MAX_PIXELS:
                raise PhotoError("INVALID_IMAGE_SIZE", "Размер фотографии не подходит")
            original.load()
            oriented = ImageOps.exif_transpose(original)
            if "A" in oriented.getbands() or "transparency" in oriented.info:
                rgba = oriented.convert("RGBA")
                image = Image.new("RGB", rgba.size, BACKGROUND)
                image.paste(rgba, mask=rgba.getchannel("A"))
            else:
                image = oriented.convert("RGB")
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise PhotoError("INVALID_IMAGE_SIZE", "Размер фотографии не подходит") from error
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise PhotoError("INVALID_IMAGE", "Файл изображения повреждён") from error

    grayscale = is_grayscale(image)
    detector = cv2.FaceDetectorYN.create(str(FACE_MODEL), "", (320, 320), 0.6, 0.3, 5000)
    faces = detect(image, detector)
    face = select_face(faces, *image.size)
    box = crop_box(face)
    square = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), BACKGROUND)
    square.paste(image, (-box[0], -box[1]))
    valid_area = Image.new("L", square.size)
    valid_area.paste(Image.new("L", image.size, 255), (-box[0], -box[1]))
    if square.width > 1600:
        square = square.resize((1600, 1600), Image.Resampling.LANCZOS)
        valid_area = valid_area.resize((1600, 1600), Image.Resampling.NEAREST)
    try:
        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = 2
        session_options.inter_op_num_threads = 1
        session_options.log_severity_level = 3
        model = ort.InferenceSession(
            str(PERSON_MATTING_MODEL),
            sess_options=session_options,
            providers=["CPUExecutionProvider"],
        )
        mask = person_mask(square, model)
    except Exception:
        try:
            fallback_model = cv2.dnn.readNet(str(PERSON_SEGMENTATION_MODEL))
            mask = segmentation_mask(square, fallback_model)
        except (cv2.error, PhotoError) as fallback_error:
            raise PhotoError("BACKGROUND_REMOVAL_FAILED", "Не удалось обработать фон") from fallback_error
    mask[np.asarray(valid_area) <= 127] = 0
    corrected = np.asarray(normalize(square, grayscale, valid_area), dtype=np.float32)
    result = corrected * mask + np.array(BACKGROUND, dtype=np.float32)[None, None, :] * (1 - mask)
    result = Image.fromarray(np.uint8(np.clip(result, 0, 255)))
    destination.mkdir(parents=True, exist_ok=True)
    for side in SIZES:
        result.resize((side, side), Image.Resampling.LANCZOS).save(destination / f"avatar_{side}.webp", "WEBP", lossless=True, quality=WEBP_QUALITY, method=6)
    return {"faces": len(faces), "rotation": 0.0, "durationMs": round((time.monotonic() - started) * 1000), "peakRssMb": peak_memory_mb()}


if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, **process(Path(sys.argv[1]), Path(sys.argv[2]))}))
    except PhotoError as error:
        print(json.dumps({"ok": False, "code": error.code, "message": str(error)}))
        sys.exit(2)
    except Exception as error:
        print(json.dumps({"ok": False, "code": "IMAGE_PROCESSING_FAILED", "message": "Не удалось обработать фотографию"}))
        print(repr(error), file=sys.stderr)
        sys.exit(3)
