// スプレッドシートをAPI化したURL（Google Apps ScriptのウェブアプリURLなど）を設定してください
const SPREADSHEET_API_URL = "https://script.google.com/macros/s/AKfycbxC87f_4sC-tu3Go-6EB_Vl5z36fOlwaEgfONpiVpHtZX4gFcOyNnOYOL3xwDLCSi30/exec";

async function fetchQuotes() {
    try {
        // まだURLが設定されていない場合のフォールバック
        if (SPREADSHEET_API_URL === "SPREADSHEET_API_URL") {
            console.warn("APIのURLが設定されていません。デフォルトの名言を表示します。");
            return [
                { text: "明日死ぬかのように生きよ。永遠に生きるかのように学べ。", author: "マハトマ・ガンジー", work: "" },
                { text: "天才とは、1％のひらめきと99％の努力である。", author: "トーマス・エジソン", work: "" },
            ];
        }

        const response = await fetch(SPREADSHEET_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // APIからJSONとして取得
        const quotes = await response.json();

        // もしデータが取得できなかった場合のフォールバック
        if (!quotes || quotes.length === 0) {
            throw new Error("APIから名言データを読み込めませんでした");
        }

        return quotes;
    } catch (error) {
        console.error("名言の取得に失敗しました:", error);
        return [
            { text: "明日死ぬかのように生きよ。永遠に生きるかのように学べ。", author: "マハトマ・ガンジー", work: "" },
            { text: "データ取得エラーが発生しました", author: "システム", work: "" }
        ];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const quoteCard = document.getElementById('quoteCard');
    const quoteText = document.getElementById('quoteText');
    const quoteAuthor = document.getElementById('quoteAuthor');
    const quoteWork = document.getElementById('quoteWork');

    // スプレッドシートAPIから名言を取得
    const quotes = await fetchQuotes();

    // 今日の日付を取得 (YYYY-MM-DD)
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    // 日付文字列からハッシュ値を生成して、配列のインデックスを決定
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
        hash = dateString.charCodeAt(i) + ((hash << 5) - hash);
    }

    // 正の値にして配列長で割った余りをインデックスとする
    const index = Math.abs(hash) % quotes.length;

    const todaysQuote = quotes[index];

    // 名言と発言者を表示
    quoteText.textContent = `「${todaysQuote.text}」`;
    quoteAuthor.textContent = `- ${todaysQuote.author}`;

    // 作品名があれば表示、なければ非表示
    if (todaysQuote.work) {
        quoteWork.textContent = `『${todaysQuote.work}』より`;
        quoteWork.style.display = 'block';
    } else {
        quoteWork.style.display = 'none';
    }

    // データ取得完了後、ローディングアニメーションを非表示にする
    const contentLoader = document.getElementById('content-loader');
    if (contentLoader) {
        contentLoader.style.display = 'none';
    }

    // アニメーション付きで表示
    quoteCard.classList.remove('hidden');
});


