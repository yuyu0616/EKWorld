# AIアンドロイド (ai-android-home)

スマホのホーム画面の上を小さなAIアンドロイドが歩き回り、タップすると話せる Android アプリです。
会話の頭脳には Claude API（`claude-opus-5-5`）を使っています。

## できること

- ホーム画面の下のほうを、とことこ歩いたり立ち止まったりする（まばたき・口パク・アンテナが光るアニメーション付き）
- **タップ** … 会話ウィンドウが開き、Claude と会話できる。返答はホーム上の吹き出しにも表示される
- **ドラッグ** … 好きな場所に持ち上げられる。離すと落下して着地する
- ときどき独り言をしゃべる（これは API を使わないのでタダ）
- 名前と性格を設定画面で自由に変えられる
- 端末を再起動しても、出現させたままなら自動で戻ってくる
- 通知の「しまう」ボタンで片付けられる

## 使い方

1. APK をインストールして「AIアンドロイド」を開く
2. [Claude Console](https://console.anthropic.com/) で発行した API キーを入力
3. 名前・性格を好みで入力して「ホームに出現させる」
4. 初回は「他のアプリの上に重ねて表示」の許可画面が開くので許可し、もう一度「ホームに出現させる」

## ビルド

GitHub Actions（`.github/workflows/build.yml`）が push ごとにデバッグ APK をビルドし、
Artifacts（`ai-android-home-debug-apk`）としてダウンロードできます。

ローカルでは Android Studio で開くか、Android SDK を入れた環境で:

```bash
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

- minSdk 26 (Android 8.0) / targetSdk 35
- Kotlin + Android View（Compose 不使用）
- Claude API: 公式 Java SDK `com.anthropic:anthropic-java`

## 構成

| ファイル | 役割 |
|---|---|
| `OverlayService.kt` | フォアグラウンドサービス。キャラと吹き出しをオーバーレイ表示し、毎フレーム歩行・落下・状態遷移を計算 |
| `AndroidCharacterView.kt` | Canvas で描くキャラクター（待機／歩行／会話／考え中／びっくり） |
| `ChatActivity.kt` | タップで開く会話ウィンドウ |
| `ClaudeClient.kt` | Claude API 呼び出し（キャラ設定のシステムプロンプト、エラーの日本語化） |
| `Conversation.kt` | 会話履歴（アプリ起動中のみ保持） |
| `MainActivity.kt` / `Prefs.kt` | 設定画面と保存 |
| `BootReceiver.kt` | 再起動時の自動出現 |

## 注意

- API キーは端末内のアプリ専用領域（SharedPreferences）に保存されます。API の利用料金はキーの持ち主に請求されます。
- オーバーレイはホーム画面だけでなく他のアプリの上にも表示されます。邪魔なときは通知の「しまう」で片付けてください。
- 雑談向けに effort を `low` にしています。じっくり考えてほしい場合は `ClaudeClient.kt` の `Effort.LOW` を変更してください。
