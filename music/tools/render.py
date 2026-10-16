"""渲染全部曲目为 44.1kHz 立体声 WAV。

用法：
    python render.py                # 渲染全部
    python render.py wind-lung      # 只渲染指定曲目
    python render.py --list         # 列出曲库
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
from engine import SR, VOICES, mix_track, master, write_wav, report
from scores import TRACKS, STINGERS

OUT = Path(__file__).resolve().parent.parent / "assets" / "music"


def render_one(entry: dict, kind: str = "track") -> tuple[str, np.ndarray]:
    spec = entry["score"]()
    events = spec["events"]
    if not events:
        raise SystemExit(f"{entry['id']} 没有音符事件")
    # 防止织体助手误用（例如 list * n 产生嵌套列表）导致渲染出静音
    bad = [e for e in events if not isinstance(e, dict) or "voice" not in e or "beat" not in e]
    if bad:
        raise SystemExit(f"{entry['id']} 存在 {len(bad)} 个非法事件，首个为 {bad[0]!r}")
    unknown = {e["voice"] for e in events} - set(VOICES)
    if unknown:
        raise SystemExit(f"{entry['id']} 使用了未定义的音色：{sorted(unknown)}")
    buffer = mix_track(events, spec["bpm"], spec["beats"], seed=hash(entry["id"]) % 9999)
    fade = (0.6, 2.4) if kind == "stinger" else (1.2, 3.0)
    finished = master(buffer, wet=spec.get("wet", 0.30), rt60=spec.get("rt60", 2.4),
                      target_peak_dbfs=-1.2, target_rms_dbfs=-18.0, fade=fade)
    return entry["file"], finished


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--list" in sys.argv:
        for track in TRACKS:
            print(f"  曲目  {track['id']:<18} {track['title']}  ({track['key']}, {track['bpm']} BPM) — {track['scene']}")
        for sting in STINGERS:
            print(f"  动机  {sting['id']:<18} {sting['title']}  — {sting['use']}")
        return

    OUT.mkdir(parents=True, exist_ok=True)
    plan = [(t, "track") for t in TRACKS] + [(s, "stinger") for s in STINGERS]
    if args:
        plan = [(e, k) for e, k in plan if e["id"] in args or e["file"] in args]
        if not plan:
            raise SystemExit("没有匹配的曲目，用 --list 查看可用 id。")

    started = time.time()
    print(f"采样率 {SR} Hz · 立体声 · 目标真峰 -1.2 dBFS\n")
    for entry, kind in plan:
        tick = time.time()
        filename, audio = render_one(entry, kind)
        write_wav(OUT / filename, audio)
        label = f"{entry['title']} / {filename}"
        print(report(label, audio) + f"  [{time.time() - tick:5.1f}s]")
    print(f"\n完成 {len(plan)} 个文件，输出目录 {OUT}，总耗时 {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
