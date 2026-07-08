// ここに表示したいスプレッドシートのIDを指定してください
const SPREADSHEET_ID = '1vDTct390utPRChS69W4yn-s0zHBvyyTwYP7XTSg6jIg';

document.addEventListener('DOMContentLoaded', async () => {
    const historyContainer = document.getElementById('history-container');
    const loader = document.getElementById('content-loader');
    
    let allRecords = [];
    let currentPage = 1;
    const itemsPerPage = 1; // 1ページに表示する履歴の数

    function renderPage(page) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageRecords = allRecords.slice(startIndex, endIndex);

        let htmlOutput = '';
        pageRecords.forEach((record) => {
            htmlOutput += `
                <div class="markdown-container" style="margin-bottom: 30px;">
                    <div style="background-color: var(--primary-light); color: var(--primary); padding: 8px 16px; border-radius: 8px; font-weight: bold; margin-bottom: 16px; display: inline-block;">
                        実行日時: ${record.date}
                    </div>
                    <div class="markdown-body">
                        ${record.html}
                    </div>
                </div>
            `;
        });
        historyContainer.innerHTML = htmlOutput;
        updatePaginationUI();
    }

    function updatePaginationUI() {
        const totalPages = Math.ceil(allRecords.length / itemsPerPage);
        const paginationHtml = `
            <button class="page-btn" id="prev-btn-tmp" ${currentPage === 1 ? 'disabled' : ''}>&laquo; 新しい分析</button>
            <span class="page-info">${currentPage} / ${totalPages} ページ</span>
            <button class="page-btn" id="next-btn-tmp" ${currentPage === totalPages ? 'disabled' : ''}>過去の分析 &raquo;</button>
        `;

        const paginationTop = document.getElementById('pagination-top');
        const paginationBottom = document.getElementById('pagination-bottom');
        const paginations = [paginationTop, paginationBottom];
        
        paginations.forEach(container => {
            if(!container) return;
            // 固有のIDにするためリプレイス
            const isTop = container.id === 'pagination-top';
            container.innerHTML = paginationHtml
                .replace('prev-btn-tmp', isTop ? 'prev-btn-top' : 'prev-btn-bottom')
                .replace('next-btn-tmp', isTop ? 'next-btn-top' : 'next-btn-bottom');
            
            container.style.display = totalPages > 1 ? 'flex' : 'none';

            const prevBtn = container.querySelector(isTop ? '#prev-btn-top' : '#prev-btn-bottom');
            const nextBtn = container.querySelector(isTop ? '#next-btn-top' : '#next-btn-bottom');

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderPage(currentPage);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderPage(currentPage);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            }
        });
    }

    // IDがプレースホルダーのままの場合は警告を表示
    if (SPREADSHEET_ID === 'ここにスプレッドシートのIDを入力してください') {
        historyContainer.innerHTML = `
            <div class="markdown-container" style="color: #666; text-align: center;">
                <p><strong>スプレッドシートのIDが設定されていません。</strong></p>
                <p><code>YouTubeAnalysis.js</code> の1行目にある <code>SPREADSHEET_ID</code> を実際のスプレッドシートIDに変更してください。</p>
            </div>
        `;
        return;
    }

    // UIをローディング状態にする
    historyContainer.style.display = 'none';
    loader.style.display = 'block';

    try {
        // スプレッドシートのデータをJSON形式で取得
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&tq=SELECT A, B`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const text = await response.text();

        // Google Sheets APIのJSONレスポンスは /*O_o*/ ... のような形式でラップされているため、JSON部分だけを抽出する
        const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);

        if (!data.table.rows || data.table.rows.length === 0) {
            historyContainer.innerHTML = `
                <div class="markdown-container" style="text-align: center;">
                    <p>データがありません。GASを実行してスプレッドシートにデータを追加してください。</p>
                </div>
            `;
            return;
        }

        // 行ごとに処理してレコードに格納
        data.table.rows.forEach((row) => {
            const dateValue = row.c[0] ? (row.c[0].f || row.c[0].v) : '日付なし';
            const markdownValue = row.c[1] ? row.c[1].v : '';

            if (markdownValue) {
                allRecords.push({
                    date: dateValue,
                    html: marked.parse(markdownValue)
                });
            }
        });

        if (allRecords.length === 0) {
            historyContainer.innerHTML = `
                <div class="markdown-container" style="text-align: center;">
                    <p>有効なデータがありません。</p>
                </div>
            `;
        } else {
            // 最初のページを描画
            renderPage(1);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        historyContainer.innerHTML = `
            <div class="markdown-container" style="color: #ef4444; font-weight: bold;">
                データの取得に失敗しました。<br>
                <small>エラー詳細: ${error.message}</small>
                <br><br>
                以下の点を確認してください：
                <ul style="color: #666; font-weight: normal; font-size: 14px;">
                    <li>スプレッドシートのIDが正しいか</li>
                    <li>「ファイル」＞「共有」＞「ウェブに公開」で全体に公開されているか</li>
                    <li>GAS側でA列に日付、B列にマークダウンが出力されるようになっているか</li>
                </ul>
            </div>
        `;
    } finally {
        // ローディング状態を解除
        loader.style.display = 'none';
        historyContainer.style.display = 'block';
    }
});

