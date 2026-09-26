"""Regenerate the original offline feedback samples. Requires ffmpeg with MP3 support."""

from array import array
from math import exp, pi, sin
from pathlib import Path
import subprocess
import sys


RATE = 44100
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "audio"


def make_sample(notes, length):
    samples = array("h")
    for index in range(int(length * RATE)):
        time = index / RATE
        value = 0.0
        for start, frequency, duration, strength in notes:
            age = time - start
            if not 0 <= age < duration:
                continue
            attack = min(1.0, age / 0.008)
            envelope = attack * (1 - age / duration) ** 1.6 * exp(-0.7 * age)
            phase = 2 * pi * frequency * age
            value += strength * envelope * (sin(phase) + 0.17 * sin(2 * phase) + 0.04 * sin(3 * phase))
        samples.append(int(max(-1, min(1, value)) * 25000))
    if sys.byteorder != "little":
        samples.byteswap()
    return samples.tobytes()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    cues = {
        "correct.mp3": ([(0, 523.25, 0.24, 0.42), (0.09, 659.25, 0.29, 0.38)], 0.43),
        "wrong.mp3": ([(0, 293.66, 0.23, 0.30), (0.09, 246.94, 0.25, 0.27)], 0.40),
        "complete-fanfare.mp3": ([(0, 392, 0.27, 0.25), (0.12, 523.25, 0.31, 0.29),
                                  (0.26, 659.25, 0.35, 0.32), (0.42, 783.99, 0.45, 0.30),
                                  (0.52, 1046.50, 0.43, 0.18)], 1.00),
    }
    for name, (notes, length) in cues.items():
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "s16le",
            "-ar", str(RATE), "-ac", "1", "-i", "pipe:0", "-codec:a", "libmp3lame",
            "-qscale:a", "7", "-map_metadata", "-1", str(OUTPUT / name),
        ], input=make_sample(notes, length), check=True)


if __name__ == "__main__":
    main()
