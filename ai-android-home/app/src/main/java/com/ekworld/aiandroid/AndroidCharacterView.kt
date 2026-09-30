package com.ekworld.aiandroid

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View
import kotlin.math.abs
import kotlin.math.sin

/** Canvas で描くアンドロイドキャラクター。状態に応じて歩く・まばたき・口パクなどをする。 */
class AndroidCharacterView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    enum class Mood { IDLE, WALK, TALK, THINK, SURPRISED }

    var mood: Mood = Mood.IDLE
        set(value) {
            if (field != value) {
                field = value
                invalidate()
            }
        }

    /** 右向きなら true。描画を左右反転する。 */
    var facingRight: Boolean = true

    private val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF3AB7C8.toInt()
        style = Paint.Style.STROKE
    }
    private val accent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF3AB7C8.toInt() }
    private val dark = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF1F2933.toInt() }
    private val cheek = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x66FF8FA3 }
    private val lamp = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x33000000 }
    private val rect = RectF()

    private val startTime = SystemClock.uptimeMillis()

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val d = resources.displayMetrics.density
        setMeasuredDimension(
            resolveSize((72 * d).toInt(), widthMeasureSpec),
            resolveSize((96 * d).toInt(), heightMeasureSpec),
        )
    }

    override fun onDraw(canvas: Canvas) {
        val t = (SystemClock.uptimeMillis() - startTime) / 1000f
        val w = width.toFloat()
        val h = height.toFloat()
        // 72x96 を基準にした座標系で描く
        val u = minOf(w / 72f, h / 96f)
        outline.strokeWidth = 2.5f * u

        canvas.save()
        canvas.translate((w - 72f * u) / 2f, h - 96f * u)
        if (!facingRight) canvas.scale(-1f, 1f, 36f * u, 0f)

        val walking = mood == Mood.WALK
        val step = if (walking) sin(t * 12f) else 0f
        val bob = when (mood) {
            Mood.WALK -> abs(step) * 2.5f
            Mood.SURPRISED -> 4f
            else -> sin(t * 2f) * 1.2f
        } * u

        // 影
        rect.set(14 * u, 90 * u, 58 * u, 95 * u)
        canvas.drawOval(rect, shadow)

        // 脚
        drawLimb(canvas, 28 * u, 70 * u, 8 * u, 20 * u, step * 18f)
        drawLimb(canvas, 44 * u, 70 * u, 8 * u, 20 * u, -step * 18f)

        canvas.save()
        canvas.translate(0f, -bob)

        // 腕
        val armSwing = when (mood) {
            Mood.WALK -> -step * 25f
            Mood.TALK -> sin(t * 6f) * 20f - 20f
            Mood.SURPRISED -> -150f
            else -> sin(t * 2f) * 5f
        }
        drawLimb(canvas, 14 * u, 50 * u, 7 * u, 18 * u, armSwing)
        drawLimb(canvas, 58 * u, 50 * u, 7 * u, 18 * u, if (mood == Mood.SURPRISED) 150f else -armSwing)

        // 胴体
        rect.set(18 * u, 46 * u, 54 * u, 76 * u)
        canvas.drawRoundRect(rect, 10 * u, 10 * u, body)
        canvas.drawRoundRect(rect, 10 * u, 10 * u, outline)
        // 胸のランプ
        rect.set(30 * u, 55 * u, 42 * u, 63 * u)
        canvas.drawRoundRect(rect, 3 * u, 3 * u, accent)

        // アンテナ
        canvas.drawRect(35 * u, 4 * u, 37 * u, 14 * u, accent)
        lamp.color = when (mood) {
            Mood.THINK -> if ((t * 4).toInt() % 2 == 0) 0xFFFFD166.toInt() else 0xFFFFF3C4.toInt()
            Mood.TALK -> 0xFF7AE582.toInt()
            Mood.SURPRISED -> 0xFFFF6B6B.toInt()
            else -> 0xFFFFD166.toInt()
        }
        canvas.drawCircle(36 * u, 5 * u, 4 * u, lamp)

        // 頭
        rect.set(8 * u, 12 * u, 64 * u, 48 * u)
        canvas.drawRoundRect(rect, 14 * u, 14 * u, body)
        canvas.drawRoundRect(rect, 14 * u, 14 * u, outline)
        // 顔パネル
        rect.set(14 * u, 18 * u, 58 * u, 42 * u)
        canvas.drawRoundRect(rect, 10 * u, 10 * u, dark)

        // 目（ときどきまばたき）
        val blinking = (t % 3.7f) < 0.12f
        val eyeY = if (mood == Mood.THINK) 26 * u else 29 * u
        val eyeLookX = if (mood == Mood.THINK) 3 * u else 0f
        when {
            mood == Mood.SURPRISED -> {
                canvas.drawCircle(27 * u, eyeY, 4.5f * u, accent)
                canvas.drawCircle(45 * u, eyeY, 4.5f * u, accent)
            }
            blinking -> {
                canvas.drawRect(23 * u, eyeY - 0.8f * u, 31 * u, eyeY + 0.8f * u, accent)
                canvas.drawRect(41 * u, eyeY - 0.8f * u, 49 * u, eyeY + 0.8f * u, accent)
            }
            else -> {
                rect.set(24 * u + eyeLookX, eyeY - 4 * u, 30 * u + eyeLookX, eyeY + 4 * u)
                canvas.drawOval(rect, accent)
                rect.set(42 * u + eyeLookX, eyeY - 4 * u, 48 * u + eyeLookX, eyeY + 4 * u)
                canvas.drawOval(rect, accent)
            }
        }
        // ほっぺ
        canvas.drawCircle(19 * u, 36 * u, 3 * u, cheek)
        canvas.drawCircle(53 * u, 36 * u, 3 * u, cheek)
        // 口
        val mouthOpen = when (mood) {
            Mood.TALK -> (abs(sin(t * 14f)) * 3f + 0.8f) * u
            Mood.SURPRISED -> 3.5f * u
            else -> 0.8f * u
        }
        rect.set(32 * u, 37 * u - mouthOpen / 2, 40 * u, 37 * u + mouthOpen / 2 + 0.8f * u)
        canvas.drawRoundRect(rect, 2 * u, 2 * u, accent)

        canvas.restore()
        canvas.restore()

        // 常にアニメーションさせる（表示中のみ呼ばれる）
        postInvalidateOnAnimation()
    }

    private fun drawLimb(canvas: Canvas, px: Float, py: Float, w: Float, len: Float, angle: Float) {
        canvas.save()
        canvas.rotate(angle, px, py)
        rect.set(px - w / 2, py, px + w / 2, py + len)
        canvas.drawRoundRect(rect, w / 2, w / 2, body)
        canvas.drawRoundRect(rect, w / 2, w / 2, outline)
        canvas.restore()
    }
}
