/**
 * フリップツールの状態マージ処理
 * ブラウザ (flip.js) とサーバー (netlify/functions/flip.mjs) の両方で使います。
 *
 * 各項目に更新時刻 (at) を持たせ、マージ時は新しい方を採用します (Last Write Wins)。
 * 同時に書き込みがあっても、全員の変更が最終的にそろいます。
 */
(function (root) {
    function emptyState() {
        return { gen: 0, round: 1, question: null, stage: null, owner: null, players: {}, reveal: {}, seen: {} };
    }

    function normalize(s) {
        const base = emptyState();
        if (!s || typeof s !== 'object') return base;
        return {
            gen: Number(s.gen) || 0,
            round: Number(s.round) || 1,
            question: s.question && typeof s.question === 'object' ? s.question : null,
            stage: s.stage && typeof s.stage === 'object' ? s.stage : null,
            owner: s.owner && typeof s.owner === 'object' ? s.owner : null,
            players: s.players && typeof s.players === 'object' ? s.players : {},
            reveal: s.reveal && typeof s.reveal === 'object' ? s.reveal : {},
            seen: s.seen && typeof s.seen === 'object' ? s.seen : {}
        };
    }

    // キー順に依存しない文字列化 (比較用)
    function canon(v) {
        if (v === null || typeof v !== 'object') return JSON.stringify(v);
        if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
        return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    }

    function lww(a, b) {
        if (!a) return b || null;
        if (!b) return a;
        if ((a.at || 0) !== (b.at || 0)) return (a.at || 0) > (b.at || 0) ? a : b;
        return canon(a) >= canon(b) ? a : b;
    }

    // ラウンドが新しい方を優先し、同じラウンドなら新しい方を採用
    function lwwRound(a, b) {
        if (a && b && (a.round || 0) !== (b.round || 0)) return (a.round || 0) > (b.round || 0) ? a : b;
        return lww(a, b);
    }

    function mergeMaps(a, b) {
        const out = {};
        new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => {
            out[k] = lww(a[k], b[k]);
        });
        return out;
    }

    /**
     * gen はルームの「何代目か」。全員がいなくなってルームを作り直すたびに 1 増える。
     * 代が違う場合は新しい代の状態だけを残す (古い画面から前の状態が復活しないように)
     */
    function mergeState(x, y) {
        const a = normalize(x);
        const b = normalize(y);
        if (a.gen !== b.gen) {
            const newer = a.gen > b.gen ? a : b;
            return mergeSameGen(newer, newer);
        }
        return mergeSameGen(a, b);
    }

    function mergeSameGen(a, b) {
        const round = Math.max(a.round, b.round);
        const reveal = mergeMaps(a.reveal, b.reveal);
        // 古いラウンドのオープン情報は不要なので捨てる
        Object.keys(reveal).forEach(k => {
            if ((reveal[k].round || 0) < round) delete reveal[k];
        });
        const players = mergeMaps(a.players, b.players);
        // 古いラウンドの回答は中身を消す (手書きデータでサイズが膨らまないように)
        Object.keys(players).forEach(k => {
            const p = players[k];
            if (p && (p.round || 0) < round && (p.submitted || p.answer || p.drawing)) {
                players[k] = { ...p, kind: 'text', answer: '', drawing: null, submitted: false };
            }
        });
        // 最後に画面を開いていた時刻 (オンライン判定用) は大きい方を採用
        // players とは別に持つので、削除 (left) を上書きしてしまうことがない
        const seen = {};
        new Set([...Object.keys(a.seen), ...Object.keys(b.seen)]).forEach(k => {
            seen[k] = Math.max(Number(a.seen[k]) || 0, Number(b.seen[k]) || 0);
        });
        return {
            gen: a.gen,
            round,
            question: lww(a.question, b.question),
            stage: lwwRound(a.stage, b.stage),
            owner: lww(a.owner, b.owner),
            players,
            reveal,
            seen
        };
    }

    const api = { emptyState, normalize, canon, mergeState };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.FlipMerge = api;
    }
})(typeof self !== 'undefined' ? self : this);
