/**
 * フリップツールの手書き機能
 *
 * 手書きの回答は画像ではなく「線の座標」として保存します (サイズが小さく、どの大きさでもくっきり表示できる)。
 *   drawing = [{ c: 色, w: 太さ, p: [x0, y0, x1, y1, ...] }, ...]
 *   座標は 横400 × 縦300 の範囲の整数です。
 */
const FlipDraw = (() => {
    const W = 400;
    const H = 300;
    const COLORS = ['#333333', '#ef4444', '#3b82f6', '#16a34a'];
    const WIDTHS = [4, 8, 14];
    const MAX_POINTS = 3000;
    const MIN_DIST = 2;

    // 他の人から届いたデータを安全な形にそろえる
    function sanitize(drawing) {
        if (!Array.isArray(drawing)) return [];
        return drawing
            .filter(s => s && COLORS.includes(s.c) && WIDTHS.includes(s.w) && Array.isArray(s.p) && s.p.length >= 2)
            .map(s => {
                const p = s.p.slice(0, s.p.length - (s.p.length % 2)).map((v, i) => {
                    const n = Math.round(Number(v)) || 0;
                    return Math.max(0, Math.min(i % 2 === 0 ? W : H, n));
                });
                return { c: s.c, w: s.w, p };
            });
    }

    function countPoints(drawing) {
        return drawing.reduce((sum, s) => sum + s.p.length / 2, 0);
    }

    // 点の列をなめらかな線にする (canvas と SVG で同じ形になるように共通化)
    function trace(p, ops) {
        const n = p.length / 2;
        ops.move(p[0], p[1]);
        if (n === 1) {
            ops.line(p[0], p[1]);
            return;
        }
        for (let i = 1; i < n - 1; i++) {
            const x = p[i * 2], y = p[i * 2 + 1];
            const nx = p[i * 2 + 2], ny = p[i * 2 + 3];
            ops.quad(x, y, (x + nx) / 2, (y + ny) / 2);
        }
        ops.line(p[n * 2 - 2], p[n * 2 - 1]);
    }

    function pathData(p) {
        const parts = [];
        const f = v => Math.round(v * 10) / 10;
        trace(p, {
            move: (x, y) => parts.push(`M${f(x)} ${f(y)}`),
            line: (x, y) => parts.push(`L${f(x)} ${f(y)}`),
            quad: (cx, cy, x, y) => parts.push(`Q${f(cx)} ${f(cy)} ${f(x)} ${f(y)}`)
        });
        return parts.join('');
    }

    // カード表示用の SVG を作る
    function toSVG(drawing) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('class', 'drawing-svg');
        sanitize(drawing).forEach(s => {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', pathData(s.p));
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', s.c);
            path.setAttribute('stroke-width', String(s.w));
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);
        });
        return svg;
    }

    /**
     * canvas に線を描く (ctx は 横400×縦300 の座標系に合わせておく)
     * 手書き欄と、画像保存の両方で使う
     */
    function paint(ctx, drawing) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawing.forEach(s => {
            ctx.strokeStyle = s.c;
            ctx.lineWidth = s.w;
            if (s.p.length === 2) {
                ctx.fillStyle = s.c;
                ctx.beginPath();
                ctx.arc(s.p[0], s.p[1], s.w / 2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }
            ctx.beginPath();
            trace(s.p, {
                move: (x, y) => ctx.moveTo(x, y),
                line: (x, y) => ctx.lineTo(x, y),
                quad: (cx, cy, x, y) => ctx.quadraticCurveTo(cx, cy, x, y)
            });
            ctx.stroke();
        });
        ctx.restore();
    }

    /**
     * 手書き用のキャンバス
     * onChange(strokes) は線が確定するたびに呼ばれる
     */
    class Pad {
        constructor(canvas, { onChange, onLimit } = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.onChange = onChange || (() => {});
            this.onLimit = onLimit || (() => {});
            this.strokes = [];
            this.current = null;
            this.color = COLORS[0];
            this.width = WIDTHS[1];
            this.enabled = true;

            canvas.style.touchAction = 'none';
            canvas.addEventListener('pointerdown', e => this.down(e));
            canvas.addEventListener('pointermove', e => this.move(e));
            canvas.addEventListener('pointerup', e => this.up(e));
            canvas.addEventListener('pointercancel', e => this.up(e));

            this.resize();
            if (window.ResizeObserver) {
                new ResizeObserver(() => this.resize()).observe(canvas);
            } else {
                window.addEventListener('resize', () => this.resize());
            }
        }

        resize() {
            const rect = this.canvas.getBoundingClientRect();
            if (!rect.width) return;
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = Math.round(rect.width * dpr);
            this.canvas.height = Math.round(rect.width * (H / W) * dpr);
            this.redraw();
        }

        toLocal(e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.round(((e.clientX - rect.left) / rect.width) * W);
            const y = Math.round(((e.clientY - rect.top) / rect.height) * H);
            return [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))];
        }

        down(e) {
            if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
            if (countPoints(this.strokes) >= MAX_POINTS) {
                this.onLimit();
                return;
            }
            e.preventDefault();
            this.canvas.setPointerCapture(e.pointerId);
            const [x, y] = this.toLocal(e);
            this.current = { c: this.color, w: this.width, p: [x, y] };
            this.redraw();
        }

        move(e) {
            if (!this.current) return;
            e.preventDefault();
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            let total = countPoints(this.strokes) + this.current.p.length / 2;
            for (const ev of (events.length ? events : [e])) {
                if (total >= MAX_POINTS) {
                    this.onLimit();
                    break;
                }
                const [x, y] = this.toLocal(ev);
                const p = this.current.p;
                const lx = p[p.length - 2], ly = p[p.length - 1];
                if (Math.hypot(x - lx, y - ly) >= MIN_DIST) {
                    p.push(x, y);
                    total++;
                }
            }
            this.redraw();
        }

        up() {
            if (!this.current) return;
            this.strokes.push(this.current);
            this.current = null;
            this.redraw();
            this.onChange(this.strokes);
        }

        undo() {
            this.strokes.pop();
            this.redraw();
            this.onChange(this.strokes);
        }

        clear() {
            this.strokes = [];
            this.redraw();
            this.onChange(this.strokes);
        }

        setStrokes(drawing) {
            this.strokes = sanitize(drawing);
            this.current = null;
            this.redraw();
        }

        getStrokes() {
            return this.strokes.map(s => ({ c: s.c, w: s.w, p: s.p.slice() }));
        }

        redraw() {
            const { ctx, canvas } = this;
            const scale = canvas.width / W;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            const all = this.current ? [...this.strokes, this.current] : this.strokes;
            paint(ctx, all);
        }
    }

    return { W, H, COLORS, WIDTHS, MAX_POINTS, sanitize, toSVG, paint, Pad };
})();
