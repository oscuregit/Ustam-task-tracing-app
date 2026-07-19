package com.ustatakip.tadilat.widget

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.ustatakip.tadilat.widget.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var auth: FirebaseAuth

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize Firebase Auth
        auth = FirebaseAuth.getInstance()

        // If user is already authenticated, jump to MainActivity
        if (auth.currentUser != null) {
            startMainActivity()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnSubmitLogin.setOnClickListener {
            handleLogin()
        }
    }

    private fun handleLogin() {
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, getString(R.string.error_empty_fields), Toast.LENGTH_LONG).show()
            return
        }

        // Show spinner, disable elements
        binding.progressBar.visibility = View.VISIBLE
        binding.btnSubmitLogin.isEnabled = false

        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(this) { task ->
                binding.progressBar.visibility = View.GONE
                binding.btnSubmitLogin.isEnabled = true

                if (task.isSuccessful) {
                    Toast.makeText(this, "Giriş Başarılı!", Toast.LENGTH_SHORT).show()
                    startMainActivity()
                } else {
                    Toast.makeText(
                        this,
                        task.exception?.message ?: getString(R.string.error_auth_failed),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
    }

    private fun startMainActivity() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
