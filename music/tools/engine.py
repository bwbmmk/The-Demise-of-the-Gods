"""《神之殇》扩展曲库渲染引擎。

设计原则
--------
1. 与仓库现有 src/music.js 保持同一技术路线：原创乐谱 + 代码合成，无第三方采样。
2. 但改用采样级离线渲染：加法合成 + 物理建模泛音列 + 双二阶滤波包络 + 卷积混响。
3. 立体声输出、44.1kHz、真峰归一化，可直接替换现有 WAV 资产。

音色实现思路
------------
真实乐器不是"正弦波 + 包络"，而是「泛音列 + 各自独立的衰减率」。
本引擎为每个 voice 定义 partials 表（倍频比、幅度、衰减系数），
再叠加起振噪声与非线性（琴槌、弓弦、气流）以摆脱电子感。
空间感由卷积混响完成：合成一段指数衰减噪声作为脉冲响应。
"""

from __future__ import annotations

import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100


# --------------------------------------------------------------------------- #
# 混响：指数衰减噪声脉冲响应（类似大厅 / 石室）
# --------------------------------------------------------------------------- #
class Reverb:
    """卷积混响。石室空间用较长 RT60 与较暗的阻尼。"""

    def __init__(self, rt60: float = 2.4, damping: float = 0.42, pre_delay: float = 0.022,
                 seed: int = 20261003):
        rng = np.random.default_rng(seed)
        length = int(rt60 * SR)
        t = np.arange(length) / SR
        impulse = rng.normal(0, 1, length) * np.exp(-6.9078 * t / rt60)
        # 早期反射：让空间有边界感，而不是无限雾
        for delay, gain in ((0.011, 0.42), (0.019, 0.33), (0.031, 0.24), (0.047, 0.15)):
            index = int(delay * SR)
            if index < length:
                impulse[index] += gain
        # 阻尼：高频衰减更快，模拟空气与石壁吸收
        sos = butter(2, 3200 * (1 - damping) + 400, btype="low", fs=SR, output="sos")
        impulse = sosfilt(sos, impulse)
        impulse /= np.sqrt(np.sum(impulse ** 2)) or 1.0
        pad = int(pre_delay * SR)
        self.ir = np.concatenate([np.zeros(pad), impulse])

    def apply(self, dry: np.ndarray, wet: float = 0.28) -> np.ndarray:
        if wet <= 0:
            return dry
        wet_signal = fftconvolve(dry, self.ir)[: len(dry)]
        peak = np.max(np.abs(wet_signal))
        if peak > 0:
            dry_peak = np.max(np.abs(dry)) or 1.0
            wet_signal *= dry_peak / peak
        return dry * (1 - wet * 0.45) + wet_signal * wet


# --------------------------------------------------------------------------- #
# 音色表：每个 voice = 泛音列 + 衰减率 + 起振噪声 + 立体声宽度
# --------------------------------------------------------------------------- #
# partials: (倍频比, 相对幅度, 衰减倍率)
#
# 标定说明：分音包络为 exp(-damp * 1.35 * t)，因此
#   damp 0.5 → 1 秒后仍有 51%，适合铺底与持续音
#   damp 1.2 → 1 秒后剩 20%，适合钟、弦
#   damp 2.5 → 1 秒后剩 3.4%，适合拨弦的余韵
#   damp 6.0 → 0.3 秒内基本消失，只用于打击瞬态
# 幅度按 1/n^0.7 量级的真实乐器滚降设定，避免只听到基音而发闷。
VOICES: dict[str, dict] = {
    # 低音铺底：接近大提琴 / 管风琴混合体，缓慢起振
    "pad": {
        "partials": [(1, 1.000, 0.42), (2, 0.480, 0.52), (3, 0.255, 0.64), (4, 0.150, 0.78),
                     (5, 0.092, 0.94), (6, 0.058, 1.12), (7, 0.037, 1.32), (8, 0.024, 1.55),
                     (10, 0.012, 2.0), (12, 0.006, 2.5)],
        "attack": 0.85, "release": 1.5, "decay": 0.16, "noise": 0.0014,
        "noise_hz": 1600, "detune": 4.5, "width": 0.85, "gain_scale": 1.0,
    },
    # 分解和弦拨弦：竖琴 / 古钢琴的混合
    "pluck": {
        "partials": [(1, 1.000, 1.10), (2, 0.560, 1.30), (3, 0.360, 1.52), (4, 0.245, 1.78),
                     (5, 0.168, 2.06), (6, 0.116, 2.38), (7, 0.080, 2.72), (8, 0.055, 3.10),
                     (9, 0.038, 3.5), (10, 0.026, 3.9), (12, 0.014, 4.8), (14, 0.008, 5.8),
                     (16, 0.0045, 6.9), (18, 0.0026, 8.1)],
        "attack": 0.003, "release": 0.24, "decay": 1.05, "noise": 0.013,
        "noise_hz": 6500, "detune": 1.4, "width": 0.45, "gain_scale": 1.0,
    },
    # 主旋律：接近人声化的中提琴，带持续颤音
    "lead": {
        "partials": [(1, 1.000, 0.78), (2, 0.520, 0.92), (3, 0.325, 1.08), (4, 0.205, 1.26),
                     (5, 0.132, 1.46), (6, 0.086, 1.68), (7, 0.056, 1.92), (8, 0.037, 2.18),
                     (9, 0.024, 2.46), (10, 0.016, 2.76), (12, 0.0072, 3.4), (14, 0.0034, 4.2)],
        "attack": 0.13, "release": 0.42, "decay": 0.30, "noise": 0.0042,
        "noise_hz": 3200, "detune": 2.6, "width": 0.35, "gain_scale": 1.0,
        "vibrato": (4.3, 0.0105), "vibrato_delay": 0.42,
    },
    # 铃：管钟 / 编钟，非谐分音，金属的亮泽来自这些非整数倍分音
    "bell": {
        "partials": [(1, 1.000, 0.62), (2.01, 0.640, 0.78), (2.756, 0.470, 0.95),
                     (3.42, 0.290, 1.14), (4.11, 0.205, 1.36), (4.87, 0.140, 1.60),
                     (5.43, 0.105, 1.86), (6.13, 0.072, 2.14), (6.79, 0.050, 2.44),
                     (8.21, 0.028, 3.05), (9.65, 0.015, 3.7), (11.3, 0.008, 4.5)],
        "attack": 0.002, "release": 1.1, "decay": 0.60, "noise": 0.010,
        "noise_hz": 9000, "detune": 0.7, "width": 0.55, "gain_scale": 1.0,
    },
    # 低鼓：频率下滑 + 点击噪声
    "drum": {
        "partials": [(1, 1.000, 3.4), (1.6, 0.360, 4.4), (2.4, 0.170, 5.6), (3.4, 0.072, 7.0)],
        "attack": 0.0018, "release": 0.12, "decay": 3.0, "noise": 0.075,
        "noise_hz": 2600, "detune": 0.0, "width": 0.16, "gain_scale": 1.0,
        "pitch_drop": (1.68, 5.6),  # (起始倍率, 下滑速率)
    },
    # 风：气流噪声 + 缓慢相位漂移
    "whisper": {
        "partials": [(1, 1.000, 0.46), (2.01, 0.520, 0.58), (3.02, 0.310, 0.72),
                     (4.03, 0.190, 0.88), (5.5, 0.105, 1.06), (7.1, 0.052, 1.30),
                     (9.3, 0.024, 1.6)],
        "attack": 0.95, "release": 1.1, "decay": 0.30, "noise": 0.10,
        "noise_hz": 2200, "detune": 6.0, "width": 1.25, "gain_scale": 1.0,
        "drift": (1.7, 1.5),
    },
    # 潮水：低频涌浪
    "wash": {
        "partials": [(1, 1.000, 0.50), (1.5, 0.430, 0.64), (2.02, 0.300, 0.80),
                     (2.51, 0.190, 0.98), (3.01, 0.135, 1.18), (4.02, 0.070, 1.45),
                     (5.3, 0.032, 1.8), (6.9, 0.014, 2.2)],
        "attack": 1.25, "release": 1.5, "decay": 0.40, "noise": 0.075,
        "noise_hz": 1200, "detune": 5.0, "width": 1.15, "gain_scale": 1.0,
        "drift": (0.85, 0.9),
    },
    # 呼吸：极缓起落
    "breath": {
        "partials": [(1, 1.000, 0.44), (2, 0.400, 0.58), (3, 0.210, 0.74),
                     (4, 0.115, 0.92), (5, 0.060, 1.14), (6.5, 0.026, 1.45)],
        "attack": 1.6, "release": 1.7, "decay": 0.30, "noise": 0.055,
        "noise_hz": 900, "detune": 3.2, "width": 0.9, "gain_scale": 1.0,
        "drift": (0.9, 0.7),
    },
    # 军团推进短音：黄铜感，快起快落
    "stab": {
        "partials": [(1, 1.000, 1.60), (2, 0.640, 1.92), (3, 0.440, 2.26), (4, 0.310, 2.62),
                     (5, 0.215, 3.00), (6, 0.148, 3.40), (7, 0.100, 3.82), (8, 0.066, 4.26),
                     (10, 0.028, 5.2), (12, 0.012, 6.2)],
        "attack": 0.006, "release": 0.13, "decay": 1.55, "noise": 0.026,
        "noise_hz": 4800, "detune": 3.6, "width": 0.75, "gain_scale": 1.0,
    },
    # 丧钟：超长衰减、密集低频分音
    "toll": {
        "partials": [(1, 1.000, 0.40), (2.02, 0.560, 0.54), (2.76, 0.400, 0.68),
                     (3.01, 0.330, 0.84), (4.17, 0.230, 1.02), (5.43, 0.150, 1.22),
                     (6.81, 0.092, 1.45), (8.24, 0.052, 1.75), (8.92, 0.038, 2.05),
                     (11.2, 0.016, 2.6)],
        "attack": 0.0035, "release": 2.0, "decay": 0.30, "noise": 0.014,
        "noise_hz": 5200, "detune": 1.1, "width": 0.9, "gain_scale": 1.0,
    },
    # 余火：暖音，轻微失谐
    "ember": {
        "partials": [(1, 1.000, 1.05), (2.003, 0.480, 1.25), (3.001, 0.270, 1.48),
                     (4.006, 0.145, 1.74), (5.01, 0.078, 2.04), (6.02, 0.040, 2.4),
                     (8.03, 0.016, 3.0)],
        "attack": 0.055, "release": 0.55, "decay": 0.85, "noise": 0.010,
        "noise_hz": 4200, "detune": 2.0, "width": 0.5, "gain_scale": 1.0,
    },
    # 铜片：脆、短、高分音密集
    "glass": {
        "partials": [(1, 1.000, 1.30), (2.76, 0.620, 1.56), (3.47, 0.430, 1.84),
                     (4.62, 0.290, 2.14), (5.91, 0.195, 2.48), (7.42, 0.125, 2.86),
                     (8.83, 0.078, 3.28), (10.6, 0.042, 3.8), (12.9, 0.022, 4.4)],
        "attack": 0.0016, "release": 0.18, "decay": 1.45, "noise": 0.026,
        "noise_hz": 12000, "detune": 0.6, "width": 0.6, "gain_scale": 1.0,
    },
    # 短笛 / 木管点缀
    "pipe": {
        "partials": [(1, 1.000, 0.90), (2, 0.430, 1.10), (3, 0.230, 1.32), (4, 0.125, 1.56),
                     (5, 0.068, 1.82), (6, 0.036, 2.10), (7, 0.019, 2.42), (8, 0.010, 2.8),
                     (10, 0.0042, 3.6)],
        "attack": 0.050, "release": 0.30, "decay": 0.72, "noise": 0.032,
        "noise_hz": 5800, "detune": 1.2, "width": 0.3, "gain_scale": 1.0,
        "vibrato": (5.6, 0.0085), "vibrato_delay": 0.25,
    },
    # 低音木管：填补中低频空隙
    "reed": {
        "partials": [(1, 1.000, 0.80), (2, 0.520, 0.98), (3, 0.300, 1.18), (4, 0.175, 1.40),
                     (5, 0.100, 1.64), (6, 0.056, 1.90), (7, 0.030, 2.20), (8, 0.016, 2.55)],
        "attack": 0.15, "release": 0.5, "decay": 0.42, "noise": 0.026,
        "noise_hz": 3000, "detune": 2.2, "width": 0.4, "gain_scale": 1.0,
        "vibrato": (4.0, 0.0075), "vibrato_delay": 0.5,
    },
    # 金属刮擦 / 石面摩擦：噪声主导，用于危险预警
    "scrape": {
        "partials": [(1, 0.700, 2.60), (1.41, 0.560, 3.1), (2.13, 0.420, 3.7),
                     (3.07, 0.280, 4.4), (4.41, 0.165, 5.2), (6.2, 0.082, 6.2)],
        "attack": 0.002, "release": 0.09, "decay": 2.6, "noise": 0.18,
        "noise_hz": 6500, "detune": 4.0, "width": 0.55, "gain_scale": 1.0,
    },
    # 弦乐群：用于追逐与高潮段推升
    "strings": {
        "partials": [(1, 1.000, 0.70), (2, 0.540, 0.86), (3, 0.340, 1.02), (4, 0.215, 1.20),
                     (5, 0.138, 1.40), (6, 0.088, 1.62), (7, 0.056, 1.86), (8, 0.036, 2.12),
                     (9, 0.022, 2.40), (10, 0.014, 2.70), (12, 0.0058, 3.3)],
        "attack": 0.26, "release": 0.6, "decay": 0.30, "noise": 0.0095,
        "noise_hz": 4200, "detune": 5.5, "width": 1.05, "gain_scale": 1.0,
        "vibrato": (4.8, 0.0115), "vibrato_delay": 0.6,
    },
    # 石磬：单次点状打击，用于机关触发
    "stone": {
        "partials": [(1, 1.000, 1.90), (1.83, 0.580, 2.30), (2.94, 0.380, 2.75),
                     (4.62, 0.215, 3.30), (6.31, 0.105, 4.0), (8.4, 0.048, 4.8)],
        "attack": 0.0018, "release": 0.2, "decay": 1.75, "noise": 0.10,
        "noise_hz": 4200, "detune": 2.6, "width": 0.72, "gain_scale": 1.0,
    },
}


def midi_to_hz(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69) / 12.0)


def render_note(voice: str, note: float, duration: float, gain: float) -> np.ndarray:
    """渲染单个音符（单声道），返回采样数组。"""
    spec = VOICES[voice]
    freq = midi_to_hz(note)
    n = max(1, int((duration + 0.35) * SR))
    t = np.arange(n) / SR

    attack = spec["attack"]
    release = spec["release"]
    decay = spec["decay"]
    # 整体包络：起振 → 指数衰减 → 收尾。
    # 衰减按"每秒衰减率"计算，与音长无关；否则长音会自己把泛音切掉，听感发闷。
    env_attack = np.clip(t / attack, 0.0, 1.0)
    env_release = np.clip((duration - t) / max(release, 1e-4), 0.0, 1.0)
    env_decay = np.exp(-decay * t)
    env = env_attack * env_release * env_decay

    pitch_drop = spec.get("pitch_drop")
    vibrato = spec.get("vibrato")
    drift = spec.get("drift")

    out = np.zeros(n, dtype=np.float64)
    for ratio, amp, damp in spec["partials"]:
        # 每个分音独立衰减：这是"真实"与"电子"的关键差别
        partial_freq = freq * ratio
        if partial_freq > SR * 0.45:
            continue
        detune = spec["detune"] * (1 if ratio > 1 else -1)
        phase = 2 * np.pi * partial_freq * t

        if pitch_drop:
            start, rate = pitch_drop
            drop_curve = 1.0 + (start - 1.0) * np.exp(-rate * t)
            phase = phase * drop_curve

        if vibrato:
            delay = spec.get("vibrato_delay", 0.4)
            ramp = np.clip((t - delay) / max(delay, 0.05), 0.0, 1.0)
            depth = vibrato[1] * ramp
            phase = phase + depth * np.sin(2 * np.pi * vibrato[0] * t) * 2 * np.pi * 2.0

        if drift:
            rate, depth = drift
            phase = phase + depth * np.sin(2 * np.pi * rate * t)

        out += amp * np.sin(phase + np.deg2rad(detune)) * np.exp(-damp * 1.35 * t)

    # 起振噪声：琴槌 / 弓毛 / 气流的高频瞬态，没有它就像纯 MIDI
    noise_amount = spec["noise"]
    if noise_amount > 0:
        rng = np.random.default_rng(int(abs(note) * 1000) % (2 ** 31))
        noise = rng.normal(0, 1, n)
        sos = butter(2, min(spec["noise_hz"], SR * 0.45), btype="low", fs=SR, output="sos")
        noise = sosfilt(sos, noise)
        noise_env = np.exp(-t / max(0.006, attack * 0.55 + 0.006))
        # 持续气流噪声（风、浪、呼吸）用平缓包络
        if voice in ("whisper", "wash", "breath"):
            noise_env = np.clip(t / attack, 0, 1) * np.clip((duration - t) / release, 0, 1)
        out += noise * noise_amount * noise_env * 6.0

    return out * env * gain * spec["gain_scale"]


def _pan_curve(width: float, rng: np.random.Generator, n: int) -> tuple[np.ndarray, np.ndarray]:
    """按 voice 宽度生成左右声道增益曲线；宽度大时加入缓慢摆动。"""
    if width <= 0.02:
        return np.full(n, 0.5), np.full(n, 0.5)
    base = 0.5 + rng.uniform(-width, width) * 0.5
    base = float(np.clip(base, 0.05, 0.95))
    if width > 0.6:
        sway = 0.5 + (base - 0.5) + width * 0.22 * np.sin(2 * np.pi * rng.uniform(0.06, 0.19) * np.arange(n) / SR)
        sway = np.clip(sway, 0.05, 0.95)
        return 1.0 - sway, sway
    return np.full(n, 1.0 - base), np.full(n, base)


def mix_track(events: list[dict], bpm: float, total_beats: float, seed: int = 7,
              tail: float = 5.0) -> np.ndarray:
    """把乐谱事件混成立体声缓冲（不含混响）。

    tail 为混响与尾音预留的秒数；只按最后一个音符实际需要的长度补齐，
    避免整段空白被一并归一化，拉低成品响度。
    """
    beat = 60.0 / bpm
    # 最后一个音符的结束拍 → 实际需要的总长度
    last_beat = max((e["beat"] + e["duration"] for e in events), default=total_beats)
    needed = last_beat * beat + tail
    total = int(max(needed, total_beats * beat * 0.5) * SR)
    buffer = np.zeros((total, 2), dtype=np.float64)
    rng = np.random.default_rng(seed)

    for index, event in enumerate(events):
        start = int(event["beat"] * beat * SR)
        if start >= total:
            continue
        duration = event["duration"] * beat
        mono = render_note(event["voice"], event["note"], duration, event["gain"])
        end = min(total, start + len(mono))
        chunk = mono[: end - start]
        left, right = _pan_curve(VOICES[event["voice"]]["width"], np.random.default_rng(seed + index), len(chunk))
        buffer[start:end, 0] += chunk * left
        buffer[start:end, 1] += chunk * right
    return buffer


def shape_tone(buffer: np.ndarray) -> np.ndarray:
    """音色整形：修正合成器易有的"中低频堆积、高频缺失"。

    纯加法合成若不做整形，能量会集中在中低频，听感像隔了一层布。
    这里做三段处理：低中频轻微收敛、1.8–6kHz 存在感提升、超高频柔化。
    """
    out = buffer.copy()
    # 1) 中低频去浑：180–600Hz 轻微收敛，给低音与旋律让出空间
    sos_mud = butter(2, [180, 620], btype="band", fs=SR, output="sos")
    for ch in range(2):
        out[:, ch] -= 0.26 * sosfilt(sos_mud, out[:, ch])
    # 2) 存在感：2–7kHz 提升，让拨弦与钟声的泛音浮出来
    sos_presence = butter(2, [2000, 7000], btype="band", fs=SR, output="sos")
    for ch in range(2):
        out[:, ch] += 0.42 * sosfilt(sos_presence, out[:, ch])
    # 3) 空气感：7kHz 以上轻微提升，摆脱沉闷
    sos_air = butter(1, 7000, btype="high", fs=SR, output="sos")
    for ch in range(2):
        out[:, ch] += 0.22 * sosfilt(sos_air, out[:, ch])
    # 4) 超高频柔化，避免合成噪声的刺耳感
    sos_smooth = butter(2, 15500, btype="low", fs=SR, output="sos")
    for ch in range(2):
        out[:, ch] = sosfilt(sos_smooth, out[:, ch])
    return out


def master(buffer: np.ndarray, wet: float = 0.28, rt60: float = 2.2,
           target_peak_dbfs: float = -1.2, target_rms_dbfs: float = -18.0,
           fade: tuple[float, float] = (1.0, 2.6)) -> np.ndarray:
    """混响 → 响度对齐 → 温软限幅 → 真峰归一化 → 首尾淡入淡出。

    先做 RMS 对齐再做峰值归一化，避免混响尾巴把整体响度拖垮。
    """
    reverb = Reverb(rt60=rt60)
    wet_buffer = np.stack([reverb.apply(buffer[:, 0], wet), reverb.apply(buffer[:, 1], wet)], axis=1)
    wet_buffer = shape_tone(wet_buffer)

    # 1) 响度对齐：只统计有声帧，忽略静音尾巴
    frame = 2048
    frames = wet_buffer[: len(wet_buffer) // frame * frame].reshape(-1, frame, 2)
    energies = np.sqrt(np.mean(frames ** 2, axis=(1, 2)))
    voiced = energies[energies > energies.max() * 0.02]
    current_rms = float(np.sqrt(np.mean(voiced ** 2))) if len(voiced) else float(np.sqrt(np.mean(wet_buffer ** 2)))
    if current_rms > 0:
        wet_buffer *= 10 ** ((target_rms_dbfs - 20 * np.log10(current_rms)) / 20)

    # 2) 软限幅：保住动态，只压掉超过阈值的部分
    threshold = 10 ** (-6.0 / 20)
    magnitude = np.abs(wet_buffer)
    over = magnitude > threshold
    reduced = np.where(over, threshold + (magnitude - threshold) / 4.0, magnitude)
    wet_buffer = np.where(magnitude > 0, wet_buffer * (reduced / np.maximum(magnitude, 1e-9)), wet_buffer)

    # 3) 真峰归一化
    peak = float(np.max(np.abs(wet_buffer))) or 1.0
    wet_buffer *= (10 ** (target_peak_dbfs / 20)) / peak

    # 4) 首尾淡入淡出与收尾静音
    n = len(wet_buffer)
    fade_in, fade_out = int(fade[0] * SR), int(fade[1] * SR)
    if fade_in > 0:
        wet_buffer[:fade_in] *= np.linspace(0, 1, fade_in)[:, None] ** 1.6
    if fade_out > 0 and fade_out < n:
        tail_curve = np.linspace(1, 0, fade_out)[:, None] ** 1.35
        wet_buffer[n - fade_out:] *= tail_curve
    wet_buffer[-64:] *= np.linspace(1, 0, 64)[:, None]
    return wet_buffer


def write_wav(path, buffer: np.ndarray, subtype: str = "PCM_16") -> None:
    import soundfile as sf
    sf.write(str(path), buffer.astype(np.float32), SR, subtype=subtype)


def report(name: str, buffer: np.ndarray) -> str:
    peak = float(np.max(np.abs(buffer))) or 1e-9
    rms = float(np.sqrt(np.mean(buffer ** 2)))
    seconds = len(buffer) / SR
    return (f"{name:<26} {seconds:6.2f}s  峰值 {20 * np.log10(peak):6.2f} dBFS  "
            f"RMS {20 * np.log10(rms):6.2f} dBFS  真峰余量 {abs(20 * np.log10(peak)):4.2f} dB")
