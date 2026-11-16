package com.mofie.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "mofie_messages_high_v4";
    public static final String CALL_CHANNEL_ID = "mofie_calls_high_v2";
    public static final String KEY_REPLY = "mofie_reply_text";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String kind = data.get("kind");

        if ("incoming_call".equals(kind)) {
            String callId = data.get("callId");
            String callerName = data.get("callerName");
            String callType = data.get("callType");

            showFullScreenCallNotification(
                    callId != null ? callId : "call",
                    callerName != null ? callerName : "Incoming Call",
                    callType != null ? callType : "voice"
            );
            return;
        }

        String title = data.get("title");
        String body = data.get("body");
        String chatId = data.get("chatId");
        String senderName = data.get("senderName");

        if (title == null && remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
        }

        if (body == null && remoteMessage.getNotification() != null) {
            body = remoteMessage.getNotification().getBody();
        }

        if (title == null) {
            title = senderName != null ? senderName : "Mofie";
        }

        if (body == null) {
            body = "New message";
        }

        if (chatId == null) {
            chatId = "default";
        }

        showMessageNotification(title, body, chatId);
    }

    private void showFullScreenCallNotification(
            String callId,
            String callerName,
            String callType
    ) {
        PowerManager pm =
                (PowerManager) getSystemService(Context.POWER_SERVICE);

        PowerManager.WakeLock wakeLock = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "Mofie::IncomingCallWakeLock"
        );

        wakeLock.acquire(30000);

        try {
            NotificationManager mgr =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            if (mgr == null) return;

            Uri ringtoneUri = Settings.System.DEFAULT_RINGTONE_URI;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                        CALL_CHANNEL_ID,
                        "Incoming Calls",
                        NotificationManager.IMPORTANCE_HIGH
                );
                ch.setDescription("Full-screen incoming voice and video calls");
                ch.enableLights(true);
                ch.setLightColor(Color.parseColor("#00A884"));
                ch.enableVibration(true);
                ch.setVibrationPattern(new long[]{0, 800, 400, 800});
                ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                AudioAttributes attr = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();

                ch.setSound(ringtoneUri, attr);
                mgr.createNotificationChannel(ch);
            }

            Intent fullScreenIntent = new Intent(this, MainActivity.class);
            fullScreenIntent.putExtra("incomingCallId", callId);
            fullScreenIntent.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            );

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                    this,
                    callId.hashCode(),
                    fullScreenIntent,
                    pendingFlags
            );

            String label = "video".equals(callType)
                    ? "Incoming Mofie video call"
                    : "Incoming Mofie voice call";

            NotificationCompat.Builder builder =
                    new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                            .setSmallIcon(R.drawable.ic_stat_mofie)
                            .setColor(Color.parseColor("#00A884"))
                            .setContentTitle(callerName)
                            .setContentText(label)
                            .setPriority(NotificationCompat.PRIORITY_MAX)
                            .setCategory(NotificationCompat.CATEGORY_CALL)
                            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                            .setSound(ringtoneUri)
                            .setOngoing(true)
                            .setAutoCancel(true)
                            .setFullScreenIntent(fullScreenPendingIntent, true)
                            .setContentIntent(fullScreenPendingIntent);

            mgr.notify(callId.hashCode(), builder.build());
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    private void showMessageNotification(String title, String body, String chatId) {
        PowerManager pm =
                (PowerManager) getSystemService(Context.POWER_SERVICE);

        PowerManager.WakeLock wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Mofie::NotificationWakeLock"
        );

        wakeLock.acquire(10000);

        try {
            NotificationManager mgr =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            if (mgr == null) return;

            Uri defaultSound = Settings.System.DEFAULT_NOTIFICATION_URI;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID,
                        "Chat Messages",
                        NotificationManager.IMPORTANCE_HIGH
                );
                ch.enableLights(true);
                ch.setLightColor(Color.parseColor("#00A884"));
                ch.enableVibration(true);
                ch.setShowBadge(true);
                ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .build();

                ch.setSound(defaultSound, audioAttributes);
                mgr.createNotificationChannel(ch);
            }

            RemoteInput remoteInput =
                    new RemoteInput.Builder(KEY_REPLY)
                            .setLabel("Reply")
                            .build();

            Intent replyIntent = new Intent(this, ReplyReceiver.class);
            replyIntent.putExtra("chatId", chatId);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }

            PendingIntent replyPending = PendingIntent.getBroadcast(
                    this,
                    chatId.hashCode(),
                    replyIntent,
                    flags
            );

            NotificationCompat.Action replyAction =
                    new NotificationCompat.Action.Builder(
                            R.drawable.ic_stat_mofie,
                            "Reply",
                            replyPending
                    )
                            .addRemoteInput(remoteInput)
                            .setAllowGeneratedReplies(true)
                            .build();

            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.putExtra("chatId", chatId);
            openIntent.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            );

            int openFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                openFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent openPending = PendingIntent.getActivity(
                    this,
                    chatId.hashCode() + 1,
                    openIntent,
                    openFlags
            );

            NotificationCompat.Builder builder =
                    new NotificationCompat.Builder(this, CHANNEL_ID)
                            .setSmallIcon(R.drawable.ic_stat_mofie)
                            .setColor(Color.parseColor("#00A884"))
                            .setContentTitle(title)
                            .setContentText(body)
                            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                            .setPriority(NotificationCompat.PRIORITY_MAX)
                            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                            .setSound(defaultSound)
                            .setAutoCancel(true)
                            .setContentIntent(openPending)
                            .setGroup(chatId)
                            .addAction(replyAction);

            mgr.notify(chatId.hashCode(), builder.build());
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
}
