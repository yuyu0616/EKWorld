// ここに表示したいスプレッドシートのIDを指定してください
const SPREADSHEET_ID = '1vDTct390utPRChS69W4yn-s0zHBvyyTwYP7XTSg6jIg';

document.addEventListener('DOMContentLoaded', async () => {
    const markdownContent = document.getElementById('markdown-content');
    const loader = document.getElementById('content-loader');

    // IDがプレースホルダーのままの場合は警告を表示
    if (SPREADSHEET_ID === 'ここにスプレッドシートのIDを入力してください') {
        markdownContent.innerHTML = `
            <div style="color: #666; text-align: center;">
                <p><strong>スプレッドシートのIDが設定されていません。</strong></p>
                <p><code>markdown.js</code> の1行目にある <code>SPREADSHEET_ID</code> を実際のスプレッドシートIDに変更してください。</p>
            </div>
        `;
        return;
    }

    // UIをローディング状態にする
    markdownContent.style.display = 'none';
    loader.style.display = 'block';

    try {
        // A1セルのデータをCSVとして取得するためのGoogle Sheets API URL
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&range=A1:A1`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const csvText = await response.text();

        // CSVとして返されるため、先頭と末尾のダブルクォーテーションを削除してエスケープを戻す
        let cellValue = csvText;
        
        if (cellValue.startsWith('"') && cellValue.endsWith('"')) {
            cellValue = cellValue.substring(1, cellValue.length - 1);
            // CSVエスケープされたダブルクォーテーション("")を単一の(")に戻す
            cellValue = cellValue.replace(/""/g, '"');
        }

        if (!cellValue.trim()) {
            cellValue = "*A1セルは空です。*";
        }

        // marked.js を使用してマークダウンをHTMLに変換
        const htmlContent = marked.parse(cellValue);
        
        // パース結果を表示
        markdownContent.innerHTML = htmlContent;

    } catch (error) {
        console.error('Error fetching data:', error);
        markdownContent.innerHTML = `
            <div style="color: #ef4444; font-weight: bold;">
                データの取得に失敗しました。<br>
                <small>エラー詳細: ${error.message}</small>
                <br><br>
                以下の点を確認してください：
                <ul style="color: #666; font-weight: normal; font-size: 14px;">
                    <li>スプレッドシートのIDが正しいか</li>
                    <li>「ファイル」＞「共有」＞「ウェブに公開」で全体に公開されているか</li>
                </ul>
            </div>
        `;
    } finally {
        // ローディング状態を解除
        loader.style.display = 'none';
        markdownContent.style.display = 'block';
    }
});
