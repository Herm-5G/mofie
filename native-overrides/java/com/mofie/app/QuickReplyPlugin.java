package com.mofie.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "QuickReply")
public class QuickReplyPlugin extends Plugin {
    private static final String PREFS = "mofie_native_auth";
    private static final String CHANNEL_ID = "mofie_messages_high_v3";

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
                String token = task.getResult();
                prefs.edit().putString("fcmToken", token).apply();
                ret.put("token", token); call.resolve(ret);
            } else if (cached != null) {
                ret.put("token", cached); call.resolve(ret);
            } else call.reject("Could not get FCM token");
        });
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) { call.resolve(); return; }
        if (getActivity() == null) { call.reject("No activity"); return; }
        getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 701);
        call.resolve();
    }

    @PluginMethod
    public void getPendingChatId(PluginCall call) {
        JSObject ret = new JSObject(); ret.put("chatId", MainActivity.consumePendingChatId()); call.resolve(ret);
    }

    @PluginMethod
    public void requestFullScreenIntent(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                Intent intent = new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT");
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        } catch (Exception e) {
            // Ignore if unavailable
        }
        call.resolve();
    }

    @PluginMethod
    public void showHeadsUp(PluginCall call) {
        String title = call.getString("title", "Mofie");
        String body = call.getString("body", "New message");
        String chatId = call.getString("chatId", "default");

        Context ctx = getContext();
        NotificationManager mgr = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr == null) { call.resolve(); return; }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "Chat Messages",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ch.enableVibration(true);
            ch.setShowBadge(true);
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            AudioAttributes attr = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
            ch.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, attr);
            mgr.createNotificationChannel(ch);
        }

        RemoteInput remoteInput = new RemoteInput.Builder(MyFirebaseMessagingService.KEY_REPLY)
                .setLabel("Reply").build();
        Intent replyIntent = new Intent(ctx, ReplyReceiver.class);
        replyIntent.putExtra("chatId", chatId);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent replyPending = PendingIntent.getBroadcast(ctx, chatId.hashCode(), replyIntent, flags);

        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                R.drawable.ic_stat_mofie, "Reply", replyPending)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build();

        Intent openIntent = new Intent(ctx, MainActivity.class);
        openIntent.putExtra("chatId", chatId);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int openFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            openFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent openPending = PendingIntent.getActivity(ctx, chatId.hashCode() + 1, openIntent, openFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_mofie)
                .setColor(Color.parseColor("#00A884"))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(openPending)
                .setGroup(chatId)
                .addAction(replyAction);

        mgr.notify(chatId.hashCode(), builder.build());
        call.resolve();
    }
}
