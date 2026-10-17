"""Deduplicate inline CSS image bytes while preserving JavaScript and native code."""
from pathlib import Path
import argparse, base64, copy, hashlib, json, re, zipfile
from optimize_ipa import InlineContent

def compact(source, destination, site):
    with zipfile.ZipFile(source) as original:
        names = set(original.namelist())
        entry = next(n for n in original.namelist() if n.endswith('/web/ios-entry.html'))
        html = original.read(entry).decode()
        parsed = InlineContent(); parsed.feed(html)
        pool = {}
        def image(match):
            value = match[0]
            name = '--list-native-image-' + hashlib.sha256(value.encode()).hexdigest()[:20]
            pool[name] = value
            return 'var(' + name + ')'
        updated = html
        for style in parsed.styles:
            css = re.sub(r'url\("data:image/[^;]+;base64,[^\"]+"\)', image, style)
            updated = updated.replace('<style>' + style + '</style>', '<style>' + css + '</style>', 1)
        images = []
        for name, value in pool.items():
            match = re.fullmatch(r'url\("data:([^;]+);base64,([^\"]+)"\)', value)
            images.append([name, match[1], match[2]])
        script = "(()=>{const images=" + json.dumps(images, separators=(',', ':')) + ";for(const [name,mime,data]of images){const raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);document.documentElement.style.setProperty(name,'url(\"'+URL.createObjectURL(new Blob([bytes],{type:mime}))+'\")');}})();"
        tag = '<script>' + script + '</script>'
        updated = updated.replace('<head>', '<head>' + tag, 1)
        restored = updated.replace(tag, '', 1)
        for name, value in pool.items():
            restored = restored.replace('var(' + name + ')', value)
        assert restored == html
        check = InlineContent(); check.feed(updated)
        assert check.scripts[1:] == parsed.scripts
        web = entry.removesuffix('ios-entry.html')
        retired = {name for name in original.namelist()
                   if name.startswith(web+'designs/fantasy/assets/')
                   and Path(name).suffix == '.png'
                   and not (site / name.removeprefix(web)).exists()}
        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
            for item in original.infolist():
                if item.filename in retired: continue
                out.writestr(copy.copy(item), updated.encode() if item.filename == entry else original.read(item), compress_type=item.compress_type, compresslevel=9)
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(destination) as result:
        assert result.testzip() is None
        assert set(result.namelist()) == names-retired
        for name in result.namelist():
            if name != entry: assert result.read(name) == original.read(name), name
    print(json.dumps({'output': str(destination), 'bytes': destination.stat().st_size, 'images': len(pool), 'retired_png_copies_removed':len(retired)}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path); parser.add_argument('destination', type=Path)
    parser.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1]/'site')
    args = parser.parse_args(); compact(args.source, args.destination, args.site)
