package com.ekworld.aiandroid

/** アプリ起動中の会話履歴。チャット画面を閉じてもサービスが生きている間は続きから話せる。 */
object Conversation {
    enum class Role { USER, ASSISTANT }

    data class Turn(val role: Role, val text: String)

    /** API に送る履歴の上限（user/assistant のペア単位で切り詰める）。 */
    private const val MAX_TURNS = 30

    private val turns = mutableListOf<Turn>()

    @Synchronized
    fun snapshot(): List<Turn> = turns.toList()

    @Synchronized
    fun add(role: Role, text: String) {
        turns += Turn(role, text)
        while (turns.size > MAX_TURNS) {
            // 先頭が必ず user になるよう、ペアで削除する
            turns.removeAt(0)
            if (turns.firstOrNull()?.role == Role.ASSISTANT) turns.removeAt(0)
        }
    }

    /** 送信に失敗したときに、未回答の user 発言を取り消す。 */
    @Synchronized
    fun removeLastUser() {
        if (turns.lastOrNull()?.role == Role.USER) turns.removeAt(turns.lastIndex)
    }

    @Synchronized
    fun clear() = turns.clear()
}
