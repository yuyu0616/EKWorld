import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";

const Roulette: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rotationRef = useRef(0); // 累積角度
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const items = useMemo(() => [
        "今先頭のポケモンだけで戦う",
        "A連打のみ",
        "ゲット禁止",
        "回復禁止",
        "見つけたら必ず戦闘",
        "メガ進化禁止",
        "語尾が「○○」になる",
        "次捕まえたポケモンだけで戦う",
        "英語だけで実況",
        "ポケモン川柳だけで実況",
        "パートナーポケモンだけで戦う",
        "人生縛り（負けたら復帰できない）",
    ], []);

    const colors = useMemo(() => [
        "#f44336",
        "#e91e63",
        "#9c27b0",
        "#3f51b5",
        "#03a9f4",
        "#4caf50",
        "#cddc39",
        "#ff9800",
        "#ff9877",
        "#87f884ff",
        "#ffa1f7ff",
        "#c1b3ffff",
    ], []);

    const radius = 200; // Canvas 半径
    const center = radius;

    // ルーレット描画（rotationAngle は累積角度）
    const drawRoulette = useCallback((rotationAngle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const arc = (2 * Math.PI) / items.length;

        ctx.clearRect(0, 0, radius * 2, radius * 2);

        // 回転中心を Canvas の中心に
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate((rotationAngle * Math.PI) / 180);

        items.forEach((item, i) => {
            const angle = i * arc;

            // 扇形
            ctx.beginPath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, angle, angle + arc);
            ctx.fill();

            // テキスト
            ctx.save();
            ctx.rotate(angle + arc / 2);
            ctx.textAlign = "right";
            ctx.textBaseline = "middle"; // 中央揃え
            ctx.fillStyle = "#fff";
            ctx.font = "bold 18px sans-serif";
            console.log({ item, is: item.length >= 10 });
            // 文字数が多い場合は省略
            if (item.length >= 9) {
                const text = item.substring(0, 8) + "...";
                ctx.fillText(text, radius - 10, 0);
            } else {
                ctx.fillText(item, radius - 10, 0);
            }
            ctx.restore();
        });

        ctx.restore();

        // 外枠
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#222";
        ctx.stroke();
    }, [items, colors, center, radius]);

    useEffect(() => {
        drawRoulette(rotationRef.current);
    }, [
        drawRoulette
    ]);

    const spin = () => {
        if (spinning) return;
        setSpinning(true);
        setResult(null);

        const targetIndex = Math.floor(Math.random() * items.length);
        const arc = 360 / items.length;
        const spins = 5;
        const baseOffset = -90;

        // 目標角度を計算
        const targetRotation =
            spins * 360 + (360 - targetIndex * arc - arc / 2) + baseOffset;

        const start = rotationRef.current % 360; // 正規化
        const duration = 4000;
        const startTime = performance.now();

        const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const angle = start + (targetRotation - start) * easeOut;

            drawRoulette(angle); // Canvas 内で直接描画

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                rotationRef.current = (start + targetRotation) % 360; // 累積角度を正規化
                setSpinning(false);
                setResult(items[targetIndex]);
            }
        };

        requestAnimationFrame(animate);
    };


    const reset = () => {
        rotationRef.current = 0;
        drawRoulette(0);
        setResult(null);
    };

    return (
        <div className="flex flex-col items-center mt-10">
            <div className="relative w-[400px] h-[400px]">
                <canvas ref={canvasRef} width={radius * 2} height={radius * 2} className="rounded-full shadow-2xl" />
                {/* ピン（固定） */}
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{
                        marginTop: "-12px",
                        borderLeft: "12px solid transparent",
                        borderRight: "12px solid transparent",
                        borderTop: "24px solid gold",
                        filter: "drop-shadow(0 0 5px gold)",
                    }}
                />
            </div>

            <button
                onClick={spin}
                disabled={spinning}
                className="mt-8 px-6 py-3 rounded-full text-white font-bold bg-gradient-to-r from-rose-400 to-red-500 shadow-lg hover:scale-105 transition"
            >
                {spinning ? "回転中..." : "回す！"}
            </button>

            <button
                onClick={reset}
                className="mt-4 px-4 py-2 rounded-full text-white font-bold bg-gray-500 shadow-lg hover:scale-105 transition"
            >
                リセット
            </button>

            {result && (
                <p className="mt-4 text-2xl font-bold text-gray-700">
                    🎯 結果：<span className="text-rose-600">{result}</span>
                </p>
            )}
        </div>
    );
};

export default Roulette;
