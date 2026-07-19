package com.ustatakip.tadilat.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.ustatakip.tadilat.widget.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var auth: FirebaseAuth

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        auth = FirebaseAuth.getInstance()
        val currentUser = auth.currentUser

        if (currentUser == null) {
            startLoginActivity()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.tvUserEmail.text = currentUser.email

        binding.btnTriggerRefresh.setOnClickListener {
            forceWidgetRefresh()
            Toast.makeText(this, "Widget güncelleme talebi gönderildi!", Toast.LENGTH_SHORT).show()
        }

        binding.btnLogout.setOnClickListener {
            auth.signOut()
            forceWidgetRefresh() // Update widget to clear state
            startLoginActivity()
        }
    }

    private fun forceWidgetRefresh() {
        val intent = Intent(this, RenovationWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        }
        val ids = AppWidgetManager.getInstance(application).getAppWidgetIds(
            ComponentName(application, RenovationWidgetProvider::class.java)
        )
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        sendBroadcast(intent)
    }

    private fun startLoginActivity() {
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
