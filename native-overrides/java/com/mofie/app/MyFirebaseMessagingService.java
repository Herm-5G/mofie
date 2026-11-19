package com.mofie.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.graphics.drawable.IconCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    public static final String KEY_REPLY = "key_text_reply";
    public static final String CHANNEL_ID = "mofie_messages_high_v5";

    private SharedPreferences getSafePrefs() {
        Context storageCtx = this;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            storageCtx = createDeviceProtectedStorageContext();
        }
        return storageCtx.getSharedPreferences("mofie_native_auth", Context.MODE_PRIVATE);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        getSafePrefs().edit().putString("fcmToken", token).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data.isEmpty()) return;

        wakeScreen();

        String kind = data.get("kind");
        String title = data.getOrDefault("title", data.getOrDefault("senderName", "Mofie"));
        String body = data.getOrDefault("body", "New message");
        String chatId = data.getOrDefault("chatId", "default");
        String senderPhoto = data.get("senderPhoto");

        if ("incoming_call".equals(kind)) {
            showIncomingCallNotification(data);
        } else {
            showQuickReplyNotification(title, body, chatId, senderPhoto);
        }
    }

    private void wakeScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "mofie:MessageWakeLock"
                );
                wl.acquire(4000);
            }
        } catch (Exception ignored) {}
    }

    private Bitmap downloadCircularBitmap(String urlString) {
        if (urlString == null || urlString.trim().isEmpty()) return null;
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setDoInput(true);
            conn.connect();
            try (InputStream input = conn.getInputStream()) {
                Bitmap raw = BitmapFactory.decodeStream(input);
                if (raw == null) return null;

                int size = Math.min(raw.getWidth(), raw.getHeight());
                Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(output);
                Paint paint = new Paint();
                Rect rect = new Rect(0, 0, size, size);

                paint.setAntiAlias(true);
                canvas.drawARGB(0, 0, 0, 0);
                canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
                paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
                canvas.drawBitmap(raw, rect, rect, paint);
                return output;
            }
        } catch (Exception e) {
            return null;
        }
    }

    private void showQuickReplyNotification(String title, String body, String chatId, String senderPhotoUrl) {
        NotificationManager mgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr == null) return;

        Uri defaultSound = Settings.System.DEFAULT_NOTIFICATION_URI;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Chat Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Instant chat message alerts");
            ch.enableLights(true);
            ch.setLightColor(Color.parseColor("#00A884"));
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 250, 150, 250});
            ch.setShowBadge(true);
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            AudioAttributes attr = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            ch.setSound(defaultSound, attr);
            mgr.createNotificationChannel(ch);
        }

        RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY)
            .setLabel("Reply to " + title + "...")
            .build();

        Intent replyIntent = new Intent(this, ReplyReceiver.class);
        replyIntent.putExtra("chatId", chatId);

        int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            replyFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent replyPending = PendingIntent.getBroadcast(
            this, chatId.hashCode(), replyIntent, replyFlags
        );

        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
            R.drawable.ic_stat_mofie, "Reply", replyPending)
            .addRemoteInput(remoteInput)
            .setAllowGeneratedReplies(true)
            .build();

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.putExtra("chatId", chatId);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int openFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPending = PendingIntent.getActivity(
            this, chatId.hashCode() + 1, openIntent, openFlags
        );

        // ✅ Download avatar & attach to Person and LargeIcon
        Bitmap avatar = downloadCircularBitmap(senderPhotoUrl);
        Person.Builder senderBuilder = new Person.Builder().setName(title);
        if (avatar != null) {
            senderBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        }
        Person sender = senderBuilder.build();

        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(sender)
            .addMessage(body, System.currentTimeMillis(), sender);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mofie)
            .setColor(Color.parseColor("#00A884"))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(style)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(defaultSound)
            .setAutoCancel(true)
            .setContentIntent(openPending)
            .addAction(replyAction);

        if (avatar != null) {
            builder.setLargeIcon(avatar);
        }

        mgr.notify(chatId.hashCode(), builder.build());
    }

    private void showIncomingCallNotification(Map<String, String> data) {
        String callId = data.get("callId");
        String callerName = data.getOrDefault("callerName", "Incoming Call");
        if (callId == null) return;

        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.putExtra("incomingCallId", callId);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenPending = PendingIntent.getActivity(
            this, callId.hashCode(), fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mofie)
            .setContentTitle(callerName)
            .setContentText("Incoming Mofie call...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPending, true)
            .setAutoCancel(true);

        NotificationManager mgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) mgr.notify(callId.hashCode(), builder.build());
    }
}
