document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('missionContainer');
    const totalPointsEl = document.getElementById('totalPoints');

    let totalPoints = 0;

    // ミッションデータ（テキストと獲得ポイント）
    const missionData = [
        { text: "1. ヒッセンで10キル（みみゅは12キル）", points: 5 },
        { text: "2. ヴァリアブルで8キル（エクリオは18キル）", points: 5 },
        { text: "3. スパッタリで8キル（赤木秋は18キル）", points: 5 },
        { text: "4. クーゲルで7キル（しゃろは15キル）", points: 5 },
        { text: "5. チャージャー種で10キル", points: 5 },
        { text: "6. スプラシューターで8キル", points: 5 },
        { text: "7. ストリンガー種で8キル", points: 5 },
        { text: "8. ノヴァブラスターで8キル", points: 5 },
        { text: "9. ホクサイで8キル", points: 5 },
        { text: "10. シェルター種で12キル", points: 50 },
        { text: "個人ミッションクリアボーナス", points: 5 }
    ];

    const squidSvg = `
    <svg viewBox="0 0 100 100" class="squid-icon">
      <!-- Body -->
      <path d="M50 5
               C45 15, 25 40, 15 60
               C10 75, 12 90, 20 95
               C28 100, 33 90, 32 80
               C31 75, 34 70, 36 70
               C38 80, 42 80, 43 70
               C47 80, 53 80, 57 70
               C58 80, 62 80, 64 70
               C66 70, 69 75, 68 80
               C67 90, 72 100, 80 95
               C88 90, 90 75, 85 60
               C75 40, 55 15, 50 5 Z" 
            fill="currentColor"/>
      <!-- Mask -->
      <path d="M20 52 C30 65, 70 65, 80 52 C85 45, 75 42, 68 45 C60 48, 55 52, 50 52 C45 52, 40 48, 32 45 C25 42, 15 45, 20 52 Z" fill="#222"/>
      <!-- Eyes -->
      <circle cx="34" cy="52" r="7.5" fill="white"/>
      <circle cx="66" cy="52" r="7.5" fill="white"/>
      <!-- Pupils -->
      <circle cx="36" cy="51" r="3" fill="#222"/>
      <circle cx="64" cy="51" r="3" fill="#222"/>
    </svg>`;

    missionData.forEach((mission, i) => {
        const item = document.createElement('div');
        item.className = 'mission-item';

        // ミッションテキストとポイント
        const textWrapper = document.createElement('div');
        textWrapper.className = 'mission-text-wrapper';

        const title = document.createElement('span');
        title.className = 'mission-title';
        title.textContent = mission.text;

        const pts = document.createElement('span');
        pts.className = 'mission-points';
        pts.textContent = `${mission.points} pt`;

        textWrapper.appendChild(title);
        textWrapper.appendChild(pts);

        // イカアイコン枠
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';
        iconWrapper.innerHTML = squidSvg;

        item.appendChild(textWrapper);
        item.appendChild(iconWrapper);

        // クリック/タップでチェック状態とポイント切り替え
        item.addEventListener('click', () => {
            const isChecked = item.classList.toggle('checked');

            // ポイントの増減
            if (isChecked) {
                totalPoints += mission.points;
            } else {
                totalPoints -= mission.points;
            }

            // ポイント表示を更新してアニメーション
            totalPointsEl.textContent = totalPoints;
            totalPointsEl.classList.remove('pop-anim');
            void totalPointsEl.offsetWidth; // リフロー強制でアニメーション再トリガー
            totalPointsEl.classList.add('pop-anim');

            // 色をランダムに変える遊び心（チェック時のみ）
            const icon = iconWrapper.querySelector('.squid-icon');
            if (isChecked) {
                const colors = ['#ff5e7e', '#3bcef3', '#ffd166', '#a7f368', '#b15eff'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                icon.style.color = randomColor;
                item.style.borderColor = randomColor;
                item.style.boxShadow = `4px 4px 0px ${randomColor}`;
            } else {
                icon.style.color = '';
                item.style.borderColor = '';
                item.style.boxShadow = '';
            }
        });

        container.appendChild(item);
    });
});
