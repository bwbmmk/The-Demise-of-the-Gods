"""Create bounded in-game cues from the user-provided WAV pack; never modify the pack."""
from pathlib import Path
import array
import hashlib
import json
import math
import sys
import wave

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\MR\Desktop\music\assets\music")
DEST = Path(__file__).resolve().parents[1] / 'assets' / 'music' / 'selected'
RATE = 22050
# Calm reading music uses the first complete eight-bar phrase. Event cues are excerpts,
# not accelerated full compositions: retain pitch and add a quiet natural release.
SELECTION = [
    ('journal', 'mia-harpsichord.wav', '抄名人之歌', 32 * 60 / 56, 2.0),
    ('transition', 'sting-transition.wav', '章末低鸣', 3.4, 1.1),
    ('resonance', 'sting-resonance.wav', '有人在念你的名字', 6.4, 1.5),
    ('defeat', 'sting-defeat.wav', '余火散入灰烬', 6.0, 2.0),
    ('victory', 'sting-victory.wav', '一粒火种归入掌心', 8.0, 2.0),
]

def prepare(file, seconds, release):
    with wave.open(str(file), 'rb') as audio:
        assert audio.getnchannels() == 2 and audio.getsampwidth() == 2 and audio.getframerate() == 44100, 'Expected stereo PCM16 / 44.1kHz'
        source_duration = audio.getnframes() / 44100
        data = array.array('h', audio.readframes(min(audio.getnframes(), math.ceil(seconds * 44100) + 4)))
    if sys.byteorder != 'little': data.byteswap()
    mono = [(data[i] + data[i + 1]) / 2 for i in range(0, len(data) - 1, 2)]
    output = array.array('h')
    count = int(seconds * RATE)
    for i in range(count):
        j = i * 2
        value = sum(mono[max(0, min(len(mono) - 1, j + k - 2))] * weight for k, weight in enumerate((1, 4, 6, 4, 1))) / 16
        time = i / RATE
        envelope = min(1, time / .045, (seconds - time) / release)
        output.append(round(value * max(0, envelope) * .72))
    if sys.byteorder != 'little': output.byteswap()
    return output, source_duration

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    report = []
    for cue, file, title, duration, release in SELECTION:
        source = SOURCE / file
        samples, source_duration = prepare(source, duration, release)
        target = DEST / (cue + '.wav')
        with wave.open(str(target), 'wb') as audio:
            audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(RATE); audio.writeframes(samples.tobytes())
        report.append(dict(id=cue, title=title, source=file, sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                           sourceSeconds=round(source_duration, 4), seconds=round(len(samples)/RATE, 4),
                           file=target.name, sampleRate=RATE, channels=1, peak=max(abs(v) for v in samples)/32768))
    (DEST / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps([dict(id=r['id'], seconds=r['seconds'], peak=round(r['peak'], 3)) for r in report], ensure_ascii=False))

if __name__ == '__main__': main()
