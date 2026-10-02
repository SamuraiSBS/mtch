import shutil
import unittest
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

from processor import PhotoError, crop_box, is_grayscale, process, select_face


class GeometryTests(unittest.TestCase):
    def test_largest_face_wins(self):
        faces = [np.array([10, 10, 20, 20]), np.array([60, 60, 40, 40])]
        self.assertIs(select_face(faces, 200, 200), faces[1])

    def test_near_equal_faces_choose_center(self):
        faces = [np.array([0, 0, 40, 40]), np.array([80, 80, 39, 39])]
        self.assertIs(select_face(faces, 200, 200), faces[1])

    def test_missing_face(self):
        with self.assertRaisesRegex(PhotoError, "лицо"):
            select_face([], 100, 100)

    def test_crop_is_square_and_has_shoulder_room(self):
        left, top, right, bottom = crop_box([80, 80, 80, 80])
        self.assertEqual(right - left, bottom - top)
        self.assertLess(top, 80)
        self.assertGreater(bottom, 160)

    def test_grayscale_detection(self):
        self.assertTrue(is_grayscale(Image.new("RGB", (256, 256), (50, 50, 50))))
        self.assertFalse(is_grayscale(Image.new("RGB", (256, 256), (50, 80, 110))))


class ProcessorTests(unittest.TestCase):
    def test_real_portrait_outputs_three_clean_webps(self):
        fixture = Path(__file__).parent / "fixtures/astronaut.png"
        if not fixture.exists() or not (Path(__file__).parent / "models/face_detection_yunet_2023mar.onnx").exists():
            self.skipTest("Portrait fixture or models unavailable")
        output = Path.cwd() / ".tmp" / f"photo-test-{uuid.uuid4().hex}"
        output.mkdir(parents=True)
        try:
            metrics = process(fixture, output)
            self.assertGreaterEqual(metrics["faces"], 1)
            for size in (800, 256, 64):
                with Image.open(output / f"avatar_{size}.webp") as image:
                    self.assertEqual(image.size, (size, size))
                    self.assertEqual(image.format, "WEBP")
                    self.assertFalse(image.getexif())
                    self.assertNotIn("icc_profile", image.info)
                    np.testing.assert_allclose(image.convert("RGB").getpixel((0, 0)), (242, 242, 240), atol=2)
        finally:
            shutil.rmtree(output)

    def test_internet_portraits_keep_the_original_orientation(self):
        fixtures = sorted((Path(__file__).parent / "fixtures/hair_quality").glob("*.jpg"))
        if not fixtures or not (Path(__file__).parent / "models/ppmattingv2-stdc1-human_512.onnx").exists():
            self.skipTest("Internet portrait fixtures or models unavailable")
        for fixture in fixtures:
            with self.subTest(photo=fixture.name):
                output = Path.cwd() / ".tmp" / f"photo-test-{uuid.uuid4().hex}"
                output.mkdir(parents=True)
                try:
                    metrics = process(fixture, output)
                    self.assertGreaterEqual(metrics["faces"], 1)
                    self.assertEqual(metrics["rotation"], 0.0)
                    for size in (800, 256, 64):
                        with Image.open(output / f"avatar_{size}.webp") as image:
                            self.assertEqual(image.size, (size, size))
                            self.assertEqual(image.format, "WEBP")
                finally:
                    shutil.rmtree(output)


if __name__ == "__main__":
    unittest.main()
