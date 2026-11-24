/**
 * フリップツール
 *
 * 同期には Netlify Functions (/api/flip) と Netlify Blobs を使います。
 * 状態のマージ処理は flip_merge.js、手書き機能は flip_draw.js にあります。
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
    renderedStage: null,
    syncTimer: null,
    syncing: false,
    syncAgain: false,
    serverEtag: null,   // 最後に受け取ったサーバー状態の版 (変化がなければ中身の再送を省く)
    serverState: null,
    answerMode: 'text', // 'text' | 'draw'
    pad: null,

    init() {
        this.answerMode = this.safeGet('flipAnswerMode') === 'draw' ? 'draw' : 'text';
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

    // 今いる画面: 'question' (お題) → 'answer' (回答) → 'reveal' (みんなのフリップ)
    currentStage() {
        const st = this.state.stage;
        if (st && st.round === this.state.round && ['question', 'answer', 'reveal'].includes(st.name)) return st.name;
        // 画面情報がない場合は、お題があれば回答画面から
        return this.currentQuestion() ? 'answer' : 'question';
    },

    setStage(name) {
        this.state.stage = { name, round: this.state.round, at: this.now() };
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
            this.renderedStage = null;
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
        on('go-reveal-btn', 'click', () => this.goReveal());
        on('back-question-btn', 'click', () => this.goStage('question'));
        on('back-answer-btn', 'click', () => this.goStage('answer'));
        on('questionInput', 'keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) this.setQuestion();
        });
        on('submit-btn', 'click', () => this.submitAnswer());
        on('answerInput', 'input', () => this.renderMyStatus());
        on('mode-tabs', 'click', e => {
            const tab = e.target.closest('.mode-tab');
            if (tab && !tab.disabled) this.setAnswerMode(tab.dataset.mode);
        });
        this.setupDrawTools();
        on('reveal-all-btn', 'click', () => this.setAllOpen(true));
        on('hide-all-btn', 'click', () => this.setAllOpen(false));
        on('next-round-btn', 'click', () => this.nextRound());
        on('cards-grid', 'click', e => {
            const card = e.target.closest('.flip-card');
            if (card && !card.classList.contains('disabled')) this.toggleCard(card.dataset.name);
        });
    },

    setupDrawTools() {
        this.pad = new FlipDraw.Pad(document.getElementById('drawCanvas'), {
            onChange: () => this.renderMyStatus(),
            onLimit: () => this.showLimitNotice()
        });

        const colorTools = document.getElementById('color-tools');
        FlipDraw.COLORS.forEach((c, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'color-btn' + (i === 0 ? ' active' : '');
            b.style.backgroundColor = c;
            b.title = '色';
            b.addEventListener('click', () => {
                this.pad.color = c;
                colorTools.querySelectorAll('.color-btn').forEach(x => x.classList.toggle('active', x === b));
            });
            colorTools.appendChild(b);
        });

        const widthTools = document.getElementById('width-tools');
        FlipDraw.WIDTHS.forEach(w => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'width-btn' + (w === this.pad.width ? ' active' : '');
            b.title = '太さ';
            const dot = document.createElement('span');
            const size = Math.max(4, Math.round(w * 1.3));
            dot.style.width = dot.style.height = size + 'px';
            b.appendChild(dot);
            b.addEventListener('click', () => {
                this.pad.width = w;
                widthTools.querySelectorAll('.width-btn').forEach(x => x.classList.toggle('active', x === b));
            });
            widthTools.appendChild(b);
        });

        document.getElementById('undo-btn').addEventListener('click', () => this.pad.undo());
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (this.pad.strokes.length && confirm('手書きを全部消しますか？')) this.pad.clear();
        });
    },

    setAnswerMode(mode) {
        this.answerMode = mode === 'draw' ? 'draw' : 'text';
        this.safeSet('flipAnswerMode', this.answerMode);
        this.renderAnswerMode();
        this.renderMyStatus();
    },

    renderAnswerMode() {
        document.querySelectorAll('#mode-tabs .mode-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mode === this.answerMode);
        });
        document.getElementById('text-area').hidden = this.answerMode !== 'text';
        document.getElementById('draw-area').hidden = this.answerMode !== 'draw';
        // 非表示の間はサイズが取れないので、表示したときに合わせ直す
        if (this.answerMode === 'draw' && this.pad) this.pad.resize();
    },

    showLimitNotice() {
        const status = document.getElementById('my-answer-status');
        status.textContent = '⚠ これ以上は書き込めません（「戻す」か「全部消す」で減らしてね）';
        status.classList.add('warn');
    },

    // 入力中の回答
    draftAnswer() {
        if (this.answerMode === 'draw') {
            return { kind: 'draw', answer: '', drawing: this.pad ? this.pad.getStrokes() : [] };
        }
        const el = document.getElementById('answerInput');
        return { kind: 'text', answer: el ? el.value.trim() : '', drawing: null };
    },

    isDraftEmpty(d) {
        return d.kind === 'draw' ? d.drawing.length === 0 : !d.answer;
    },

    sameAnswer(d, p) {
        const kind = p.kind === 'draw' ? 'draw' : 'text';
        if (d.kind !== kind) return false;
        return kind === 'draw' ? canon(d.drawing) === canon(p.drawing || []) : d.answer === p.answer;
    },

    renderRoom() {
        document.getElementById('display-room-id').textContent = this.roomId;
        document.getElementById('display-name').textContent = this.playerName;
        document.querySelectorAll('.round-no').forEach(el => { el.textContent = this.state.round; });

        const q = this.currentQuestion();
        ['answer-question', 'reveal-question'].forEach(id => {
            const el = document.getElementById(id);
            el.textContent = q || '（お題なし）';
            el.classList.toggle('empty', !q);
        });

        this.renderStage();

        // ラウンドが変わったら回答欄を初期化
        const answerEl = document.getElementById('answerInput');
        if (this.renderedRound !== this.state.round) {
            const me = this.me();
            const mine = this.hasAnswer(me) ? me : null;
            if (mine && mine.kind === 'draw') {
                answerEl.value = '';
                this.pad.setStrokes(mine.drawing);
                this.answerMode = 'draw';
            } else {
                answerEl.value = mine ? mine.answer : '';
                this.pad.setStrokes([]);
                if (mine) this.answerMode = 'text';
            }
            this.renderAnswerMode();
            this.renderedRound = this.state.round;
        }

        const players = this.activePlayers();
        const answered = players.filter(p => this.hasAnswer(p));
        const opened = answered.filter(p => this.isOpen(p.name));

        // お題画面: メンバー一覧
        document.getElementById('member-count').textContent = players.length;
        this.renderMembers('member-list', players, () => true);
        // 回答画面: 回答状況
        document.getElementById('answer-progress').textContent = `回答済み ${answered.length} / ${players.length} 人`;
        this.renderMembers('answer-members', players, p => this.hasAnswer(p), p => (this.hasAnswer(p) ? '✔ ' : '… '));

        document.getElementById('progress-text').textContent =
            `回答済み ${answered.length} / ${players.length} 人　・　オープン ${opened.length} 枚`;

        document.getElementById('reveal-all-btn').disabled = answered.length === 0 || opened.length === answered.length;
        document.getElementById('hide-all-btn').disabled = opened.length === 0;

        this.renderMyStatus();
        this.renderCards(players);
    },

    renderStage() {
        const stage = this.currentStage();
        const order = ['question', 'answer', 'reveal'];
        document.querySelectorAll('#steps li').forEach(li => {
            const i = order.indexOf(li.dataset.stage);
            li.classList.toggle('active', li.dataset.stage === stage);
            li.classList.toggle('done', i < order.indexOf(stage));
        });
        if (this.renderedStage === stage) return;

        order.forEach(name => {
            const el = document.getElementById('screen-' + name);
            el.hidden = name !== stage;
            el.classList.remove('enter');
        });
        const shown = document.getElementById('screen-' + stage);
        void shown.offsetWidth; // アニメーションを再生し直す
        shown.classList.add('enter');
        if (this.renderedStage) window.scrollTo({ top: 0, behavior: 'smooth' });
        this.renderedStage = stage;

        // 回答画面に戻ってきたらキャンバスの大きさを合わせ直す
        if (stage === 'answer') this.renderAnswerMode();
    },

    renderMembers(id, players, isOk, prefix = () => '') {
        const ul = document.getElementById(id);
        ul.textContent = '';
        players.forEach(p => {
            const li = document.createElement('li');
            li.className = 'member-chip';
            li.classList.toggle('ok', isOk(p));
            li.classList.toggle('me', p.name === this.playerName);
            li.textContent = prefix(p) + p.name + (p.name === this.playerName ? '（あなた）' : '');
            ul.appendChild(li);
        });
    },

    renderMyStatus() {
        const me = this.me();
        const answerEl = document.getElementById('answerInput');
        const btn = document.getElementById('submit-btn');
        const status = document.getElementById('my-answer-status');
        if (!answerEl) return;

        const myOpen = this.isOpen(this.playerName);
        answerEl.disabled = myOpen;
        if (this.pad) {
            this.pad.enabled = !myOpen;
            document.getElementById('drawCanvas').classList.toggle('locked', myOpen);
        }
        document.querySelectorAll('#mode-tabs .mode-tab, #draw-area button').forEach(b => { b.disabled = myOpen; });
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
            if (!this.sameAnswer(this.draftAnswer(), me)) {
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
            const isDrawing = open && p.kind === 'draw';
            const key = open ? `${p.kind || 'text'}:${p.at}` : '';
            if (ans.dataset.key !== key) {
                ans.dataset.key = key;
                ans.textContent = '';
                if (isDrawing) {
                    ans.appendChild(FlipDraw.toSVG(p.drawing));
                } else if (open) {
                    ans.textContent = p.answer;
                }
            }
            ans.classList.toggle('drawing', isDrawing);
            ans.classList.toggle('long', !isDrawing && open && (p.answer || '').length > 20);
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
        this.serverEtag = null;
        this.serverState = null;
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
        this.setStage('answer');
        input.value = '';
        this.render();
        this.sync();
    },

    goStage(name) {
        this.setStage(name);
        this.render();
        this.sync();
    },

    goReveal() {
        const players = this.activePlayers();
        const waiting = players.filter(p => !this.hasAnswer(p));
        if (waiting.length > 0) {
            const names = waiting.map(p => p.name).join('、');
            if (!confirm(`まだ回答していない人がいます（${names}）。\nみんなのフリップへ進みますか？`)) return;
        }
        this.goStage('reveal');
    },

    nextRound() {
        const answered = this.activePlayers().filter(p => this.hasAnswer(p));
        const closed = answered.filter(p => !this.isOpen(p.name));
        if (closed.length > 0 && !confirm(`まだオープンしていないフリップが${closed.length}枚あります。\n次のお題へ進みますか？`)) return;
        this.startNewRound();
        this.render();
        this.sync();
    },

    startNewRound() {
        this.state.round += 1;
        this.state.reveal = {};
        this.setStage('question');
        // 自分の回答だけは自分で消しておく (他の人の分は round が古いので自動的に無効になる)
        const me = this.me();
        if (me) {
            this.state.players[this.playerName] = {
                ...me, kind: 'text', answer: '', drawing: null, submitted: false, round: this.state.round, at: this.now()
            };
        }
    },

    submitAnswer() {
        const draft = this.draftAnswer();
        if (this.isDraftEmpty(draft)) {
            alert(draft.kind === 'draw' ? '手書きで回答を書いてください！' : '回答を入力してください！');
            return;
        }
        if (this.isOpen(this.playerName)) return;
        const me = this.me() || { joinedAt: this.now() };
        this.state.players[this.playerName] = {
            ...me, ...draft, submitted: true, round: this.state.round, left: false, at: this.now()
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
    // 前回から変化がなければ、サーバーは中身を送らず unchanged だけ返す
    async fetchState() {
        try {
            let url = `${API_URL}?roomId=${encodeURIComponent(this.roomId)}`;
            if (this.serverEtag && this.serverState) url += `&since=${encodeURIComponent(this.serverEtag)}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.setSyncStatus('オンライン');
            if (data && data.unchanged && this.serverState) return this.serverState;
            this.serverEtag = (data && data.etag) || null;
            this.serverState = (data && data.state) || null;
            return this.serverState;
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
            const data = await res.json();
            this.serverEtag = data.etag || null;
            this.serverState = data.state || null;
            return this.serverState;
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
