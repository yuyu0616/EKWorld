/**
 * ito (イト) ゲームフロントエンドロジック
 * 
 * ユーザー準備: 以下の GAS_URL に、デプロイしたGoogle Apps ScriptのURLを貼り付けてください。
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbwm339wSwgi1LzAToywYfv8M6fQZ_YZZ8cJWU_bDY4s_KQI4-CCb7T2jubgPOomukF1/exec"; 
// 例: "https://script.google.com/macros/s/AKfycb.../exec"

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

        if (GAS_URL === "YOUR_GAS_WEBAPP_URL_HERE") {
            alert("開発者へ: GAS_URLが設定されていません。ito.jsを編集してURLを設定してください。");
            return;
        }

        this.state.playerName = name;
        this.state.roomId = roomId;
        localStorage.setItem('itoPlayerName', name);

        // 状態を取得
        const state = await this.fetchState();
        
        if (state) {
            this.state.phase = state.phase;
            this.state.theme = state.theme;
            this.state.players = state.players;
            
            // 自分がまだいなければ追加
            if (!this.state.players.find(p => p.name === name)) {
                this.state.players.push({ name: name, card: 0, played: false, playOrder: 0 });
                await this.pushState();
            }
        } else {
            // 新規作成
            this.state.phase = 'waiting';
            this.state.players = [{ name: name, card: 0, played: false, playOrder: 0 }];
            await this.pushState();
        }

        this.render();
        this.startSync();
    },

    async startGame() {
        const theme = document.getElementById('themeInput').value.trim();
        if (!theme) {
            alert("お題を入力してください！");
            return;
        }

        // カードを配る (1〜100の重複しない数字)
        const numbers = Array.from({length: 100}, (_, i) => i + 1);
        // シャッフル
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }

        this.state.players.forEach((p, index) => {
            p.card = numbers[index];
            p.played = false;
            p.playOrder = 0;
        });

        this.state.theme = theme;
        this.state.phase = 'playing';
        this.state.mistakes = 0;
        this.localMistakes = 0;
        
        await this.pushState();
        this.render();
    },

    async playCard() {
        const me = this.state.players.find(p => p.name === this.state.playerName);
        if (!me || me.played || this.state.phase !== 'playing') return;

        const btn = document.getElementById('play-card-btn');
        if (btn) {
            btn.innerText = '判定中...';
            btn.disabled = true;
        }

        // 自分の画面だけ先に結果が出てしまうのを防ぐため、ローカルのstateは書き換えずにサーバーへ送信する
        const newPlayers = JSON.parse(JSON.stringify(this.state.players));
        const newMe = newPlayers.find(p => p.name === this.state.playerName);

        // 即時判定：他の人の手札に、これより小さい数字がないかチェック
        let mistake = false;
        newPlayers.forEach(p => {
            if (!p.played && p.card < newMe.card) {
                mistake = true;
                p.played = true; // 強制オープン
            }
        });

        const maxOrder = newPlayers.reduce((max, p) => Math.max(max, p.playOrder || 0), 0);
        let newMistakes = this.state.mistakes;

        if (mistake) {
            newMistakes++;
            // 強制オープンされたカードに順番を振る
            let order = maxOrder + 1;
            const forced = newPlayers.filter(p => p.played && !p.playOrder && p.name !== newMe.name).sort((a,b) => a.card - b.card);
            forced.forEach(p => p.playOrder = order++);
            
            newMe.played = true;
            newMe.playOrder = order;
        } else {
            newMe.played = true;
            newMe.playOrder = maxOrder + 1;
        }

        // 終了判定
        const unplayed = newPlayers.filter(p => !p.played);
        const newPhase = unplayed.length === 0 ? 'result' : this.state.phase;
        
        const payload = {
            roomId: this.state.roomId,
            gameState: {
                phase: newPhase,
                theme: this.state.theme,
                players: newPlayers,
                mistakes: newMistakes
            }
        };

        try {
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            // ここで render はしない！
            // 1秒ごとの startSync (ポーリング) によって、AさんもBさんも同時に最新データを取得して画面が切り替わる
        } catch (e) {
            console.error(e);
            if (btn) {
                btn.innerText = 'カードを場に出す！';
                btn.disabled = false;
            }
        }
    },

    async resetGame() {
        this.state.phase = 'waiting';
        this.state.theme = '';
        this.localMistakes = 0;
        this.state.players.forEach(p => {
            p.card = 0;
            p.played = false;
            p.playOrder = 0;
        });
        await this.pushState();
        this.render();
    },

    // --- 通信処理 ---

    startSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(async () => {
            if (this.isSyncing) return;
            const state = await this.fetchState();
            if (state) {
                // 自分がカードを出したかどうかのローカル状態を優先したい場合などもあるが、簡易的に全体を上書き
                this.state.phase = state.phase;
                this.state.theme = state.theme;
                this.state.players = state.players;
                this.state.mistakes = state.mistakes !== undefined ? state.mistakes : 0;
                this.render();
            }
        }, 1000); // 1秒ごとに同期（よりリアルタイムに）
    },

    async fetchState() {
        this.setSyncStatus(true);
        try {
            const res = await fetch(`${GAS_URL}?roomId=${encodeURIComponent(this.state.roomId)}`);
            const data = await res.json();
            this.setSyncStatus(false);
            if (data && data.status !== "not_found" && !data.error) {
                // 文字列として保存されている場合はパース
                return typeof data === 'string' ? JSON.parse(data) : data;
            }
            return null;
        } catch (e) {
            console.error(e);
            this.setSyncStatus(false);
            return null;
        }
    },

    async pushState() {
        this.setSyncStatus(true);
        const payload = {
            roomId: this.state.roomId,
            gameState: {
                phase: this.state.phase,
                theme: this.state.theme,
                players: this.state.players,
                mistakes: this.state.mistakes
            }
        };
        try {
            await fetch(GAS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain', // CORS回避
                },
                body: JSON.stringify(payload)
            });
            this.setSyncStatus(false);
        } catch (e) {
            console.error(e);
            this.setSyncStatus(false);
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
