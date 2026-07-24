let statusChartInstance = null;

const members = [
    { id: 1, name: 'ゆー', icon: '👻', color: '#ff5e7e', hp: 120, mp: 50, atk: 80, def: 40, spd: 70, desc: 'いつも元気！攻撃は最大の防御。勢いで押し切るタイプ！' },
    { id: 2, name: 'るー', icon: '🦊', color: '#3bcef3', hp: 80, mp: 100, atk: 40, def: 60, spd: 85, desc: '魔法が得意。知略で勝負するタイプ。後方支援はお任せ！' },
    { id: 3, name: 'すー', icon: '🐱', color: '#ffd166', hp: 100, mp: 60, atk: 60, def: 80, spd: 60, desc: 'バランス型。チームのムードメーカー。どんな状況でも対応可能。' },
    { id: 4, name: 'とー', icon: '🐰', color: '#9c27b0', hp: 150, mp: 20, atk: 90, def: 90, spd: 30, desc: '防御特化のタンク役。頼りになるけど、ちょっと動きが遅い。' },
    { id: 5, name: 'みー', icon: '🐼', color: '#4ade80', hp: 90, mp: 80, atk: 70, def: 50, spd: 95, desc: '素早さが自慢！ヒット＆アウェイで敵を翻弄する。' },
    { id: 6, name: 'なー', icon: '🐨', color: '#f97316', hp: 110, mp: 40, atk: 100, def: 30, spd: 50, desc: '一撃必殺のパワーファイター。当たればデカイ！' }
];

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('members-container');
    
    members.forEach((member, index) => {
        const card = document.createElement('div');
        card.className = 'member-card';
        // Add a slight animation delay for each card so they pop in sequentially
        card.style.animationDelay = `${index * 0.1}s`;
        
        card.onclick = () => openStatusModal(member);
        
        card.innerHTML = `
            <div class="member-icon" style="background-color: ${member.color}">${member.icon}</div>
            <div class="member-name">${member.name}</div>
        `;
        
        container.appendChild(card);
    });
});

function openStatusModal(member) {
    const modal = document.getElementById('status-modal');
    
    // Update Icon
    document.getElementById('modal-icon').textContent = member.icon;
    document.getElementById('modal-icon').style.backgroundColor = member.color;
    
    // Update Name
    document.getElementById('modal-name').textContent = member.name;
    
    // Update Stats
    document.getElementById('modal-hp').textContent = member.hp;
    document.getElementById('modal-mp').textContent = member.mp;
    document.getElementById('modal-atk').textContent = member.atk;
    document.getElementById('modal-def').textContent = member.def;
    
    // Update Description
    document.getElementById('modal-desc').textContent = member.desc;
    
    // Draw Radar Chart
    drawRadarChart(member);
    
    // Show Modal
    modal.classList.remove('hidden');
}

function drawRadarChart(member) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (statusChartInstance) {
        statusChartInstance.destroy();
    }
    
    // Chart.js default configuration for our radar chart
    statusChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['HP', 'MP', 'ATK (攻撃力)', 'SPD (素早さ)', 'DEF (防御力)'],
            datasets: [{
                label: member.name + ' のステータス',
                data: [member.hp, member.mp, member.atk, member.spd, member.def],
                backgroundColor: member.color + '66', // Add some transparency
                borderColor: member.color,
                pointBackgroundColor: member.color,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: member.color,
                borderWidth: 3,
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 15 // レーダーが見切れないようにパディングを追加
            },
            scales: {
                r: {
                    angleLines: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    pointLabels: {
                        font: {
                            family: "'M PLUS Rounded 1c', sans-serif",
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#4b4b4b'
                    },
                    ticks: {
                        beginAtZero: true,
                        max: 150, // Set maximum to the highest possible value
                        stepSize: 30,
                        display: false // Hide numbers on the axes
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Hide the legend for cleaner look
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: {
                        family: "'M PLUS Rounded 1c', sans-serif",
                        size: 14
                    },
                    bodyFont: {
                        family: "'M PLUS Rounded 1c', sans-serif",
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.raw;
                        }
                    }
                }
            }
        }
    });
}

function closeStatusModal() {
    const modal = document.getElementById('status-modal');
    modal.classList.add('hidden');
}

// モーダルの外側をクリックしたら閉じる
document.getElementById('status-modal').addEventListener('click', (e) => {
    if (e.target.id === 'status-modal') {
        closeStatusModal();
    }
});
