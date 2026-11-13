package com.mofie.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Volatile ensures the background thread (from notifications) and UI thread see the same value
    private static volatile String pendingChatId = null;
    
    public static String consumePendingChatId() {
        String id = pendingChatId; 
        pendingChatId = null; 
        return id;
    }
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuickReplyPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Handle initial launch from a notification (Cold Start)
        captureChatIntent(getIntent());

        // Start the background service
        Intent serviceIntent = new Intent(this, BackgroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        
        // ✅ CRITICAL FIX: Capacitor needs this to track the new intent
        setIntent(intent); 
        
        // Capture the chat ID from the new notification tap
        captureChatIntent(intent);
        
        // If the app is already open, push the event to the WebView immediately
        if (pendingChatId != null && this.bridge != null && this.bridge.getWebView() != null) {
            final String cid = pendingChatId; 
            
            // Clear it now so the JS doesn't open it twice
            pendingChatId = null; 
            
            this.bridge.getWebView().post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('mofie:openChat',{detail:{chatId:'" + cid + "'}}))";
                this.bridge.getWebView().evaluateJavascript(js, null);
            });
        }
    }
    
    private void captureChatIntent(Intent intent) {
        if (intent != null && intent.hasExtra("chatId")) {
            String cid = intent.getStringExtra("chatId");
            if (cid != null && !cid.isEmpty()) {
                pendingChatId = cid;
            }
            // Remove the extra so it doesn't get re-processed if the activity reloads
            intent.removeExtra("chatId");
        }
    }
}
