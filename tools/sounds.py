#!/usr/bin/env python3
"""Builds the cove's recordings (assets/snd3) from the Moodist sound library's originals.

    git clone --depth 1 --filter=blob:none --sparse https://github.com/remvze/moodist /tmp/moodist
    (cd /tmp/moodist && git sparse-checkout set public/sounds)
    python3 tools/sounds.py /tmp/moodist/public/sounds

Loops are made seamless: a stretch of the recording is crossfaded into its own start, and a little of the loop is
copied before and after it, so the page can loop between two points well inside the file (MP3's encoder padding at
the very start and end never comes into it). Single sounds (an owl's call, a roll of thunder, a page turned) are cut
at their own quiet moments and listed as events. Everything is encoded once, at a bitrate high enough to be clean
on headphones, and never pitch-shifted or chopped by the page.
"""
import json, os, subprocess, sys
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/moodist/public/sounds'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'snd3')
os.makedirs(OUT, exist_ok=True)

def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True)
    sr, ch = r.stdout.strip().split(',')[:2]
    return int(sr), int(ch)

def decode(path, sr, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', str(sr), '-ac', str(ch), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()

def encode(x, sr, kbps, name):
    ch = x.shape[1]
    path = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ar', str(sr), path],
                   input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)
    return path

def rms(x):
    return float(np.sqrt(np.mean(np.square(x.astype(np.float64)))))

def loop(name, file, start, length, xfade=3.0, kbps=160, mono=False, pad=0.6):
    """a seamless loop of `length` seconds from `start` seconds into the recording"""
    path = os.path.join(SRC, file); sr, ch = probe(path); ch = 1 if mono else ch
    x = decode(path, sr, ch)
    a, L, X, P = int(start * sr), int(length * sr), int(xfade * sr), int(pad * sr)
    seg = x[a:a + L + X]
    if len(seg) < L + X: raise SystemExit(f'{name}: the recording is too short for {length}+{xfade} s from {start} s')
    out = seg[:L].copy()
    t = np.linspace(0.0, 1.0, X, endpoint=False)[:, None]
    fi, fo = np.sin(t * np.pi / 2) ** 2, np.cos(t * np.pi / 2) ** 2     # equal-power crossfade
    out[:X] = seg[:X] * fi + seg[L:L + X] * fo
    full = np.concatenate([out[-P:], out, out[:P]])
    encode(full, sr, kbps, name)
    return {'rms': round(rms(out), 4), 'peak': round(float(np.abs(out).max()), 4), 'loopStart': round(P / sr, 5), 'loopEnd': round((P + L) / sr, 5)}

def events(name, file, cuts, kbps=128, mono=False, fade=0.25):
    """single sounds: each [start, end] cut softly at both ends, laid end to end with a little silence between"""
    path = os.path.join(SRC, file); sr, ch = probe(path); ch = 1 if mono else ch
    x = decode(path, sr, ch)
    parts, ev, pos, gap = [], [], 0, int(0.3 * sr)
    for s, e in cuts:
        seg = x[int(s * sr):int(e * sr)].copy(); n = len(seg); f = min(int(fade * sr), n // 4)
        ramp = np.linspace(0, 1, f)[:, None]; seg[:f] *= ramp; seg[n - f:] *= ramp[::-1]
        pk = int(np.argmax(np.abs(seg).max(axis=1)))
        ev.append([round((pos + int(0.05 * sr)) / sr, 4), round(n / sr, 4), round(pk / sr, 4)])
        parts += [np.zeros((int(0.05 * sr), ch), np.float32), seg, np.zeros((gap, ch), np.float32)]
        pos += int(0.05 * sr) + n + gap
    full = np.concatenate(parts)
    encode(full, sr, kbps, name)
    body = np.concatenate([p for p in parts if len(p) > gap])
    return {'rms': round(rms(body), 4), 'peak': round(float(np.abs(body).max()), 4), 'events': ev}

def loud(file, win=0.5, mono=True):
    """(for choosing cuts) the loudness of a recording, half a second at a time"""
    path = os.path.join(SRC, file); sr, ch = probe(path); x = decode(path, sr, 1)
    n = int(win * sr); k = len(x) // n
    return [round(float(np.sqrt(np.mean(x[i * n:(i + 1) * n] ** 2))), 4) for i in range(k)]

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'loud':
    print(json.dumps(loud(sys.argv[3]))); raise SystemExit

meta = {}
meta['sea'] = loop('sea', 'nature/waves.mp3', 4.0, 80.0, xfade=4.0, kbps=160)
meta['crickets'] = loop('crickets', 'animals/crickets.mp3', 10.0, 60.0, xfade=3.0, kbps=112)
meta['fire'] = loop('fire', 'nature/campfire.mp3', 6.0, 50.0, xfade=3.0, kbps=160)
meta['birds'] = loop('birds', 'animals/birds.mp3', 8.0, 60.0, xfade=3.0, kbps=112)
meta['gulls'] = loop('gulls', 'animals/seagulls.mp3', 1.0, 38.0, xfade=2.5, kbps=96, mono=True)
meta['rain'] = loop('rain', 'rain/light-rain.mp3', 5.0, 45.0, xfade=3.0, kbps=128)
meta['owl'] = events('owl', 'animals/owl.mp3', [[3.2, 4.8], [10.2, 12.4]], kbps=80, mono=True, fade=0.12)
meta['thunder'] = events('thunder', 'rain/thunder.mp3', [[0.5, 7.2], [20.5, 30.5], [41.0, 55.0]], kbps=160, fade=0.6)
meta['page'] = events('page', 'things/paper.mp3', [[0.8, 1.6], [5.2, 6.1], [7.9, 8.9], [10.8, 11.6]], kbps=112, fade=0.06)
# the knocks (Kenney, CC0) are kept as they are
old = os.path.join(OUT, 'meta.json')
if os.path.exists(old):
    prev = json.load(open(old))
    for k in ('impact',):
        if k in prev: meta[k] = prev[k]
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print(json.dumps(meta, indent=1))
