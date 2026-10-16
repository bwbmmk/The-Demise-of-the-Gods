"""《神之殇》扩展曲库 · 乐谱数据。

与仓库 src/music.js 同一乐理语言：和弦以 MIDI 音高数组表示，旋律以 [音高, 时值] 序列表示，
时值单位是四分音符。整曲按拍数循环。

调性布局（每章一个神域，各有其和声性格）
------------------------------------------
序章 灰烬之城   D 小调          空虚、行走（已有《葬火》，不重复）
I    失名街区   D 大调          人间温度、记名
II   风神之肺   A 多利亚        呼吸、上升
III  海神之血   D 和声小调      庄严、淹没
IV   安眠神之眼 D 小调 + 大七度  悬置、不闭合
V    坠日王庭   D 弗里吉亚      炽热、审判
VI   无名之门   D 利底亚        黎明、开放
尾   安魂       D 小调          克制、送葬
"""

from __future__ import annotations

# --------------------------------------------------------------------------- #
# 和弦库：全部以 MIDI 音高写死，避免运行时推导出错
# --------------------------------------------------------------------------- #
# 调式骨架
D_MIN = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]]
D_MAJ = [[50, 57, 62, 66], [45, 52, 57, 61], [48, 55, 60, 64], [43, 50, 57, 62]]
A_DOR = [[45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 53, 57], [45, 52, 57, 60]]
D_HARM = [[50, 57, 62, 65], [46, 53, 58, 62], [47, 52, 58, 61], [48, 55, 61, 64]]
D_PHRY = [[50, 57, 62, 65], [49, 56, 61, 64], [48, 55, 60, 63], [50, 57, 62, 65]]
D_LYD = [[50, 57, 61, 66], [43, 50, 54, 61], [47, 54, 59, 62], [45, 52, 56, 61], [48, 55, 59, 64], [50, 57, 61, 66]]
# 安眠神：大七度与九度叠加，刻意不解决
D_SLEEP = [[50, 57, 61, 65], [48, 55, 59, 64], [46, 53, 57, 62], [45, 52, 56, 61], [50, 57, 60, 63], [48, 55, 59, 63]]


# --------------------------------------------------------------------------- #
# 织体生成器
# --------------------------------------------------------------------------- #
def pad(bars, every=2, gain=0.040, duration=8.5, voice="pad", octave=0):
    """每 every 小节铺一次长和弦。"""
    return [{"beat": bar * 4, "duration": duration, "note": note + octave, "voice": voice, "gain": gain}
            for bar, chord in enumerate(bars) if bar % every == 0 for note in chord]


def pluck(bars, pattern=(0, 1, 2, 1, 3, 1, 2, 1), gain=0.050, octave=12, layer=1):
    """分解和弦。pattern 索引取和弦音，可越界循环。"""
    return [{"beat": bar * 4 + n * (4 / len(pattern)), "duration": 0.9,
             "note": chord[pattern[n] % len(chord)] + octave, "voice": "pluck", "gain": gain, "layer": layer}
            for bar, chord in enumerate(bars) for n in range(len(pattern))]


def drums(bars, gain=0.26, extra=0.13, octave=-12, every=1):
    out = []
    for bar, chord in enumerate(bars):
        if bar % every:
            continue
        note = chord[0] + octave
        out.append({"beat": bar * 4, "duration": 1.4, "note": note, "voice": "drum", "gain": gain, "layer": 1})
        if extra > 0:
            out.append({"beat": bar * 4 + 2.5, "duration": 0.8, "note": note, "voice": "drum", "gain": extra, "layer": 2})
    return out


def bells(bars, every=4, gain=0.10, octave=12, offset=0, index=2):
    return [{"beat": bar * 4 + offset, "duration": 5.0, "note": chord[index % len(chord)] + octave,
             "voice": "bell", "gain": gain}
            for bar, chord in enumerate(bars) if bar % every == 0]


def lead(melody, gain=0.085, voice="lead", offset=0):
    """[音高, 时值] 序列 → 音轨。音高为 0 表示休止。"""
    out, cursor = [], offset
    for note, duration in melody:
        if note:
            out.append({"beat": cursor, "duration": duration * 0.92, "note": note, "voice": voice, "gain": gain})
        cursor += duration
    return out


def drone(bars, note_offset=0, gain=0.05, octave=0, beat_step=2.0):
    """持续低音：填住中低频，让和声有地基。"""
    out = []
    for bar, chord in enumerate(bars):
        out.append({"beat": bar * 4, "duration": 8.0, "note": chord[note_offset] + octave,
                    "voice": "strings", "gain": gain})
        out.append({"beat": bar * 4 + beat_step, "duration": 6.0, "note": chord[note_offset] + octave,
                    "voice": "reed", "gain": gain * 0.7})
    return out


# --------------------------------------------------------------------------- #
# 1 · 抄名人之歌（第一章 · 失名街区）
# --------------------------------------------------------------------------- #
def mia_harpsichord():
    """D 大调，56 BPM，8 小节，竖琴古钢琴。唯一不靠低音压迫的曲子。"""
    bars = D_MAJ * 2
    return dict(
        bpm=56, beats=32, wet=0.34, rt60=2.6,
        events=(
            pluck(bars, pattern=(0, 1, 2, 3, 2, 1), gain=0.056)
            + bells(bars, every=4, gain=0.055, octave=24)
            + lead([
                [81, 3], [79, 1], [77, 2], [76, 2], [74, 4], [0, 2], [76, 2],
                [77, 3], [79, 1], [81, 4], [79, 2], [77, 2], [76, 4], [74, 2], [72, 2],
                [81, 2], [79, 2], [77, 2], [74, 2], [76, 4], [77, 4],
                [74, 3], [72, 1], [74, 2], [76, 2], [74, 8],
            ], gain=0.072, voice="pipe")
        ),
    )


# --------------------------------------------------------------------------- #
# 2 · 风神之肺（第二幕）
# --------------------------------------------------------------------------- #
def wind_lung():
    """A 多利亚，80 BPM，12 小节。气流噪声与悬空钟楼。"""
    bars = A_DOR * 3
    whisper = [{"beat": bar * 4 + n * 0.75, "duration": 1.6, "note": chord[n % len(chord)] + 12,
                "voice": "whisper", "gain": 0.030, "layer": 1}
               for bar, chord in enumerate(bars) for n in range(4)]
    return dict(
        bpm=80, beats=48, wet=0.40, rt60=3.0,
        events=(
            pad(bars, every=2, gain=0.042)
            + pluck(bars, pattern=(0, 2, 1, 3, 2, 0, 3, 1), gain=0.044, octave=24)
            + whisper
            + drums(bars, gain=0.17, extra=0.0)
            + bells(bars, every=4, gain=0.105, octave=24, offset=2)
            + lead([
                [69, 2], [72, 2], [74, 1], [76, 1], [74, 2], [72, 2], [76, 4],
                [0, 4], [77, 2], [76, 2], [74, 1], [72, 1], [74, 2], [71, 2], [69, 4],
                [0, 2], [74, 2], [76, 2], [79, 2], [81, 4], [79, 2], [77, 2],
                [76, 3], [74, 1], [76, 2], [74, 2], [72, 4], [69, 3], [71, 1],
                [72, 2], [74, 2], [72, 2], [69, 2], [71, 4], [69, 4],
            ], gain=0.078)
        ),
    )


# --------------------------------------------------------------------------- #
# 3 · 海神之血（第三幕）
# --------------------------------------------------------------------------- #
def tide_blood():
    """D 和声小调，66 BPM，12 小节。涨潮的庄严淹没感。"""
    bars = D_HARM * 3
    wash = [{"beat": bar * 4 + n * 2 + 1, "duration": 3.2, "note": chord[3] + 12,
             "voice": "wash", "gain": 0.034, "layer": 2}
            for bar, chord in enumerate(bars) for n in range(2)]
    return dict(
        bpm=66, beats=48, wet=0.38, rt60=3.4,
        events=(
            pad(bars, every=2, gain=0.046, duration=9.6)
            + pluck(bars, pattern=(0, 1, 3, 2, 1, 3), gain=0.038)
            + wash
            + drone(bars, gain=0.040)
            + drums(bars, gain=0.30, extra=0.16)
            + bells(bars, every=6, gain=0.085)
            + lead([
                [74, 2], [76, 1], [77, 1], [79, 3], [78, 1], [76, 4],
                [0, 3], [74, 1], [76, 2], [74, 2], [70, 4], [0, 4],
                [79, 2], [81, 2], [83, 1], [81, 1], [79, 2], [77, 2], [76, 4], [0, 4],
                [74, 3], [72, 1], [74, 2], [76, 2], [74, 6], [0, 2],
                [77, 2], [76, 2], [74, 2], [72, 2], [74, 8],
            ], gain=0.082)
        ),
    )


# --------------------------------------------------------------------------- #
# 4 · 安眠神之眼（第四幕）
# --------------------------------------------------------------------------- #
def sleep_eye():
    """D 小调 + 大七度，58 BPM，12 小节。和声永不解决。"""
    bars = D_SLEEP * 2
    breath = [{"beat": bar * 4 + n * 3, "duration": 3.6, "note": chord[1],
               "voice": "breath", "gain": 0.030, "layer": 1}
              for bar, chord in enumerate(bars) for n in range(2)]
    return dict(
        bpm=58, beats=48, wet=0.44, rt60=3.8,
        events=(
            pad(bars, every=2, gain=0.050, duration=9.0)
            + pluck(bars, pattern=(0, 2, 3, 2), gain=0.034, octave=24, layer=2)
            + breath
            + drone(bars, note_offset=1, gain=0.032)
            + bells(bars, every=3, gain=0.070, offset=3)
            + lead([
                [74, 4], [72, 4], [69, 6], [0, 2], [72, 4], [71, 4], [69, 8],
                [0, 4], [67, 4], [69, 4], [72, 2], [74, 2], [72, 6], [0, 2],
                [74, 3], [76, 3], [77, 2], [76, 4], [74, 4],
                [72, 4], [69, 4], [71, 8],
            ], gain=0.070)
        ),
    )


# --------------------------------------------------------------------------- #
# 5 · 坠日王庭（第五幕）
# --------------------------------------------------------------------------- #
def throne_march():
    """D 弗里吉亚，88 BPM，12 小节。第一音就带威胁的降二度。"""
    bars = D_PHRY * 3
    stabs = [{"beat": bar * 4 + at, "duration": 0.55, "note": chord[0] - 12,
              "voice": "stab", "gain": 0.048, "layer": 2}
             for bar, chord in enumerate(bars) for at in (1.0, 1.75, 2.5, 3.25)]
    return dict(
        bpm=88, beats=48, wet=0.30, rt60=2.8,
        events=(
            pad(bars, every=2, gain=0.038)
            + pluck(bars, pattern=(0, 2, 1, 3), gain=0.030, layer=2)
            + stabs
            + drone(bars, gain=0.036)
            + drums(bars, gain=0.34, extra=0.20)
            + lead([
                [74, 1], [75, 1], [76, 2], [74, 2], [73, 2], [74, 3], [71, 1], [74, 4],
                [0, 2], [76, 2], [75, 2], [74, 2], [72, 4], [0, 4],
                [79, 2], [76, 2], [74, 1], [73, 1], [74, 2], [76, 2], [78, 4], [0, 4],
                [74, 2], [73, 1], [72, 1], [74, 6], [0, 2],
                [75, 2], [74, 2], [72, 2], [71, 2], [74, 8],
            ], gain=0.086)
        ),
    )


# --------------------------------------------------------------------------- #
# 6 · 无名之门（终幕）
# --------------------------------------------------------------------------- #
def nameless_gate():
    """D 利底亚，64 BPM，12 小节。利底亚升四度给出"可以往外走"的暗示。"""
    bars = D_LYD * 2
    answer = [{"beat": bar * 4 + n * 2 + 1, "duration": 3.0, "note": chord[2] + 12,
               "voice": "ember", "gain": 0.030, "layer": 1}
              for bar, chord in enumerate(bars) for n in range(2)]
    return dict(
        bpm=64, beats=48, wet=0.36, rt60=3.6,
        events=(
            pad(bars, every=2, gain=0.050, duration=9.2)
            + pluck(bars, pattern=(0, 1, 2, 3, 2, 1), gain=0.045)
            + answer
            + drone(bars, gain=0.038)
            + bells(bars, every=3, gain=0.105)
            + lead([
                [74, 2], [76, 2], [78, 2], [81, 6], [79, 2], [78, 2], [76, 4],
                [0, 2], [74, 2], [76, 2], [74, 2], [71, 4], [69, 4],
                [74, 3], [76, 1], [78, 2], [81, 2], [83, 4], [81, 4],
                [79, 2], [78, 2], [76, 2], [74, 2], [74, 8],
                [76, 2], [78, 2], [81, 4], [83, 2], [81, 2], [78, 4],
                [76, 2], [74, 2], [76, 2], [74, 2], [74, 8],
            ], gain=0.082)
        ),
    )


# --------------------------------------------------------------------------- #
# 7 · 安魂 · 送葬（死亡结算 / 片尾）
# --------------------------------------------------------------------------- #
def requiem_rite():
    """D 小调，52 BPM，12 小节。不是悲恸，而是克制。丧钟每六小节一次。"""
    bars = D_MIN * 3
    toll = [{"beat": bar * 4, "duration": 6.0, "note": chord[0] + 12, "voice": "toll", "gain": 0.135}
            for bar, chord in enumerate(bars) if bar % 6 == 0]
    return dict(
        bpm=52, beats=48, wet=0.46, rt60=4.2,
        events=(
            pad(bars, every=2, gain=0.054, duration=9.6)
            + toll
            + drone(bars, gain=0.034)
            + drums(bars, gain=0.21, extra=0.09, every=2)
            + lead([
                [74, 4], [72, 4], [69, 4], [0, 2], [72, 2],
                [74, 4], [76, 4], [74, 8],
                [72, 2], [74, 2], [72, 2], [69, 2], [67, 4], [69, 4],
                [74, 4], [72, 3], [69, 1], [66, 8],
                [69, 4], [71, 4], [72, 8],
                [74, 4], [72, 4], [69, 8],
            ], gain=0.074, voice="reed")
        ),
    )


# --------------------------------------------------------------------------- #
# 8 · 短动机（四段结果音）
# --------------------------------------------------------------------------- #
# 四音动机：与其在 music.js 中的主题同源，但每次以不同方式收束
MOTIF = [(74, 2), (77, 1), (76, 1), (72, 4)]


def _motif(transpose=0, rate=1.0):
    return [(note + transpose, duration * rate) for note, duration in MOTIF]


def sting_victory():
    """结局：一粒火种归入掌心。动机上行后落在下方八度的主音，是"归还"而非"胜利"。"""
    return dict(
        bpm=84, beats=24, wet=0.42, rt60=3.6,
        events=(
            pluck(D_LYD, pattern=(0, 2), gain=0.052)
            + pluck(D_LYD, pattern=(0, 2), gain=0.044, octave=24)
            + bells(D_LYD, every=1, gain=0.095)
            + lead(_motif(0) + [(61, 6)], gain=0.105, voice="pipe")
            + pad(D_LYD[:2], every=1, gain=0.048, duration=10)
        ),
    )


def sting_defeat():
    """失败：余火散入灰烬。动机下沉并放慢，末尾只剩一支低音管。"""
    return dict(
        bpm=50, beats=20, wet=0.46, rt60=4.0,
        events=(
            pad(D_MIN[:2], every=1, gain=0.055, duration=12)
            + lead(_motif(-3, 1.7), gain=0.092, voice="reed")
            + lead([(38, 8)], gain=0.055, voice="strings")
        ),
    )


def sting_resonance():
    """共鸣：有人在念你的名字。同一动机升高八度，用铜片音色。"""
    return dict(
        bpm=96, beats=16, wet=0.40, rt60=3.2,
        events=(
            lead(_motif(12), gain=0.085, voice="glass")
            + bells(D_MAJ[:2], every=1, gain=0.075, octave=24)
            + pad(D_MAJ[:2], every=1, gain=0.042, duration=8)
        ),
    )


def sting_transition():
    """转入：章末低鸣。动机加速一倍，用于短促的转场提示。"""
    return dict(
        bpm=120, beats=12, wet=0.34, rt60=2.6,
        events=(
            lead(_motif(0, 0.5), gain=0.082, voice="pluck")
            + drone(D_MIN[:1], gain=0.048)
            + drums(D_MIN[:1], gain=0.22, extra=0)
        ),
    )


# --------------------------------------------------------------------------- #
# 曲库清单
# --------------------------------------------------------------------------- #
TRACKS = [
    dict(id="mia-harpsichord", file="mia-harpsichord.wav", title="抄名人之歌",
         english="The Namekeeper", scene="第一章 · 失名街区", key="D 大调", bpm=56,
         use="旅途手记、真名铜片收集、人物对话、章节选择",
         mood="克制的温暖。全曲库唯一不靠低音压迫的曲子，因为记名这件事本身属于人。",
         score=mia_harpsichord),
    dict(id="wind-lung", file="wind-lung.wav", title="风神之肺",
         english="The Lung of Wind", scene="第二幕 · 风神域", key="A 多利亚", bpm=80,
         use="上升气流段、悬空钟楼、风印腾跃",
         mood="呼吸与失衡。多利亚的升六度让每次托举都伴随一点未落地的空虚。",
         score=wind_lung),
    dict(id="tide-blood", file="tide-blood.wav", title="海神之血",
         english="The Blood Tide", scene="第三幕 · 海神域", key="D 和声小调", bpm=66,
         use="涨潮台阶、水位迫近、倒置圣堂",
         mood="庄严的淹没感。和声小调的升七度，就是「祝福也会淹死不服从者」那句话的音色。",
         score=tide_blood),
    dict(id="sleep-eye", file="sleep-eye.wav", title="安眠神之眼",
         english="The Unwaking Eye", scene="第四幕 · 安眠神域", key="D 小调 · 大七度", bpm=58,
         use="睡梦裂缝、明灭平台、被献祭者的梦",
         mood="永恒悬置。大七度与九度刻意不解决，就像这座城里没有人真正醒来。",
         score=sleep_eye),
    dict(id="throne-march", file="throne-march.wav", title="坠日王庭",
         english="March of the Torchbearer", scene="第五幕 · 坠日王庭", key="D 弗里吉亚", bpm=88,
         use="追索军团、巨神脚步、七夜倒计时",
         mood="推进与审判。弗里吉亚的降二度从第一音就说明执炬王不是可以商量的对手。",
         score=throne_march),
    dict(id="nameless-gate", file="nameless-gate.wav", title="无名之门",
         english="The Nameless Gate", scene="终幕 · 万家微火", key="D 利底亚", bpm=64,
         use="终点、分火结局、人间第一盏火",
         mood="开放的黎明。利底亚升四度暗示世界可以往外走，而不是退回旧循环。",
         score=nameless_gate),
    dict(id="requiem-rite", file="requiem-rite.wav", title="安魂 · 送葬",
         english="Rite of the Bearer", scene="死亡结算 / 片尾", key="D 小调", bpm=52,
         use="死亡结算、独白、片尾送葬",
         mood="不是悲恸而是克制。丧钟每六小节一次，其余时间只有低音弦与木管。",
         score=requiem_rite),
]

STINGERS = [
    dict(id="victory", file="sting-victory.wav", title="一粒火种归入掌心", use="通关、解锁结局", score=sting_victory),
    dict(id="defeat", file="sting-defeat.wav", title="余火散入灰烬", use="死亡结算", score=sting_defeat),
    dict(id="resonance", file="sting-resonance.wav", title="有人在念你的名字", use="共鸣环、真名获取", score=sting_resonance),
    dict(id="transition", file="sting-transition.wav", title="章末低鸣", use="章节切换、进入新神域", score=sting_transition),
]
