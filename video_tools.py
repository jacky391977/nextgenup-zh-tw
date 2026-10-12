"""Video utility tools built on ffmpeg + the audio AI engine:

- clean_audio: denoise the audio track (DeepFilterNet3) or remove
  music / voice from it (MDX separation), then remux with the
  untouched video stream (no re-encode of the picture).
- compress: two-pass libx264 encode to a target file size.
- to_gif: palette-optimized GIF conversion.
"""
import os
import re
import subprocess
import audio_engine

def _ffmpeg():
    return audio_engine._ffmpeg()

def _run(cmd, timeout=None):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    if r.returncode != 0:
        lines = [l for l in r.stderr.strip().splitlines() if l.strip()]
        raise RuntimeError(lines[-1][:200] if lines else 'FFmpeg 處理失敗')
    return r

def _run_with_progress(cmd, duration, progress_cb, base, span):
    """Run ffmpeg mapping -progress out_time to base..base+span percent.
    The '-progress pipe:1' flags are inserted before the output argument."""
    cmd = cmd[:-1] + ['-progress', 'pipe:1', cmd[-1]]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
    stderr_chunks = []
    import threading
    t = threading.Thread(target=lambda : stderr_chunks.extend(proc.stderr), daemon=True)
    t.start()
    try:
        for line in proc.stdout:
            m = re.match('out_time_ms=(\\d+)', line.strip())
            if m and duration and progress_cb:
                frac = min(1.0, int(m.group(1)) / 1000000.0 / duration)
                progress_cb(base + int(frac * span))
        proc.wait()
    except BaseException:
        proc.kill()
        raise
    t.join(timeout=5)
    if proc.returncode != 0:
        lines = [l for l in ''.join(stderr_chunks).strip().splitlines() if l.strip()]
        raise RuntimeError(lines[-1][:200] if lines else 'FFmpeg 處理失敗')

def _has_audio(in_path):
    r = subprocess.run([_ffmpeg(), '-hide_banner', '-i', in_path], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
    return 'Audio:' in r.stderr

def clean_audio(in_path, out_path, mode, tmp_dir, progress_cb=None):
    """mode: 'denoise' | 'remove_music' (keep voice) | 'remove_voice'
    (keep music). Video stream is copied untouched."""
    if not _has_audio(in_path):
        raise ValueError('這支影片沒有音軌')

    def report(pct, msg):
        if progress_cb:
            progress_cb(pct, msg)
    base = os.path.join(tmp_dir, os.path.basename(out_path) + '.tmp')
    wav_in = base + '.in.wav'
    wav_out = base + '.out.wav'
    try:
        report(5, '正在擷取音軌…')
        if mode == 'denoise':
            _run([_ffmpeg(), '-y', '-v', 'error', '-i', in_path, '-vn', '-ac', '1', '-ar', '48000', wav_in])
            audio_engine.denoise(wav_in, wav_out, progress_cb=lambda d, t: report(10 + int(d / t * 65), f'正在降噪（{d}/{t})'))
        else:
            _run([_ffmpeg(), '-y', '-v', 'error', '-i', in_path, '-vn', '-ac', '2', '-ar', '44100', wav_in])
            voc = base + '.voc.wav'
            ins = base + '.ins.wav'
            audio_engine.separate(wav_in, voc, ins, progress_cb=lambda d, t: report(10 + int(d / t * 65), f'正在分離音訊（{d}/{t})'))
            wav_out = voc if mode == 'remove_music' else ins
        report(80, '正在重新合成影片…')
        _run([_ffmpeg(), '-y', '-v', 'error', '-i', in_path, '-i', wav_out, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out_path])
        report(98, '正在完成最後處理…')
    finally:
        for p in (wav_in, base + '.out.wav', base + '.voc.wav', base + '.ins.wav'):
            try:
                os.remove(p)
            except OSError:
                pass

def compress(in_path, out_path, target_mb, duration, tmp_dir, progress_cb=None):
    """Two-pass libx264 encode aiming at target_mb megabytes."""
    if not duration:
        raise ValueError('無法確認影片長度')
    audio_kbps = 96
    total_kbps = target_mb * 8192 / duration
    video_kbps = max(80, int(total_kbps - audio_kbps))
    log = os.path.join(tmp_dir, os.path.basename(out_path) + '.passlog')
    common = [_ffmpeg(), '-y', '-v', 'error', '-i', in_path, '-c:v', 'libx264', '-b:v', f'{video_kbps}k', '-maxrate', f'{int(video_kbps * 1.3)}k', '-bufsize', f'{video_kbps * 2}k', '-pix_fmt', 'yuv420p', '-passlogfile', log]
    try:
        _run_with_progress(common + ['-pass', '1', '-an', '-f', 'null', 'NUL' if os.name == 'nt' else '/dev/null'], duration, lambda p: progress_cb and progress_cb(p, '正在分析（第一階段）…'), 5, 45)
        has_audio = _has_audio(in_path)
        audio_args = ['-c:a', 'aac', '-b:a', f'{audio_kbps}k'] if has_audio else ['-an']
        _run_with_progress(common + ['-pass', '2', *audio_args, out_path], duration, lambda p: progress_cb and progress_cb(p, '正在編碼（第二階段）…'), 50, 48)
    finally:
        for suffix in ('-0.log', '-0.log.mbtree'):
            try:
                os.remove(log + suffix)
            except OSError:
                pass

def to_gif(in_path, out_path, fps, width, tmp_dir, progress_cb=None):
    """Palette-optimized GIF (two-step palettegen/paletteuse)."""
    palette = os.path.join(tmp_dir, os.path.basename(out_path) + '.palette.png')
    scale = f'fps={fps},scale={width}:-2:flags=lanczos'
    try:
        if progress_cb:
            progress_cb(15, '正在建立調色盤…')
        _run([_ffmpeg(), '-y', '-v', 'error', '-i', in_path, '-vf', f'{scale},palettegen=stats_mode=diff', palette], timeout=600)
        if progress_cb:
            progress_cb(50, '正在產生 GIF…')
        _run([_ffmpeg(), '-y', '-v', 'error', '-i', in_path, '-i', palette, '-lavfi', f'{scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', out_path], timeout=1200)
        if progress_cb:
            progress_cb(96, '正在完成最後處理…')
    finally:
        try:
            os.remove(palette)
        except OSError:
            pass
