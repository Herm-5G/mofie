package com.mofie.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

public class CallForegroundService extends Service {
    public static final String CHANNEL_ID = "mofie_calls_v1";
    private static final int NOTIF_ID = 777000;
    private static final long TIMEOUT_MS = 45000L;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }

        String callId     = intent.getStringExtra("callId");
        String callerName = intent.getStringExtra("callerName");
        String callType   = intent.getStringExtra("callType");
        if (callId == null) { stopSelf(); return START_NOT_STICKY; }

        ensureChannel();

        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.putExtra("incomingCallId", callId);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent fullScreenPending = PendingIntent.getActivity(
            this, callId.hashCode(), fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent declineIntent = new Intent(this, MainActivity.class);
        declineIntent.putExtra("incomingCallId", callId);
        declineIntent.putExtra("declineCall", true);
        declineIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent declinePending = PendingIntent.getActivity(
            this, callId.hashCode() + 1, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notif = buildCallNotification(
            callerName, callType, fullScreenPending, declinePending);

        // MUST be called within 5 seconds of startForegroundService()
        startForeground(NOTIF_ID, notif);

        // Android 14+ ignores fullScreenIntent when phone is unlocked.
        // Direct startActivity works if user granted SYSTEM_ALERT_WINDOW.
        try { startActivity(fullScreenIntent); } catch (Exception ignored) {}

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            NotificationManager mgr = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (mgr != null) mgr.cancel(NOTIF_ID);
            stopForeground(true);
            stopSelf();
        }, TIMEOUT_MS);

        return START_NOT_STICKY;
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager mgr = getSystemService(NotificationManager.class);
        if (mgr == null || mgr.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Incoming voice and video calls");
        ch.enableLights(true);
        ch.setLightColor(Color.parseColor("#00A884"));
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 1000, 1000});
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        ch.setSound(
            Settings.System.DEFAULT_RINGTONE_URI,
            new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build());
        mgr.createNotificationChannel(ch);
    }

    private Notification buildCallNotification(
            String callerName, String callType,
            PendingIntent answerPending, PendingIntent declinePending) {

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mofie)
            .setColor(Color.parseColor("#00A884"))
            .setContentTitle(callerName != null ? callerName : "Incoming Call")
            .setContentText("video".equals(callType) ? "Mofie video call..." : "Mofie voice call...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(Settings.System.DEFAULT_RINGTONE_URI)
            .setVibrate(new long[]{0, 1000, 1000})
            .setFullScreenIntent(answerPending, true)
            .setContentIntent(answerPending)
            .setOngoing(true)
            .setAutoCancel(false);

        // WhatsApp-style native call card on Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Person caller = new Person.Builder()
                .setName(callerName != null ? callerName : "Incoming Call")
                .setImportant(true)
                .build();
            b.setStyle(NotificationCompat.CallStyle.forIncomingCall(
                caller, declinePending, answerPending));
        }

        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT;
        return n;
    }
        }
