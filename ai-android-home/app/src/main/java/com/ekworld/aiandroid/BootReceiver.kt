package com.ekworld.aiandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings

/** 端末の再起動後、前回出現させていたら自動でホーム画面に戻ってくる。 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (Prefs(context).enabled && Settings.canDrawOverlays(context)) {
            OverlayService.start(context)
        }
    }
}
