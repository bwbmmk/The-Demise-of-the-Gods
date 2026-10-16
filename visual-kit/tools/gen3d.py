"""Call the bundled multimodal skill's 3D generator with a local image.

The skill script only accepts an image URL or an inline base64 argv value.
A 1024x1024 PNG base64 string blows past the Windows CreateProcess argv
limit (32767 chars), so this wrapper sets sys.argv *inside* the process
and runs the skill script with runpy. No OS limit applies then.

Usage:
    python gen3d.py <image-path> <clientTempToken> [prompt]
"""

import base64
import runpy
import sys
from pathlib import Path

SKILL = Path(
    r"D:\Workbubdy\workbuddy\resources\app.asar.unpacked\resources\plugins"
    r"\workbuddy-builtin\skills\buddy-multimodal-generation\scripts"
    r"\buddy-multimodal-generation.py"
)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    image_path, token = sys.argv[1], sys.argv[2]
    prompt = sys.argv[3] if len(sys.argv) > 3 else ""

    raw = Path(image_path).read_bytes()
    if len(raw) > 4_500_000:
        raise SystemExit(f"image too large for base64 input: {len(raw)} bytes")
    b64 = base64.b64encode(raw).decode("ascii")

    sys.argv = [
        str(SKILL), "3d",
        "--image-base64", b64,
        "--enable-pbr",
        "--generate-type", "Normal",
        "--face-count", "300000",
        "--token", token,
    ]
    if prompt:
        sys.argv.insert(2, prompt)

    runpy.run_path(str(SKILL), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
