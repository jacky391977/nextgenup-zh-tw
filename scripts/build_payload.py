"""Build-only resources and portable localization payload; never copy user data."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TAG = 'v1.2.0-zh.4'


def prepare():
    for name, item in json.loads((ROOT / 'model-lock.json').read_text()).items():
        dest = ROOT / 'static/models' / name
        urllib.request.urlretrieve(item['url'], dest)
        if hashlib.sha256(dest.read_bytes()).hexdigest() != item['sha256']:
            raise RuntimeError('Model checksum mismatch: ' + name)
    licenses = ROOT / 'licenses/python'
    licenses.mkdir(parents=True, exist_ok=True)
    inventory = []
    for dist in importlib.metadata.distributions():
        name = dist.metadata['Name']
        inventory.append({'name': name, 'version': dist.version,
                          'license': dist.metadata.get('License-Expression', dist.metadata.get('License', '')),
                          'homepage': dist.metadata.get('Home-page', '')})
        for entry in dist.files or []:
            if any(x in str(entry).lower() for x in ('license', 'copying', 'notice')):
                original = Path(dist.locate_file(entry))
                if original.is_file():
                    dest = licenses / name / str(entry).replace('..', '_')
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(original, dest)
    (licenses / 'inventory.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')


def package(target):
    windows = target == 'windows-x64'
    suffix = '.exe' if windows else ''
    files = {
        'payload/nextgenup' + suffix: ROOT / ('src-tauri/target/release/nextgenup' + suffix),
        'payload/nextgenup-server' + suffix: ROOT / ('dist/nextgenup-server' + suffix),
        'LICENSE': ROOT / 'LICENSE',
        'THIRD_PARTY_NOTICES.md': ROOT / 'THIRD_PARTY_NOTICES.md',
    }
    manifest = {'release': TAG, 'distribution': 'zh-Hant-TW-1.2.0-r4', 'target': target,
                'files': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()}}
    output = ROOT / 'release-assets'
    output.mkdir(exist_ok=True)
    name = f'NextGenUp-zh-TW-{TAG}-{target}.zip'
    with zipfile.ZipFile(output / name, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for dest, path in files.items():
            archive.write(path, dest)
        archive.writestr('manifest.json', json.dumps(manifest, indent=2))
    digest = hashlib.sha256((output / name).read_bytes()).hexdigest()
    (output / 'SHA256SUMS').write_text(f'{digest}  {name}\n')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--package', choices=['macos-arm64', 'macos-x64', 'windows-x64'])
    args = parser.parse_args()
    if args.prepare:
        prepare()
    if args.package:
        package(args.package)
