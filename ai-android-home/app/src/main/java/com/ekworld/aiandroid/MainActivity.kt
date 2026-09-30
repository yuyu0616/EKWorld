package com.ekworld.aiandroid

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.ekworld.aiandroid.databinding.ActivityMainBinding

/** 設定画面。API キーやキャラクターの性格を入力し、ホーム画面に出現させる。 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: Prefs

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)

        binding.apiKey.setText(prefs.apiKey)
        binding.name.setText(prefs.name)
        binding.personality.setText(prefs.personality)

        binding.save.setOnClickListener {
            save()
            Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show()
        }
        binding.start.setOnClickListener { summon() }
        binding.stop.setOnClickListener { OverlayService.stop(this) }
        binding.reset.setOnClickListener {
            Conversation.clear()
            Toast.makeText(this, R.string.conversation_reset, Toast.LENGTH_SHORT).show()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun save() {
        prefs.apiKey = binding.apiKey.text?.toString().orEmpty()
        prefs.name = binding.name.text?.toString().orEmpty()
        prefs.personality = binding.personality.text?.toString().orEmpty()
    }

    private fun summon() {
        save()
        if (prefs.apiKey.isBlank()) {
            Toast.makeText(this, R.string.api_key_missing, Toast.LENGTH_LONG).show()
            return
        }
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, R.string.overlay_permission_needed, Toast.LENGTH_LONG).show()
            startActivity(
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            )
            return
        }
        OverlayService.start(this)
        // ホーム画面に戻って、歩き回る姿を見せる
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME))
    }
}
