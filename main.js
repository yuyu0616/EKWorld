document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('rouletteCanvas');
    const ctx = canvas.getContext('2d');
    const spinBtn = document.getElementById('spinBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultText = document.getElementById('resultText');
    const resultValue = document.getElementById('resultValue');

    let rotationAngle = 0; // 累積角度
    let spinning = false;

    const items = [
        // "今先頭のポケモンだけで戦う",
        // "A連打のみ",
        // "ゲット禁止",
        // "回復禁止",
        // "見つけたら必ず戦闘",
        // "メガ進化禁止",
        // "語尾が「○○」になる",
        // "次捕まえたポケモンだけで戦う",
        // "英語だけで実況",
        // "ポケモン川柳だけで実況",
        // "パートナーポケモンだけで戦う",
        // "人生縛り（負けたら復帰できない）",
        "イクラ投げのみで納品",
        "イクラ投げ,テッキュウ砲台禁止",
        "スペシャル1回禁止(1回は使用OK)",
        "救助禁止",
        "バクダン討伐禁止",
        "モグラボム入れ禁止(討伐はOK)",
        "テッパン討伐禁止(止めるのはOK)",
        "ダイバー塗り返し禁止(討伐はOK)",
        "ヘビ討伐禁止",
        "コウモリのアメダマ落とし禁止(コウモリ討伐はOK)",
        "タワー1段残し(1回以上)",
        "ナベブタ起動禁止(討伐はOK)",
        "ハシラを4面塗る(各WAVE1本以上)",
        "カタパ片翼残し(討伐禁止)",
        "タマヒロイ討伐禁止",
        "ラスト20秒メイン使用禁止",
        "ラスト20秒納品禁止",
        "ノルマ達成後オオモノ討伐禁止",
    ];

    const colors = [
        "#f44336", "#e91e63", "#9c27b0", "#3f51b5", 
        "#03a9f4", "#4caf50", "#cddc39", "#ff9800", 
        "#ff9877", "#87f884ff", "#ffa1f7ff", "#c1b3ffff"
    ];

    const radius = 200;
    const center = radius;

    function drawRoulette(angle) {
        const arc = (2 * Math.PI) / items.length;

        ctx.clearRect(0, 0, radius * 2, radius * 2);

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate((angle * Math.PI) / 180);

        items.forEach((item, i) => {
            const itemAngle = i * arc;

            ctx.beginPath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, itemAngle, itemAngle + arc);
            ctx.fill();

            ctx.save();
            ctx.rotate(itemAngle + arc / 2);
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.font = "bold 18px sans-serif";

            if (item.length >= 9) {
                const text = item.substring(0, 8) + "...";
                ctx.fillText(text, radius - 10, 0);
            } else {
                ctx.fillText(item, radius - 10, 0);
            }
            ctx.restore();
        });

        ctx.restore();

        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#222";
        ctx.stroke();
    }

    drawRoulette(rotationAngle);

    spinBtn.addEventListener('click', () => {
        if (spinning) return;
        spinning = true;
        spinBtn.disabled = true;
        spinBtn.textContent = "回転中...";
        resultText.classList.add('hidden');

        const targetIndex = Math.floor(Math.random() * items.length);
        const arcDegrees = 360 / items.length;
        const spins = 5;
        const baseOffset = -90;

        const targetRotation = spins * 360 + (360 - targetIndex * arcDegrees - arcDegrees / 2) + baseOffset;

        const start = rotationAngle % 360;
        const duration = 4000;
        const startTime = performance.now();

        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentAngle = start + (targetRotation - start) * easeOut;

            drawRoulette(currentAngle);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                rotationAngle = (start + targetRotation) % 360;
                spinning = false;
                spinBtn.disabled = false;
                spinBtn.textContent = "回す！";
                
                resultValue.textContent = items[targetIndex];
                resultText.classList.remove('hidden');
            }
        }

        requestAnimationFrame(animate);
    });

    resetBtn.addEventListener('click', () => {
        if (spinning) return;
        rotationAngle = 0;
        drawRoulette(0);
        resultText.classList.add('hidden');
    });
});
