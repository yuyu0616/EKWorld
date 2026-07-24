// current_state.js - 対戦画面の初期状態を定義するファイル
// 恒久的に設定を変えたい場合は、このJSONデータを直接編集してください。

const currentBattleState = {
    title: "ランクマッチ 配信",
    rule: "シングルバトル",
    rate: "マスターボール級",
    telop: "対戦よろしくお願いします！",
    damageCalc: "例)\nこちらの攻撃 → 相手\n確定2発 (80%〜95%)",
    memo: "・相手の裏はミミッキュ警戒\n・ステロまいて展開する",
    showGuide: true,
    partyLeft: [
        { name: "カイリュー", imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/dragonite.png", itemName: "たべのこし", itemImageUrl: "https://play.pokemonshowdown.com/sprites/itemicons/leftovers.png", selected: true },
        { name: "ハバタクカミ", imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/fluttermane.png", itemName: "ブーストエナジー", itemImageUrl: "https://play.pokemonshowdown.com/sprites/itemicons/booster-energy.png", selected: false },
        { name: "サーフゴー", imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/gholdengo.png", itemName: "こだわりメガネ", itemImageUrl: "https://play.pokemonshowdown.com/sprites/itemicons/choice-specs.png", selected: true },
        { name: "オーガポン", imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/ogerpon.png", itemName: "", itemImageUrl: "", selected: false },
        { name: "ウーラオス(水)", imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/urshifurapidstrike.png", itemName: "きあいのタスキ", itemImageUrl: "https://play.pokemonshowdown.com/sprites/itemicons/focus-sash.png", selected: true },
        { name: "パオジアン", imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/chienpao.png", itemName: "", itemImageUrl: "", selected: false }
    ],
    partyRight: [
        { name: "", imageUrl: "", itemName: "", itemImageUrl: "", selected: false },
        { name: "", imageUrl: "", itemName: "", itemImageUrl: "", selected: false },
        { name: "", imageUrl: "", itemName: "", itemImageUrl: "", selected: false },
        { name: "", imageUrl: "", itemName: "", itemImageUrl: "", selected: false },
        { name: "", imageUrl: "", itemName: "", itemImageUrl: "", selected: false },
        { name: "", imageUrl: "", itemName: "", itemImageUrl: "", selected: false }
    ]
};
