"""プロンプトセット(.md)を読み、ElevenLabs Music API で全曲をmp3生成する。

使い方: ELEVENLABS_API_KEY=... python3 suno/generate_elevenlabs.py suno/2026-10-07_第1回.md
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

API_URL = "https://api.elevenlabs.io/v1/music"
LENGTH_MS = 270_000  # 4分30秒


def parse_songs(md: str):
    for block in re.split(r"^## ", md, flags=re.M)[1:]:
        title = re.search(r"^Title: (.+)$", block, re.M)
        style = re.search(r"^Style: (.+)$", block, re.M)
        lyrics = re.search(r"```\n(.*?)```", block, re.S)
        if title and style and lyrics:
            yield block.split("\n", 1)[0].strip(), title[1].strip(), style[1].strip(), lyrics[1].strip()


def build_prompt(style: str, lyrics: str) -> str:
    instrumental = "[Instrumental]" in lyrics
    sections = [s for s in re.findall(r"\[(.+?)\]", lyrics) if s != "Instrumental"]
    prompt = f"{style}. Song structure: {' -> '.join(sections)}."
    if instrumental:
        prompt += " Instrumental only, no vocals."
    return prompt


def generate(prompt: str, out: Path, key: str):
    body = json.dumps({"prompt": prompt, "music_length_ms": LENGTH_MS, "model_id": "music_v1"}).encode()
    req = urllib.request.Request(
        API_URL, data=body, method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    with urllib.request.urlopen(req, timeout=600) as res:
        out.write_bytes(res.read())


def main():
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY が設定されていません")
    src = Path(sys.argv[1])
    out_dir = src.with_suffix("")
    out_dir.mkdir(exist_ok=True)
    for heading, title, style, lyrics in parse_songs(src.read_text(encoding="utf-8")):
        out = out_dir / f"{heading.split()[0]}_{title.replace(' ', '_')}.mp3"
        if out.exists():
            print(f"skip {out.name}")
            continue
        print(f"生成中: {heading} / {title}", flush=True)
        try:
            generate(build_prompt(style, lyrics), out, key)
            print(f"  -> {out}")
        except urllib.error.HTTPError as e:
            print(f"  失敗 {e.code}: {e.read().decode(errors='replace')[:300]}")


if __name__ == "__main__":
    main()
