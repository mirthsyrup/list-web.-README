"""Embed the approved complete CC0 fanfare for offline mobile/WebAudio playback."""
from pathlib import Path
import base64
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'site/assets/sounds/level-up.ogg'
pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source),
                               '-f', 's16le', '-ac', '1', '-ar', '22050', '-'])
entry = {'sampleRate': 22050, 'frames': len(pcm) // 2,
         'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
         'pcm': base64.b64encode(pcm).decode()}
(ROOT / 'site/level-fanfare.js').write_text(
    '/* Complete approved CC0 fanfare: legal/LEVEL-UP-SOUND.md. */\n'
    'window.ListLevelSamples=Object.freeze(' +
    json.dumps({'level-up': entry}, separators=(',', ':')) + ');\n')
