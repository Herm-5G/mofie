package com.mofie.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "QuickReply")
public class QuickReplyPlugin extends Plugin {
    private static final String PREFS = "mofie_native_auth";

    @PluginMethod
    public void saveAuthTokens(PluginCall call) {
        SharedPreferences.Editor edit = getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit();
        if (call.getString("idToken") != null) edit.putString("idToken", call.getString("idToken"));
        if (call.getString("refreshToken") != null) edit.putString("refreshToken", call.getString("refreshToken"));
        if (call.getString("apiKey") != null) edit.putString("apiKey", call.getString("apiKey"));
        edit.apply();
        JSObject ret = new JSObject(); ret.put("ok", true); call.resolve(ret);
    }

    @PluginMethod
    public void clearAuthTokens(PluginCall call) {
        getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit().clear().apply();
        JSObject ret = new JSObject(); ret.put("ok", true); call.resolve(ret);
    }

    @PluginMethod
    public void getFCMToken(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
        String cached = prefs.getString("fcmToken", null);
        com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            JSObject ret = new JSObject();
            if (task.isSuccessful() && task.getResult() != null) {
                ret.put("token", task.getResult()); call.resolve(ret);
            } else if (cached != null) {
                ret.put("token", cached); call.resolve(ret);
            } else call.reject("Could not get FCM token");
        });
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) { call.resolve(); return; } // TIRAMISU is 33
        if (getActivity() == null) { call.reject("No activity"); return; }
        getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 701);
        call.resolve();
    }

    @PluginMethod
    public void getPendingChatId(PluginCall call) {
        JSObject ret = new JSObject(); ret.put("chatId", MainActivity.consumePendingChatId()); call.resolve(ret);
    }

    // ✅ FIXED: Using raw integer and string to prevent compilation errors on older SDKs
    @PluginMethod
    public void requestFullScreenIntent(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 34) { // Android 14+
                Intent intent = new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT");
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        } catch (Exception e) {
            // Ignore if the settings page doesn't exist on this specific device
        }
        call.resolve();
    }
    }
