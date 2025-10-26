package com.bastiasa.blogcutter

import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d("PluginRegister", "Registering MediaManager...")
        registerPlugin(MediaManager::class.java)
        Log.d("PluginRegister", "MediaManager registered.")
        super.onCreate(savedInstanceState)
    }
}
