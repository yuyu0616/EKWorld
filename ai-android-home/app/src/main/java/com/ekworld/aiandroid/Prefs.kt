package com.ekworld.aiandroid

import android.content.Context

/** アプリ設定（API キー・名前・性格）の保存先。端末内のアプリ専用領域にのみ保存される。 */
class Prefs(context: Context) {
    private val appContext = context.applicationContext
    private val sp = appContext.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var apiKey: String
        get() = sp.getString(KEY_API_KEY, "").orEmpty()
        set(value) = sp.edit().putString(KEY_API_KEY, value.trim()).apply()

    var name: String
        get() = sp.getString(KEY_NAME, null)?.takeIf { it.isNotBlank() } ?: DEFAULT_NAME
        set(value) = sp.edit().putString(KEY_NAME, value.trim()).apply()

    var personality: String
        get() = sp.getString(KEY_PERSONALITY, null)?.takeIf { it.isNotBlank() }
            ?: appContext.getString(R.string.personality_default)
        set(value) = sp.edit().putString(KEY_PERSONALITY, value.trim()).apply()

    /** 端末再起動時に自動で出現させるか（「しまう」を押すと false になる）。 */
    var enabled: Boolean
        get() = sp.getBoolean(KEY_ENABLED, false)
        set(value) = sp.edit().putBoolean(KEY_ENABLED, value).apply()

    companion object {
        private const val KEY_API_KEY = "api_key"
        private const val KEY_NAME = "name"
        private const val KEY_PERSONALITY = "personality"
        private const val KEY_ENABLED = "enabled"
        const val DEFAULT_NAME = "エク"
    }
}
