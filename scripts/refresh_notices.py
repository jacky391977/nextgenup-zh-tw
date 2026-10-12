"""Add complete notices to an already-tested payload without changing executable bytes."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
notice = (root / 'THIRD_PARTY_NOTICES.md').read_bytes()
report = []
sums = []
for path in sorted(args.directory.glob('NextGenUp-zh-TW-*.zip')):
    with zipfile.ZipFile(path) as archive:
        entries = [(info, archive.read(info)) for info in archive.infolist()]
    assert len({info.filename for info, _ in entries}) == len(entries), 'Duplicate archive entries'
    manifest = json.loads(next(data for info, data in entries if info.filename == 'manifest.json'))
    binaries = {info.filename: hashlib.sha256(data).hexdigest()
                for info, data in entries if info.filename.startswith('payload/')}
    for name, digest in binaries.items():
        assert manifest['files'][name] == digest, (path, name)
    manifest['files']['THIRD_PARTY_NOTICES.md'] = hashlib.sha256(notice).hexdigest()
    temp = path.with_suffix('.updated.zip')
    with zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for info, data in entries:
            if info.filename == 'THIRD_PARTY_NOTICES.md':
                data = notice
            elif info.filename == 'manifest.json':
                data = json.dumps(manifest, indent=2).encode()
            archive.writestr(info, data)
    with zipfile.ZipFile(temp) as archive:
        assert all(hashlib.sha256(archive.read(name)).hexdigest() == digest for name, digest in binaries.items())
        assert archive.read('THIRD_PARTY_NOTICES.md') == notice
    temp.replace(path)
    sums.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n')
    report.append({'asset': path.name, 'tested_executable_hashes_unchanged': binaries,
                   'change': 'complete license notices and corresponding manifest checksum only'})
assert len(report) == 3, 'Expected three tested platform payloads'
with (args.directory / 'SHA256SUMS').open('w', encoding='utf-8', newline='\n') as stream:
    stream.write(''.join(sums))
(args.directory / 'qa-license-notices.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
