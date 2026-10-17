"""Encode interface artwork at display-appropriate sizes; keep original files outside site/."""
from pathlib import Path
import argparse, concurrent.futures, json, shutil, subprocess

ROOT = Path(__file__).resolve().parents[1]
WIDTHS = {'painted-icons':1024, 'updated-icons':1024, 'equipment-icons':768,
          'metal-controls':1280, 'steel-button':768}

def main(backup):
    assets = ROOT / 'site/designs/fantasy/assets'
    backup.mkdir(parents=True, exist_ok=True)
    sources = sorted(assets.glob('*.png'))
    def encode(source):
        original = backup / source.name
        if not original.exists(): shutil.copy2(source, original)
        destination = source.with_suffix('.webp')
        command = ['magick', str(source)]
        if source.stem in WIDTHS: command += ['-resize', str(WIDTHS[source.stem])+'x>']
        command += ['-strip', '-quality', '86', '-define', 'webp:method=6',
                    '-define', 'webp:alpha-quality=100', str(destination)]
        subprocess.run(command, check=True)
        return {'name':source.name,'before':source.stat().st_size,'after':destination.stat().st_size}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        report = list(pool.map(encode, sources))
    css = ROOT / 'site/designs/fantasy/fantasy.css'
    text = css.read_text()
    # Slice geometry is relative to the original plate, so resizing keeps its corners intact.
    text = text.replace('200 fill / 12px', '24.21308% 10.50972% fill / 12px')
    for source in sources:
        text = text.replace('assets/'+source.name, 'assets/'+source.with_suffix('.webp').name)
    css.write_text(text)
    for source in sources: source.unlink()
    result = {'files':report,'before':sum(x['before'] for x in report),'after':sum(x['after'] for x in report)}
    (backup/'optimization.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--backup',type=Path,required=True)
    main(parser.parse_args().backup)
