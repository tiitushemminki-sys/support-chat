package com.supportchat.app
import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.widget.Toast
import androidx.activity.ComponentActivity
class MainActivity : ComponentActivity() {
 private val ADMIN_URL = "https://support-chat-d1ev.onrender.com/admin.html"
 private lateinit var web: WebView
 @SuppressLint("SetJavaScriptEnabled") override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); web=WebView(this); web.settings.javaScriptEnabled=true; web.settings.domStorageEnabled=true; web.webChromeClient=WebChromeClient(); web.webViewClient=WebViewClient(); setContentView(web); web.loadUrl(ADMIN_URL) }
 @Deprecated("Deprecated in Java") override fun onBackPressed(){if(::web.isInitialized&&web.canGoBack())web.goBack() else super.onBackPressed()}
}
