/**
 * フリップツール
 *
 * 同期には Netlify Functions (/api/flip) と Netlify Blobs を使います。
 * 状態のマージ処理は flip_merge.js にあります。
 */
const { emptyState, normalize, canon, mergeState } = window.FlipMerge;
const API_URL = '/api/flip';
const SYNC_INTERVAL_MS = 4000;

// ---------- アプリ本体 ----------

const flipApp = {
    roomId: '',
    playerName: '',
    state: emptyState(),
    phase: 'lobby',
    renderedPhase: '',
    renderedRound: null,
    syncTimer: null,
    syncing: false,
    syncAgain: false,
    lastSyncOk: true,

    init() {
        this.render();
    },

    now() {
        return Date.now();
    },

    // ---------- 状態の読み取り ----------

    activePlayers() {
        return Object.keys(this.state.players)
            .map(name => ({ name, ...this.state.players[name] }))
            .filter(p => !p.left)
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.name.localeCompare(b.name));
    },

    hasAnswer(p) {
        return !!p && !p.left && p.submitted && p.round === this.state.round;
    },

    isOpen(name) {
        const r = this.state.reveal[name];
        return !!r && r.open && r.round === this.state.round && this.hasAnswer(this.state.players[name]);
    },

    me() {
        return this.state.players[this.playerName];
    },

    currentQuestion() {
        const q = this.state.question;
        return q && q.round === this.state.round ? q.text : '';
    },

    // ---------- 画面描画 ----------

    render() {
        const container = document.getElementById('flip-container');
        if (this.renderedPhase !== this.phase) {
            container.innerHTML = '';
            const tpl = document.getElementById(this.phase === 'room' ? 'tpl-room' : 'tpl-lobby');
            container.appendChild(tpl.content.cloneNode(true));
            this.renderedPhase = this.phase;
            this.renderedRound = null;
            this.bindEvents();
        }
        if (this.phase === 'room') this.renderRoom();
    },

    bindEvents() {
        const on = (id, ev, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(ev, fn);
        };

        if (this.phase === 'lobby') {
            const nameEl = document.getElementById('playerName');
            const roomEl = document.getElementById('roomId');
            nameEl.value = this.safeGet('flipPlayerName') || '';
            roomEl.value = this.safeGet('flipRoomId') || '';
            on('join-btn', 'click', () => this.joinRoom());
            [nameEl, roomEl].forEach(el => el.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.isComposing) this.joinRoom();
            }));
            return;
        }

        on('leave-btn', 'click', () => this.leaveRoom());
        on('set-question-btn', 'click', () => this.setQuestion());
        on('questionInput', 'keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) this.setQuestion();
        });
        on('submit-btn', 'click', () => this.submitAnswer());
        on('answerInput', 'input', () => this.renderMyStatus());
        on('reveal-all-btn', 'click', () => this.setAllOpen(true));
        on('hide-all-btn', 'click', () => this.setAllOpen(false));
        on('next-round-btn', 'click', () => this.nextRound());
        on('cards-grid', 'click', e => {
            const card = e.target.closest('.flip-card');
            if (card && !card.classList.contains('disabled')) this.toggleCard(card.dataset.name);
        });
    },

    renderRoom() {
        document.getElementById('display-room-id').textContent = this.roomId;
        document.getElementById('display-name').textContent = this.playerName;
        document.getElementById('round-label').textContent = `(第${this.state.round}問)`;

        const q = this.currentQuestion();
        const qEl = document.getElementById('display-question');
        qEl.textContent = q || 'お題はまだありません（下の欄から設定できます）';
        qEl.classList.toggle('empty', !q);

        // ラウンドが変わったら回答欄を初期化
        const answerEl = document.getElementById('answerInput');
        if (this.renderedRound !== this.state.round) {
            const me = this.me();
            answerEl.value = this.hasAnswer(me) ? me.answer : '';
            this.renderedRound = this.state.round;
        }

        const players = this.activePlayers();
        const answered = players.filter(p => this.hasAnswer(p));
        const opened = answered.filter(p => this.isOpen(p.name));
        document.getElementById('progress-text').textContent =
            `回答済み ${answered.length} / ${players.length} 人　・　オープン ${opened.length} 枚`;

        document.getElementById('reveal-all-btn').disabled = answered.length === 0 || opened.length === answered.length;
        document.getElementById('hide-all-btn').disabled = opened.length === 0;

        this.renderMyStatus();
        this.renderCards(players);
    },

    renderMyStatus() {
        const me = this.me();
        const answerEl = document.getElementById('answerInput');
        const btn = document.getElementById('submit-btn');
        const status = document.getElementById('my-answer-status');
        if (!answerEl) return;

        const myOpen = this.isOpen(this.playerName);
        answerEl.disabled = myOpen;
        status.classList.remove('warn');

        if (myOpen) {
            btn.disabled = true;
            btn.textContent = 'オープン済み';
            status.textContent = 'あなたのフリップはオープンされました！';
            return;
        }
        btn.disabled = false;
        if (this.hasAnswer(me)) {
            btn.textContent = '回答を更新';
            if (answerEl.value.trim() !== me.answer) {
                status.textContent = '⚠ 変更がまだ送信されていません';
                status.classList.add('warn');
            } else {
                status.textContent = '✔ 送信済み（オープンされるまで修正できます）';
            }
        } else {
            btn.textContent = '回答を送信';
            status.textContent = '';
        }
    },

    renderCards(players) {
        const grid = document.getElementById('cards-grid');
        const existing = {};
        grid.querySelectorAll('.flip-card').forEach(el => { existing[el.dataset.name] = el; });

        players.forEach((p, i) => {
            let card = existing[p.name];
            if (!card) {
                card = this.createCard(p.name);
            }
            delete existing[p.name];
            // 並び順をそろえる
            if (grid.children[i] !== card) grid.insertBefore(card, grid.children[i] || null);

            const answered = this.hasAnswer(p);
            const open = this.isOpen(p.name);
            const isMe = p.name === this.playerName;

            card.classList.toggle('open', open);
            card.classList.toggle('disabled', !answered);
            card.title = !answered ? '' : (open ? 'タップでふせる' : 'タップでオープン');

            const back = card.querySelector('.flip-back');
            back.classList.toggle('waiting', !answered);
            back.querySelector('.mark').textContent = answered ? '?' : '…';
            back.querySelector('.status').textContent = answered ? '回答済み' : '回答待ち';
            back.querySelector('.hint').textContent = answered ? 'タップでオープン' : '';

            card.querySelectorAll('.name-text').forEach(el => { el.textContent = p.name; });
            card.querySelectorAll('.me-badge').forEach(el => { el.style.display = isMe ? '' : 'none'; });

            const ans = card.querySelector('.card-answer');
            // 中身はオープン時だけ入れる (ふせている間に覗けないように)
            const text = open ? p.answer : '';
            if (ans.textContent !== text) ans.textContent = text;
            ans.classList.toggle('long', text.length > 20);
        });

        Object.values(existing).forEach(el => el.remove());
    },

    createCard(name) {
        const card = document.createElement('div');
        card.className = 'flip-card';
        card.dataset.name = name;
        card.innerHTML = `
            <div class="flip-card-inner">
                <div class="flip-face flip-back">
                    <div class="card-name"><span class="name-text"></span><span class="me-badge">あなた</span></div>
                    <div class="mark">?</div>
                    <div class="status"></div>
                    <div class="hint"></div>
                </div>
                <div class="flip-face flip-front">
                    <div class="card-name"><span class="name-text"></span><span class="me-badge">あなた</span></div>
                    <div class="card-answer"></div>
                </div>
            </div>`;
        return card;
    },

    // ---------- アクション ----------

    async joinRoom() {
        const name = document.getElementById('playerName').value.trim();
        const roomId = document.getElementById('roomId').value.trim();
        if (!name || !roomId) {
            alert('名前とルームIDを入力してください！');
            return;
        }

        const btn = document.getElementById('join-btn');
        btn.disabled = true;
        btn.textContent = '接続中...';

        this.roomId = roomId;
        this.playerName = name;
        this.safeSet('flipPlayerName', name);
        this.safeSet('flipRoomId', roomId);

        const server = await this.fetchState();
        if (server === undefined) {
            alert('サーバーに接続できませんでした。時間をおいてもう一度お試しください。');
            btn.disabled = false;
            btn.textContent = '入室する / 作成する';
            return;
        }

        this.state = mergeState(emptyState(), server);
        const prev = this.state.players[name];
        const t = this.now();
        if (prev && !prev.left) {
            // 同じ名前で再入室 (リロードなど) → そのまま引き継ぐ
        } else {
            this.state.players[name] = {
                answer: '', submitted: false, round: this.state.round,
                joinedAt: prev && prev.joinedAt ? prev.joinedAt : t, at: t
            };
        }

        this.phase = 'room';
        this.render();
        await this.sync();
        this.startSync();
    },

    async leaveRoom() {
        if (!confirm('ルームから退出しますか？')) return;
        this.stopSync();
        const me = this.me();
        if (me) {
            this.state.players[this.playerName] = { ...me, left: true, at: this.now() };
            await this.pushState(this.state);
        }
        this.roomId = '';
        this.phase = 'lobby';
        this.state = emptyState();
        this.render();
        this.setSyncStatus('オフライン');
    },

    setQuestion() {
        const input = document.getElementById('questionInput');
        const text = input.value.trim();
        if (!text) {
            alert('お題を入力してください！');
            return;
        }
        const hasAnswers = this.activePlayers().some(p => this.hasAnswer(p));
        if (hasAnswers) {
            if (!confirm('今の回答をリセットして、新しいお題にしますか？')) return;
            this.startNewRound();
        }
        this.state.question = { text, round: this.state.round, at: this.now() };
        input.value = '';
        this.render();
        this.sync();
    },

    nextRound() {
        if (!confirm('全員の回答をリセットして次のお題へ進みますか？')) return;
        this.startNewRound();
        this.render();
        this.sync();
    },

    startNewRound() {
        this.state.round += 1;
        this.state.reveal = {};
        // 自分の回答だけは自分で消しておく (他の人の分は round が古いので自動的に無効になる)
        const me = this.me();
        if (me) {
            this.state.players[this.playerName] = { ...me, answer: '', submitted: false, round: this.state.round, at: this.now() };
        }
    },

    submitAnswer() {
        const answer = document.getElementById('answerInput').value.trim();
        if (!answer) {
            alert('回答を入力してください！');
            return;
        }
        if (this.isOpen(this.playerName)) return;
        const me = this.me() || { joinedAt: this.now() };
        this.state.players[this.playerName] = {
            ...me, answer, submitted: true, round: this.state.round, left: false, at: this.now()
        };
        this.render();
        this.sync();
    },

    toggleCard(name) {
        const p = this.state.players[name];
        if (!this.hasAnswer(p)) return;
        this.state.reveal[name] = { open: !this.isOpen(name), round: this.state.round, at: this.now() };
        this.render();
        this.sync();
    },

    setAllOpen(open) {
        const t = this.now();
        this.activePlayers().forEach(p => {
            if (this.hasAnswer(p)) {
                this.state.reveal[p.name] = { open, round: this.state.round, at: t };
            }
        });
        this.render();
        this.sync();
    },

    // ---------- 通信 ----------

    startSync() {
        this.stopSync();
        // タブが裏にある間は通信しない (関数の呼び出し回数を節約)
        this.syncTimer = setInterval(() => {
            if (!document.hidden) this.sync();
        }, SYNC_INTERVAL_MS);
    },

    stopSync() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        this.syncTimer = null;
    },

    /**
     * サーバーの状態を取得 → 手元とマージ → 差分があれば送信 (サーバー側でもマージされる)
     * 同時に呼ばれた場合は、今の同期が終わったあとにもう一度実行する
     */
    async sync() {
        if (!this.roomId) return;
        if (this.syncing) {
            this.syncAgain = true;
            return;
        }
        this.syncing = true;
        const roomId = this.roomId;
        try {
            do {
                this.syncAgain = false;
                let server = await this.fetchState();
                if (server === undefined || roomId !== this.roomId) break;
                let merged = mergeState(this.state, server);
                if (server === null || canon(merged) !== canon(normalize(server))) {
                    const saved = await this.pushState(merged);
                    if (roomId !== this.roomId) break;
                    if (saved) merged = mergeState(merged, saved);
                }
                // 通信中に行われた手元の操作も取りこぼさないようにマージ
                merged = mergeState(this.state, merged);
                const changedLocal = canon(merged) !== canon(normalize(this.state));
                this.state = merged;
                if (changedLocal && this.phase === 'room') this.render();
            } while (this.syncAgain);
        } finally {
            this.syncing = false;
        }
    },

    // 成功: 状態オブジェクト / ルームなし: null / 通信失敗: undefined
    async fetchState() {
        try {
            const res = await fetch(`${API_URL}?roomId=${encodeURIComponent(this.roomId)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.setSyncStatus('オンライン');
            return data || null;
        } catch (e) {
            console.error(e);
            this.setSyncStatus('通信エラー', true);
            return undefined;
        }
    },

    // 成功: サーバーでマージされた状態 / 失敗: null
    async pushState(state) {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.roomId, state })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error(e);
            this.setSyncStatus('通信エラー', true);
            return null;
        }
    },

    setSyncStatus(text, isError = false) {
        const el = document.getElementById('sync-status');
        el.textContent = text;
        el.classList.toggle('error', isError);
    },

    safeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },

    safeSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* noop */ }
    }
};

window.addEventListener('DOMContentLoaded', () => flipApp.init());

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) flipApp.sync();
});
