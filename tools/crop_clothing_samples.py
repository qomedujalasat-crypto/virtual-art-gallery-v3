#!/usr/bin/env python3
"""
Create crop samples from clothing photos without changing the originals.

Usage:
  python tools/crop_clothing_samples.py
  python tools/crop_clothing_samples.py --count 3

Requirements:
  pip install opencv-python pillow

For each photo, draw a rectangle around the garment to keep, then press ENTER
or SPACE. Press C to cancel that photo. Cropped samples are written to
crop_samples/; files in images/ are never overwritten.
"""
from pathlib import Path
import argparse
import cv2

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "images"
OUTPUT_DIR = ROOT / "crop_samples"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=3, help="number of photos to process")
    args = parser.parse_args()

    files = sorted(
        p for p in IMAGE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )
    if not files:
        raise SystemExit(f"No image files found in {IMAGE_DIR}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    done = 0
    for path in files:
        if done >= args.count:
            break
        image = cv2.imread(str(path))
        if image is None:
            continue
        # Resize only the selection preview; map the selected box back to original pixels.
        h, w = image.shape[:2]
        scale = min(1.0, 1100 / max(w, h))
        preview = cv2.resize(image, (int(w * scale), int(h * scale))) if scale < 1 else image
        print(f"Select the garment to keep in: {path.name} (ENTER/SPACE=accept, C=skip)")
        roi = cv2.selectROI("Select garment crop", preview, showCrosshair=True, fromCenter=False)
        cv2.destroyWindow("Select garment crop")
        x, y, rw, rh = [int(v / scale) for v in roi]
        if rw < 2 or rh < 2:
            continue

        # Add a modest margin around the selected garment.
        margin_x = int(rw * 0.035)
        margin_y = int(rh * 0.025)
        x1 = max(0, x - margin_x)
        y1 = max(0, y - margin_y)
        x2 = min(w, x + rw + margin_x)
        y2 = min(h, y + rh + margin_y)
        cropped = image[y1:y2, x1:x2]
        out = OUTPUT_DIR / f"{path.stem}_sample{path.suffix.lower()}"
        if cv2.imwrite(str(out), cropped):
            print(f"Saved sample: {out.relative_to(ROOT)}")
            done += 1

    print(f"Finished: {done} sample(s) in {OUTPUT_DIR}")
    print("Original images were not modified. Review the samples before replacing anything.")

if __name__ == "__main__":
    main()
