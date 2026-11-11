package com.mofie.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
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
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) { call.resolve(); return; }
        if (getActivity() == null) { call.reject("No activity"); return; }
        getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 701);
        call.resolve();
    }

    @PluginMethod
    public void getPendingChatId(PluginCall call) {
        JSObject ret = new JSObject(); ret.put("chatId", MainActivity.consumePendingChatId()); call.resolve(ret);
    }

    // ✅ NEW METHOD: Request Full Screen Intent Permission (Required for Android 12+)
    @PluginMethod
    public void requestFullScreenIntent(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm != null && !nm.canUseFullScreenIntent()) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // Android 12 & 13
            // Some OEMs (like Xiaomi/Samsung) have their own full-screen intent settings
            // If you experience issues, you may need specific Intents for those manufacturers.
        }
        call.resolve();
    }
    }
