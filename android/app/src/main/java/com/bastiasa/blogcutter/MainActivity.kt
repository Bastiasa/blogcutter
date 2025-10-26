package com.bastiasa.blogcutter

import android.os.Bundle
import android.util.Log
import android.webkit.WebSettings
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MediaManager::class.java)
        super.onCreate(savedInstanceState)

        bridge.webView.settings.apply {
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            useWideViewPort = true
            loadWithOverviewMode = false
            domStorageEnabled = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            javaScriptCanOpenWindowsAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            //setEnableSmoothTransition(true)
        }

        // Forzar renderización por hardware
        bridge.webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
    }
}
