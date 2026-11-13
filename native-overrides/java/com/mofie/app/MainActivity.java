package com.mofie.app;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static volatile String pendingChatId = null;
    
    public static String consumePendingChatId() {
        String id = pendingChatId; pendingChatId = null; return id;
    }
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuickReplyPlugin.class);
        super.onCreate(savedInstanceState);
        captureChatIntent(getIntent());

        // ✅ Start the background service
        Intent serviceIntent = new Intent(this, BackgroundService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        captureChatIntent(intent);
        if (pendingChatId != null && this.bridge != null && this.bridge.getWebView() != null) {
            final String cid = pendingChatId; pendingChatId = null;
            this.bridge.getWebView().post(() -> this.bridge.getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('mofie:openChat',{detail:{chatId:'" + cid + "'}}))", null));
        }
    }
    
    private void captureChatIntent(Intent intent) {
        if (intent != null && intent.hasExtra("chatId")) {
            String cid = intent.getStringExtra("chatId");
            if (cid != null && !cid.isEmpty()) pendingChatId = cid;
            intent.removeExtra("chatId");
        }
    }
}
