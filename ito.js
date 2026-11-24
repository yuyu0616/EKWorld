/**
 * ito (イト) ゲームフロントエンドロジック
 *
 * 同期には Netlify Functions (/api/ito) と Netlify Blobs を使います。
 * カード配布や判定はサーバー側 (netlify/functions/ito.mjs) で行います。
 */
const API_URL = '/api/ito';
const SYNC_INTERVAL_MS = 4000;

const itoApp = {
    state: {
        roomId: '',
        playerName: '',
        players: [], // { name: 'A', card: 42, played: false }
        theme: '',
        phase: 'lobby', // lobby, waiting, playing, result
        mistakes: 0,
        lastUpdated: 0
    },
    syncInterval: null,
    isSyncing: false,
    currentPhase: '',
    localMistakes: 0,

    init() {
        this.render();
        // 過去に入力した名前を復元
        const savedName = localStorage.getItem('itoPlayerName');
        if (savedName && document.getElementById('playerName')) {
            document.getElementById('playerName').value = savedName;
        }
    },

    // --- 画面描画 ---
    render() {
        // フェーズが変わった時だけ画面全体を再構築する（入力中のフォーカス外れを防ぐため）
        if (this.currentPhase !== this.state.phase) {
            const container = document.getElementById('ito-container');
            container.innerHTML = ''; // クリア
            
            let templateId = 'tpl-lobby';
            if (this.state.phase === 'waiting') templateId = 'tpl-waiting';
            if (this.state.phase === 'playing') templateId = 'tpl-playing';
            if (this.state.phase === 'result') templateId = 'tpl-result';

            const template = document.getElementById(templateId);
            container.appendChild(template.content.cloneNode(true));
            
            this.currentPhase = this.state.phase;
        }

        this.bindData();
    },

    bindData() {
        // 待機画面
        if (this.state.phase === 'waiting') {
            document.getElementById('display-room-id').innerText = this.state.roomId;
            const playersUl = document.getElementById('waiting-players');
            playersUl.innerHTML = '';
            this.state.players.forEach(p => {
                const li = document.createElement('li');
                li.className = 'player-chip';
                li.innerText = p.name;
                playersUl.appendChild(li);
            });
        }
        
        // プレイ画面
        if (this.state.phase === 'playing') {
            document.getElementById('display-theme').innerText = this.state.theme;
            
            if (this.state.mistakes > this.localMistakes) {
                alert("失敗！もっと小さい数字を持っている人がいました😭");
                this.localMistakes = this.state.mistakes;
            }
            
            // 自分のカードを見つける
            const me = this.state.players.find(p => p.name === this.state.playerName);
            if (me) {
                document.getElementById('my-card-number').innerText = me.card;
                const btn = document.getElementById('play-card-btn');
                if (me.played) {
                    btn.innerText = 'カードを出しました';
                    btn.disabled = true;
                    btn.style.backgroundColor = '#94a3b8';
                } else {
                    btn.innerText = 'カードを場に出す！';
                    btn.disabled = false;
                    btn.style.backgroundColor = 'var(--primary)';
                }
            }
            
            this.renderPlayedCards('played-cards-area');
            
            const playedCount = this.state.players.filter(p => p.played).length;
            const total = this.state.players.length;
            document.getElementById('play-status-text').innerText = `${playedCount} / ${total} 人がカードを出しました`;
        }

        // リザルト画面
        if (this.state.phase === 'result') {
            document.getElementById('result-theme').innerText = this.state.theme;
            this.renderPlayedCards('result-cards-area', true);

            const banner = document.getElementById('result-banner');
            if (this.state.mistakes === 0) {
                banner.className = 'result-banner success';
                banner.innerText = '大成功！！🎉';
            } else {
                banner.className = 'result-banner fail';
                banner.innerText = `失敗...😭 (ミス: ${this.state.mistakes}回)`;
            }
        }
    },

    renderPlayedCards(elementId, showAll = false) {
        const area = document.getElementById(elementId);
        area.innerHTML = '';
        
        // プレイ順でソートして表示
        let cards = this.state.players.filter(p => p.played);
        if (showAll) {
            cards = this.state.players; // リザルトでは出していない人も表示
        }
        
        cards.sort((a, b) => (a.playOrder || 999) - (b.playOrder || 999));

        cards.forEach(p => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'played-card';
            if (!p.played && showAll) {
                cardDiv.style.opacity = '0.5';
            }
            cardDiv.innerHTML = `
                <div class="played-card-number">${p.card}</div>
                <div class="played-card-player">${p.name}</div>
            `;
            area.appendChild(cardDiv);
        });
    },

    // --- アクション ---

    async joinRoom() {
        const name = document.getElementById('playerName').value.trim();
        const roomId = document.getElementById('roomId').value.trim();

        if (!name || !roomId) {
            alert("名前とルームIDを入力してください！");
            return;
        }

        this.state.playerName = name;
        this.state.roomId = roomId;
        localStorage.setItem('itoPlayerName', name);

        const state = await this.sendAction('join', { name });
        if (!state) {
            alert("サーバーに接続できませんでした。時間をおいてもう一度お試しください。");
            return;
        }
        this.applyState(state);
        this.render();
        this.startSync();
    },

    async startGame() {
        const theme = document.getElementById('themeInput').value.trim();
        if (!theme) {
            alert("お題を入力してください！");
            return;
        }

        this.localMistakes = 0;
        const state = await this.sendAction('start', { theme });
        if (state) {
            this.applyState(state);
            this.render();
        }
    },

    async playCard() {
        const me = this.state.players.find(p => p.name === this.state.playerName);
        if (!me || me.played || this.state.phase !== 'playing') return;

        const btn = document.getElementById('play-card-btn');
        if (btn) {
            btn.innerText = '判定中...';
            btn.disabled = true;
        }

        // 判定はサーバーで行う。
        // 自分の画面だけ先に結果が出てしまうのを防ぐため、ここでは render せず、
        // 定期同期 (ポーリング) で全員が同じタイミングで最新状態を受け取る
        const state = await this.sendAction('play', { name: this.state.playerName });
        if (!state && btn) {
            btn.innerText = 'カードを場に出す！';
            btn.disabled = false;
        }
    },

    async resetGame() {
        this.localMistakes = 0;
        const state = await this.sendAction('reset');
        if (state) {
            this.applyState(state);
            this.render();
        }
    },

    // --- 通信処理 ---

    applyState(state) {
        this.state.phase = state.phase;
        this.state.theme = state.theme;
        this.state.players = state.players;
        this.state.mistakes = state.mistakes !== undefined ? state.mistakes : 0;
    },

    startSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(async () => {
            // タブが裏にある間は通信しない (関数の呼び出し回数を節約)
            if (this.isSyncing || document.hidden) return;
            const state = await this.fetchState();
            if (state) {
                this.applyState(state);
                this.render();
            }
        }, SYNC_INTERVAL_MS);
    },

    async fetchState() {
        this.setSyncStatus(true);
        try {
            const res = await fetch(`${API_URL}?roomId=${encodeURIComponent(this.state.roomId)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.setSyncStatus(false);
            return data || null;
        } catch (e) {
            console.error(e);
            this.setSyncStatus(false);
            return null;
        }
    },

    // 成功: 新しい状態 / 失敗: null
    async sendAction(action, params = {}) {
        this.setSyncStatus(true);
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.state.roomId, action, ...params })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.setSyncStatus(false);
            return data;
        } catch (e) {
            console.error(e);
            this.setSyncStatus(false);
            return null;
        }
    },

    setSyncStatus(isSyncing) {
        this.isSyncing = isSyncing;
        const el = document.getElementById('sync-status');
        if (isSyncing) {
            document.body.classList.add('syncing');
            el.innerText = '同期中...';
        } else {
            document.body.classList.remove('syncing');
            el.innerText = 'オンライン';
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    itoApp.init();
});
