    // --- 主题控制 ---
    const VIBE_THEMES = ['theme-v14-snow', 'theme-v14-glass', 'theme-v14-ink', 'theme-v14-paper'];
    let currentVibeTheme = localStorage.getItem('vibeThemeV14') || 'theme-v14-snow';
    document.body.className = currentVibeTheme;
    function openThemeModal() { document.getElementById('theme-modal').classList.remove('hidden'); document.getElementById('theme-modal').classList.add('flex'); highlightCurrentThemeBtn(); }
    function closeThemeModal() { document.getElementById('theme-modal').classList.add('hidden'); document.getElementById('theme-modal').classList.remove('flex'); }
    function highlightCurrentThemeBtn() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if(btn.dataset.theme === currentVibeTheme) { btn.classList.add('border-indigo-400', 'bg-white/20'); }
            else { btn.classList.remove('border-indigo-400', 'bg-white/20'); btn.classList.add('border-transparent'); }
        });
    }
    function applyTheme(themeName) {
        if (!VIBE_THEMES.includes(themeName)) return;
        document.body.classList.remove(...VIBE_THEMES);
        document.body.classList.add(themeName);
        currentVibeTheme = themeName;
        localStorage.setItem('vibeThemeV14', themeName);
        markLocalChanged();
        scheduleSyncPush();
        highlightCurrentThemeBtn();
    }

    function buildBackupObject(includeSensitive = true) {
        const storageData = collectStorageData();
        let exportedAiConfig = aiConfig;
        if (!includeSensitive) {
            const storedSyncConfig = JSON.parse(storageData.syncConfigV14 || '{}');
            storedSyncConfig.webdav = { ...(storedSyncConfig.webdav || {}), password: '' };
            storedSyncConfig.github = { ...(storedSyncConfig.github || {}), token: '' };
            storedSyncConfig.supabase = { ...(storedSyncConfig.supabase || {}), key: '' };
            storageData.syncConfigV14 = JSON.stringify(storedSyncConfig);
            const storedAiConfig = JSON.parse(storageData.aiConfigV13 || JSON.stringify(aiConfig));
            storedAiConfig.key = '';
            storageData.aiConfigV13 = JSON.stringify(storedAiConfig);
            exportedAiConfig = { ...aiConfig, key: '' };
        }
        return {
            formatVersion: 1,
            app: 'inspiration-catcher',
            appVersion: 'V13.0',
            exportedAt: new Date().toISOString(),
            inspirations,
            aiConfig: exportedAiConfig,
            theme: currentVibeTheme,
            localStorage: storageData
        };
    }

    function exportBackup() {
        const backup = buildBackupObject(document.getElementById('include-sensitive-data').checked);
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = `灵感捕手备份_${date}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function triggerBackupImport() {
        document.getElementById('backup-import-input').click();
    }

    function fillJianguoyunWebDav() {
        document.getElementById('sync-webdav-server').value = 'https://dav.jianguoyun.com/dav/';
    }

    function importBackupFile(event) {
        const input = event.target;
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const backup = JSON.parse(String(reader.result));
                if (!backup || typeof backup !== 'object' || Array.isArray(backup) || !backup.localStorage || typeof backup.localStorage !== 'object' || Array.isArray(backup.localStorage)) {
                    alert('❌ 备份文件格式不正确');
                    return;
                }

                const entries = Object.entries(backup.localStorage);
                if (entries.length === 0 || entries.some(([, value]) => typeof value !== 'string')) {
                    alert('❌ 备份文件没有可导入的数据');
                    return;
                }

                if (!confirm('导入会覆盖当前所有数据，确定吗？')) return;
                entries.forEach(([key, value]) => localStorage.setItem(key, value));
                window.location.reload();
            } catch (error) {
                alert('❌ JSON 解析失败，请确认这是导出的备份文件');
            }
        };
        reader.onerror = () => alert('❌ 读取备份文件失败');
        reader.readAsText(file, 'UTF-8');
    }

    // --- 危险区：清空数据 / 恢复出厂设置 / 同步暂停 ---
    // 本应用自己写入 localStorage 的全部 key。
    // localStorage 按域名共享：同一域名下的其他项目也读写同一个 localStorage，
    // 所以这里绝不能 localStorage.clear() 或遍历所有 key 删除，只能删这份清单里的 key。
    // 未来新功能如果要写新的 localStorage key，必须同步加到这里，否则恢复出厂设置会漏删。
    const APP_OWNED_KEYS = [
        'inspirationsV13', 'inspirationsV12', 'aiConfigV13', 'aiConfigV12',
        'vibeThemeV14', 'vibeThemeV13', 'syncConfigV14', 'syncConfigV13',
        'customElementsV14', 'drawCollectionsV14', 'dailyDrawsV14',
        'syncLocalChangedAtV14', '__syncPausedV14__'
    ];
    function clearAllData() {
        if (confirm('这会清空所有记录。是否先导出备份？')) {
            exportBackup();
            if (!confirm('备份已下载。确认清空所有数据？')) return;
        } else if (!confirm('不备份，直接清空？')) {
            return;
        }
        ['inspirationsV13', 'inspirationsV12'].forEach(key => localStorage.removeItem(key));
        location.reload();
    }

    function factoryReset() {
        if (confirm('这将清空所有数据和配置，包括云端同步设置。是否先导出备份？')) {
            exportBackup();
        }
        const input = prompt('请输入 DELETE（大写）确认重置');
        if (input !== 'DELETE') { alert('已取消'); return; }
        APP_OWNED_KEYS.forEach(key => localStorage.removeItem(key));
        localStorage.setItem('__syncPausedV14__', 'true');
        location.reload();
    }

    function refreshSyncPausedBanner() {
        const paused = localStorage.getItem('__syncPausedV14__') === 'true';
        document.getElementById('sync-paused-banner').classList.toggle('hidden', !paused);
    }

    async function resumeSyncPull() {
        localStorage.removeItem('__syncPausedV14__');
        refreshSyncPausedBanner();
        try {
            await sync.pull();
            location.reload();
        } catch (error) {
            updateSyncStatus(`❌ ${error.message}`);
            alert(`❌ 云端同步失败：${error.message}`);
        }
    }

    async function resumeSyncPush() {
        localStorage.removeItem('__syncPausedV14__');
        refreshSyncPausedBanner();
        try {
            await sync.push();
            alert('✅ 已上传');
        } catch (error) {
            updateSyncStatus(`❌ ${error.message}`);
            alert(`❌ 云端同步失败：${error.message}`);
        }
    }

    // --- 云端同步 ---
    // ⚠️ 新增敏感数据 key 时（如 API Key、Token），必须加到这个黑名单里，否则会随云端同步上传
    const SYNC_EXCLUDE_KEYS = [
        'aiConfigV13',
        'syncConfigV14',
        'syncLocalChangedAtV14'
    ];

    function collectStorageData(excludeKeys = []) {
        const storageData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (excludeKeys.includes(key)) continue;
            storageData[key] = localStorage.getItem(key);
        }
        return storageData;
    }

    const SYNC_CONFIG_DEFAULTS = {
        backend: 'none',
        webdav: { server: '', username: '', password: '', filePath: '/灵感捕手/data.json' },
        github: { repo: '', branch: 'main', filePath: '灵感捕手/data.json', token: '' },
        supabase: { url: '', key: '', table: '' }
    };
    let syncConfig = JSON.parse(localStorage.getItem('syncConfigV14')) || SYNC_CONFIG_DEFAULTS;
    syncConfig = { ...SYNC_CONFIG_DEFAULTS, ...syncConfig, webdav: { ...SYNC_CONFIG_DEFAULTS.webdav, ...(syncConfig.webdav || {}) }, github: { ...SYNC_CONFIG_DEFAULTS.github, ...(syncConfig.github || {}) }, supabase: { ...SYNC_CONFIG_DEFAULTS.supabase, ...(syncConfig.supabase || {}) } };
    let syncPushTimer = null;
    let syncSuppressAutoPush = false;

    function readSyncConfigFromForm() {
        return {
            backend: document.getElementById('sync-backend').value,
            webdav: {
                server: document.getElementById('sync-webdav-server').value.trim(),
                username: document.getElementById('sync-webdav-username').value.trim(),
                password: document.getElementById('sync-webdav-password').value,
                filePath: document.getElementById('sync-webdav-path').value.trim() || SYNC_CONFIG_DEFAULTS.webdav.filePath
            },
            github: {
                repo: document.getElementById('sync-github-repo').value.trim(),
                branch: document.getElementById('sync-github-branch').value.trim() || SYNC_CONFIG_DEFAULTS.github.branch,
                filePath: document.getElementById('sync-github-path').value.trim() || SYNC_CONFIG_DEFAULTS.github.filePath,
                token: document.getElementById('sync-github-token').value
            },
            supabase: {
                url: document.getElementById('sync-supabase-url').value.trim(),
                key: document.getElementById('sync-supabase-key').value,
                table: document.getElementById('sync-supabase-table').value.trim()
            }
        };
    }

    function saveSyncConfig(config) {
        syncConfig = config;
        localStorage.setItem('syncConfigV14', JSON.stringify(syncConfig));
    }

    function showSyncConfig() {
        const backend = document.getElementById('sync-backend').value;
        document.getElementById('sync-config-box').classList.toggle('hidden', backend === 'none');
        document.getElementById('sync-fields-webdav').classList.toggle('hidden', backend !== 'webdav');
        document.getElementById('sync-fields-github').classList.toggle('hidden', backend !== 'github');
        document.getElementById('sync-fields-supabase').classList.toggle('hidden', backend !== 'supabase');
        updateSyncStatus(backend === 'none' ? '未配置云端同步' : '配置后点击「测试连接」，再点击下方「保存设置」');
    }

    function updateSyncStatus(message) {
        document.getElementById('sync-status').innerText = message;
    }

    function isSyncConfigured(config = syncConfig) {
        if (config.backend === 'webdav') return Boolean(config.webdav.server && config.webdav.username && config.webdav.password);
        if (config.backend === 'github') return Boolean(config.github.repo && config.github.branch && config.github.filePath && config.github.token);
        if (config.backend === 'supabase') return Boolean(config.supabase.url && config.supabase.key && config.supabase.table);
        return false;
    }

    function markLocalChanged() {
        localStorage.setItem('syncLocalChangedAtV14', String(Date.now()));
    }

    function scheduleSyncPush() {
        if (syncSuppressAutoPush || !isSyncConfigured()) return;
        clearTimeout(syncPushTimer);
        syncPushTimer = setTimeout(async () => {
            try { await sync.push({ silent: true }); }
            catch (error) { console.error('自动同步失败:', error); }
        }, 500);
    }

    function buildSyncPayload() {
        return {
            formatVersion: 2,
            app: 'inspiration-catcher',
            appVersion: 'V13.0',
            exportedAt: new Date().toISOString(),
            syncedAt: Date.now(),
            localStorage: collectStorageData(SYNC_EXCLUDE_KEYS)
        };
    }

    function applyCloudData(cloud) {
        if (!cloud || typeof cloud !== 'object' || !cloud.localStorage || typeof cloud.localStorage !== 'object' || Array.isArray(cloud.localStorage)) return false;
        syncSuppressAutoPush = true;
        try {
            Object.entries(cloud.localStorage).forEach(([key, value]) => {
                if (!SYNC_EXCLUDE_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value);
            });
            const cloudInspirations = JSON.parse(localStorage.getItem('inspirationsV13') || '[]');
            if (Array.isArray(cloudInspirations)) inspirations = cloudInspirations;
            const syncedAt = Number(cloud.syncedAt) || Date.now();
            localStorage.setItem('syncLastSyncedV14', String(syncedAt));
            localStorage.setItem('syncLocalChangedAtV14', String(syncedAt));
            const cloudTheme = localStorage.getItem('vibeThemeV14');
            if (cloudTheme && VIBE_THEMES.includes(cloudTheme)) applyTheme(cloudTheme);
            saveData();
            if (document.getElementById('view-universe').classList.contains('active')) renderUniverse();
            return true;
        } finally {
            syncSuppressAutoPush = false;
        }
    }

    function getWebDavUrl(config) {
        const base = config.webdav.server.replace(/\/+$/, '');
        const path = config.webdav.filePath.startsWith('/') ? config.webdav.filePath : `/${config.webdav.filePath}`;
        return `${base}${path}`;
    }

    function getWebDavHeaders(config) {
        return { Authorization: `Basic ${toBase64Utf8(`${config.webdav.username}:${config.webdav.password}`)}` };
    }

    async function readWebDav(config) {
        const res = await fetch(getWebDavUrl(config), { method: 'GET', headers: getWebDavHeaders(config) });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`WebDAV 读取失败：${res.status}`);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    async function writeWebDav(config, payload) {
        const res = await fetch(getWebDavUrl(config), {
            method: 'PUT',
            headers: { ...getWebDavHeaders(config), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`WebDAV 写入失败：${res.status}`);
    }

    function getGithubContentUrl(config) {
        const encodedPath = config.github.filePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
        return `https://api.github.com/repos/${config.github.repo}/contents/${encodedPath}?ref=${encodeURIComponent(config.github.branch)}`;
    }

    function getGithubHeaders(config) {
        return { Authorization: `Bearer ${config.github.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    }

    function toBase64Utf8(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return btoa(binary);
    }

    function fromBase64Utf8(base64) {
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    async function readGithub(config) {
        const file = await getGithubFile(config);
        return file ? JSON.parse(fromBase64Utf8(file.content)) : null;
    }

    async function getGithubFile(config) {
        const res = await fetch(getGithubContentUrl(config), { headers: getGithubHeaders(config) });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`GitHub 读取失败：${res.status}`);
        return await res.json();
    }

    async function writeGithub(config, payload) {
        const existing = await getGithubFile(config);
        const body = {
            message: 'Sync Inspiration Catcher data',
            branch: config.github.branch,
            content: toBase64Utf8(JSON.stringify(payload))
        };
            if (existing && existing.sha) body.sha = existing.sha;
        const res = await fetch(getGithubContentUrl(config), {
            method: 'PUT',
            headers: { ...getGithubHeaders(config), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`GitHub 写入失败：${res.status}`);
    }

    function getSupabaseUrl(config) {
        const base = config.supabase.url.replace(/\/+$/, '');
        return `${base}/rest/v1/${encodeURIComponent(config.supabase.table)}`;
    }

    function getSupabaseHeaders(config) {
        return { apikey: config.supabase.key, Authorization: `Bearer ${config.supabase.key}` };
    }

    async function readSupabase(config) {
        const url = `${getSupabaseUrl(config)}?id=eq.inspiration-catcher&select=data,synced_at`;
        const res = await fetch(url, { headers: getSupabaseHeaders(config) });
        if (!res.ok) throw new Error(`Supabase 读取失败：${res.status}`);
        const rows = await res.json();
        return rows.length > 0 ? rows[0].data : null;
    }

    async function writeSupabase(config, payload) {
        const res = await fetch(getSupabaseUrl(config), {
            method: 'POST',
            headers: { ...getSupabaseHeaders(config), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([{ id: 'inspiration-catcher', data: payload, synced_at: new Date(payload.syncedAt).toISOString() }])
        });
        if (!res.ok) throw new Error(`Supabase 写入失败：${res.status}`);
    }

    async function readSyncBackend(config) {
        if (config.backend === 'webdav') return readWebDav(config);
        if (config.backend === 'github') return readGithub(config);
        if (config.backend === 'supabase') return readSupabase(config);
        throw new Error('请选择云端同步后端');
    }

    async function writeSyncBackend(config, payload) {
        if (config.backend === 'webdav') return writeWebDav(config, payload);
        if (config.backend === 'github') return writeGithub(config, payload);
        if (config.backend === 'supabase') return writeSupabase(config, payload);
        throw new Error('请选择云端同步后端');
    }

    const sync = {
        async push(options = {}) {
            const config = options.config || syncConfig;
            if (!isSyncConfigured(config)) throw new Error('请先完成云端同步配置');
            const payload = buildSyncPayload();
            await writeSyncBackend(config, payload);
            localStorage.setItem('syncLastSyncedV14', String(payload.syncedAt));
            localStorage.setItem('syncLocalChangedAtV14', String(payload.syncedAt));
            updateSyncStatus(`✅ 已同步到云端：${new Date(payload.syncedAt).toLocaleTimeString()}`);
            return payload;
        },
        async pull(options = {}) {
            const config = options.config || syncConfig;
            if (!isSyncConfigured(config)) throw new Error('请先完成云端同步配置');
            const cloud = await readSyncBackend(config);
            if (options.apply === false) return cloud;
            if (!cloud) {
                if (!options.silent) throw new Error('云端还没有数据，请先点击「立即同步」');
                return null;
            }
            const localChangedAt = Number(localStorage.getItem('syncLocalChangedAtV14')) || 0;
            const lastSyncedAt = Number(localStorage.getItem('syncLastSyncedV14')) || 0;
            const localVersion = Math.max(localChangedAt, lastSyncedAt);
            if (Number(cloud.syncedAt) > localVersion) {
                applyCloudData(cloud);
                updateSyncStatus(`✅ 云端较新，已恢复：${new Date(cloud.syncedAt).toLocaleTimeString()}`);
            } else if (!options.silent) {
                updateSyncStatus('☁️ 云端没有比本地更新的数据');
            }
            return cloud;
        },
        async test(options = {}) {
            const config = options.config || syncConfig;
            if (!isSyncConfigured(config)) throw new Error('请先完成云端同步配置');
            const payload = await sync.push({ ...options, config, silent: true });
            const cloud = await sync.pull({ config, apply: false, silent: true });
            if (!cloud || Number(cloud.syncedAt) !== Number(payload.syncedAt)) throw new Error('写入成功但读取校验失败');
            return cloud;
        }
    };

    async function withSyncButton(buttonId, action, idleText, runningText) {
        const button = document.getElementById(buttonId);
        button.innerText = runningText;
        button.disabled = true;
        try {
            await action();
        } catch (error) {
            updateSyncStatus(`❌ ${error.message}`);
            alert(`❌ 云端同步失败：${error.message}`);
        } finally {
            button.innerText = idleText;
            button.disabled = false;
        }
    }

    async function testSyncConnection() {
        const config = readSyncConfigFromForm();
        await withSyncButton('sync-test-btn', async () => {
            await sync.test({ config });
            updateSyncStatus('✅ 连接成功，已验证读写。请点击「保存设置」保留配置');
        }, '🔌 测试连接', '🔌 测试中...');
    }

    async function syncPushNow() {
        await withSyncButton('sync-push-btn', async () => {
            const config = readSyncConfigFromForm();
            saveSyncConfig(config);
            await sync.push();
        }, '⬆️ 立即同步', '⬆️ 同步中...');
    }

    async function syncPullNow() {
        await withSyncButton('sync-pull-btn', async () => {
            const config = readSyncConfigFromForm();
            saveSyncConfig(config);
            const cloud = await sync.pull();
            if (!cloud) alert('云端还没有数据，请先点击「立即同步」');
        }, '⬇️ 云端恢复', '⬇️ 拉取中...');
    }

    // --- 【关键修复】极其稳定的免版权 MP3 音源 ---
    const RADIO_PLAYLIST = [
        { title: "雨天发呆", artist: "Rain Ambience", url: "./audio/rain.mp3" }, // 日
        { title: "清晨森林鸟鸣", artist: "Forest Birds", url: "./audio/forest.mp3" }, // 一
        { title: "平静的海岸线", artist: "Ocean Waves", url: "./audio/ocean.mp3" }, // 二
        { title: "治愈系轻钢琴", artist: "Soft Piano", url: "./audio/piano.mp3" }, // 三
        { title: "深夜静谧白噪音", artist: "White Noise", url: "./audio/white-noise.mp3" }, // 四
        { title: "壁炉噼啪作响", artist: "Fireplace", url: "./audio/fireplace.mp3" }, // 五
        { title: "夜间虫鸣", artist: "Night Crickets", url: "./audio/crickets.mp3" }  // 六
    ];
    let currentRadio = RADIO_PLAYLIST[new Date().getDay()];

    // --- 颜色库扩展至每分类 5 种，且秘密星改为“发光暗星” ---
    const CATEGORY_COLORS = {
        '💡 灵感点子': [
            { id: 'insp_1', bg: '#fde047', shadow: 'rgba(253,224,71,0.7)' },
            { id: 'insp_2', bg: '#fbbf24', shadow: 'rgba(251,191,36,0.7)' },
            { id: 'insp_3', bg: '#f97316', shadow: 'rgba(249,115,22,0.7)' },
            { id: 'insp_4', bg: '#ef4444', shadow: 'rgba(239,68,68,0.7)' },
            { id: 'insp_5', bg: '#fca5a5', shadow: 'rgba(252,165,165,0.7)' }
        ],
        '✅ 顺手小事': [
            { id: 'todo_1', bg: '#6ee7b7', shadow: 'rgba(110,231,183,0.7)' },
            { id: 'todo_2', bg: '#34d399', shadow: 'rgba(52,211,153,0.7)' },
            { id: 'todo_3', bg: '#2dd4bf', shadow: 'rgba(45,212,191,0.7)' },
            { id: 'todo_4', bg: '#38bdf8', shadow: 'rgba(56,189,248,0.7)' },
            { id: 'todo_5', bg: '#818cf8', shadow: 'rgba(129,140,248,0.7)' }
        ],
        '📝 碎碎念/日记': [
            { id: 'diary_1', bg: '#c084fc', shadow: 'rgba(192,132,252,0.7)' },
            { id: 'diary_2', bg: '#d8b4fe', shadow: 'rgba(216,180,254,0.7)' },
            { id: 'diary_3', bg: '#f472b6', shadow: 'rgba(244,114,182,0.7)' },
            { id: 'diary_4', bg: '#fda4af', shadow: 'rgba(253,164,175,0.7)' },
            { id: 'diary_5', bg: '#e879f9', shadow: 'rgba(232,121,249,0.7)' }
        ],
        '🔒 小秘密': [
            { id: 'sec_1', bg: '#e2e8f0', shadow: 'rgba(226,232,240,0.8)', isSecret: true }, // 发光银
            { id: 'sec_2', bg: '#94a3b8', shadow: 'rgba(148,163,184,0.8)', isSecret: true }, // 秘银灰
            { id: 'sec_3', bg: '#5eead4', shadow: 'rgba(94,234,212,0.8)', isSecret: true }, // 幽光青
            { id: 'sec_4', bg: '#c4b5fd', shadow: 'rgba(196,181,253,0.8)', isSecret: true }, // 幽光紫
            { id: 'sec_5', bg: '#fecdd3', shadow: 'rgba(254,205,211,0.8)', isSecret: true }  // 幽光粉
        ]
    };
    
    let selectedStarColorId = 'random';
    let editingId = null; 
    let archiveCategoryFilter = 'diary'; // 默认档案只看日记

    const API_PRESETS = { deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' }, aliyun: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' }, openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o' }, custom: { url: '', model: '' } };
    
    let inspirations = JSON.parse(localStorage.getItem('inspirationsV13')) || JSON.parse(localStorage.getItem('inspirationsV12')) || [];
    
    let aiConfig = JSON.parse(localStorage.getItem('aiConfigV13')) || JSON.parse(localStorage.getItem('aiConfigV12')) || { provider: 'deepseek', key: '', url: API_PRESETS.deepseek.url, model: API_PRESETS.deepseek.model };
    
    let currentTask = null; let inputMode = ''; let currentImageBase64 = null; let gachaFilter = 'all'; 
    let isMusicPlaying = false; const bgmPlayer = document.getElementById('bgm-player');

    // 自由番茄钟状态
    let freeTimerInterval;
    let freeTimeLeft = 25 * 60;
    let freeTimerRunning = false;

    function init() { 
        switchTab('home'); 
        bgmPlayer.volume = 0.5;
        bgmPlayer.src = currentRadio.url;
        bgmPlayer.load();

        document.getElementById('music-title-pc').innerText = currentRadio.title; document.getElementById('music-artist-pc').innerText = currentRadio.artist;
        document.getElementById('music-title-mobile').innerText = currentRadio.title; document.getElementById('music-artist-mobile').innerText = currentRadio.artist;
        if (localStorage.getItem('__syncPausedV14__') !== 'true' && isSyncConfigured()) sync.pull({ silent: true }).catch(error => console.error('启动云端检查失败:', error));
        renderStats();
    }

    function switchTab(tabId) {
        document.querySelectorAll('.view-section').forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
        document.getElementById(`view-${tabId}`).classList.remove('hidden'); document.getElementById(`view-${tabId}`).classList.add('active');
        
        document.querySelectorAll('.nav-btn-mobile').forEach(btn => {
            const span = btn.querySelector('span:first-child');
            if(btn.dataset.target === tabId) { span.classList.remove('opacity-50', 'scale-90'); span.classList.add('opacity-100', 'scale-110'); btn.classList.add('bg-white/80', 'shadow-sm'); } 
            else { span.classList.add('opacity-50', 'scale-90'); span.classList.remove('opacity-100', 'scale-110'); btn.classList.remove('bg-white/80', 'shadow-sm'); }
        });
        document.querySelectorAll('.nav-btn-pc').forEach(btn => {
            if(btn.dataset.target === tabId) {
                if(tabId==='free-pomodoro') btn.className = 'nav-btn-pc w-full py-3 rounded-xl bg-emerald-500 text-white font-bold btn-hover flex justify-center items-center gap-2 shadow-md';
                else btn.className = 'nav-btn-pc w-full py-3 rounded-xl bg-indigo-500 text-white font-bold btn-hover flex justify-center items-center gap-2 shadow-md';
            } else {
                if(btn.dataset.target==='free-pomodoro') btn.className = 'nav-btn-pc w-full py-3 rounded-xl bg-white/60 text-emerald-600 font-bold btn-hover flex justify-center items-center gap-2 border border-emerald-100 hover:border-emerald-300';
                else btn.className = 'nav-btn-pc w-full py-3 rounded-xl bg-white/60 text-slate-600 font-medium btn-hover flex justify-center items-center gap-2 border border-transparent hover:border-white';
            }
        });

        document.body.className = currentVibeTheme;
        if (tabId === 'universe') { document.body.classList.add('universe-mode'); renderUniverse(); }
        else if (tabId === 'archive') { document.body.classList.add('archive-mode'); renderArchive(); }
        else if (tabId === 'jar') { document.body.classList.add('jar-mode'); updateJarWater(); }
        else if (tabId === 'drawcard') { renderDrawcard(); }
        else if (tabId === 'pomodoro' || tabId === 'free-pomodoro') { document.body.classList.add('pomodoro-mode'); }
        else if (tabId === 'dailydraw') { }
        else { renderHome(); }
    }

    // --- 每日一抽：22 张大阿卡纳塔罗牌 ---
    const TAROT_DECK = [
        { id: 0, name: '愚者', emoji: '🃏', upright: '新的开始、自由冒险、保持纯真', reversed: '鲁莽冲动、犹豫不决、方向不明' },
        { id: 1, name: '魔术师', emoji: '🎩', upright: '创造力涌现、行动力满格、心想事成', reversed: '准备不足、意志分散、谨防欺骗' },
        { id: 2, name: '女祭司', emoji: '🌙', upright: '相信直觉、内在智慧、静观其变', reversed: '忽略直觉、心浮气躁、秘密浮现' },
        { id: 3, name: '皇后', emoji: '👑', upright: '丰盛富足、温柔滋养、感性与美', reversed: '过度依赖、创造力受阻、忽略自我' },
        { id: 4, name: '皇帝', emoji: '🤴', upright: '秩序与掌控、稳固根基、值得信赖', reversed: '固执专断、局面失控、规则束缚' },
        { id: 5, name: '教皇', emoji: '📿', upright: '传统智慧、贵人指引、循序渐进', reversed: '打破陈规、另辟蹊径、质疑权威' },
        { id: 6, name: '恋人', emoji: '💞', upright: '爱与联结、真诚选择、心意相通', reversed: '关系失衡、价值冲突、难以抉择' },
        { id: 7, name: '战车', emoji: '🏇', upright: '意志坚定、勇往直前、掌控全局', reversed: '方向迷失、动力不足、别硬撑' },
        { id: 8, name: '力量', emoji: '🦁', upright: '温柔而坚定、勇气与耐心兼具', reversed: '自我怀疑、情绪波动、以柔克刚' },
        { id: 9, name: '隐士', emoji: '🕯️', upright: '沉淀内省、独处充电、答案在心', reversed: '过度封闭、逃避人群、钻牛角尖' },
        { id: 10, name: '命运之轮', emoji: '🎡', upright: '转机降临、顺势而为、好运轮转', reversed: '时运暂缓、抗拒改变、静待时机' },
        { id: 11, name: '正义', emoji: '⚖️', upright: '公平公正、理性决断、因果清晰', reversed: '失衡偏颇、逃避责任、需要权衡' },
        { id: 12, name: '倒吊人', emoji: '🙃', upright: '换个角度、暂停蓄力、甘愿付出', reversed: '无谓牺牲、停滞焦灼、学会放手' },
        { id: 13, name: '死神', emoji: '💀', upright: '结束即新生、彻底告别、勇敢蜕变', reversed: '抗拒结束、拖延改变、旧事反复' },
        { id: 14, name: '节制', emoji: '🏺', upright: '平衡调和、循序渐进、保持耐心', reversed: '失衡过度、急于求成、需要克制' },
        { id: 15, name: '恶魔', emoji: '😈', upright: '直面欲望、觉察束缚、警惕执念', reversed: '挣脱枷锁、摆脱沉迷、重获自由' },
        { id: 16, name: '高塔', emoji: '⚡', upright: '突变与觉醒、破旧才能立新', reversed: '避免崩坏、推迟的爆发、内部调整' },
        { id: 17, name: '星星', emoji: '⭐', upright: '希望与疗愈、梦想照进现实', reversed: '信心受挫、暂时迷茫、别放弃' },
        { id: 18, name: '月亮', emoji: '🌕', upright: '朦胧不安时、跟随直觉、接纳情绪', reversed: '迷雾散去、真相浮现、焦虑缓解' },
        { id: 19, name: '太阳', emoji: '☀️', upright: '成功与活力、喜悦与光明自来', reversed: '短暂阴霾、勿过度乐观、补点自信' },
        { id: 20, name: '审判', emoji: '🎺', upright: '觉醒召唤、复盘重生、重要决定', reversed: '自我怀疑、逃避过去、时机未到' },
        { id: 21, name: '世界', emoji: '🌍', upright: '圆满达成、完整合一、新的征程', reversed: '差临门一脚、未竟之事、画好句号' }
    ];

    // 56 张小阿卡纳：紧凑格式 [牌面, 正位, 逆位]，展开后并入牌堆凑齐 78 张
    const TAROT_MINOR_SUITS = [
        { suit: '权杖', emoji: '🪄', ranks: [
            ['一', '新机遇降临、行动火花', '拖延迟疑、方向未明'],
            ['二', '规划未来、稳步前行', '犹豫不决、计划受阻'],
            ['三', '远见初显、进展可期', '进展延迟、视野受限'],
            ['四', '稳定欢庆、值得庆祝', '基础动荡、喜事推迟'],
            ['五', '良性竞争、激发斗志', '无谓争执、避免内耗'],
            ['六', '胜利在望、获得认可', '信心受挫、暂居人后'],
            ['七', '坚守立场、迎难而上', '压力过大、疲于防守'],
            ['八', '快速推进、好消息至', '进度停滞、沟通受阻'],
            ['九', '坚韧不拔、最后冲刺', '精疲力竭、别硬撑'],
            ['十', '责任在肩、学会分担', '负担过重、需要放手'],
            ['侍从', '好奇探索、新的尝试', '三分钟热度、易分心'],
            ['骑士', '冲劲十足、勇往直前', '冲动鲁莽、欲速不达'],
            ['王后', '热情自信、魅力四射', '情绪化、信心不足'],
            ['国王', '领导魄力、目标明确', '专断独行、急功近利']
        ]},
        { suit: '圣杯', emoji: '🍷', ranks: [
            ['一', '情感涌动、新的开始', '情感封闭、内心空虚'],
            ['二', '心意相通、良缘将至', '关系失衡、误会渐生'],
            ['三', '好友相聚、分享喜悦', '热闹过后的空虚'],
            ['四', '倦怠沉思、别错失机会', '走出低迷、重拾动力'],
            ['五', '为失去伤怀、珍惜拥有', '走出悲伤、接受现实'],
            ['六', '怀旧温情、故人重逢', '沉溺过去、难以向前'],
            ['七', '选择众多、需辨真伪', '幻想破灭、看清现实'],
            ['八', '转身离开、追寻深处', '害怕改变、停滞不前'],
            ['九', '心愿达成、满足惬意', '贪求过多、难得满足'],
            ['十', '家庭和睦、幸福美满', '家人失和、期望落空'],
            ['侍从', '情感萌芽、浪漫消息', '敏感多疑、情绪起伏'],
            ['骑士', '浪漫追求、诚意满满', '空想不切实际'],
            ['王后', '温柔共情、直觉敏锐', '情绪淹没、过度付出'],
            ['国王', '情绪成熟、稳如磐石', '压抑情感、忽冷忽热']
        ]},
        { suit: '宝剑', emoji: '⚔️', ranks: [
            ['一', '思路清晰、真相浮现', '思维混乱、判断失误'],
            ['二', '两难抉择、需要决断', '信息过载、难以权衡'],
            ['三', '心痛难免、直面真相', '疗愈开始、释怀过往'],
            ['四', '休养生息、静观其变', '恢复元气、重新出发'],
            ['五', '惨胜如败、退一步好', '放下输赢、握手言和'],
            ['六', '渡过难关、渐入平静', '旧事缠身、难以抽身'],
            ['七', '策略行事、以智取胜', '弄巧成拙、坦诚为上'],
            ['八', '自我设限、其实有路', '打破束缚、重掌主动'],
            ['九', '焦虑多想、放宽心睡', '阴霾渐散、卸下忧虑'],
            ['十', '触底反弹、结束即开始', '最坏已过、缓慢复苏'],
            ['侍从', '思维敏捷、消息灵通', '言多必失、信息失真'],
            ['骑士', '雷厉风行、直击要害', '言语锋利、易伤他人'],
            ['王后', '理性通透、一针见血', '过于苛刻、冷漠疏离'],
            ['国王', '公正果断、权威判断', '固执己见、强势压人']
        ]},
        { suit: '星币', emoji: '🪙', ranks: [
            ['一', '财运新启、踏实起步', '机会流失、计划不周'],
            ['二', '灵活平衡、多线并行', '顾此失彼、精力透支'],
            ['三', '协作共赢、技艺精进', '配合不畅、标准不一'],
            ['四', '守成稳定、量入为出', '过度紧抓、学会放手'],
            ['五', '暂时拮据、援助在旁', '困境渐解、转机出现'],
            ['六', '慷慨给予、善有善报', '施受失衡、量力而行'],
            ['七', '耐心耕耘、收获在望', '回报甚微、重新评估'],
            ['八', '专注打磨、精益求精', '敷衍了事、缺乏热情'],
            ['九', '自给自足、享受成果', '过度消费、财务吃紧'],
            ['十', '家业丰厚、长久安稳', '家宅不宁、财务波动'],
            ['侍从', '踏实学习、技能上手', '好高骛远、基础不牢'],
            ['骑士', '稳扎稳打、靠谱推进', '过于保守、进展缓慢'],
            ['王后', '务实持家、温润丰足', '操劳过度、忽略自己'],
            ['国王', '事业有成、财富稳固', '重利轻义、财务冒险']
        ]}
    ];
    TAROT_MINOR_SUITS.forEach((suit, suitIndex) => {
        suit.ranks.forEach((rank, rankIndex) => {
            TAROT_DECK.push({ id: 22 + suitIndex * 14 + rankIndex, name: suit.suit + rank[0], emoji: suit.emoji, upright: rank[1], reversed: rank[2] });
        });
    });

    function drawDailyCard() {
        const btn = document.getElementById('dailydraw-btn');
        if (btn.disabled) return;
        const unsavedNote = document.getElementById('dailydraw-note');
        if (unsavedNote && unsavedNote.value.trim() && !confirm('当前感悟还没保存，确定要重新抽牌吗？')) return;
        btn.disabled = true;
        const inner = document.getElementById('tarot-card-inner');
        const drawSeq = ++dailyDrawSeq;
        hideDailyDrawPanel();
        resetDailyDrawPanel();
        const revealCard = () => {
            const card = TAROT_DECK[Math.floor(Math.random() * TAROT_DECK.length)];
            const isReversed = Math.random() < 0.5;
            document.getElementById('tarot-name').innerText = card.name;
            const emojiEl = document.getElementById('tarot-emoji');
            emojiEl.innerText = card.emoji;
            emojiEl.classList.toggle('reversed', isReversed);
            const orientEl = document.getElementById('tarot-orient');
            orientEl.innerText = isReversed ? '逆位' : '正位';
            orientEl.className = isReversed ? 'tarot-orient reversed' : 'tarot-orient upright';
            document.getElementById('tarot-meaning').innerText = isReversed ? card.reversed : card.upright;
            inner.classList.add('flipped');
            setTimeout(() => {
                if (drawSeq !== dailyDrawSeq) return;
                createDailyDrawRecord(card.name, isReversed);
                showDailyDrawPanel();
            }, 1200);
            btn.innerText = '🔮 重新抽牌';
            setTimeout(() => { btn.disabled = false; }, 1300);
        };
        if (inner.classList.contains('flipped')) {
            inner.classList.remove('flipped');
            setTimeout(revealCard, 1250);
        } else {
            revealCard();
        }
    }

    // --- 每日一抽：抽牌记录保存 + 手动录入实体牌 ---
    let dailyDraws = JSON.parse(localStorage.getItem('dailyDrawsV14')) || [];
    let currentDrawId = null;
    let dailyDrawTargetLabel = '今天';
    let dailyDrawMood = '';
    let dailyDrawSeq = 0;
    let manualDrawOrientation = 'upright';

    function formatDailyDrawDate(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    function resetDailyDrawPanel() {
        dailyDrawTargetLabel = '今天';
        dailyDrawMood = '';
        document.querySelectorAll('.dailydraw-target-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.label === '今天'));
        document.querySelectorAll('.dailydraw-mood-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('dailydraw-note').value = '';
        const saveBtn = document.getElementById('dailydraw-save-btn');
        saveBtn.disabled = false;
        saveBtn.innerText = '📝 保存感悟';
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    function showDailyDrawPanel() {
        const panel = document.getElementById('dailydraw-record-panel');
        panel.classList.remove('hidden');
        panel.classList.add('flex');
    }

    function hideDailyDrawPanel() {
        const panel = document.getElementById('dailydraw-record-panel');
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }

    function persistDailyDraws() {
        localStorage.setItem('dailyDrawsV14', JSON.stringify(dailyDraws));
        markLocalChanged();
        scheduleSyncPush();
        renderStats();
    }

    function createDailyDrawRecord(name, isReversed) {
        const record = {
            id: Date.now(),
            draw_date: formatDailyDrawDate(new Date()),
            target_date: dailyDrawTargetLabel,
            card_name: name,
            orientation: isReversed ? '逆位' : '正位',
            note: '',
            mood: '',
            created_at: Date.now()
        };
        dailyDraws.push(record);
        persistDailyDraws();
        currentDrawId = record.id;
        return record;
    }

    function updateCurrentDrawRecord(fields) {
        if (!currentDrawId) return;
        const record = dailyDraws.find(item => item.id === currentDrawId);
        if (!record) return;
        Object.assign(record, fields);
        persistDailyDraws();
    }

    // 历史回看预留：note 为空的记录统一提示『等待补充感悟』
    function dailyDrawNoteLabel(record) {
        return record && record.note && record.note.trim() ? record.note : '等待补充感悟';
    }

    function setDailyDrawTarget(label) {
        dailyDrawTargetLabel = label;
        document.querySelectorAll('.dailydraw-target-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.label === label));
        updateCurrentDrawRecord({ target_date: label });
    }

    function setDailyDrawMood(mood) {
        dailyDrawMood = mood;
        document.querySelectorAll('.dailydraw-mood-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mood === mood));
    }

    function saveDailyDrawRecord() {
        if (!currentDrawId) return;
        const noteEl = document.getElementById('dailydraw-note');
        const note = noteEl.value.trim();
        updateCurrentDrawRecord({ note: note, mood: dailyDrawMood });
        showToast('✅ 感悟已保存');
        noteEl.value = '';
        const saveBtn = document.getElementById('dailydraw-save-btn');
        saveBtn.disabled = true;
        saveBtn.innerText = '✅ 已保存';
        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    function onDailyDrawNoteInput() {
        const saveBtn = document.getElementById('dailydraw-save-btn');
        if (!saveBtn.disabled) return;
        saveBtn.disabled = false;
        saveBtn.innerText = '📝 保存感悟';
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    function openManualDrawModal() {
        document.getElementById('manual-draw-name').value = '';
        setManualOrientation('upright');
        const modal = document.getElementById('manual-draw-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('manual-draw-name').focus(), 60);
    }

    function closeManualDrawModal() {
        const modal = document.getElementById('manual-draw-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function setManualOrientation(orient) {
        manualDrawOrientation = orient;
        document.querySelectorAll('.manual-orient-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.orient === orient));
    }

    function confirmManualDraw() {
        const name = document.getElementById('manual-draw-name').value.trim();
        if (!name) { showToast('先输入牌名'); return; }
        const isReversed = manualDrawOrientation === 'reversed';
        const known = TAROT_DECK.find(card => card.name === name);
        document.getElementById('tarot-name').innerText = name;
        const emojiEl = document.getElementById('tarot-emoji');
        emojiEl.innerText = known ? known.emoji : '🃏';
        emojiEl.classList.toggle('reversed', isReversed);
        const orientEl = document.getElementById('tarot-orient');
        orientEl.innerText = isReversed ? '逆位' : '正位';
        orientEl.className = isReversed ? 'tarot-orient reversed' : 'tarot-orient upright';
        document.getElementById('tarot-meaning').innerText = known ? (isReversed ? known.reversed : known.upright) : '自定义牌面，含义由你定义';
        const inner = document.getElementById('tarot-card-inner');
        inner.style.transition = 'none';
        inner.classList.add('flipped');
        void inner.offsetHeight;
        inner.style.transition = '';
        dailyDrawSeq++;
        resetDailyDrawPanel();
        createDailyDrawRecord(name, isReversed);
        showDailyDrawPanel();
        closeManualDrawModal();
        document.getElementById('dailydraw-btn').innerText = '🔮 重新抽牌';
    }

    // --- 每日一抽：历史回看（日历 + 列表） ---
    const DAILY_DRAW_MOOD_EMOJI = { touched: '✨ 有感触', plain: '😐 平平', pending: '⏳ 待验证' };
    let dailyDrawView = 'draw';
    let dailyDrawHistoryTab = 'calendar';
    let dailyDrawCalendarCursor = null;
    let dailyDrawSelectedDate = null;

    function getDailyDrawCardEmoji(record) {
        const known = TAROT_DECK.find(card => card.name === (record && record.card_name));
        return known ? known.emoji : '🃏';
    }

    function switchDailyDrawTab(tab) {
        dailyDrawView = tab;
        document.getElementById('dailydraw-tab-draw').classList.toggle('active', tab === 'draw');
        document.getElementById('dailydraw-tab-history').classList.toggle('active', tab === 'history');
        document.getElementById('dailydraw-draw-area').classList.toggle('hidden', tab !== 'draw');
        document.getElementById('dailydraw-history-area').classList.toggle('hidden', tab !== 'history');
        if (tab === 'history') {
            dailyDrawCalendarCursor = null;
            dailyDrawSelectedDate = null;
            renderDailyDrawHistory();
        }
    }

    function switchDailyDrawHistoryTab(tab) {
        dailyDrawHistoryTab = tab;
        document.getElementById('dailydraw-sub-calendar').classList.toggle('active', tab === 'calendar');
        document.getElementById('dailydraw-sub-list').classList.toggle('active', tab === 'list');
        document.getElementById('dailydraw-calendar-view').classList.toggle('hidden', tab !== 'calendar');
        document.getElementById('dailydraw-list-view').classList.toggle('hidden', tab !== 'list');
        renderDailyDrawHistory();
    }

    function renderDailyDrawHistory() {
        if (dailyDrawHistoryTab === 'calendar') renderDailyDrawCalendar();
        else renderDailyDrawList();
    }

    function getDailyDrawsByDate() {
        const byDate = {};
        dailyDraws.forEach(record => {
            if (!record || !record.draw_date) return;
            (byDate[record.draw_date] = byDate[record.draw_date] || []).push(record);
        });
        return byDate;
    }

    function resetDailyDrawCalendarCursor() {
        const now = new Date();
        dailyDrawCalendarCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    function shiftDailyDrawMonth(offset) {
        if (!dailyDrawCalendarCursor) resetDailyDrawCalendarCursor();
        dailyDrawCalendarCursor = new Date(dailyDrawCalendarCursor.getFullYear(), dailyDrawCalendarCursor.getMonth() + offset, 1);
        dailyDrawSelectedDate = null;
        renderDailyDrawCalendar();
    }

    function selectDailyDrawDate(dateStr) {
        dailyDrawSelectedDate = dailyDrawSelectedDate === dateStr ? null : dateStr;
        renderDailyDrawCalendar();
    }

    function renderDailyDrawCalendar() {
        if (!dailyDrawCalendarCursor) resetDailyDrawCalendarCursor();
        const year = dailyDrawCalendarCursor.getFullYear();
        const month = dailyDrawCalendarCursor.getMonth();
        document.getElementById('dailydraw-calendar-title').innerText = `${year} 年 ${month + 1} 月`;
        const byDate = getDailyDrawsByDate();
        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstWeekday; i++) cells.push('<span></span>');
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRecords = byDate[dateStr];
            if (dayRecords && dayRecords.length) {
                const selected = dateStr === dailyDrawSelectedDate ? ' selected' : '';
                const extra = dayRecords.length > 1 ? `<span class="text-[9px] font-bold text-indigo-400" style="line-height:1;">×${dayRecords.length}</span>` : '';
                cells.push(`<button onclick="selectDailyDrawDate('${dateStr}')" class="dailydraw-cal-cell${selected}"><span>${day}</span><span class="dailydraw-cal-emoji">${getDailyDrawCardEmoji(dayRecords[0])}</span>${extra}</button>`);
            } else {
                cells.push(`<span class="dailydraw-cal-cell" style="opacity:0.45;"><span>${day}</span></span>`);
            }
        }
        document.getElementById('dailydraw-calendar-grid').innerHTML = cells.join('');
        renderDailyDrawCalendarDetail(byDate);
    }

    function renderDailyDrawCalendarDetail(byDate) {
        const container = document.getElementById('dailydraw-calendar-detail');
        if (!dailyDrawSelectedDate) {
            container.innerHTML = '<p class="text-center text-xs font-bold text-slate-400 py-2">点击带牌面的日期查看当天记录</p>';
            return;
        }
        const records = byDate[dailyDrawSelectedDate] || [];
        if (!records.length) {
            container.innerHTML = '<p class="text-center text-xs font-bold text-slate-400 py-2">这一天没有记录</p>';
            return;
        }
        container.innerHTML = records.map(record => renderDailyDrawRecordCard(record, true)).join('');
    }

    function renderDailyDrawRecordCard(record, showTarget) {
        const mood = DAILY_DRAW_MOOD_EMOJI[record.mood] || '';
        const note = escapeDrawText(dailyDrawNoteLabel(record));
        const targetLine = showTarget ? `<span class="text-xs font-bold text-indigo-400">记录给：${escapeDrawText(record.target_date || '今天')}</span>` : '';
        return `<div class="glass-item rounded-2xl p-4 flex flex-col gap-1.5 shadow-sm"><div class="flex items-center justify-between gap-2"><span class="text-sm font-bold text-slate-700">${getDailyDrawCardEmoji(record)} ${escapeDrawText(record.card_name)} · ${escapeDrawText(record.orientation || '')}</span>${mood ? `<span class="text-xs font-bold text-slate-500 whitespace-nowrap">${mood}</span>` : ''}</div><div class="flex items-center justify-between gap-2"><span class="text-xs font-bold text-slate-400">${escapeDrawText(record.draw_date || '')}</span>${targetLine}</div><p class="text-sm text-slate-600 font-medium leading-relaxed">${note}</p><div class="flex gap-2 justify-end mt-1"><button onclick="openDailyDrawEditModal(${record.id})" class="btn-hover glass-item text-indigo-500 text-xs font-bold px-3 py-1 rounded-lg shadow-sm">✏️ 编辑</button><button onclick="deleteDailyDrawRecord(${record.id})" class="btn-hover bg-white/60 text-rose-500 border border-rose-200 text-xs font-bold px-3 py-1 rounded-lg shadow-sm">🗑️ 删除</button></div></div>`;
    }

    function renderDailyDrawList() {
        const container = document.getElementById('dailydraw-list-view');
        const sorted = [...dailyDraws].sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
        if (!sorted.length) {
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-400 py-10">还没有抽牌记录</p>';
            return;
        }
        container.innerHTML = sorted.map(record => {
            const noteChars = [...dailyDrawNoteLabel(record)];
            const short = noteChars.length > 40 ? escapeDrawText(noteChars.slice(0, 40).join('')) + '…' : escapeDrawText(noteChars.join(''));
            return `<div class="glass-item rounded-2xl p-4 flex flex-col gap-1 shadow-sm"><div class="flex items-center justify-between gap-2"><span class="text-sm font-bold text-slate-700">${getDailyDrawCardEmoji(record)} ${escapeDrawText(record.card_name)} · ${escapeDrawText(record.orientation || '')}</span><span class="text-xs font-bold text-slate-400 whitespace-nowrap">${escapeDrawText(record.draw_date || '')}</span></div><p class="text-xs text-slate-500 font-medium">${short}</p><div class="flex gap-2 justify-end mt-1"><button onclick="openDailyDrawEditModal(${record.id})" class="btn-hover glass-item text-indigo-500 text-xs font-bold px-3 py-1 rounded-lg shadow-sm">✏️ 编辑</button><button onclick="deleteDailyDrawRecord(${record.id})" class="btn-hover bg-white/60 text-rose-500 border border-rose-200 text-xs font-bold px-3 py-1 rounded-lg shadow-sm">🗑️ 删除</button></div></div>`;
        }).join('');
    }

    // --- 每日一抽：历史记录编辑 / 删除 ---
    let editingDailyDrawId = null;
    let dailyDrawEditTargetLabel = '今天';
    let dailyDrawEditMood = '';

    function openDailyDrawEditModal(id) {
        const record = dailyDraws.find(item => item.id === id);
        if (!record) return;
        editingDailyDrawId = id;
        dailyDrawEditTargetLabel = record.target_date || '今天';
        dailyDrawEditMood = record.mood || '';
        document.getElementById('dailydraw-edit-card').innerText = getDailyDrawCardEmoji(record) + ' ' + (record.card_name || '') + ' · ' + (record.orientation || '');
        document.querySelectorAll('.dailydraw-edit-target-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.label === dailyDrawEditTargetLabel));
        document.querySelectorAll('.dailydraw-edit-mood-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mood === dailyDrawEditMood));
        document.getElementById('dailydraw-edit-note').value = record.note || '';
        const modal = document.getElementById('dailydraw-edit-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeDailyDrawEditModal() {
        const modal = document.getElementById('dailydraw-edit-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        editingDailyDrawId = null;
    }

    function setDailyDrawEditTarget(label) {
        dailyDrawEditTargetLabel = label;
        document.querySelectorAll('.dailydraw-edit-target-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.label === label));
    }

    function setDailyDrawEditMood(mood) {
        dailyDrawEditMood = mood;
        document.querySelectorAll('.dailydraw-edit-mood-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mood === mood));
    }

    function saveDailyDrawEdit() {
        if (!editingDailyDrawId) return;
        const record = dailyDraws.find(item => item.id === editingDailyDrawId);
        if (!record) { closeDailyDrawEditModal(); return; }
        record.note = document.getElementById('dailydraw-edit-note').value.trim();
        record.mood = dailyDrawEditMood;
        record.target_date = dailyDrawEditTargetLabel;
        persistDailyDraws();
        closeDailyDrawEditModal();
        renderDailyDrawHistory();
        showToast('✅ 修改已保存');
    }

    function deleteDailyDrawRecord(id) {
        if (!confirm('确定要删除这条记录吗？')) return;
        dailyDraws = dailyDraws.filter(item => item.id !== id);
        if (currentDrawId === id) currentDrawId = null;
        persistDailyDraws();
        renderDailyDrawHistory();
        showToast('🗑️ 已删除');
    }

    // --- 彻底解决音频兼容 ---
    function openMusicModal() { document.getElementById('music-modal').classList.remove('hidden'); document.getElementById('music-modal').classList.add('flex'); }
    function closeMusicModal() { document.getElementById('music-modal').classList.add('hidden'); document.getElementById('music-modal').classList.remove('flex'); }
    
    function toggleMusic() {
        const recordPc = document.getElementById('record-pc'); const recordMobile = document.getElementById('record-mobile');
        const playBtn = document.getElementById('music-play-btn'); const dot = document.getElementById('music-playing-dot');
        
        if(isMusicPlaying) { 
            bgmPlayer.pause(); isMusicPlaying = false; 
            recordPc.classList.add('record-paused'); recordMobile.classList.add('record-paused'); 
            playBtn.innerText = '▶️ 点击播放 / 暂停'; dot.classList.add('hidden');
        } else { 
            const playPromise = bgmPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isMusicPlaying = true; 
                    recordPc.classList.remove('record-paused'); recordMobile.classList.remove('record-paused'); 
                    playBtn.innerText = '⏸️ 正在沉浸播放...'; dot.classList.remove('hidden');
                }).catch(error => {
                    console.error("播放失败:", error);
                    alert("🎵 哎呀，浏览器拦截了播放。再点一次播放按钮应该就好了！");
                });
            }
        }
    }

    function saveData() { localStorage.setItem('inspirationsV13', JSON.stringify(inspirations)); markLocalChanged(); scheduleSyncPush(); if(document.getElementById('view-home').classList.contains('active')) renderHome(); updateJarWater(); if(document.getElementById('view-archive').classList.contains('active')) renderArchive(); renderStats(); }

    function renderHome() {
        const pendingList = inspirations.filter(i => i.status === 'pending'); document.getElementById('pending-count-text').innerText = `${pendingList.length} 个`;
        const listEl = document.getElementById('manual-list'); listEl.innerHTML = '';
        if (pendingList.length === 0) { listEl.innerHTML = `<div class="md:col-span-2 text-center py-12 glass-item rounded-3xl border border-dashed border-slate-300"><p class="text-slate-500 font-bold text-sm">清单空空的，让 AI 帮你塞几个灵感吧~</p></div>`; return; }

        pendingList.forEach(item => {
            const li = document.createElement('li'); li.className = 'glass-item p-5 rounded-2xl shadow-sm flex flex-col gap-3 relative hover:shadow-lg transition-shadow';
            let displayText = item.text; let actionBtn = ''; let tagColor = 'bg-indigo-50 text-indigo-700';
            
            if (item.tag.includes('秘密')) {
                tagColor = 'text-indigo-200 bg-slate-800'; li.style.background = 'rgba(30, 41, 59, 0.85)';
                if(!item.unlocked) { displayText = `<span class="text-slate-400 italic">🔒 ( 封印的小秘密 )</span>`; actionBtn = `<button class="text-xs bg-slate-700 hover:bg-slate-600 text-indigo-200 px-4 py-2.5 rounded-xl font-bold w-full transition-colors" onclick="unlockSecret(${item.id})">👀 查看并封印</button>`; } 
                else { displayText = `<span class="text-indigo-100 font-bold">${item.text}</span>`; actionBtn = `<button class="text-xs bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl font-bold w-full shadow-md transition-colors" onclick="completeListItem(${item.id})">✨ 化作暗星隐藏</button>`; }
            } else if (item.tag.includes('日记')) { tagColor = 'text-blue-700 bg-blue-100 border border-blue-200'; actionBtn = `<button class="text-xs bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl font-bold w-full shadow-md transition-colors" onclick="completeListItem(${item.id})">✨ 阅毕封存上星空</button>`;
            } else { 
                tagColor = item.tag.includes('灵感') ? 'text-orange-700 bg-orange-100 border border-orange-200' : 'text-teal-700 bg-teal-100 border border-teal-200'; 
                // 加入“直接完成”按钮
                actionBtn = `<div class="flex gap-2 w-full"><button class="flex-1 text-xs bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl font-bold shadow-md transition-colors" onclick="startPomodoro(${item.id})">🍅 专注</button><button class="flex-1 text-xs bg-white text-indigo-500 border border-indigo-200 py-2.5 rounded-xl font-bold shadow-sm transition-colors hover:bg-indigo-50" onclick="completeListItem(${item.id})">✨ 直接完成</button></div>`; 
            }

            let imgHtml = item.image ? `<img src="${item.image}" class="w-full h-28 object-cover rounded-xl mt-1 border border-slate-200/50 shadow-sm">` : '';
            li.innerHTML = `<div class="flex justify-between items-center"><span class="text-[10px] px-3 py-1 rounded-full font-bold shadow-sm ${tagColor}">${item.tag}</span><div class="flex gap-2"><button onclick="editItem(${item.id})" class="text-slate-400 hover:text-indigo-500 text-xs font-bold transition-colors">✏️ 修改</button><button onclick="deleteItem(${item.id})" class="text-slate-300 hover:text-red-500 text-xs font-bold transition-colors">✖</button></div></div><div class="text-slate-800 text-base font-bold leading-relaxed break-words line-clamp-3 ${item.tag.includes('秘密')?'text-indigo-100':''}">${displayText}</div>${imgHtml}<div class="mt-auto pt-2">${actionBtn}</div>`;
            listEl.appendChild(li);
        });
    }
    
    // 批次5：数据统计面板 —— 计算累计灵感 / 完成任务 / 连续打卡 / 本周活跃度
    function calculateStats() {
        const dayKey = ts => { const d = new Date(Number(ts) || 0); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
        const totalInspirations = inspirations.filter(item => (item.tag || '').includes('灵感')).length;
        const totalCompleted = inspirations.filter(item => item.status === 'completed').length;
        const recordDays = new Set();
        inspirations.forEach(item => { if (item.created_at) recordDays.add(dayKey(item.created_at)); });
        dailyDraws.forEach(record => { if (record.created_at) recordDays.add(dayKey(record.created_at)); });

        let streak = 0;
        const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
        if (!recordDays.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
        while (recordDays.has(dayKey(cursor.getTime()))) { streak++; cursor.setDate(cursor.getDate() - 1); }

        const monday = new Date(); monday.setHours(0, 0, 0, 0);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const todayKey = dayKey(Date.now());
        const week = [];
        for (let offset = 0; offset < 7; offset++) {
            const day = new Date(monday); day.setDate(day.getDate() + offset);
            const key = dayKey(day.getTime());
            week.push({ active: recordDays.has(key), isToday: key === todayKey });
        }
        return { totalInspirations, totalCompleted, streak, week };
    }

    function renderStats() {
        if (!document.getElementById('stats-card')) return;
        const stats = calculateStats();
        document.getElementById('stats-total-inspirations').innerText = stats.totalInspirations;
        document.getElementById('stats-total-completed').innerText = stats.totalCompleted;
        document.getElementById('stats-streak-days').innerText = stats.streak;
        const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
        document.getElementById('stats-week-grid').innerHTML = stats.week.map((day, idx) => {
            const fillStyle = day.active ? 'background: var(--theme-primary); color: #fff; box-shadow: var(--theme-shadow);' : 'border: 1px dashed var(--theme-border); color: var(--theme-text); opacity: 0.5;';
            const todayRing = day.isToday ? ' outline: 2px solid var(--theme-primary); outline-offset: 2px; opacity: 1;' : '';
            return '<div class="flex-1 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all" style="' + fillStyle + todayRing + '">' + weekLabels[idx] + '</div>';
        }).join('');
    }

    function deleteItem(id) { if(confirm("确定丢弃这个碎片吗？")) { inspirations = inspirations.filter(i => i.id !== id); saveData(); } }

    function editItem(id) {
        const item = inspirations.find(i => i.id === id);
        if(!item) return;
        editingId = id; 
        inputMode = item.tag;
        
        document.getElementById('input-modal-title').innerText = "修改: " + inputMode;
        document.getElementById('main-input').value = item.text;
        document.getElementById('submit-input-btn').innerText = "💾 保存修改";
        
        if(item.image) {
            currentImageBase64 = item.image;
            document.getElementById('image-preview').src = currentImageBase64;
            document.getElementById('image-preview').classList.remove('hidden');
            document.getElementById('remove-image-btn').classList.remove('hidden');
        } else {
            currentImageBase64 = null;
            document.getElementById('image-preview').classList.add('hidden');
            document.getElementById('remove-image-btn').classList.add('hidden');
        }
        
        renderColorPicker(inputMode);
        if(item.color) selectColor(item.color);
        else selectColor('random');
        
        closeStarModal();
        document.getElementById('input-modal').classList.remove('hidden');
        document.getElementById('input-modal').classList.add('flex');
    }

    function updateJarWater() { const total = inspirations.filter(i => i.status === 'pending').length; let fill = Math.min((total / 15) * 100, 100); if(total === 0) fill = 0; else if(fill < 20) fill = 20; document.getElementById('big-jar-fill').style.height = `${fill}%`; }
    document.querySelectorAll('.filter-btn').forEach(btn => { btn.addEventListener('click', (e) => { document.querySelectorAll('.filter-btn').forEach(b => { b.classList.remove('bg-indigo-500', 'text-white', 'shadow-md'); b.classList.add('glass-item', 'text-slate-600', 'shadow-sm'); }); e.target.classList.remove('glass-item', 'text-slate-600', 'shadow-sm'); e.target.classList.add('bg-indigo-500', 'text-white', 'shadow-md'); gachaFilter = e.target.dataset.filter; }); });
    function pourJar() {
        let pool = inspirations.filter(i => i.status === 'pending'); if(gachaFilter !== 'all') pool = pool.filter(i => i.tag.includes(gachaFilter.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '').trim()));
        if (pool.length === 0) return alert("罐子里没有符合的碎片啦！");
        const jar = document.getElementById('big-jar-wrapper'); const drop = document.getElementById('water-drop'); jar.classList.add('shake-animation');
        setTimeout(() => { jar.classList.remove('shake-animation'); drop.style.animation = 'none'; drop.offsetHeight; drop.style.animation = 'dropFall 1s forwards'; setTimeout(() => { showGachaResult(pool[Math.floor(Math.random() * pool.length)], "打捞成功！"); }, 800); }, 600);
    }
    
    // 列表专属直接完成
    function completeListItem(id) {
        const item = inspirations.find(i => i.id === id);
        if(!item) return;
        if(item.tag.includes('秘密')) item.unlocked = false;
        
        item.status = 'completed';
        item.completed_at = Date.now();
        item.starPos = { x: 5 + Math.random() * 90, y: 10 + Math.random() * 80 };
        saveData();
        fireConfetti();
        
        // 提示或者直接跳宇宙
        if(confirm("🎉 碎片已完成并化作星辰！要去宇宙里看看它吗？")) {
            switchTab('universe');
        }
    }

    function showGachaResult(item, title, customText = null, showActions = true) {
        document.getElementById('gacha-title').innerText = title; document.getElementById('gacha-tag').innerText = item.tag;
        document.getElementById('gacha-text').innerHTML = customText || ((item.tag.includes('秘密') && !item.unlocked) ? "🔒 ( 一个你存下的小秘密 )" : item.text);
        const imgEl = document.getElementById('gacha-img'); if(item.image && (!item.tag.includes('秘密') || item.unlocked)) { imgEl.src = item.image; imgEl.classList.remove('hidden'); } else { imgEl.classList.add('hidden'); }
        const actionBox = document.getElementById('gacha-actions'); actionBox.innerHTML = '';
        if(showActions) {
            if(item.tag.includes('待办') || item.tag.includes('顺手') || item.tag.includes('灵感')) { 
                document.getElementById('gacha-icon').innerText = '🍅'; 
                actionBox.innerHTML = `<button onclick="startPomodoro(${item.id}); closeGachaModal()" class="flex-1 bg-emerald-500 text-white font-bold py-3.5 rounded-xl btn-hover shadow-lg border border-emerald-400">🍅 去专注</button><button onclick="completeListItem(${item.id}); closeGachaModal()" class="flex-1 bg-white text-indigo-500 font-bold py-3.5 rounded-xl btn-hover shadow-sm border border-indigo-200">✨ 直接完成</button>`; 
            } 
            else if(item.tag.includes('秘密')) { 
                document.getElementById('gacha-icon').innerText = '🤫'; 
                actionBox.innerHTML = !item.unlocked ? `<button onclick="unlockSecret(${item.id}); closeGachaModal()" class="flex-1 bg-slate-800 text-indigo-200 font-bold py-3.5 rounded-xl btn-hover shadow-lg border border-slate-700">👀 解锁查看</button>` : `<button onclick="completeListItem(${item.id}); closeGachaModal()" class="flex-1 bg-indigo-500 text-white font-bold py-3.5 rounded-xl btn-hover shadow-lg border border-indigo-400">✨ 化作暗星隐藏</button>`; 
            } 
            else { 
                document.getElementById('gacha-icon').innerText = '📖'; 
                actionBox.innerHTML = `<button onclick="completeListItem(${item.id}); closeGachaModal()" class="flex-1 bg-blue-500 text-white font-bold py-3.5 rounded-xl btn-hover shadow-lg border border-blue-400">✨ 阅毕封存</button>`; 
            }
        } else {
            actionBox.innerHTML = `<button onclick="closeGachaModal()" class="flex-1 bg-indigo-500 text-white font-bold py-3.5 rounded-xl btn-hover shadow-lg border border-indigo-400">收下这份心意</button>`;
        }
        const modal = document.getElementById('gacha-modal'); modal.classList.remove('hidden'); modal.classList.add('flex');
    }
    function closeGachaModal() { document.getElementById('gacha-modal').classList.add('hidden'); document.getElementById('gacha-modal').classList.remove('flex'); }

    function renderColorPicker(tag) {
        const pickerBox = document.getElementById('color-picker');
        pickerBox.innerHTML = '';
        
        let colors = CATEGORY_COLORS['💡 灵感点子'];
        if (tag.includes('灵感')) colors = CATEGORY_COLORS['💡 灵感点子'];
        if (tag.includes('待办') || tag.includes('顺手')) colors = CATEGORY_COLORS['✅ 顺手小事'];
        if (tag.includes('日记')) colors = CATEGORY_COLORS['📝 碎碎念/日记'];
        if (tag.includes('秘密')) colors = CATEGORY_COLORS['🔒 小秘密'];

        colors.forEach(c => {
            const dot = document.createElement('div');
            dot.className = 'color-dot w-7 h-7 rounded-full cursor-pointer ring-2 ring-offset-2 ring-transparent shadow-sm';
            dot.style.background = c.bg;
            dot.dataset.color = c.id;
            dot.onclick = () => selectColor(c.id);
            pickerBox.appendChild(dot);
        });

        const randomDot = document.createElement('div');
        randomDot.className = 'color-dot w-7 h-7 rounded-full cursor-pointer ring-2 ring-offset-2 ring-transparent active flex items-center justify-center text-[10px] bg-slate-200 text-slate-500 shadow-sm';
        randomDot.dataset.color = 'random';
        randomDot.innerText = '🎲';
        randomDot.onclick = () => selectColor('random');
        pickerBox.appendChild(randomDot);
    }

    function selectColor(colorId) {
        selectedStarColorId = colorId;
        const dots = document.querySelectorAll('.color-dot');
        
        let found = false;
        dots.forEach(el => {
            el.classList.remove('active', 'ring-slate-300');
            el.style.boxShadow = 'none';
            if(el.dataset.color === colorId) {
                found = true;
                el.classList.add('active');
                if(colorId === 'random') {
                    el.classList.add('ring-slate-300');
                } else {
                    let shadowStyle = 'rgba(0,0,0,0.2)';
                    for (let key in CATEGORY_COLORS) {
                        const c = CATEGORY_COLORS[key].find(x => x.id === colorId);
                        if(c) shadowStyle = c.shadow;
                    }
                    el.style.boxShadow = `0 0 10px ${shadowStyle}`;
                }
            }
        });
        
        if(!found && dots.length > 0) {
            selectedStarColorId = 'random';
            dots[dots.length - 1].classList.add('active', 'ring-slate-300');
        }
    }

    function openInputModal(mode) { 
        editingId = null; inputMode = mode; currentImageBase64 = null;
        document.getElementById('image-preview').classList.add('hidden'); document.getElementById('remove-image-btn').classList.add('hidden'); 
        document.getElementById('main-input').value = ''; document.getElementById('input-modal-title').innerText = mode; 
        document.getElementById('submit-input-btn').innerText = "✨ 存入罐子";
        
        renderColorPicker(mode);
        selectColor('random');

        document.getElementById('input-modal').classList.remove('hidden'); document.getElementById('input-modal').classList.add('flex'); 
    }
    function closeInputModal() { document.getElementById('input-modal').classList.add('hidden'); document.getElementById('input-modal').classList.remove('flex'); editingId = null; }
    function handleImageUpload(e) {
        const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (event) => {
            const img = new Image(); img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 600; let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                currentImageBase64 = canvas.toDataURL('image/jpeg', 0.6); document.getElementById('image-preview').src = currentImageBase64; document.getElementById('image-preview').classList.remove('hidden'); document.getElementById('remove-image-btn').classList.remove('hidden');
            }; img.src = event.target.result;
        }; reader.readAsDataURL(file);
    }
    function removeImage() { currentImageBase64 = null; document.getElementById('image-preview').classList.add('hidden'); document.getElementById('remove-image-btn').classList.add('hidden'); }
    
    function submitInput() { 
        const text = document.getElementById('main-input').value.trim(); if(!text && !currentImageBase64) return alert("请写点什么或者上传图片"); 
        
        let finalColorId = selectedStarColorId;
        if (finalColorId === 'random') {
            let colors = CATEGORY_COLORS['💡 灵感点子'];
            if (inputMode.includes('灵感')) colors = CATEGORY_COLORS['💡 灵感点子'];
            if (inputMode.includes('待办') || inputMode.includes('顺手')) colors = CATEGORY_COLORS['✅ 顺手小事'];
            if (inputMode.includes('日记')) colors = CATEGORY_COLORS['📝 碎碎念/日记'];
            if (inputMode.includes('秘密')) colors = CATEGORY_COLORS['🔒 小秘密'];
            finalColorId = colors[Math.floor(Math.random() * colors.length)].id;
        }

        if(editingId) {
            const item = inspirations.find(i => i.id === editingId);
            if(item) { item.text = text; item.image = currentImageBase64; item.color = finalColorId; }
            editingId = null;
        } else {
            inspirations.unshift({ id: Date.now(), text: text, tag: inputMode, created_at: Date.now(), status: 'pending', image: currentImageBase64, color: finalColorId }); 
        }
        
        saveData(); closeInputModal(); 
    }

    // --- 档案：强制分类显示 ---
    function setArchiveCategory(cat) {
        archiveCategoryFilter = cat;
        document.getElementById('cat-btn-diary').className = cat === 'diary' ? 'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all bg-indigo-500 shadow-md text-white' : 'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-800';
        document.getElementById('cat-btn-tasks').className = cat === 'tasks' ? 'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all bg-indigo-500 shadow-md text-white' : 'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-800';
        renderArchive();
    }
    function renderArchive() {
        const tContainer = document.getElementById('timeline-container');
        tContainer.innerHTML = '<div class="timeline-line"></div>'; 

        // 分离数据
        let filteredList = [...inspirations].sort((a, b) => b.created_at - a.created_at);
        if(archiveCategoryFilter === 'diary') {
            filteredList = filteredList.filter(i => i.tag.includes('日记') || i.tag.includes('秘密'));
        } else {
            filteredList = filteredList.filter(i => i.tag.includes('待办') || i.tag.includes('顺手') || i.tag.includes('灵感'));
        }

        if(filteredList.length === 0) { tContainer.innerHTML = '<div class="text-center py-12 text-slate-500 font-bold glass-item rounded-3xl mx-6">这个分类下还是空空的哦~</div>'; return; }

        filteredList.forEach((item, index) => {
            const dateObj = new Date(item.created_at); const dateStr = `${dateObj.getMonth()+1}月${dateObj.getDate()}日`; const timeStr = `${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
            const isCompleted = item.status === 'completed'; const dotColor = isCompleted ? 'border-indigo-400 bg-indigo-100' : 'border-slate-300 bg-slate-100';
            
            let contentText = item.text; if(item.tag.includes('秘密') && !item.unlocked_in_archive) contentText = `🔒 (隐藏的秘密) <button onclick="unlockArchiveSecret(${item.id})" class="bg-slate-800 text-indigo-200 px-3 py-1 rounded-full text-[10px] ml-2 font-bold hover:scale-105 transition-transform shadow-sm">解锁查看</button>`;
            let imgHtml = item.image && (!item.tag.includes('秘密') || item.unlocked_in_archive) ? `<img src="${item.image}" class="w-full rounded-2xl mt-4 shadow-md border border-slate-200">` : '';

            const editBtnHtml = `<button onclick="editItem(${item.id})" class="text-slate-400 hover:text-indigo-500 text-xs font-bold transition-colors absolute top-4 right-4 bg-white/50 px-2 py-1 rounded shadow-sm">✏️ 修改</button>`;

            const el = document.createElement('div'); el.className = 'relative pl-6 pb-8';
            el.innerHTML = `<div class="timeline-dot ${dotColor}"></div><div class="flex items-baseline gap-3 mb-3"><span class="text-2xl font-bold text-slate-800 cute-font drop-shadow-sm">${dateStr}</span><span class="text-xs text-slate-500 font-bold">${timeStr}</span><span class="text-[10px] px-3 py-1 rounded-full bg-white shadow-sm text-slate-600 font-bold border border-slate-100">${item.tag}</span>${isCompleted && !item.tag.includes('日记') && !item.tag.includes('秘密') ? '<span class="text-sm text-emerald-500 font-bold ml-auto drop-shadow-sm">✨ 已完成</span>' : ''}</div><div class="glass-item p-5 rounded-2xl shadow-sm text-slate-800 text-base font-medium leading-relaxed whitespace-pre-wrap relative">${editBtnHtml}${contentText}${imgHtml}</div>`;
            tContainer.appendChild(el);
        });
    }
    function unlockArchiveSecret(id) { const item = inspirations.find(i => i.id === id); if(item) { item.unlocked_in_archive = true; renderArchive(); } }
    function unlockSecret(id) { const item = inspirations.find(i => i.id === id); if(item) { item.unlocked = true; saveData(); } }

    // --- 专注孵化番茄钟逻辑修复 ---
    function startPomodoro(id) { 
        currentTask = inspirations.find(i => i.id === id); 
        switchTab('pomodoro'); 
        document.getElementById('current-task').innerText = currentTask.text; 
        document.getElementById('current-task-tag').innerText = currentTask.tag; 
        const imgEl = document.getElementById('current-task-img'); 
        if(currentTask.image) { imgEl.src = currentTask.image; imgEl.classList.remove('hidden'); } else { imgEl.classList.add('hidden'); } 
    }
    function abandonTask() { 
        currentTask = null; // 只是清理状态，不标记完成
        switchTab('home'); 
    }
    function finishTask() { 
        if(currentTask) { 
            // 真正标记完成
            currentTask.status = 'completed'; 
            currentTask.completed_at = Date.now(); 
            currentTask.starPos = { x: 5 + Math.random() * 90, y: 10 + Math.random() * 80 }; 
            saveData(); 
            fireConfetti(); 
            currentTask = null; // 清理状态
            switchTab('universe'); 
        } 
    }

    // --- 自由番茄钟 ---
    function adjFreeTime(min) {
        if(freeTimerRunning) return;
        const input = document.getElementById('free-time-input');
        let val = parseInt(input.value) + min;
        if(val < 1) val = 1;
        if(val > 120) val = 120;
        input.value = val;
        freeTimeLeft = val * 60;
        updateFreeTimerDisplay();
    }
    function updateFreeTimerDisplay() {
        const m = Math.floor(freeTimeLeft / 60).toString().padStart(2, '0');
        const s = (freeTimeLeft % 60).toString().padStart(2, '0');
        document.getElementById('free-timer-display').innerText = `${m}:${s}`;
    }
    function startFreeTimer() {
        const btn = document.getElementById('free-start-btn');
        if(!freeTimerRunning) {
            freeTimeLeft = parseInt(document.getElementById('free-time-input').value) * 60;
            updateFreeTimerDisplay();
            freeTimerRunning = true;
            btn.innerText = "⏸️ 暂停";
            btn.classList.replace('bg-indigo-500', 'bg-orange-500');
            btn.classList.replace('border-indigo-400', 'border-orange-400');
            freeTimerInterval = setInterval(() => {
                freeTimeLeft--;
                updateFreeTimerDisplay();
                if(freeTimeLeft <= 0) {
                    clearInterval(freeTimerInterval);
                    freeTimerRunning = false;
                    btn.innerText = "▶️ 重新开始";
                    btn.classList.replace('bg-orange-500', 'bg-indigo-500');
                    btn.classList.replace('border-orange-400', 'border-indigo-400');
                    fireConfetti();
                    alert("🎉 专注时间结束！休息一下吧。");
                }
            }, 1000);
        } else {
            clearInterval(freeTimerInterval);
            freeTimerRunning = false;
            btn.innerText = "▶️ 继续专注";
            btn.classList.replace('bg-orange-500', 'bg-indigo-500');
            btn.classList.replace('border-orange-400', 'border-indigo-400');
        }
    }
    function resetFreeTimer() {
        clearInterval(freeTimerInterval);
        freeTimerRunning = false;
        const btn = document.getElementById('free-start-btn');
        btn.innerText = "▶️ 开始专注";
        btn.classList.replace('bg-orange-500', 'bg-indigo-500');
        btn.classList.replace('border-orange-400', 'border-indigo-400');
        freeTimeLeft = parseInt(document.getElementById('free-time-input').value) * 60;
        updateFreeTimerDisplay();
    }
    // 监听输入框变化
    document.getElementById('free-time-input').addEventListener('change', (e) => {
        if(!freeTimerRunning) {
            let val = parseInt(e.target.value);
            if(isNaN(val) || val < 1) val = 1;
            e.target.value = val;
            freeTimeLeft = val * 60;
            updateFreeTimerDisplay();
        }
    });

    function renderUniverse() {
        const container = document.getElementById('stars-container'); container.innerHTML = '';
        inspirations.filter(i => i.status === 'completed').forEach(item => {
            if(!item.starPos) item.starPos = { x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 };
            
            let colorConfig = { bg: '#fff', shadow: 'rgba(255,255,255,0.5)', isSecret: false };
            for(let key in CATEGORY_COLORS) {
                const found = CATEGORY_COLORS[key].find(x => x.id === item.color);
                if(found) colorConfig = found;
            }

            const star = document.createElement('div'); star.className = 'star'; 
            let size = 8 + Math.random() * 6; let icon = '';

            if(item.tag.includes('秘密')) { size = 12; icon = '🤫'; } 
            else if(item.tag.includes('日记')) { size = 12; icon = '📖'; } 
            else { icon = '🌟'; }

            star.style.backgroundColor = colorConfig.bg;
            star.style.width = `${size}px`; star.style.height = `${size}px`; 
            star.style.left = `${item.starPos.x}%`; star.style.top = `${item.starPos.y}%`; 
            star.style.animationDelay = `${Math.random() * 3}s`;

            // 秘密星星变成“发光星”而不是暗星，更容易找到且好看
            if(colorConfig.isSecret) {
                star.classList.add('star-secret');
            } else {
                star.style.boxShadow = `0 0 15px 3px ${colorConfig.shadow}`;
                star.classList.add('star-bright');
            }
            
            star.onclick = (e) => { 
                e.stopPropagation(); 
                document.getElementById('star-view-icon').innerText = icon; 
                document.getElementById('star-view-tag').innerText = item.tag; 
                document.getElementById('star-view-text').innerText = item.tag.includes('秘密') ? "这是一个永远隐藏的小秘密。" : item.text; 
                document.getElementById('star-view-date').innerText = `✨ 孵化于 ${new Date(item.completed_at).toLocaleDateString()}`; 
                
                const imgEl = document.getElementById('star-view-img'); 
                if(item.image && !item.tag.includes('秘密')) { imgEl.src = item.image; imgEl.classList.remove('hidden'); } else { imgEl.classList.add('hidden'); } 
                
                const editBtn = document.getElementById('star-edit-btn');
                editBtn.classList.remove('hidden');
                editBtn.onclick = () => editItem(item.id);

                const modal = document.getElementById('star-view-modal'); const card = document.getElementById('star-view-card'); 
                modal.classList.remove('hidden'); modal.classList.add('flex'); 
                setTimeout(() => { modal.classList.remove('opacity-0'); card.classList.remove('scale-95'); card.classList.add('scale-100'); }, 10); 
            }; 
            container.appendChild(star);
        });
    }
    function closeStarModal() { const modal = document.getElementById('star-view-modal'); const card = document.getElementById('star-view-card'); modal.classList.add('opacity-0'); card.classList.remove('scale-100'); card.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300); }
    function shuffleStars() { inspirations.forEach(i => { if(i.status === 'completed') i.starPos = { x: 5 + Math.random() * 90, y: 10 + Math.random() * 80 }; }); saveData(); fireConfetti(); }

    async function cloudBackup() { const btn = document.getElementById('cloud-upload-btn'); btn.innerText = "☁️ 正在打包上传..."; btn.disabled = true; try { const res = await fetch('https://api.npoint.io/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inspirations) }); const data = await res.json(); const syncCode = data.id || data.url.split('/').pop(); document.getElementById('sync-code-display').innerText = syncCode.substring(0, 6).toUpperCase(); document.getElementById('sync-code-box').classList.remove('hidden'); } catch(e) { alert("云端同步失败"); } btn.innerText = "⬆️ 备份并生成提取码"; btn.disabled = false; }
    async function cloudRestore() { let code = document.getElementById('sync-code-input').value.trim().toLowerCase(); if(!code) return alert("请输入提取码"); const btn = document.getElementById('cloud-download-btn'); btn.innerText = "拉取中..."; btn.disabled = true; try { const res = await fetch(`https://api.npoint.io/${code}`); const data = await res.json(); if(data && Array.isArray(data)) { inspirations = data; saveData(); alert("🎉 云端记忆恢复成功！"); closeSettings(); } else { alert("❌ 提取码无效或数据损坏"); } } catch(e) { alert("获取失败，请确保提取码正确 (区分大小写)"); } btn.innerText = "⬇️ 恢复"; btn.disabled = false; }

    function openSettings() {
        document.getElementById('api-provider').value = aiConfig.provider || 'deepseek';
        document.getElementById('api-url-input').value = aiConfig.url;
        document.getElementById('api-model-input').value = aiConfig.model;
        document.getElementById('api-key-input').value = aiConfig.key;
        document.getElementById('sync-backend').value = syncConfig.backend;
        document.getElementById('sync-webdav-server').value = syncConfig.webdav.server;
        document.getElementById('sync-webdav-username').value = syncConfig.webdav.username;
        document.getElementById('sync-webdav-password').value = syncConfig.webdav.password;
        document.getElementById('sync-webdav-path').value = syncConfig.webdav.filePath;
        document.getElementById('sync-github-repo').value = syncConfig.github.repo;
        document.getElementById('sync-github-branch').value = syncConfig.github.branch;
        document.getElementById('sync-github-path').value = syncConfig.github.filePath;
        document.getElementById('sync-github-token').value = syncConfig.github.token;
        document.getElementById('sync-supabase-url').value = syncConfig.supabase.url;
        document.getElementById('sync-supabase-key').value = syncConfig.supabase.key;
        document.getElementById('sync-supabase-table').value = syncConfig.supabase.table;
        showSyncConfig();
        refreshSyncPausedBanner();
        document.getElementById('settings-modal').classList.remove('hidden');
        document.getElementById('settings-modal').classList.add('flex');
    }
    function changeProvider() { const provider = document.getElementById('api-provider').value; if (API_PRESETS[provider]) { document.getElementById('api-url-input').value = API_PRESETS[provider].url; document.getElementById('api-model-input').value = API_PRESETS[provider].model; } }

    async function fetchAIModels() {
        const button = document.getElementById('fetch-models-btn');
        const apiKey = document.getElementById('api-key-input').value.trim();
        const baseUrl = document.getElementById('api-url-input').value.trim();
        if (!apiKey) return alert('请先填写 API Key');
        if (!baseUrl) return alert('请先填写 API Base URL');

        const originalText = button.innerText;
        button.innerText = '拉取中...';
        button.disabled = true;
        try {
            const url = baseUrl.endsWith('/') ? baseUrl + 'models' : baseUrl + '/models';
            const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            const models = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
            const modelIds = models.map(model => typeof model === 'string' ? model : model.id || model.name).filter(Boolean);
            if (modelIds.length === 0) throw new Error('empty');

            const datalist = document.getElementById('api-model-list');
            datalist.innerHTML = '';
            modelIds.forEach(modelId => {
                const option = document.createElement('option');
                option.value = modelId;
                datalist.appendChild(option);
            });
            document.getElementById('api-model-input').focus();
        } catch (error) {
            alert('该接口不支持模型列表，请手动填写。支持该功能的常见服务：DeepSeek / 阿里云通义 / OpenAI');
        } finally {
            button.innerText = originalText;
            button.disabled = false;
        }
    }

    function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); document.getElementById('settings-modal').classList.remove('flex'); }
    function saveSettings() {
        aiConfig.provider = document.getElementById('api-provider').value;
        aiConfig.url = document.getElementById('api-url-input').value.trim();
        aiConfig.model = document.getElementById('api-model-input').value.trim();
        aiConfig.key = document.getElementById('api-key-input').value.trim();
        saveSyncConfig(readSyncConfigFromForm());
        localStorage.setItem('aiConfigV13', JSON.stringify(aiConfig));
        markLocalChanged();
        scheduleSyncPush();
        closeSettings();
        alert('设置已保存！云端配置仅保存在本机 localStorage。');
    }

    async function callLLM(systemPrompt, userPrompt) {
        if(!aiConfig.key) { openSettings(); throw new Error('请先在设置页面填写 API Key！'); }
        const url = aiConfig.url.endsWith('/') ? aiConfig.url + 'chat/completions' : aiConfig.url + '/chat/completions';
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.key}` }, body: JSON.stringify({ model: aiConfig.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }) });
        if(!res.ok) throw new Error('API 请求失败（HTTP ' + res.status + '）');
        const data = await res.json();
        if(!data.choices || !data.choices.length) throw new Error('API 返回内容为空或格式异常');
        return data.choices[0].message.content;
    }

    async function aiGenerateIdeas() {
        const btn = document.getElementById('ai-idea-btn');
        btn.innerHTML = '<span class="ai-loading border-indigo-500 border-top-indigo-200"></span> 正在思考...';
        btn.disabled = true;
        try {
            const prompt = "你是一个能提供治愈系灵感的精灵。直接输出3个适合普通人立刻去做的、25分钟内能完成的小事。极其简短。格式：\n1. xxx\n2. xxx\n3. xxx";
            const reply = await callLLM(prompt, "给我3个灵感");
            if(reply) {
                const items = reply.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(l => l);
                items.forEach(text => { inspirations.unshift({ id: Date.now() + Math.random(), text: text, tag: '💡 灵感点子', created_at: Date.now(), status: 'pending', image: null, color: CATEGORY_COLORS['💡 灵感点子'][Math.floor(Math.random()*5)].id }); });
                saveData();
                alert("🎉 成功为你捕获 3 个新灵感！");
            }
        } catch(e) {
            console.error('AI 塞点子出错:', e);
            alert("调用 AI 失败: " + e.message);
        } finally {
            btn.innerHTML = '🤖 AI 塞个点子';
            btn.disabled = false;
        }
    }
    async function aiPickForMe() {
        let pool = inspirations.filter(i => i.status === 'pending' && !i.tag.includes('秘密'));
        if(pool.length === 0) return alert("待办列表空空的！");
        const btn = document.getElementById('ai-pick-btn');
        btn.innerHTML = '<span class="ai-loading border-indigo-500 border-top-indigo-200"></span> AI 正在扫描列表...';
        btn.disabled = true;
        try {
            const listStr = pool.map(i => `[ID:${i.id}] ${i.tag}: ${i.text}`).join('\n');
            const prompt = "仔细阅读下面待办列表，挑选【1件】最推荐现在做的事情。直接返回格式：\n推荐ID: [填入ID]\n理由: [简短暖心的一句话理由]";
            const reply = await callLLM(prompt, listStr);
            if(reply) {
                const matchId = reply.match(/ID:\s*(\d+(\.\d+)?)/);
                if(matchId) {
                    const pickedItem = pool.find(i => i.id == matchId[1]) || pool[0];
                    const reason = reply.split('理由:')[1] || "很适合你现在的心情。";
                    showGachaResult(pickedItem, "🤖 AI 为你精选", `<strong>AI 说：</strong>${reason.trim()}<br><br><span class="text-slate-400">--- 原内容 ---</span><br>${pickedItem.text}`);
                } else {
                    showGachaResult(pool[Math.floor(Math.random() * pool.length)], "🤖 AI 随手一抽");
                }
            }
        } catch(e) {
            console.error('AI 挑选出错:', e);
            alert("调用 AI 失败: " + e.message);
        } finally {
            btn.innerHTML = '🤖 犹豫不决？让 AI 读取列表为你挑一个';
            btn.disabled = false;
        }
    }
    async function aiSummary() {
        const btn = document.getElementById('ai-summary-btn');
        btn.innerHTML = '<span class="ai-loading"></span> 撰写中...';
        btn.disabled = true;
        try {
            const todayItems = inspirations.filter(i => (Date.now() - i.created_at) < 86400000 && !i.tag.includes('秘密'));
            if(todayItems.length === 0) { alert("今天还没有记录内容哦！"); return; }
            const listStr = todayItems.map(i => `[${i.status==='completed'?'已完成':'未完成'}] ${i.tag}: ${i.text}`).join('\n');
            const prompt = "根据用户今天记录的内容，写一段不超过100字的温柔晚安总结，给予鼓励和情绪价值，格式优美。";
            const reply = await callLLM(prompt, "今天的记录如下：\n" + listStr);
            if(reply) {
                document.getElementById('gacha-icon').innerText = '✨';
                showGachaResult({tag:'AI 总结', text: ''}, "AI 星空手账", reply, false);
            }
        } catch(e) {
            console.error('AI 总结出错:', e);
            alert("调用 AI 失败: " + e.message);
        } finally {
            btn.innerHTML = '<span>📝 生成今日 AI 星空总结</span>';
            btn.disabled = false;
        }
    }

    // ================= 批次3：灵感抽卡（第一步：转盘模式） =================
    const ELEMENT_LIBRARY = {
        '颜色': ['雾蓝', '锈红', '奶油白', '墨绿', '柠檬黄', '藕紫', '陶土棕', '烟灰', '暗金', '薄荷绿', '珊瑚粉', '靛青', '沙色', '炭黑', '酒红', '天青'],
        '材质': ['玻璃', '毛线', '铁锈', '丝绸', '陶土', '皮革', '羽毛', '水晶', '纸张', '陶瓷', '木纹', '麻布', '液态金属', '冰', '灰烬', '珍珠'],
        '情绪': ['缓慢', '焦躁', '温柔', '孤寂', '雀跃', '倦怠', '虔诚', '慵懒', '警觉', '惆怅', '狂喜', '平静', '暧昧', '凛冽', '怀念', '期待'],
        '场景': ['雨夜', '旧书店', '无人车站', '清晨厨房', '废弃游乐场', '深夜便利店', '海边灯塔', '山间小屋', '地铁末班车', '温室', '天台', '教堂', '澡堂', '理发店', '图书馆', '天台花园'],
        '物件': ['信封', '钥匙', '怀表', '镜子', '蜡烛', '雨伞', '磁带', '地图', '药瓶', '毛绒玩具', '信纸', '旧照片', '铃铛', '香水瓶', '纽扣', '风铃'],
        '天气': ['细雨', '薄雾', '暴雪', '晴空', '阴云', '雷雨', '微风', '潮湿', '干燥', '冰雹', '彩虹', '晚霞', '晨露', '月晕', '焚风', '霜'],
        '动作': ['等待', '奔跑', '蜷缩', '凝视', '拥抱', '告别', '书写', '哼唱', '缝纫', '煮茶', '擦拭', '晾晒', '折叠', '点燃', '独行', '深呼吸'],
        '抽象': ['距离', '时间', '遗忘', '轮廓', '回音', '循环', '空隙', '片段', '谎言', '沉默', '边界', '折痕', '倒影', '影子', '契约', '摇篮曲']
    };
    const DRAW_CREATE_NEW = '__create_new_category__';
    function getAllDrawCategories() { return [...new Set([...Object.keys(ELEMENT_LIBRARY), ...Object.keys(customElements)])]; }
    let drawcardMode = 'wheel';
    let drawWheelCategory = '颜色';
    let wheelRotation = 0;
    let wheelSpinning = false;

    function getDrawElements(category) { return [...(ELEMENT_LIBRARY[category] || []), ...(customElements[category] || [])]; }
    function escapeDrawText(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function switchDrawMode(mode) { drawcardMode = mode; renderDrawcard(); }

    function renderDrawcard() {
        const wheelActive = drawcardMode === 'wheel';
        const activeCls = 'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all bg-indigo-500 shadow-md text-white';
        const idleCls = 'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-800';
        document.getElementById('draw-tab-wheel').className = wheelActive ? activeCls : idleCls;
        document.getElementById('draw-tab-shake').className = wheelActive ? idleCls : activeCls;
        document.getElementById('draw-panel-wheel').style.display = wheelActive ? 'flex' : 'none';
        document.getElementById('draw-panel-shake').style.display = wheelActive ? 'none' : 'flex';
        renderDrawCategoryOptions();
        buildWheel();
        renderDrawChips();
        renderDrawCountBtns();
    }

    function renderDrawCategoryOptions() {
        const select = document.getElementById('draw-wheel-category');
        const options = getAllDrawCategories().map(c => `<option value="${escapeDrawText(c).replace(/"/g, '&quot;')}">${DRAW_CATEGORY_EMOJI[c] || '✨'} ${escapeDrawText(c)}</option>`);
        options.push(`<option value="${DRAW_CREATE_NEW}">➕ 创建新类别</option>`);
        select.innerHTML = options.join('');
        select.value = drawWheelCategory;
    }

    function setDrawWheelCategory(category) {
        if (category === DRAW_CREATE_NEW) {
            const name = promptNewCategoryName();
            if (!name) { renderDrawCategoryOptions(); return; }
            if (!ELEMENT_LIBRARY[name] && !customElements[name]) { customElements[name] = []; saveCustomElements(); }
            category = name;
        }
        drawWheelCategory = category;
        renderDrawCategoryOptions();
        wheelRotation = 0;
        wheelSpinning = false;
        const wheel = document.getElementById('draw-wheel');
        wheel.style.transitionDuration = '0s';
        wheel.style.transform = 'rotate(0deg)';
        document.getElementById('draw-wheel-result').innerText = '';
        const btn = document.getElementById('draw-spin-btn');
        btn.disabled = false;
        btn.classList.remove('opacity-60');
        buildWheel();
    }

    function wheelSliceColor(index) { return `hsl(${(index * 137.5) % 360}, 62%, ${index % 2 === 0 ? 70 : 78}%)`; }

    function buildWheel() {
        const wheel = document.getElementById('draw-wheel');
        const elements = getDrawElements(drawWheelCategory);
        const count = elements.length;
        if (!count) { wheel.style.background = 'none'; wheel.innerHTML = ''; return; }
        const fontSize = count <= 16 ? 12 : count <= 24 ? 10 : count <= 32 ? 8 : 6;
        wheel.style.setProperty('--draw-label-fs', fontSize + 'px');
        const slice = 360 / count;
        const stops = [];
        for (let i = 0; i < count; i++) stops.push(`${wheelSliceColor(i)} ${(i * slice).toFixed(3)}deg ${((i + 1) * slice).toFixed(3)}deg`);
        wheel.style.background = `conic-gradient(${stops.join(', ')})`;
        const wheelSize = wheel.clientWidth || 320;
        const maxLabelWidth = 2 * (wheelSize * 0.33) * Math.tan(Math.PI / count) * 1.1;
        wheel.innerHTML = elements.map((name, i) => {
            const charCount = [...String(name)].length;
            const textWidth = charCount * fontSize + Math.max(0, charCount - 1);
            const hiddenStyle = textWidth > maxLabelWidth ? ' display: none;' : '';
            return `<div class="draw-wheel-label" style="transform: translate(-50%, -50%) rotate(${(i * slice + slice / 2).toFixed(3)}deg) translateY(calc(var(--draw-wheel-size) * -0.33));${hiddenStyle}">${escapeDrawText(name)}</div>`;
        }).join('');
    }

    function spinWheel() {
        if (wheelSpinning) return;
        const elements = getDrawElements(drawWheelCategory);
        if (!elements.length) return;
        wheelSpinning = true;
        const btn = document.getElementById('draw-spin-btn');
        btn.disabled = true;
        btn.classList.add('opacity-60');
        const resultEl = document.getElementById('draw-wheel-result');
        resultEl.classList.remove('pop');
        const count = elements.length;
        const slice = 360 / count;
        const targetIndex = Math.floor(Math.random() * count);
        const targetAngle = targetIndex * slice + slice / 2;
        const delta = ((360 - targetAngle - wheelRotation) % 360 + 360) % 360;
        const fullSpins = 4 + Math.floor(Math.random() * 3);
        wheelRotation += fullSpins * 360 + delta;
        const duration = 3000 + Math.random() * 2000;
        const wheel = document.getElementById('draw-wheel');
        wheel.style.transitionDuration = `${duration}ms`;
        wheel.style.transform = `rotate(${wheelRotation}deg)`;
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            wheel.removeEventListener('transitionend', finish);
            wheelSpinning = false;
            btn.disabled = false;
            btn.classList.remove('opacity-60');
            resultEl.innerText = elements[targetIndex];
            resultEl.classList.add('pop');
        };
        wheel.addEventListener('transitionend', finish);
        setTimeout(finish, duration + 400);
    }

    // ================= 批次3：灵感抽卡（第二步：摇摇乐 + 收藏） =================
    const DRAW_CATEGORY_EMOJI = { '颜色': '🎨', '材质': '🧵', '情绪': '💭', '场景': '🏙️', '物件': '🕯️', '天气': '🌦️', '动作': '🏃', '抽象': '♾️' };
    let drawShakeCategories = new Set(); // 默认全不选
    let drawShakeCount = 3;
    let drawShaking = false;
    let lastShakeGroup = [];
    let drawCollections = JSON.parse(localStorage.getItem('drawCollectionsV14')) || [];
    let drawToastTimer = null;

    // fireConfetti 在旧代码里被调用了 4 次但一直没定义，在此补上实现（仅新增，不动旧调用点）
    function fireConfetti() { if (typeof confetti === 'function') confetti({ particleCount: 130, spread: 78, origin: { y: 0.72 } }); }

    function showToast(message, duration = 2000) {
        const toast = document.getElementById('draw-toast');
        toast.innerText = message;
        toast.classList.add('show');
        clearTimeout(drawToastTimer);
        drawToastTimer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    function saveDrawCollections() { localStorage.setItem('drawCollectionsV14', JSON.stringify(drawCollections)); markLocalChanged(); scheduleSyncPush(); }

    function renderDrawChips() {
        document.getElementById('draw-chip-row').innerHTML = getAllDrawCategories().map(category => `<button onclick="toggleDrawCategory('${category}')" class="draw-chip ${drawShakeCategories.has(category) ? 'active' : ''}">${DRAW_CATEGORY_EMOJI[category] || '✨'} ${escapeDrawText(category)}</button>`).join('');
    }

    function toggleDrawCategory(category) {
        if (drawShakeCategories.has(category)) drawShakeCategories.delete(category);
        else drawShakeCategories.add(category);
        renderDrawChips();
    }

    function setDrawShakeCount(count) { drawShakeCount = count; renderDrawCountBtns(); }

    function renderDrawCountBtns() {
        document.querySelectorAll('.draw-count-btn').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.count) === drawShakeCount));
    }

    function resetDrawCollectBtn() {
        const btn = document.getElementById('draw-collect-btn');
        btn.disabled = false;
        btn.innerHTML = '⭐ 收藏这组';
        btn.classList.remove('opacity-60', 'cursor-not-allowed');
    }

    function shuffleDrawArray(list) {
        for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
        return list;
    }

    function drawShake() {
        if (drawShaking) return;
        const categories = [...drawShakeCategories];
        if (!categories.length) { showToast('请至少选择一个类别'); return; }
        const resultsBox = document.getElementById('draw-shake-results');
        const actionsBox = document.getElementById('draw-shake-actions');
        resultsBox.innerHTML = '';
        actionsBox.style.display = 'none';
        resetDrawCollectBtn();

        // 公平轮询抽取：选中类别各自打乱成独立池子，空池子直接跳过
        const pools = new Map();
        categories.forEach(category => {
            const elements = shuffleDrawArray(getDrawElements(category).map(name => ({ category, name })));
            if (elements.length) pools.set(category, elements);
        });
        const totalAvailable = [...pools.values()].reduce((sum, list) => sum + list.length, 0);
        if (!totalAvailable) { showToast('选中的类别里没有元素'); return; }

        const target = Math.min(drawShakeCount, totalAvailable);
        const picks = [];
        if (target >= pools.size) {
            // N >= K：第一轮每个类别各抽 1 个，保证都有代表
            pools.forEach(list => picks.push(list.pop()));
            // 第二轮：剩余元素混合打乱，随机抽满剩余名额
            const rest = shuffleDrawArray([...pools.values()].flat());
            while (picks.length < target && rest.length) picks.push(rest.pop());
        } else {
            // N < K：随机挑 N 个类别，各抽 1 个
            shuffleDrawArray([...pools.keys()]).slice(0, target).forEach(category => picks.push(pools.get(category).pop()));
        }
        shuffleDrawArray(picks);
        lastShakeGroup = picks;
        if (totalAvailable < drawShakeCount) showToast(`元素不足，已抽出全部 ${picks.length} 个`);

        drawShaking = true;
        picks.forEach((pick, index) => {
            setTimeout(() => {
                const card = document.createElement('div');
                card.className = 'draw-card glass-item rounded-2xl p-4 flex items-center gap-3 shadow-sm';
                card.innerHTML = `<span class="text-2xl drop-shadow-sm">${DRAW_CATEGORY_EMOJI[pick.category] || '✨'}</span><div class="flex-1 min-w-0"><div class="text-lg font-bold truncate">${escapeDrawText(pick.name)}</div><div class="text-xs opacity-70 font-bold">${pick.category}</div></div>`;
                resultsBox.appendChild(card);
                if (index === picks.length - 1) setTimeout(() => { actionsBox.style.display = 'flex'; drawShaking = false; }, 350);
            }, index * 300);
        });
    }

    function collectShakeGroup() {
        const btn = document.getElementById('draw-collect-btn');
        if (btn.disabled) return;
        if (!lastShakeGroup.length) { showToast('先摇一组再收藏'); return; }
        drawCollections.push({ id: Date.now(), elements: lastShakeGroup.map(pick => ({ category: pick.category, name: pick.name })), created_at: Date.now() });
        saveDrawCollections();
        fireConfetti();
        showToast('✨ 已收藏');
        btn.disabled = true;
        btn.innerHTML = '✅ 已收藏';
        btn.classList.add('opacity-60', 'cursor-not-allowed');
    }

    // ================= 批次3 第三步：AI 扩充 + 自定义元素 =================
    // 结构：{ '颜色': ['暮山紫', ...], ... }；key 可以是内置类别名，也可以是用户自建类别名
    let customElements = JSON.parse(localStorage.getItem('customElementsV14')) || {};

    function saveCustomElements() { localStorage.setItem('customElementsV14', JSON.stringify(customElements)); markLocalChanged(); scheduleSyncPush(); }

    // 弹窗让用户输入新类别名并做基础校验；返回合法名字，取消或非法返回 null
    function promptNewCategoryName() {
        const input = prompt('请输入新类别的名称，例如：梦境');
        if (input === null) return null;
        const name = input.trim();
        if (!name) { showToast('类别名不能为空'); return null; }
        if ([...name].length > 12) { showToast('类别名最多 12 个字符'); return null; }
        if (/['"<>&\\`]/.test(name)) { showToast('类别名不能包含引号或特殊符号'); return null; }
        return name;
    }

    // 确定要操作的类别：转盘模式用下拉框当前值；摇摇乐模式弹窗让用户选（内置 + 自定义类别，最后一项可创建新类别）
    function resolveDrawTargetCategory() {
        if (drawcardMode === 'wheel') return drawWheelCategory;
        const names = getAllDrawCategories();
        const menu = names.map((c, i) => `${i + 1}. ${DRAW_CATEGORY_EMOJI[c] || '✨'} ${c}`).join('\n');
        const input = prompt(`要操作哪个类别？输入序号：\n${menu}\n${names.length + 1}. ➕ 创建新类别`);
        if (input === null) return null;
        const trimmed = input.trim();
        if (names.includes(trimmed)) return trimmed;
        const idx = parseInt(trimmed, 10);
        if (idx === names.length + 1) return promptNewCategoryName();
        if (idx >= 1 && idx <= names.length) return names[idx - 1];
        showToast('序号无效');
        return null;
    }

    function parseElementInput(text) {
        return [...new Set(String(text).split(/[,，]/).map(s => s.trim()).filter(s => s))];
    }

    function addCustomElements() {
        const category = resolveDrawTargetCategory();
        if (!category) return;
        const input = prompt(`请输入要加入【${category}】的新元素，用逗号分隔，例如：暴雨, 油纸伞`);
        if (input === null) return;
        const items = parseElementInput(input);
        if (!items.length) { showToast('没有有效元素'); return; }
        const existing = new Set(getDrawElements(category));
        const fresh = items.filter(name => !existing.has(name));
        if (!fresh.length) { showToast('元素已全部存在，没有新增'); return; }
        customElements[category] = [...(customElements[category] || []), ...fresh];
        saveCustomElements();
        renderDrawcard();
        showToast(`✅ 已添加 ${fresh.length} 个元素`);
    }

    // 清洗 AI 输出：去行首编号/符号/Markdown，去首尾引号括号，丢超 6 字的行，去重，最多 8 个
    function cleanAiElementLines(reply, existingSet) {
        const cleaned = [];
        String(reply).split('\n').forEach(line => {
            const text = line
                .replace(/^\s*(?:[-*•·>#\s]+|\d+\s*[.、)）:：]\s*)/, '')
                .replace(/[*_`#]/g, '')
                .replace(/^["'“”‘’「」『』【】]+|["'“”‘’「」『』【】]+$/g, '')
                .replace(/[\s:：;；,，.。]+$/g, '')
                .trim();
            if (!text || [...text].length > 6) return;
            if (existingSet.has(text) || cleaned.includes(text)) return;
            cleaned.push(text);
        });
        return cleaned.slice(0, 8);
    }

    async function aiExpandElements() {
        console.log('AI 扩充被触发，当前配置:', aiConfig);
        const btn = document.getElementById('drawcard-ai-btn');
        btn.innerHTML = '⏳ 请求中...';
        btn.disabled = true;
        btn.classList.add('opacity-60');
        try {
            if (!aiConfig.key) { alert('请先在设置里填写 API Key'); openSettings(); return; }
            let requirement = prompt('请输入扩充要求（例如：关于海洋的5个词、只要3个词等）。留空则默认随机生成8个：');
            if (requirement === null) {
                return; // 用户点了取消，直接退出
            }
            const category = resolveDrawTargetCategory();
            if (!category) return;
            const existing = getDrawElements(category);
            const systemPrompt = '你是一个灵感素材生成器。请严格按格式输出，不要解释，不要编号，不要 Markdown 标记。';
            const requirementText = requirement.trim() ? `扩充要求：${requirement.trim()}。` : '';
            const userPrompt = `类别：${category}。已有元素：${existing.join('，')}。${requirementText}请生成 8 个不重复的新元素，每个不超过 6 个汉字。只输出 8 行，每行一个元素，不要空行。`;
            console.log('准备向以下地址发送请求:', aiConfig.url, '模型:', aiConfig.model);
            const reply = await callLLM(systemPrompt, userPrompt);
            if (!reply) return;
            const fresh = cleanAiElementLines(reply, new Set(existing));
            if (!fresh.length) { showToast('AI 生成失败或内容重复，请重试'); return; }
            openAiPreviewModal(category, fresh);
        } catch (e) {
            console.error('AI扩充出错:', e);
            alert('生成失败：' + e.message);
        } finally {
            btn.innerHTML = '🤖 AI 扩充';
            btn.disabled = false;
            btn.classList.remove('opacity-60');
        }
    }

    // 管理自定义元素：只列出/删除 customElements 里的元素，内置元素不出现
    let managingCategory = null;

    function openManageModal() {
        const category = resolveDrawTargetCategory();
        if (!category) return;
        managingCategory = category;
        document.getElementById('draw-manage-category').innerText = `当前类别：${category}`;
        renderManageList();
        document.getElementById('draw-manage-modal').classList.remove('hidden');
        document.getElementById('draw-manage-modal').classList.add('flex');
    }

    function closeManageModal() {
        document.getElementById('draw-manage-modal').classList.add('hidden');
        document.getElementById('draw-manage-modal').classList.remove('flex');
        managingCategory = null;
    }

    function renderManageList() {
        const list = document.getElementById('draw-manage-list');
        const items = customElements[managingCategory] || [];
        if (!items.length) { list.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">该类别还没有自定义元素</p>'; return; }
        list.innerHTML = items.map((name, index) => `<div class="flex items-center justify-between bg-white/70 border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm"><span class="text-sm font-bold text-slate-700">${escapeDrawText(name)}</span><button onclick="deleteCustomElement(${index})" class="btn-hover text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg whitespace-nowrap">删除</button></div>`).join('');
    }

    function deleteCustomElement(index) {
        if (!managingCategory) return;
        const items = customElements[managingCategory] || [];
        if (index < 0 || index >= items.length) return;
        const removed = items.splice(index, 1)[0];
        saveCustomElements();
        renderDrawcard();
        renderManageList();
        showToast(`🗑️ 已删除「${removed}」`);
    }

    // AI 扩充预览确认：勾选后才写入 customElements
    let aiPendingExpand = null;

    function openAiPreviewModal(category, items) {
        aiPendingExpand = { category, items };
        document.getElementById('draw-ai-preview-list').innerHTML = items.map((name, index) => `<label class="flex items-center gap-3 bg-white/70 border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm cursor-pointer"><input type="checkbox" class="ai-preview-check accent-indigo-500 w-4 h-4" data-index="${index}" checked><span class="text-sm font-bold text-slate-700">${escapeDrawText(name)}</span></label>`).join('');
        document.getElementById('draw-ai-preview-modal').classList.remove('hidden');
        document.getElementById('draw-ai-preview-modal').classList.add('flex');
    }

    function closeAiPreviewModal() {
        document.getElementById('draw-ai-preview-modal').classList.add('hidden');
        document.getElementById('draw-ai-preview-modal').classList.remove('flex');
        aiPendingExpand = null;
    }

    function confirmAiPreview() {
        if (!aiPendingExpand) { closeAiPreviewModal(); return; }
        const category = aiPendingExpand.category;
        const items = aiPendingExpand.items;
        const picked = [...document.querySelectorAll('#draw-ai-preview-list .ai-preview-check:checked')].map(box => items[Number(box.dataset.index)]);
        if (!picked.length) { showToast('没有勾选任何元素'); return; }
        customElements[category] = [...(customElements[category] || []), ...picked];
        saveCustomElements();
        renderDrawcard();
        closeAiPreviewModal();
        showToast(`✨ 已加入 ${picked.length} 个元素`);
    }

    init();
