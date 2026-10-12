/**
 * NextGenUp — Video Tools controller: audio cleanup (denoise / remove
 * music / remove voice), compressor with target size, and GIF maker.
 */
(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const NGU_TOKEN = document.querySelector('meta[name="ngu-token"]')?.content || '';

    const HINTS = {
        denoise: "AI 移除影片音軌中的背景雜訊",
        remove_music: "AI 保留人聲、移除配樂",
        remove_voice: "AI 保留配樂、移除人聲",
        compress: "以雙次編碼達到目標檔案大小",
        gif: "使用最佳化調色盤製作動態 GIF",
    };
    const MODEL_FOR = { denoise: 'denoise_speech', remove_music: 'separate', remove_voice: 'separate' };

    const vt = {
        file: null, taskId: null, mode: 'denoise',
        processing: false, cancelRequested: false, resultId: null,
        resultName: '', resultIsGif: false,
    };

    function showToast(msg) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function desktopDialog() {
        return (window.__TAURI__ && window.__TAURI__.dialog) ? window.__TAURI__.dialog : null;
    }

    async function browserSaveAs(suggestedName, getBlob) {
        if (!window.showSaveFilePicker) return false;
        let handle;
        try {
            handle = await window.showSaveFilePicker({ suggestedName });
        } catch (e) {
            if (e && e.name === 'AbortError') return true;
            return false;
        }
        try {
            const blob = await getBlob();
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast("已儲存  " + suggestedName);
        } catch (e) {
            showToast("儲存失敗： " + e.message);
        }
        return true;
    }

    async function saveResult(taskId, suggestedName) {
        const dlg = desktopDialog();
        if (dlg) {
            try {
                const path = await dlg.save({ defaultPath: suggestedName });
                if (!path) return;
                const res = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-NGU-Token': NGU_TOKEN },
                    body: JSON.stringify({ task_id: taskId, path }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "儲存失敗");
                showToast("已儲存至  " + data.path);
            } catch (e) {
                showToast("儲存失敗： " + e.message);
            }
            return;
        }
        const url = `/api/file/${taskId}`;
        if (await browserSaveAs(suggestedName, async () => {
            const r = await fetch(url);
            if (!r.ok) throw new Error("下載失敗");
            return r.blob();
        })) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function ensureModel(key, onProgress) {
        let s = await (await fetch(`/api/models/${key}`)).json();
        if (s.available) return;
        const mb = Math.round((s.size || 0) / 1e6);
        onProgress(0, `正在下載 AI 模型（${mb} MB）— 首次設定…`);
        await fetch(`/api/models/${key}`, { method: 'POST' });
        while (true) {
            await sleep(1000);
            try {
                s = await (await fetch(`/api/models/${key}`)).json();
            } catch {
                continue;
            }
            if (s.available) return;
            if (s.status === 'error') throw new Error("模型下載失敗： " + (s.error || "網路錯誤"));
            onProgress(Math.round((s.progress || 0) * 0.99),
                `正在下載 AI 模型（${mb} MB）… ${s.progress || 0}%`);
        }
    }

    function pollStatus(taskId, onProgress, isCancelled) {
        return new Promise((resolve, reject) => {
            const iv = setInterval(async () => {
                if (isCancelled && isCancelled()) {
                    clearInterval(iv);
                    reject(new Error('cancelled'));
                    return;
                }
                try {
                    const s = await (await fetch(`/api/image/status/${taskId}`)).json();
                    if (onProgress) onProgress(s.progress || 50, s.message || "處理中…");
                    if (s.status === 'completed') { clearInterval(iv); resolve(s); }
                    else if (s.status === 'cancelled') { clearInterval(iv); reject(new Error('cancelled')); }
                    else if (s.status === 'error') { clearInterval(iv); reject(new Error(s.message || "本機引擎錯誤")); }
                } catch {
                    clearInterval(iv);
                    reject(new Error("連線中斷"));
                }
            }, 800);
        });
    }

    function fmtSize(bytes) {
        if (bytes > 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / 1024).toFixed(0) + ' KB';
    }

    function init() {
        const zone = $('#vtools-dropzone');
        const input = $('#vtools-file-input');
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files.length) handleFile(input.files[0]);
        });

        document.querySelectorAll('[data-vtool]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (vt.processing) return;
                document.querySelectorAll('[data-vtool]').forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                vt.mode = btn.dataset.vtool;
                $('#vtools-hint').textContent = HINTS[vt.mode];
                $('#vtools-compress-opts').classList.toggle('hidden', vt.mode !== 'compress');
                $('#vtools-gif-opts').classList.toggle('hidden', vt.mode !== 'gif');
            });
        });

        $('#vtools-start-btn').addEventListener('click', run);
        $('#vtools-cancel-btn').addEventListener('click', () => {
            vt.cancelRequested = true;
            if (vt.taskId) fetch(`/api/image/cancel/${vt.taskId}`, { method: 'POST' }).catch(() => {});
        });
        $('#vtools-save').addEventListener('click', () => {
            if (vt.resultId) saveResult(vt.resultId, vt.resultName);
        });
        $('#vtools-new-btn').addEventListener('click', () => {
            $('#vtools-app-section').classList.add('hidden');
            $('#vtools-new-row').classList.add('hidden');
            $('#vtools-upload-section').classList.remove('hidden');
            $('#vtools-file-input').value = '';
            vt.file = null;
            vt.taskId = null;
        });
    }

    function handleFile(file) {
        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
            showToast("請選擇影片檔案。");
            return;
        }
        if (file.size > 2 * 1024 * 1024 * 1024) {
            showToast("檔案過大，上限為 2 GB。");
            return;
        }
        vt.file = file;
        vt.taskId = null;
        vt.resultId = null;
        $('#vtools-file-name').textContent = file.name;
        $('#vtools-file-info').textContent = fmtSize(file.size);
        $('#vtools-upload-section').classList.add('hidden');
        $('#vtools-app-section').classList.remove('hidden');
        $('#vtools-new-row').classList.remove('hidden');
        $('#vtools-results').classList.add('hidden');
        $('#vtools-start-btn').disabled = false;
    }

    function progress(pct, msg) {
        $('#vtools-progress-fill').style.width = pct + '%';
        $('#vtools-progress-percent').textContent = pct + '%';
        $('#vtools-progress-message').textContent = msg;
    }

    async function upload() {
        if (vt.taskId) return vt.taskId;    // reuse the upload across tool runs
        const formData = new FormData();
        formData.append('video', vt.file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "匯入失敗");
        vt.taskId = data.task_id;
        return data.task_id;
    }

    async function run() {
        if (vt.processing || !vt.file) return;
        vt.processing = true;
        vt.cancelRequested = false;
        $('#vtools-start-btn').disabled = true;
        $('#vtools-progress-section').classList.remove('hidden');
        $('#vtools-results').classList.add('hidden');
        $('#vtools-new-row').classList.add('hidden');

        const stem = vt.file.name.replace(/\.[^.]+$/, '');
        try {
            if (MODEL_FOR[vt.mode]) await ensureModel(MODEL_FOR[vt.mode], progress);
            progress(2, "正在匯入影片…");
            const taskId = await upload();

            let endpoint, body, resultId, resultName, isGif = false;
            if (vt.mode === 'compress') {
                endpoint = '/api/video/compress';
                body = { task_id: taskId, target_mb: parseFloat($('#vtools-target-mb').value) };
                resultId = taskId + '_cmp';
                resultName = `${stem}_compressed.mp4`;
            } else if (vt.mode === 'gif') {
                endpoint = '/api/video/gif';
                body = { task_id: taskId, fps: parseInt($('#vtools-gif-fps').value),
                         width: parseInt($('#vtools-gif-width').value) };
                resultId = taskId + '_gif';
                resultName = `${stem}.gif`;
                isGif = true;
            } else {
                endpoint = '/api/video/audio';
                body = { task_id: taskId, mode: vt.mode };
                resultId = taskId + '_cln';
                const label = { denoise: 'denoised', remove_music: 'voice_only',
                                remove_voice: 'music_only' }[vt.mode];
                resultName = `${stem}_${label}.mp4`;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "無法開始處理");
            }
            const final = await pollStatus(taskId, progress, () => vt.cancelRequested);

            vt.resultId = resultId;
            vt.resultName = resultName;
            vt.resultIsGif = isGif;
            const url = `/api/file/${resultId}?t=${Date.now()}`;
            $('#vtools-result-video').classList.toggle('hidden', isGif);
            $('#vtools-result-gif').classList.toggle('hidden', !isGif);
            if (isGif) $('#vtools-result-gif').src = url;
            else $('#vtools-result-video').src = url;
            $('#vtools-result-label').textContent = resultName;
            $('#vtools-result-size').textContent =
                (final.message || '').replace("完成！", '').trim();
            $('#vtools-results').classList.remove('hidden');
        } catch (err) {
            if (vt.cancelRequested || (err && err.message === 'cancelled')) {
                showToast("已取消。");
            } else {
                showToast("處理失敗： " + err.message);
            }
        } finally {
            vt.processing = false;
            $('#vtools-progress-section').classList.add('hidden');
            $('#vtools-new-row').classList.remove('hidden');
            $('#vtools-start-btn').disabled = false;
        }
    }

    init();
})();
