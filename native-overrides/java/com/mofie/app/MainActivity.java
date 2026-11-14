package com.mofie.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static volatile String pendingChatId = null;
    
    public static String consumePendingChatId() {
        String id = pendingChatId; 
        pendingChatId = null; 
        return id;
    }
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuickReplyPlugin.class);
        registerPlugin(FastContactsPlugin.class); 
        
        super.onCreate(savedInstanceState);
        
        captureChatIntent(getIntent());

        // ❌ DELETED THE BLOCK THAT STARTED BackgroundService HERE
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent); 
        captureChatIntent(intent);
        
        if (pendingChatId != null && this.bridge != null && this.bridge.getWebView() != null) {
            final String cid = pendingChatId; 
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
            intent.removeExtra("chatId");
        }
    }
}
