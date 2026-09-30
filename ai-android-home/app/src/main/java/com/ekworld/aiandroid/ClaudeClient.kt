package com.ekworld.aiandroid

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.AuthenticationException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.AnthropicIoException
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.BetaStopReason
import com.anthropic.models.beta.messages.MessageCreateParams
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Claude API との通信。ネットワーク処理は IO スレッドで行う。 */
object ClaudeClient {
    private const val MODEL = "claude-opus-5-5"

    private var client: AnthropicClient? = null
    private var clientKey: String? = null

    @Synchronized
    private fun clientFor(apiKey: String): AnthropicClient {
        val current = client
        if (current != null && clientKey == apiKey) return current
        current?.close()
        return AnthropicOkHttpClient.builder().apiKey(apiKey).build().also {
            client = it
            clientKey = apiKey
        }
    }

    private fun systemPrompt(name: String, personality: String) = """
        あなたは「$name」という名前の小さなAIアンドロイドです。持ち主のスマートフォンのホーム画面に住んでいて、画面の下をとことこ歩き回っています。
        性格・話し方: $personality

        返答は吹き出しに表示されるので、話し言葉で1〜3文程度の短さにしてください。Markdown や箇条書き、絵文字の多用は避けてください。
        持ち主に寄り添い、質問には正確に、わからないことは正直にわからないと答えてください。
    """.trimIndent()

    /**
     * 会話履歴（最後が user 発言）を送り、アンドロイドの返答を返す。
     * 失敗時はユーザーに見せられる日本語メッセージを持つ [ClaudeException] を投げる。
     */
    suspend fun reply(prefs: Prefs, history: List<Conversation.Turn>): String =
        withContext(Dispatchers.IO) {
            val apiKey = prefs.apiKey
            if (apiKey.isBlank()) throw ClaudeException("API キーが設定されていません。設定画面で入力してね。")

            val builder = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(16000L)
                .system(systemPrompt(prefs.name, prefs.personality))
                // 雑談なので低い effort で素早く返す
                .outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
                // 安全分類器に断られた場合はサーバー側で別モデルに自動フォールバック
                .addBeta("server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            for (turn in history) {
                when (turn.role) {
                    Conversation.Role.USER -> builder.addUserMessage(turn.text)
                    Conversation.Role.ASSISTANT -> builder.addAssistantMessage(turn.text)
                }
            }

            val response = try {
                clientFor(apiKey).beta().messages().create(builder.build())
            } catch (e: AuthenticationException) {
                throw ClaudeException("API キーが正しくないみたい…設定を確認してね。", e)
            } catch (e: RateLimitException) {
                throw ClaudeException("ちょっと話しすぎたかも。少し待ってからまた話しかけてね。", e)
            } catch (e: AnthropicServiceException) {
                throw ClaudeException("うまく考えられなかった…（エラー ${e.statusCode()}）", e)
            } catch (e: AnthropicIoException) {
                throw ClaudeException("通信できなかったよ。ネットにつながってるか確認してね。", e)
            }

            if (response.stopReason().orElse(null) == BetaStopReason.REFUSAL) {
                return@withContext "ごめんね、その話にはお答えできないんだ。"
            }

            response.content()
                .mapNotNull { block -> block.text().orElse(null)?.text() }
                .joinToString("")
                .trim()
                .ifEmpty { "……（うまく言葉にできなかった）" }
        }
}

class ClaudeException(message: String, cause: Throwable? = null) : Exception(message, cause)
