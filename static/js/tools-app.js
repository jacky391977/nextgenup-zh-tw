/**
 * NextGenUp — Restore tools controllers:
 *   Denoise & Deblur (SCUNet / NAFNet), single + batch
 *   Magic Eraser (LaMa) with brush-mask canvas
 *   Old Photo Restore (DDColor + GFPGAN + Real-ESRGAN pipeline)
 *
 * Models download on first use: pressing the action button fetches the
 * model with progress shown in the normal progress bar, then continues.
 */
(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const NGU_TOKEN = document.querySelector('meta[name="ngu-token"]')?.content || '';

    // ========================= SHARED HELPERS =========================

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

    function isValidImage(file) {
        return (file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|bmp|tiff?)$/i))
            && file.size <= 50 * 1024 * 1024;
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
            if (e && e.name === 'AbortError') return true; // user closed the dialog
            return false; // API blocked here — use the fallback
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

    async function saveServerResult(taskId, suggestedName) {
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
        const url = `/api/image/download/${taskId}`;
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

    async function saveBlobResult(blob, suggestedName) {
        const dlg = desktopDialog();
        if (dlg) {
            try {
                const path = await dlg.save({ defaultPath: suggestedName });
                if (!path) return;
                const res = await fetch('/api/save-blob?path=' + encodeURIComponent(path), {
                    method: 'POST',
                    headers: { 'X-NGU-Token': NGU_TOKEN },
                    body: blob,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "儲存失敗");
                showToast("已儲存至  " + data.path);
            } catch (e) {
                showToast("儲存失敗： " + e.message);
            }
            return;
        }
        if (await browserSaveAs(suggestedName, () => Promise.resolve(blob))) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }

    /** Make sure a model is installed, downloading with progress if not. */
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

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/image/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "匯入失敗");
        return data.task_id;
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
            }, 500);
        });
    }

    function bindDropzone(zoneSel, inputSel, onFiles) {
        const zone = $(zoneSel);
        const input = $(inputSel);
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        });
        input.addEventListener('change', () => {
            if (input.files.length) onFiles(input.files);
        });
    }

    // ========================= DENOISE & DEBLUR =========================

    const MODE_HINTS = {
        denoise: "改善低光照片顆粒與 ISO 雜訊",
        deblur: "改善動態模糊與相機晃動",
    };

    const clean = {
        file: null, taskId: null, mode: 'denoise', processing: false,
        cancelRequested: false, originalUrl: null,
        batch: { items: [], running: false, mode: 'denoise', cancelRequested: false, currentTaskId: null },
    };

    function initClean() {
        bindDropzone('#clean-dropzone', '#clean-file-input', (files) => {
            const valid = Array.from(files).filter(isValidImage);
            if (!valid.length) { showToast("請選擇小於 50 MB 的圖片檔案。"); return; }
            if (valid.length === 1) cleanEnterSingle(valid[0]);
            else cleanEnterBatch(valid);
        });

        document.querySelectorAll('[data-cleanmode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (clean.processing) return;
                document.querySelectorAll('[data-cleanmode]').forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                clean.mode = btn.dataset.cleanmode;
                $('#clean-mode-hint').textContent = MODE_HINTS[clean.mode];
            });
        });
        document.querySelectorAll('[data-cleanbatchmode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (clean.batch.running) return;
                document.querySelectorAll('[data-cleanbatchmode]').forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                clean.batch.mode = btn.dataset.cleanbatchmode;
            });
        });

        $('#clean-start-btn').addEventListener('click', cleanStart);
        $('#clean-cancel-btn').addEventListener('click', () => {
            clean.cancelRequested = true;
            if (clean.taskId) fetch(`/api/image/cancel/${clean.taskId}`, { method: 'POST' }).catch(() => {});
        });
        $('#clean-download-btn').addEventListener('click', () => {
            if (!clean.taskId) return;
            const stem = clean.file ? clean.file.name.replace(/\.[^.]+$/, '') : 'image';
            saveServerResult(clean.taskId, `${stem}_clean.png`);
        });
        $('#clean-new-btn').addEventListener('click', cleanResetSingle);

        $('#clean-batch-start-btn').addEventListener('click', cleanStartBatch);
        $('#clean-batch-zip-btn').addEventListener('click', cleanBatchZip);
        $('#clean-batch-reset-btn').addEventListener('click', cleanResetBatch);
    }

    function cleanEnterSingle(file) {
        clean.file = file;
        clean.taskId = null;
        if (clean.originalUrl) URL.revokeObjectURL(clean.originalUrl);
        clean.originalUrl = URL.createObjectURL(file);
        const img = $('#clean-original');
        img.src = clean.originalUrl;
        img.onload = () => { $('#clean-original-res').textContent = `${img.naturalWidth}x${img.naturalHeight}`; };

        $('#clean-upload-section').classList.add('hidden');
        $('#clean-batch-section').classList.add('hidden');
        $('#clean-app-section').classList.remove('hidden');
        $('#clean-new-row').classList.remove('hidden');
        $('#clean-download-section').classList.add('hidden');
        $('#clean-result').classList.add('hidden');
        $('#clean-result').src = '';
        $('#clean-output-placeholder').classList.remove('hidden');
        $('#clean-start-btn').disabled = false;
    }

    function cleanProgress(pct, msg) {
        $('#clean-progress-fill').style.width = pct + '%';
        $('#clean-progress-percent').textContent = pct + '%';
        $('#clean-progress-message').textContent = msg;
    }

    async function cleanStart() {
        if (clean.processing || !clean.file) return;
        clean.processing = true;
        clean.cancelRequested = false;
        $('#clean-start-btn').disabled = true;
        $('#clean-progress-section').classList.remove('hidden');
        $('#clean-download-section').classList.add('hidden');
        $('#clean-new-row').classList.add('hidden');

        try {
            await ensureModel(clean.mode, cleanProgress);
            cleanProgress(2, "正在匯入圖片…");
            const taskId = await uploadImage(clean.file);
            clean.taskId = taskId;
            const res = await fetch('/api/clean', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId, mode: clean.mode }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "無法開始處理");
            }
            await pollStatus(taskId, cleanProgress, () => clean.cancelRequested);

            const resultImg = $('#clean-result');
            resultImg.src = `/api/image/download/${taskId}?t=${Date.now()}`;
            resultImg.classList.remove('hidden');
            resultImg.onload = () => { $('#clean-result-res').textContent = `${resultImg.naturalWidth}x${resultImg.naturalHeight}`; };
            $('#clean-output-placeholder').classList.add('hidden');
            $('#clean-download-details').textContent = clean.mode === 'denoise'
                ? "已使用 SCUNet AI 降噪" : "已使用 NAFNet AI 去除模糊";
            $('#clean-download-section').classList.remove('hidden');
        } catch (err) {
            if (clean.cancelRequested || (err && err.message === 'cancelled')) {
                showToast("已取消，可調整設定後重試。");
            } else {
                showToast("圖片清理失敗： " + err.message);
            }
        } finally {
            clean.processing = false;
            $('#clean-progress-section').classList.add('hidden');
            $('#clean-new-row').classList.remove('hidden');
            $('#clean-start-btn').disabled = false;
        }
    }

    function cleanResetSingle() {
        clean.file = null;
        clean.taskId = null;
        $('#clean-app-section').classList.add('hidden');
        $('#clean-progress-section').classList.add('hidden');
        $('#clean-download-section').classList.add('hidden');
        $('#clean-new-row').classList.add('hidden');
        $('#clean-upload-section').classList.remove('hidden');
        $('#clean-file-input').value = '';
    }

    // --- Clean batch (same pattern as the background remover batch) ---

    function cleanEnterBatch(files) {
        const b = clean.batch;
        b.items.forEach((i) => { if (i.url) URL.revokeObjectURL(i.url); });
        b.items = files.map((file) => ({ file, url: URL.createObjectURL(file), status: 'pending', taskId: null, el: null }));
        b.running = false;
        b.cancelRequested = false;

        $('#clean-upload-section').classList.add('hidden');
        $('#clean-app-section').classList.add('hidden');
        $('#clean-batch-section').classList.remove('hidden');

        $('#clean-batch-title').textContent = `批次：${b.items.length} 張圖片`;
        $('#clean-batch-sub').textContent = "選擇修復方式，再開始處理";
        $('#clean-batch-progress-label').textContent = '—';
        $('#clean-batch-zip-btn').classList.add('hidden');
        $('#clean-batch-start-btn').disabled = false;
        $('#clean-batch-reset-btn').textContent = "取消";

        const grid = $('#clean-batch-grid');
        grid.innerHTML = '';
        b.items.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'batch-item';
            const img = document.createElement('img');
            img.src = item.url;
            const info = document.createElement('div');
            info.className = 'batch-item-info';
            const name = document.createElement('span');
            name.className = 'batch-item-name';
            name.textContent = item.file.name;
            const status = document.createElement('span');
            status.className = 'batch-status pending';
            status.textContent = "等待處理";
            info.append(name, status);
            div.append(img, info);
            grid.appendChild(div);
            item.el = { status, info, img };
        });
    }

    function cleanSetItem(item, cls, text) {
        item.el.status.className = 'batch-status ' + cls;
        item.el.status.textContent = text;
    }

    async function cleanStartBatch() {
        const b = clean.batch;
        if (b.running || !b.items.length) return;
        b.running = true;
        b.cancelRequested = false;
        $('#clean-batch-start-btn').disabled = true;
        $('#clean-batch-zip-btn').classList.add('hidden');
        $('#clean-batch-reset-btn').textContent = "取消";

        try {
            await ensureModel(b.mode, (pct, msg) => { $('#clean-batch-sub').textContent = msg; });
        } catch (e) {
            showToast(e.message);
            b.running = false;
            $('#clean-batch-start-btn').disabled = false;
            return;
        }
        $('#clean-batch-sub').textContent = b.mode === 'denoise'
            ? "正在本機引擎降噪" : "正在本機引擎去除模糊";

        let done = 0;
        for (const item of b.items) {
            if (b.cancelRequested) break;
            $('#clean-batch-progress-label').textContent = `${done + 1} / ${b.items.length}`;
            cleanSetItem(item, 'working', '0%');
            try {
                const taskId = await uploadImage(item.file);
                b.currentTaskId = taskId;
                if (b.cancelRequested) throw new Error('cancelled');
                const res = await fetch('/api/clean', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_id: taskId, mode: b.mode }),
                });
                if (!res.ok) throw new Error("無法開始處理");
                await pollStatus(taskId, (pct) => cleanSetItem(item, 'working', pct + '%'),
                    () => b.cancelRequested);
                item.taskId = taskId;
                item.status = 'completed';
                b.currentTaskId = null;
                cleanSetItem(item, 'done', 'done');
                const a = document.createElement('a');
                a.textContent = "儲存";
                a.href = '#';
                const name = item.file.name.replace(/\.[^.]+$/, '') + '_clean.png';
                a.addEventListener('click', (e) => { e.preventDefault(); saveServerResult(item.taskId, name); });
                item.el.info.appendChild(a);
                item.el.img.src = `/api/image/download/${taskId}?t=${Date.now()}`;
            } catch (e) {
                if (b.cancelRequested || (e && e.message === 'cancelled')) {
                    cleanSetItem(item, 'failed', 'cancelled');
                    break;
                }
                console.error('clean batch item failed', e);
                cleanSetItem(item, 'failed', 'failed');
            }
            done++;
        }

        const finished = b.items.filter((i) => i.status === 'completed');
        if (b.cancelRequested) {
            $('#clean-batch-progress-label').textContent = "已取消";
            $('#clean-batch-sub').textContent = `已取消 — 停止前已完成 ${finished.length} 個檔案`;
        } else {
            $('#clean-batch-progress-label').textContent = "已完成";
            $('#clean-batch-sub').textContent = `共 ${b.items.length} 個檔案，成功 ${finished.length} 個`;
        }
        if (finished.length) $('#clean-batch-zip-btn').classList.remove('hidden');
        b.running = false;
        b.currentTaskId = null;
        b.cancelRequested = false;
        $('#clean-batch-start-btn').disabled = false;
        $('#clean-batch-reset-btn').textContent = "關閉";
    }

    async function cleanBatchZip() {
        const ids = clean.batch.items.filter((i) => i.status === 'completed').map((i) => i.taskId);
        if (!ids.length) return;
        const btn = $('#clean-batch-zip-btn');
        btn.disabled = true;
        btn.textContent = "正在打包 ZIP…";
        try {
            const res = await fetch('/api/zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_ids: ids }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "ZIP 壓縮失敗");
            const dlg = desktopDialog();
            if (dlg) {
                await saveServerResult(data.zip_id, 'cleaned_images.zip');
            } else if (!await browserSaveAs('cleaned_images.zip', async () => {
                const r = await fetch(`/api/zip/${data.zip_id}`);
                if (!r.ok) throw new Error("下載失敗");
                return r.blob();
            })) {
                const a = document.createElement('a');
                a.href = `/api/zip/${data.zip_id}`;
                a.download = 'cleaned_images.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (e) {
            showToast("ZIP 打包失敗： " + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "儲存全部結果（.zip）";
        }
    }

    function cleanResetBatch() {
        const b = clean.batch;
        if (b.running) {
            b.cancelRequested = true;
            if (b.currentTaskId) fetch(`/api/image/cancel/${b.currentTaskId}`, { method: 'POST' }).catch(() => {});
            $('#clean-batch-sub').textContent = "正在取消…";
            return;
        }
        b.items.forEach((i) => { if (i.url) URL.revokeObjectURL(i.url); });
        b.items = [];
        $('#clean-batch-grid').innerHTML = '';
        $('#clean-batch-section').classList.add('hidden');
        $('#clean-upload-section').classList.remove('hidden');
        $('#clean-file-input').value = '';
    }

    // ========================= MAGIC ERASER =========================

    const eraser = {
        blob: null,          // current working image (PNG blob)
        history: [],         // previous images for Undo
        naturalW: 0, naturalH: 0,
        drawing: false,
        hasMask: false,
        processing: false,
        cancelRequested: false,
        taskId: null,
        maskCanvas: null,    // offscreen, natural size, white strokes on black
    };

    function initEraser() {
        bindDropzone('#erase-dropzone', '#erase-file-input', (files) => {
            const file = Array.from(files).find(isValidImage);
            if (!file) { showToast("請選擇小於 50 MB 的圖片檔案。"); return; }
            eraserLoadFile(file);
        });

        const overlay = $('#erase-overlay');
        overlay.addEventListener('pointerdown', (e) => {
            if (eraser.processing) return;
            eraser.drawing = true;
            overlay.setPointerCapture(e.pointerId);
            eraserStroke(e, true);
        });
        overlay.addEventListener('pointermove', (e) => { if (eraser.drawing) eraserStroke(e, false); });
        overlay.addEventListener('pointerup', () => { eraser.drawing = false; });
        overlay.addEventListener('pointercancel', () => { eraser.drawing = false; });

        $('#erase-clear-btn').addEventListener('click', eraserClearMask);
        $('#erase-undo-btn').addEventListener('click', eraserUndo);
        $('#erase-start-btn').addEventListener('click', eraserRun);
        $('#erase-cancel-btn').addEventListener('click', () => {
            eraser.cancelRequested = true;
            if (eraser.taskId) fetch(`/api/image/cancel/${eraser.taskId}`, { method: 'POST' }).catch(() => {});
        });
        $('#erase-download-btn').addEventListener('click', () => {
            if (eraser.blob) saveBlobResult(eraser.blob, 'erased.png');
        });
        $('#erase-new-btn').addEventListener('click', eraserReset);
    }

    async function eraserLoadFile(file) {
        eraser.blob = file;
        eraser.history = [];
        $('#erase-undo-btn').disabled = true;
        $('#erase-upload-section').classList.add('hidden');
        $('#erase-app-section').classList.remove('hidden');
        $('#erase-new-row').classList.remove('hidden');
        $('#erase-download-section').classList.add('hidden');
        await eraserDrawImage();
    }

    async function eraserDrawImage() {
        const bitmap = await createImageBitmap(eraser.blob);
        eraser.naturalW = bitmap.width;
        eraser.naturalH = bitmap.height;

        const base = $('#erase-canvas');
        const overlay = $('#erase-overlay');
        base.width = bitmap.width;
        base.height = bitmap.height;
        overlay.width = bitmap.width;
        overlay.height = bitmap.height;
        base.getContext('2d').drawImage(bitmap, 0, 0);
        bitmap.close();

        eraser.maskCanvas = document.createElement('canvas');
        eraser.maskCanvas.width = eraser.naturalW;
        eraser.maskCanvas.height = eraser.naturalH;
        const mctx = eraser.maskCanvas.getContext('2d');
        mctx.fillStyle = '#000';
        mctx.fillRect(0, 0, eraser.naturalW, eraser.naturalH);
        eraser.hasMask = false;
    }

    function eraserStroke(e, isStart) {
        const overlay = $('#erase-overlay');
        const rect = overlay.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (overlay.width / rect.width);
        const y = (e.clientY - rect.top) * (overlay.height / rect.height);
        // Brush size is in screen pixels; convert to image pixels
        const r = parseInt($('#erase-brush-size').value) * (overlay.width / rect.width) / 2;

        const octx = overlay.getContext('2d');
        octx.fillStyle = 'rgba(255, 80, 80, 0.55)';
        octx.beginPath();
        octx.arc(x, y, r, 0, Math.PI * 2);
        octx.fill();

        const mctx = eraser.maskCanvas.getContext('2d');
        mctx.fillStyle = '#fff';
        mctx.beginPath();
        mctx.arc(x, y, r, 0, Math.PI * 2);
        mctx.fill();

        // Connect to the previous point so fast strokes stay solid
        if (!isStart && eraser.lastX !== undefined) {
            for (const [ctx, style] of [[octx, 'rgba(255, 80, 80, 0.55)'], [mctx, '#fff']]) {
                ctx.strokeStyle = style;
                ctx.lineWidth = r * 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(eraser.lastX, eraser.lastY);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
        eraser.lastX = x;
        eraser.lastY = y;
        if (isStart) { eraser.lastX = x; eraser.lastY = y; }
        eraser.hasMask = true;
    }

    function eraserClearMask() {
        const overlay = $('#erase-overlay');
        overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
        if (eraser.maskCanvas) {
            const mctx = eraser.maskCanvas.getContext('2d');
            mctx.fillStyle = '#000';
            mctx.fillRect(0, 0, eraser.maskCanvas.width, eraser.maskCanvas.height);
        }
        eraser.hasMask = false;
        eraser.lastX = undefined;
    }

    function eraserProgress(pct, msg) {
        $('#erase-progress-fill').style.width = pct + '%';
        $('#erase-progress-percent').textContent = pct + '%';
        $('#erase-progress-message').textContent = msg;
    }

    async function eraserRun() {
        if (eraser.processing) return;
        if (!eraser.hasMask) { showToast("請先塗抹想移除的物件。"); return; }
        eraser.processing = true;
        eraser.cancelRequested = false;
        $('#erase-start-btn').disabled = true;
        $('#erase-progress-section').classList.remove('hidden');
        $('#erase-download-section').classList.add('hidden');

        try {
            await ensureModel('erase', eraserProgress);
            eraserProgress(5, "正在匯入…");
            const maskBlob = await new Promise((r) => eraser.maskCanvas.toBlob(r, 'image/png'));
            const formData = new FormData();
            formData.append('image', eraser.blob, 'image.png');
            formData.append('mask', maskBlob, 'mask.png');
            const res = await fetch('/api/erase', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "無法開始處理");
            eraser.taskId = data.task_id;

            await pollStatus(data.task_id, eraserProgress, () => eraser.cancelRequested);

            const dl = await fetch(`/api/image/download/${data.task_id}?t=${Date.now()}`);
            if (!dl.ok) throw new Error("處理結果下載失敗");
            const resultBlob = await dl.blob();

            eraser.history.push(eraser.blob);
            eraser.blob = resultBlob;
            $('#erase-undo-btn').disabled = false;
            await eraserDrawImage();
            $('#erase-overlay').getContext('2d').clearRect(0, 0, eraser.naturalW, eraser.naturalH);
            $('#erase-download-section').classList.remove('hidden');
        } catch (err) {
            if (eraser.cancelRequested || (err && err.message === 'cancelled')) {
                showToast("已取消。");
            } else {
                showToast("物件移除失敗： " + err.message);
            }
        } finally {
            eraser.processing = false;
            eraser.taskId = null;
            $('#erase-progress-section').classList.add('hidden');
            $('#erase-start-btn').disabled = false;
        }
    }

    async function eraserUndo() {
        if (!eraser.history.length || eraser.processing) return;
        eraser.blob = eraser.history.pop();
        $('#erase-undo-btn').disabled = !eraser.history.length;
        await eraserDrawImage();
    }

    function eraserReset() {
        eraser.blob = null;
        eraser.history = [];
        eraser.hasMask = false;
        $('#erase-app-section').classList.add('hidden');
        $('#erase-progress-section').classList.add('hidden');
        $('#erase-download-section').classList.add('hidden');
        $('#erase-new-row').classList.add('hidden');
        $('#erase-upload-section').classList.remove('hidden');
        $('#erase-file-input').value = '';
    }

    // ========================= OLD PHOTO RESTORE =========================

    const restore = {
        file: null, taskId: null, processing: false,
        cancelRequested: false, originalUrl: null,
    };

    function initRestore() {
        bindDropzone('#restore-dropzone', '#restore-file-input', (files) => {
            const file = Array.from(files).find(isValidImage);
            if (!file) { showToast("請選擇小於 50 MB 的圖片檔案。"); return; }
            restoreEnterSingle(file);
        });

        $('#restore-start-btn').addEventListener('click', restoreStart);
        $('#restore-cancel-btn').addEventListener('click', () => {
            restore.cancelRequested = true;
            if (restore.taskId) fetch(`/api/image/cancel/${restore.taskId}`, { method: 'POST' }).catch(() => {});
        });
        $('#restore-download-btn').addEventListener('click', () => {
            if (!restore.taskId) return;
            const stem = restore.file ? restore.file.name.replace(/\.[^.]+$/, '') : 'photo';
            saveServerResult(restore.taskId, `${stem}_restored.png`);
        });
        $('#restore-new-btn').addEventListener('click', restoreReset);
    }

    function restoreEnterSingle(file) {
        restore.file = file;
        restore.taskId = null;
        if (restore.originalUrl) URL.revokeObjectURL(restore.originalUrl);
        restore.originalUrl = URL.createObjectURL(file);
        const img = $('#restore-original');
        img.src = restore.originalUrl;
        img.onload = () => { $('#restore-original-res').textContent = `${img.naturalWidth}x${img.naturalHeight}`; };

        $('#restore-upload-section').classList.add('hidden');
        $('#restore-app-section').classList.remove('hidden');
        $('#restore-new-row').classList.remove('hidden');
        $('#restore-download-section').classList.add('hidden');
        $('#restore-result').classList.add('hidden');
        $('#restore-result').src = '';
        $('#restore-output-placeholder').classList.remove('hidden');
        $('#restore-start-btn').disabled = false;
    }

    function restoreProgress(pct, msg) {
        $('#restore-progress-fill').style.width = pct + '%';
        $('#restore-progress-percent').textContent = pct + '%';
        $('#restore-progress-message').textContent = msg;
    }

    async function restoreStart() {
        if (restore.processing || !restore.file) return;
        const colorize = $('#restore-colorize').checked;
        const faceCheck = $('#restore-face');
        const enhanceCheck = $('#restore-enhance');
        const face = !!(faceCheck && faceCheck.checked);
        const enhance = !!(enhanceCheck && enhanceCheck.checked);
        if (!colorize && !face && !enhance) {
            showToast("請至少選擇一項修復功能。");
            return;
        }
        restore.processing = true;
        restore.cancelRequested = false;
        $('#restore-start-btn').disabled = true;
        $('#restore-progress-section').classList.remove('hidden');
        $('#restore-download-section').classList.add('hidden');
        $('#restore-new-row').classList.add('hidden');

        try {
            if (colorize) await ensureModel('colorize', restoreProgress);
            restoreProgress(2, "正在匯入照片…");
            const taskId = await uploadImage(restore.file);
            restore.taskId = taskId;
            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId, colorize, face, enhance }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "無法開始處理");
            }
            await pollStatus(taskId, restoreProgress, () => restore.cancelRequested);

            const resultImg = $('#restore-result');
            resultImg.src = `/api/image/download/${taskId}?t=${Date.now()}`;
            resultImg.classList.remove('hidden');
            resultImg.onload = () => { $('#restore-result-res').textContent = `${resultImg.naturalWidth}x${resultImg.naturalHeight}`; };
            $('#restore-output-placeholder').classList.add('hidden');
            const parts = [];
            if (enhance) parts.push("細節已增強");
            if (face) parts.push("臉部已修復");
            if (colorize) parts.push("已上色");
            $('#restore-download-details').textContent =
                parts.join(', ').replace(/^./, (c) => c.toUpperCase());
            $('#restore-download-section').classList.remove('hidden');
        } catch (err) {
            if (restore.cancelRequested || (err && err.message === 'cancelled')) {
                showToast("已取消，可調整設定後重試。");
            } else {
                showToast("照片修復失敗： " + err.message);
            }
        } finally {
            restore.processing = false;
            $('#restore-progress-section').classList.add('hidden');
            $('#restore-new-row').classList.remove('hidden');
            $('#restore-start-btn').disabled = false;
        }
    }

    function restoreReset() {
        restore.file = null;
        restore.taskId = null;
        $('#restore-app-section').classList.add('hidden');
        $('#restore-progress-section').classList.add('hidden');
        $('#restore-download-section').classList.add('hidden');
        $('#restore-new-row').classList.add('hidden');
        $('#restore-upload-section').classList.remove('hidden');
        $('#restore-file-input').value = '';
    }

    // --- Init all three ---
    initClean();
    initEraser();
    initRestore();
})();
/* Shared photo comparison. Clip the original at full size, never resize one half. */
(() => {
    'use strict';
    function attachPhotoComparison(prefix) {
        const root = document.getElementById(prefix + '-app-section');
        if (!root) return;
        const original = document.getElementById(prefix + '-original');
        const result = document.getElementById(prefix + '-result');
        const start = document.getElementById(prefix + '-start-btn');
        const panels = root.querySelector('.image-compare-container');
        const section = document.createElement('section');
        section.className = 'ng-photo-compare hidden';
        section.id = prefix + '-photo-compare';
        section.setAttribute('aria-label', '原圖與修復結果比對');
        section.innerHTML = `
            <div class="ng-compare-toolbar">
                <strong>前後比對</strong>
                <button type="button" class="ng-compare-mode" aria-pressed="false">並排檢視</button>
            </div>
            <div class="ng-compare-swipe">
                <div class="ng-compare-labels"><span>左側：原圖</span><span>右側：修復結果</span></div>
                <div class="ng-compare-stage">
                    <img class="ng-compare-after" alt="修復後的照片" draggable="false">
                    <img class="ng-compare-before" alt="原始照片" draggable="false">
                    <div class="ng-compare-divider" aria-hidden="true"><span>↔</span></div>
                </div>
                <div class="ng-compare-controls">
                    <span>拖曳照片中的分隔線</span>
                    <input type="range" min="0" max="100" value="50" step="1" aria-label="前後比對分隔線">
                    <output>50%</output>
                </div>
            </div>`;
        panels.before(section);
        const stage = section.querySelector('.ng-compare-stage');
        const before = section.querySelector('.ng-compare-before');
        const after = section.querySelector('.ng-compare-after');
        const range = section.querySelector('input');
        const output = section.querySelector('output');
        const modeButton = section.querySelector('button');
        const swipe = section.querySelector('.ng-compare-swipe');
        let ready = false, sideBySide = false, pair = '', activePointer = null;
        function setPosition(value) {
            const position = Math.max(0, Math.min(100, value));
            stage.style.setProperty('--ng-position', position + '%');
            range.value = String(Math.round(position));
            range.setAttribute('aria-valuetext', `原圖 ${Math.round(position)}%，修復結果 ${100 - Math.round(position)}%`);
            output.value = Math.round(position) + '%';
        }
        function renderMode() {
            panels.classList.toggle('hidden', ready && !sideBySide);
            swipe.classList.toggle('hidden', sideBySide);
            modeButton.textContent = sideBySide ? '拖曳比對' : '並排檢視';
            modeButton.setAttribute('aria-pressed', String(sideBySide));
        }
        function sync() {
            ready = !!(original.getAttribute('src') && result.getAttribute('src') &&
                original.complete && result.complete && original.naturalWidth && result.naturalWidth &&
                !result.classList.contains('hidden') && !start.disabled);
            section.classList.toggle('hidden', !ready);
            if (ready) {
                const nextPair = original.src + '\n' + result.src;
                if (nextPair !== pair) {
                    pair = nextPair;
                    before.src = original.src;
                    after.src = result.src;
                    const ratio = original.naturalWidth / original.naturalHeight;
                    stage.style.aspectRatio = String(ratio);
                    stage.style.maxWidth = Math.round(ratio * 440) + 'px';
                    sideBySide = false;
                    setPosition(50);
                }
            } else if (!result.getAttribute('src') || result.classList.contains('hidden')) {
                pair = '';
                sideBySide = false;
                before.removeAttribute('src');
                after.removeAttribute('src');
            }
            renderMode();
        }
        function positionAt(clientX) {
            const rect = stage.getBoundingClientRect();
            if (rect.width > 0) setPosition((clientX - rect.left) / rect.width * 100);
        }
        stage.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0) return;
            activePointer = event.pointerId;
            stage.setPointerCapture(event.pointerId);
            positionAt(event.clientX);
            event.preventDefault();
        });
        stage.addEventListener('pointermove', event => {
            if (event.pointerId === activePointer) positionAt(event.clientX);
        });
        const stopDragging = event => {
            if (event.pointerId !== activePointer) return;
            if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
            activePointer = null;
        };
        stage.addEventListener('pointerup', stopDragging);
        stage.addEventListener('pointercancel', stopDragging);
        stage.addEventListener('lostpointercapture', () => { activePointer = null; });
        stage.addEventListener('dblclick', () => setPosition(50));
        range.addEventListener('input', () => setPosition(Number(range.value)));
        modeButton.addEventListener('click', () => { sideBySide = !sideBySide; renderMode(); });
        original.addEventListener('load', sync);
        result.addEventListener('load', sync);
        original.addEventListener('error', sync);
        result.addEventListener('error', sync);
        const observer = new MutationObserver(sync);
        observer.observe(original, { attributes: true, attributeFilter: ['src'] });
        observer.observe(result, { attributes: true, attributeFilter: ['src', 'class'] });
        observer.observe(start, { attributes: true, attributeFilter: ['disabled'] });
        setPosition(50);
        sync();
    }
    attachPhotoComparison('restore');
    attachPhotoComparison('clean');
})();
