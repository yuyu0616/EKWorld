// pokemon_data.js - ポケモンデータベース
// このファイルにポケモンを追加することで、検索候補に表示されるようになります。
// types: カンマ区切りの配列で指定
// imageUrl: 表示用の画像URLを指定

const pokemonDatabase = [
    { name: "カイリュー", types: ["ドラゴン", "ひこう"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/dragonite.png" },
    { name: "ハバタクカミ", types: ["ゴースト", "フェアリー"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/fluttermane.png" },
    { name: "サーフゴー", types: ["はがね", "ゴースト"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/gholdengo.png" },
    { name: "オーガポン", types: ["くさ"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/ogerpon.png" },
    { name: "ウーラオス(水)", types: ["かくとう", "みず"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/urshifurapidstrike.png" },
    { name: "ウーラオス(悪)", types: ["かくとう", "あく"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/urshifu.png" },
    { name: "パオジアン", types: ["あく", "こおり"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/chienpao.png" },
    { name: "ガチグマ(アカツキ)", types: ["じめん", "ノーマル"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/ursalunabloodmoon.png" },
    { name: "テツノツツミ", types: ["こおり", "みず"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/ironbundle.png" },
    { name: "ディンルー", types: ["あく", "じめん"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/tinglu.png" },
    { name: "イーユイ", types: ["あく", "ほのお"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/chiyu.png" },
    { name: "ハッサム", types: ["むし", "はがね"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/scizor.png" },
    { name: "ミミッキュ", types: ["ゴースト", "フェアリー"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/mimikyu.png" },
    { name: "キノガッサ", types: ["くさ", "かくとう"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/breloom.png" },
    { name: "ランドロス(霊獣)", types: ["じめん", "ひこう"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/landorustherian.png" },
    { name: "ガブリアス", types: ["ドラゴン", "じめん"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/garchomp.png" },
    { name: "テツノドクガ", types: ["ほのお", "どく"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/ironmoth.png" },
    { name: "セグレイブ", types: ["ドラゴン", "こおり"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/baxcalibur.png" },
    { name: "テツノカイナ", types: ["かくとう", "でんき"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/ironhands.png" },
    { name: "ゲンガー", types: ["ゴースト", "どく"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/gengar.png" },
    { name: "リザードン", types: ["ほのお", "ひこう"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/charizard.png" },
    { name: "オーロンゲ", types: ["あく", "フェアリー"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/grimmsnarl.png" },
    { name: "ドラパルト", types: ["ドラゴン", "ゴースト"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/dragapult.png" },
    { name: "ドドゲザン", types: ["あく", "はがね"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/kingambit.png" },
    { name: "マスカーニャ", types: ["くさ", "あく"], imageUrl: "https://play.pokemonshowdown.com/sprites/gen5/meowscarada.png" }
];
