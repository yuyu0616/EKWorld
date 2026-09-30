package com.ekworld.aiandroid

import android.os.Bundle
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.ekworld.aiandroid.databinding.ActivityChatBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** アンドロイドをタップすると開く会話ウィンドウ。返答はホーム上の吹き出しにも表示される。 */
class ChatActivity : AppCompatActivity() {

    private lateinit var binding: ActivityChatBinding
    private lateinit var prefs: Prefs
    private var sending = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)

        binding.title.text = "${prefs.name}とおしゃべり"
        Conversation.snapshot().forEach { addBubble(it.role, it.text) }

        binding.send.setOnClickListener { send() }
        binding.input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                send()
                true
            } else {
                false
            }
        }
    }

    private fun send() {
        val text = binding.input.text.toString().trim()
        if (text.isEmpty() || sending) return
        sending = true
        binding.send.isEnabled = false
        binding.input.text.clear()

        Conversation.add(Conversation.Role.USER, text)
        addBubble(Conversation.Role.USER, text)
        val pending = addBubble(Conversation.Role.ASSISTANT, getString(R.string.thinking))
        OverlayService.instance?.setThinking(true)

        // 会話ウィンドウを閉じても返答はホーム上の吹き出しに届くよう、画面より長生きするスコープで実行する
        requestScope.launch {
            val reply = try {
                ClaudeClient.reply(prefs, Conversation.snapshot()).also {
                    Conversation.add(Conversation.Role.ASSISTANT, it)
                }
            } catch (e: ClaudeException) {
                Conversation.removeLastUser()
                e.message.orEmpty()
            } catch (e: Exception) {
                Conversation.removeLastUser()
                "エラーが起きちゃった: ${e.message}"
            }
            OverlayService.instance?.say(reply)
            if (!isDestroyed) {
                pending.text = reply
                scrollToBottom()
                sending = false
                binding.send.isEnabled = true
            }
        }
    }

    private fun addBubble(role: Conversation.Role, text: String): TextView {
        val isUser = role == Conversation.Role.USER
        val pad = (10 * resources.displayMetrics.density).toInt()
        val view = TextView(this).apply {
            this.text = text
            setTextIsSelectable(true)
            setPadding(pad, pad, pad, pad)
            setTextColor(ContextCompat.getColor(context, R.color.bubble_text))
            setBackgroundResource(if (isUser) R.drawable.msg_user_bg else R.drawable.msg_bot_bg)
        }
        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            gravity = if (isUser) Gravity.END else Gravity.START
            topMargin = pad / 2
            if (isUser) marginStart = pad * 4 else marginEnd = pad * 4
        }
        binding.messages.addView(view, lp)
        scrollToBottom()
        return view
    }

    private fun scrollToBottom() {
        binding.scroll.post { binding.scroll.fullScroll(android.view.View.FOCUS_DOWN) }
    }

    companion object {
        private val requestScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    }
}
