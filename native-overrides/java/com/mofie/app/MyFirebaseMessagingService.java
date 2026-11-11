package com.mofie.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    // CHANGED: Appended _v2 to force Android to re-read the IMPORTANCE_HIGH setting
    public static final String CHANNEL_ID = "mofie_messages_high_v2";
    public static final String KEY_REPLY = "mofie_reply_text";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        String title = remoteMessage.getData().get("title");
        String body = remoteMessage.getData().get("body");
        String chatId = remoteMessage.getData().get("chatId");
        if (title == null) title = "Mofie";
        if (body == null) body = "New message";
        if (chatId == null) chatId = "default";
        showNotification(title, body, chatId);
    }

    private void showNotification(String title, String body, String chatId) {
        // 1. WAKE LOCK: Force the CPU to stay awake so the screen can turn on
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mofie::NotificationWakeLock");
        wakeLock.acquire(10000); // Hold for 10 seconds

        // 2. CHANNEL CREATION: Must be IMPORTANCE_HIGH for pop-ups
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null && mgr.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Messages", NotificationManager.IMPORTANCE_HIGH);
                ch.enableVibration(true); 
                ch.setShowBadge(true);
                ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                mgr.createNotificationChannel(ch);
            }
        }

        // 3. REPLY ACTION SETUP
        RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY).setLabel("Reply").build();
        Intent replyIntent = new Intent(this, ReplyReceiver.class);
        replyIntent.putExtra("chatId", chatId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_MUTABLE;
        PendingIntent replyPending = PendingIntent.getBroadcast(this, chatId.hashCode(), replyIntent, flags);
        
        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(R.drawable.ic_stat_mofie, "Reply", replyPending)
                .addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build();

        // 4. OPEN APP INTENT SETUP
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.putExtra("chatId", chatId);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int oFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) oFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPending = PendingIntent.getActivity(this, chatId.hashCode() + 1, openIntent, oFlags);

        // 5. BUILD THE NOTIFICATION
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_mofie)
                .setColor(Color.parseColor("#00A884"))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                // CATEGORY_CALL forces the system to treat this as an urgent alert
                .setCategory(NotificationCompat.CATEGORY_CALL) 
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(openPending)
                .addAction(replyAction)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_SOUND)
                // THIS IS THE CRITICAL LINE FOR WAKING THE SCREEN
                .setFullScreenIntent(openPending, true); 

        NotificationManager mgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) mgr.notify(chatId.hashCode(), builder.build());
        
        // Release the wake lock
        if (wakeLock.isHeld()) wakeLock.release();
    }
            }
