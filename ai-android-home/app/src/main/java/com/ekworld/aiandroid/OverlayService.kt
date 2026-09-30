package com.ekworld.aiandroid

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.TypedValue
import android.view.Choreographer
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlin.math.hypot
import kotlin.random.Random

/**
 * ホーム画面の上にアンドロイドを常駐させるフォアグラウンドサービス。
 * キャラクターと吹き出しをオーバーレイウィンドウとして表示し、フレームごとに動かす。
 */
class OverlayService : Service(), Choreographer.FrameCallback {

    private lateinit var wm: WindowManager
    private lateinit var prefs: Prefs
    private lateinit var character: AndroidCharacterView
    private lateinit var bubble: TextView
    private lateinit var charParams: WindowManager.LayoutParams
    private lateinit var bubbleParams: WindowManager.LayoutParams

    private var screenW = 0
    private var screenH = 0
    private var charW = 0
    private var charH = 0

    // キャラクターの位置（左上座標, px）と物理状態
    private var x = 0f
    private var y = 0f
    private var vy = 0f
    private var direction = 1
    private var groundY = 0f

    private enum class Action { IDLE, WALK }

    private var action = Action.IDLE
    private var actionLeft = 2f
    private var talkLeft = 0f
    private var thinking = false
    private var dragging = false
    private var chatterLeft = nextChatterDelay()
    private var lastFrameNanos = 0L

    private val speedPx by lazy { dp(42f) }
    private val gravityPx by lazy { dp(2200f) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        startInForeground()

        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }

        character = AndroidCharacterView(this)
        charW = dp(72f).toInt()
        charH = dp(96f).toInt()
        charParams = overlayParams(charW, charH, touchable = true)

        bubble = TextView(this).apply {
            setBackgroundResource(R.drawable.bubble_bg)
            setTextColor(ContextCompat.getColor(context, R.color.bubble_text))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            val pad = dp(10f).toInt()
            setPadding(pad + dp(2f).toInt(), pad, pad + dp(2f).toInt(), pad)
            maxWidth = dp(240f).toInt()
            visibility = View.GONE
        }
        bubbleParams = overlayParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            touchable = false,
        )

        updateScreenSize()
        x = Random.nextInt(0, (screenW - charW).coerceAtLeast(1)).toFloat()
        y = groundY
        applyPositions()

        wm.addView(bubble, bubbleParams)
        wm.addView(character, charParams)
        setUpTouch()

        instance = this
        Choreographer.getInstance().postFrameCallback(this)
        say("こんにちは！${prefs.name}だよ。タップして話しかけてね。")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            prefs.enabled = false
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        Choreographer.getInstance().removeFrameCallback(this)
        if (::character.isInitialized) {
            runCatching { wm.removeView(character) }
            runCatching { wm.removeView(bubble) }
        }
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (!::character.isInitialized) return
        updateScreenSize()
        x = x.coerceIn(0f, (screenW - charW).toFloat().coerceAtLeast(0f))
        y = y.coerceAtMost(groundY)
    }

    // ---- 外部（チャット画面）から呼ばれる API ----

    /** 吹き出しでしゃべらせる。長い文ほど長く表示する。 */
    fun say(text: String) {
        thinking = false
        bubble.text = text
        bubble.visibility = View.VISIBLE
        talkLeft = (2.5f + text.length * 0.12f).coerceAtMost(14f)
        character.mood = AndroidCharacterView.Mood.TALK
    }

    /** API の返答待ち中は考え中のポーズにする。 */
    fun setThinking(on: Boolean) {
        thinking = on
        if (on) {
            bubble.text = getString(R.string.thinking)
            bubble.visibility = View.VISIBLE
            talkLeft = 0f
        }
    }

    // ---- フレーム更新 ----

    override fun doFrame(frameTimeNanos: Long) {
        val dt = if (lastFrameNanos == 0L) 0f else ((frameTimeNanos - lastFrameNanos) / 1e9f).coerceAtMost(0.1f)
        lastFrameNanos = frameTimeNanos
        update(dt)
        applyPositions()
        Choreographer.getInstance().postFrameCallback(this)
    }

    private fun update(dt: Float) {
        if (dragging) {
            character.mood = AndroidCharacterView.Mood.SURPRISED
            return
        }

        // 空中にいるときは落下
        if (y < groundY) {
            vy += gravityPx * dt
            y = (y + vy * dt).coerceAtMost(groundY)
            if (y >= groundY) {
                vy = 0f
                say(LANDING_LINES.random())
            }
            character.mood = AndroidCharacterView.Mood.SURPRISED
            return
        }

        if (talkLeft > 0f) {
            talkLeft -= dt
            if (talkLeft <= 0f) {
                bubble.visibility = View.GONE
            } else {
                character.mood = AndroidCharacterView.Mood.TALK
                return
            }
        }

        if (thinking) {
            character.mood = AndroidCharacterView.Mood.THINK
            return
        }

        // ときどき独り言（API は使わない）
        chatterLeft -= dt
        if (chatterLeft <= 0f) {
            chatterLeft = nextChatterDelay()
            if (Random.nextFloat() < 0.5f) {
                say(IDLE_LINES.random())
                return
            }
        }

        actionLeft -= dt
        if (actionLeft <= 0f) {
            if (Random.nextFloat() < 0.6f) {
                action = Action.WALK
                direction = if (Random.nextBoolean()) 1 else -1
                actionLeft = 2f + Random.nextFloat() * 4f
            } else {
                action = Action.IDLE
                actionLeft = 1.5f + Random.nextFloat() * 3.5f
            }
        }

        when (action) {
            Action.WALK -> {
                x += direction * speedPx * dt
                val maxX = (screenW - charW).toFloat().coerceAtLeast(0f)
                if (x <= 0f) { x = 0f; direction = 1 }
                if (x >= maxX) { x = maxX; direction = -1 }
                character.facingRight = direction > 0
                character.mood = AndroidCharacterView.Mood.WALK
            }
            Action.IDLE -> character.mood = AndroidCharacterView.Mood.IDLE
        }
    }

    private fun applyPositions() {
        val cx = x.toInt()
        val cy = y.toInt()
        if (charParams.x != cx || charParams.y != cy) {
            charParams.x = cx
            charParams.y = cy
            if (character.isAttachedToWindow) wm.updateViewLayout(character, charParams)
        }
        if (bubble.visibility == View.VISIBLE && bubble.isAttachedToWindow) {
            val bw = bubble.width
            val bh = bubble.height
            val bx = (cx + charW / 2 - bw / 2).coerceIn(0, (screenW - bw).coerceAtLeast(0))
            val by = (cy - bh - dp(4f).toInt()).coerceAtLeast(0)
            if (bubbleParams.x != bx || bubbleParams.y != by) {
                bubbleParams.x = bx
                bubbleParams.y = by
                wm.updateViewLayout(bubble, bubbleParams)
            }
        }
    }

    // ---- タッチ（タップで会話・ドラッグで移動） ----

    @SuppressLint("ClickableViewAccessibility")
    private fun setUpTouch() {
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        var downRawX = 0f
        var downRawY = 0f
        var startX = 0f
        var startY = 0f
        character.setOnTouchListener { _, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = e.rawX
                    downRawY = e.rawY
                    startX = x
                    startY = y
                    dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downRawX
                    val dy = e.rawY - downRawY
                    if (!dragging && hypot(dx, dy) > slop) {
                        dragging = true
                        say(DRAG_LINES.random())
                    }
                    if (dragging) {
                        x = (startX + dx).coerceIn(0f, (screenW - charW).toFloat().coerceAtLeast(0f))
                        y = (startY + dy).coerceIn(0f, groundY)
                        vy = 0f
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        dragging = false
                    } else {
                        onTap()
                    }
                }
                MotionEvent.ACTION_CANCEL -> dragging = false
            }
            true
        }
    }

    private fun onTap() {
        if (!thinking) say(TAP_LINES.random())
        startActivity(
            Intent(this, ChatActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    // ---- ユーティリティ ----

    private fun updateScreenSize() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val metrics = wm.currentWindowMetrics
            val insets = metrics.windowInsets.getInsetsIgnoringVisibility(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
            )
            screenW = metrics.bounds.width() - insets.left - insets.right
            screenH = metrics.bounds.height() - insets.top - insets.bottom
        } else {
            val dm = resources.displayMetrics
            screenW = dm.widthPixels
            screenH = dm.heightPixels
        }
        groundY = (screenH - charH - dp(8f)).coerceAtLeast(0f)
    }

    private fun overlayParams(w: Int, h: Int, touchable: Boolean): WindowManager.LayoutParams {
        var flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        if (!touchable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        return WindowManager.LayoutParams(
            w, h,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.TOP or Gravity.START }
    }

    private fun startInForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, getString(R.string.notification_channel), NotificationManager.IMPORTANCE_MIN)
        )
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this, 1, Intent(this, OverlayService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.stop), stopIntent)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun dp(v: Float) = v * resources.displayMetrics.density

    companion object {
        private const val CHANNEL_ID = "overlay"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_STOP = "com.ekworld.aiandroid.STOP"

        /** 起動中のサービス（メインスレッドからのみ参照する）。 */
        var instance: OverlayService? = null
            private set

        fun start(context: Context) {
            Prefs(context).enabled = true
            ContextCompat.startForegroundService(context, Intent(context, OverlayService::class.java))
        }

        fun stop(context: Context) {
            Prefs(context).enabled = false
            context.stopService(Intent(context, OverlayService::class.java))
        }

        private fun nextChatterDelay() = 45f + Random.nextFloat() * 45f

        private val IDLE_LINES = listOf(
            "ふんふーん♪",
            "今日はなにしてるの？",
            "ちょっと休憩〜",
            "画面の端っこまで探検中！",
            "水分補給、忘れないでね。",
            "なにか手伝えることある？",
        )
        private val TAP_LINES = listOf("なあに？", "呼んだ？", "はーい！")
        private val DRAG_LINES = listOf("わわっ！", "どこ行くの〜？", "高い高い！")
        private val LANDING_LINES = listOf("着地成功！", "ふぅ、びっくりした。", "よいしょっと。")
    }
}
