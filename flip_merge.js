/**
 * フリップツールの状態マージ処理
 * ブラウザ (flip.js) とサーバー (netlify/functions/flip.mjs) の両方で使います。
 *
 * 各項目に更新時刻 (at) を持たせ、マージ時は新しい方を採用します (Last Write Wins)。
 * 同時に書き込みがあっても、全員の変更が最終的にそろいます。
 */
(function (root) {
    function emptyState() {
        return { round: 1, question: null, players: {}, reveal: {} };
    }

    function normalize(s) {
        const base = emptyState();
        if (!s || typeof s !== 'object') return base;
        return {
            round: Number(s.round) || 1,
            question: s.question && typeof s.question === 'object' ? s.question : null,
            players: s.players && typeof s.players === 'object' ? s.players : {},
            reveal: s.reveal && typeof s.reveal === 'object' ? s.reveal : {}
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

    function mergeMaps(a, b) {
        const out = {};
        new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => {
            out[k] = lww(a[k], b[k]);
        });
        return out;
    }

    function mergeState(x, y) {
        const a = normalize(x);
        const b = normalize(y);
        const round = Math.max(a.round, b.round);
        const reveal = mergeMaps(a.reveal, b.reveal);
        // 古いラウンドのオープン情報は不要なので捨てる
        Object.keys(reveal).forEach(k => {
            if ((reveal[k].round || 0) < round) delete reveal[k];
        });
        return {
            round,
            question: lww(a.question, b.question),
            players: mergeMaps(a.players, b.players),
            reveal
        };
    }

    const api = { emptyState, normalize, canon, mergeState };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.FlipMerge = api;
    }
})(typeof self !== 'undefined' ? self : this);
