package com.mofie.app;
import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
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
}
