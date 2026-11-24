/**
 * フリップの回答を PNG 画像にして保存する
 *
 * 画面を撮影するのではなく、canvas に描き直して作ります (外部ライブラリ不要)。
 *   FlipImage.saveCard(player, { question, round, index }) … 1人分の回答 (index はカードの並び順)
 *   FlipImage.saveBoard(players, { question, round }) … みんなの回答をまとめて
 *   player = { name, kind: 'text' | 'draw', answer, drawing }
 */
const FlipImage = (() => {
    const FONT = '"M PLUS Rounded 1c", sans-serif';
    const COLORS = {
        bg1: '#fff4f7',
        bg2: '#eef8ff',
        text: '#403a4d',
        muted: '#8b8499',
        primary: '#ff6b8b',
        name: '#ffc94d',
        card: '#ffffff',
        line: '#efe7f3'
    };
    const CARD_W = 520;
    const CARD_H = 416; // 横:縦 = 5:4

    function font(size, weight = 900) {
        return `${weight} ${size}px ${FONT}`;
    }

    // Webフォントの読み込みを待つ (読み込み前に描くと別のフォントになるため)
    async function ready() {
        if (!document.fonts) return;
        try {
            await Promise.all([document.fonts.load(font(40, 900)), document.fonts.load(font(20, 700))]);
        } catch (e) { /* フォントがなくても標準フォントで描く */ }
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // 1文字ずつ詰めて折り返す (日本語はどこでも改行できるため)
    function wrap(ctx, text, maxW) {
        const lines = [];
        String(text).split('\n').forEach(para => {
            let line = '';
            for (const ch of para) {
                if (line && ctx.measureText(line + ch).width > maxW) {
                    lines.push(line);
                    line = ch;
                } else {
                    line += ch;
                }
            }
            lines.push(line);
        });
        return lines;
    }

    // 枠に収まるいちばん大きな文字サイズで、中央にそろえて描く
    function fitText(ctx, text, x, y, w, h, { max = 200, min = 12, weight = 900, color = COLORS.text, lineHeight = 1.25 } = {}) {
        let lo = min, hi = max, best = null;
        while (lo <= hi) {
            const size = Math.floor((lo + hi) / 2);
            ctx.font = font(size, weight);
            const lines = wrap(ctx, text, w);
            const totalH = lines.length * size * lineHeight;
            const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
            if (totalH <= h && widest <= w) {
                best = { size, lines };
                lo = size + 1;
            } else {
                hi = size - 1;
            }
        }
        if (!best) {
            ctx.font = font(min, weight);
            best = { size: min, lines: wrap(ctx, text, w) };
        }
        ctx.font = font(best.size, weight);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lh = best.size * lineHeight;
        const top = y + (h - best.lines.length * lh) / 2 + lh / 2;
        best.lines.forEach((line, i) => ctx.fillText(line, x + w / 2, top + i * lh));
    }

    function drawBackground(ctx, w, h) {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, COLORS.bg1);
        g.addColorStop(1, COLORS.bg2);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    // 1枚のカードを描く
    function drawCard(ctx, x, y, w, h, p) {
        const r = Math.round(w * 0.05);
        // 影
        ctx.save();
        ctx.shadowColor = 'rgba(233, 85, 122, 0.18)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = COLORS.card;
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundRect(ctx, x, y, w, h, r);
        ctx.clip();
        // 名前の帯
        const barH = Math.round(h * 0.15);
        ctx.fillStyle = COLORS.name;
        ctx.fillRect(x, y, w, barH);
        fitText(ctx, p.name, x + w * 0.05, y, w * 0.9, barH, { max: Math.round(barH * 0.55), weight: 900 });

        // 回答
        const pad = w * 0.06;
        const ax = x + pad, ay = y + barH + pad * 0.8, aw = w - pad * 2, ah = h - barH - pad * 1.6;
        if (p.kind === 'draw') {
            const drawing = FlipDraw.sanitize(p.drawing);
            const scale = Math.min(aw / FlipDraw.W, ah / FlipDraw.H);
            const dw = FlipDraw.W * scale, dh = FlipDraw.H * scale;
            ctx.translate(ax + (aw - dw) / 2, ay + (ah - dh) / 2);
            ctx.scale(scale, scale);
            FlipDraw.paint(ctx, drawing);
        } else {
            fitText(ctx, p.answer || '', ax, ay, aw, ah, { max: Math.round(ah * 0.8) });
        }
        ctx.restore();

        ctx.save();
        roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function drawHeader(ctx, w, h, { question, round }) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(26, 800);
        ctx.fillStyle = COLORS.primary;
        ctx.fillText(round ? `第${round}問` : 'お題', w / 2, 44);
        fitText(ctx, question || '（お題なし）', 60, 64, w - 120, h - 80, { max: 56, weight: 900 });
        ctx.restore();
    }

    function drawFooter(ctx, w, h) {
        ctx.save();
        ctx.font = font(20, 800);
        ctx.fillStyle = COLORS.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('ゆるすと！ フリップ', w - 32, h - 28);
        ctx.restore();
    }

    function download(canvas, filename) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('画像を作れませんでした'));
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                resolve(blob);
            }, 'image/png');
        });
    }

    // ファイル名はブラウザによって日本語が使えないことがあるので、英数字だけにする
    //   例: flip_20261124_q3_all.png / flip_20261124_q3_2.png
    function fileName(round, suffix) {
        const d = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        return `flip_${ymd}_q${round || 1}_${suffix}.png`;
    }

    function cols(n) {
        if (n <= 1) return 1;
        if (n <= 4) return 2;
        if (n <= 9) return 3;
        return 4;
    }

    // みんなの回答を1枚の画像にする (canvas を返す)
    async function renderBoard(players, info = {}) {
        await ready();
        const c = cols(players.length);
        const rows = Math.ceil(players.length / c);
        const gap = 32, margin = 48, headerH = 190, footerH = 56;
        const w = margin * 2 + c * CARD_W + (c - 1) * gap;
        const h = headerH + rows * CARD_H + (rows - 1) * gap + footerH + margin / 2;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        drawBackground(ctx, w, h);
        drawHeader(ctx, w, headerH, info);
        // 最後の行は中央にそろえる
        players.forEach((p, i) => {
            const row = Math.floor(i / c);
            const inRow = Math.min(c, players.length - row * c);
            const rowW = inRow * CARD_W + (inRow - 1) * gap;
            const x = (w - rowW) / 2 + (i % c) * (CARD_W + gap);
            const y = headerH + row * (CARD_H + gap);
            drawCard(ctx, x, y, CARD_W, CARD_H, p);
        });
        drawFooter(ctx, w, h);
        return canvas;
    }

    // 1人分の回答を画像にする (canvas を返す)
    async function renderCard(p, info = {}) {
        await ready();
        const margin = 48, headerH = 170, footerH = 56;
        const cw = 960, ch = 768;
        const w = cw + margin * 2;
        const h = headerH + ch + footerH + margin / 2;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        drawBackground(ctx, w, h);
        drawHeader(ctx, w, headerH, info);
        drawCard(ctx, margin, headerH, cw, ch, p);
        drawFooter(ctx, w, h);
        return canvas;
    }

    async function saveBoard(players, info = {}) {
        const canvas = await renderBoard(players, info);
        return download(canvas, fileName(info.round, 'all'));
    }

    async function saveCard(p, info = {}) {
        const canvas = await renderCard(p, info);
        return download(canvas, fileName(info.round, info.index || 1));
    }

    return { renderBoard, renderCard, saveBoard, saveCard };
})();
