package com.mofie.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static volatile String pendingChatId = null;
    private static volatile String pendingCallId = null;

    public static String consumePendingChatId() {
        String id = pendingChatId;
        pendingChatId = null;
        return id;
    }

    public static String consumePendingCallId() {
        String id = pendingCallId;
        pendingCallId = null;
        return id;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuickReplyPlugin.class);
        registerPlugin(FastContactsPlugin.class);
        super.onCreate(savedInstanceState);

        // Allow incoming call screen to wake device and show over lockscreen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // Start foreground background service so system optimization doesn't kill Mofie
        try {
            Intent bgIntent = new Intent(this, BackgroundService.class);
            ContextCompat.startForegroundService(this, bgIntent);
        } catch (Exception ignored) {}

        captureIntentExtras(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureIntentExtras(intent);

        if (pendingCallId != null && this.bridge != null && this.bridge.getWebView() != null) {
            final String callId = pendingCallId;
            pendingCallId = null;
            this.bridge.getWebView().post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('mofie:incomingCall',{detail:{callId:'" + callId + "'}}))";
                this.bridge.getWebView().evaluateJavascript(js, null);
            });
        }

        if (pendingChatId != null && this.bridge != null && this.bridge.getWebView() != null) {
            final String cid = pendingChatId;
            pendingChatId = null;
            this.bridge.getWebView().post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('mofie:openChat',{detail:{chatId:'" + cid + "'}}))";
                this.bridge.getWebView().evaluateJavascript(js, null);
            });
        }
    }

    private void captureIntentExtras(Intent intent) {
        if (intent == null) return;
        if (intent.hasExtra("chatId")) {
            String cid = intent.getStringExtra("chatId");
            if (cid != null && !cid.isEmpty()) pendingChatId = cid;
            intent.removeExtra("chatId");
        }
        if (intent.hasExtra("incomingCallId")) {
            String callId = intent.getStringExtra("incomingCallId");
            if (callId != null && !callId.isEmpty()) pendingCallId = callId;
            intent.removeExtra("incomingCallId");
        }
    }
}
