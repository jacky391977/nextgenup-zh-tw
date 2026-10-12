"""Check the installed, running native app with synthetic media only."""
import argparse
import io
import json
import os
from pathlib import Path
import platform
import subprocess
import tempfile
import time
import urllib.request
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:18790')
parser.add_argument('--ffmpeg', type=Path)
args = parser.parse_args()


def get(path):
    return json.load(urllib.request.urlopen(args.base + path, timeout=20))


def post(path, data):
    req = urllib.request.Request(args.base + path, data=json.dumps(data).encode(),
                                 headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=20))


def upload(path, field, filename):
    boundary = '----NextGenUpSyntheticSmokeTest'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; '
            f'filename="{filename.name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()
    body += filename.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(args.base + path, data=body,
                                 headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    return json.load(urllib.request.urlopen(req, timeout=20))


cap = get('/api/capabilities')
assert cap['distribution'] == 'zh-Hant-TW-1.2.0-r4', cap
assert cap['server_ai'] and cap['ffmpeg'], cap
page = urllib.request.urlopen(args.base).read().decode()
assert 'ng-help-dialog' in page and '圖片超分' in page
guide = urllib.request.urlopen(args.base + '/static/js/help-app.js').read().decode()
assert '單張照片拖曳比對' in guide and 'showModal' in guide
assert 'caption:\'操作示意' in guide
assert urllib.request.urlopen(args.base + '/static/help/photo-compare.svg').status == 200
assert not get('/api/update-check')['update_available']
runtime = Path(os.environ.get('RUNNER_TEMP', '.'))
ffmpeg = args.ffmpeg or (runtime / 'test-app/ffmpeg.exe' if platform.system() == 'Windows'
                        else runtime / 'test-apps/NextGenUp繁體中文版.app/Contents/MacOS/ffmpeg')
with tempfile.TemporaryDirectory() as folder:
    folder = Path(folder)
    image = folder / 'synthetic.png'
    im = Image.new('RGB', (32, 24))
    im.putdata([(x * 8, y * 10, (x + y) * 4) for y in range(24) for x in range(32)])
    im.save(image)
    task = upload('/api/image/upload', 'image', image)['task_id']
    post('/api/image/upscale', {'task_id': task, 'scale': 2, 'mode': 'ai'})
    for _ in range(120):
        result = get('/api/image/status/' + task)
        if result['status'] in ('completed', 'error'):
            break
        time.sleep(1)
    assert result['status'] == 'completed', result
    image_result = Image.open(io.BytesIO(urllib.request.urlopen(args.base + '/api/image/download/' + task).read()))
    assert image_result.size == (64, 48), image_result.size
    video = folder / 'synthetic.mp4'
    subprocess.run([str(ffmpeg), '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'testsrc2=size=64x48:rate=4:duration=1', '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', str(video)], check=True)
    task = upload('/api/upload', 'video', video)['task_id']
    post('/api/upscale/basic', {'task_id': task, 'scale': 2})
    with urllib.request.urlopen(args.base + '/api/progress/' + task, timeout=120) as events:
        for line in events:
            if line.startswith(b'data: '):
                result = json.loads(line[6:])
                if result['status'] in ('completed', 'error'):
                    break
    assert result['status'] == 'completed', result
    output = folder / 'output.mp4'
    output.write_bytes(urllib.request.urlopen(args.base + '/api/download/' + task).read())
    probe = ffmpeg.with_name('ffprobe' + ffmpeg.suffix)
    streams = json.loads(subprocess.check_output([str(probe), '-v', 'quiet', '-show_streams', '-of', 'json', str(output)]))
    assert (streams['streams'][0]['width'], streams['streams'][0]['height']) == (128, 96), streams
label = 'windows-x64' if platform.system() == 'Windows' else ('macos-arm64' if platform.machine() == 'arm64' else 'macos-x64')
report = {'platform': label, 'capabilities': cap, 'localized_ui_assets': True,
          'guide_diagram_no_customer_media': True, 'upstream_auto_update_disabled': True,
          'ai_image_2x': [64, 48], 'ffmpeg_video_2x': [128, 96],
          'test_media': 'synthetic only', 'all_optional_models_tested': False}
dest = Path('release-assets')
dest.mkdir(exist_ok=True)
(dest / f'qa-{label}.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
