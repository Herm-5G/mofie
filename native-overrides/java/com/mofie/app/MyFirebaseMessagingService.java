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
    // ✅ REVERTED TO V2
    public static final String CHANNEL_ID = "mofie_messages_high_v2";
    public static final String KEY_REPLY = "mofie_reply_text";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        String title = remoteMessage.getData().get("title");
        String body = remoteMessage.getData().get("body");
        String chatId = remoteMessage.getData().get("chatId");
        String senderName = remoteMessage.getData().get("senderName");

        if (title == null) title = senderName != null ? senderName : "Mofie";
        if (body == null) body = "New message";
        if (chatId == null) chatId = "default";

        showNotification(title, body, chatId);
    }

    private void showNotification(String title, String body, String chatId) {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mofie::NotificationWakeLock");
        wakeLock.acquire(10000);

        // 1. Create the Notification Channel with HIGH importance
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null && mgr.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, 
                        "Chat Messages", 
                        NotificationManager.IMPORTANCE_HIGH // Forces the pop-up
                );
                ch.enableVibration(true); 
                ch.setShowBadge(true);
                ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                
                // Play default phone notification sound
                android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                        .build();
                ch.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, audioAttributes);
                
                mgr.createNotificationChannel(ch);
            }
        }

        // 2. Setup "Reply" Action
        RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY).setLabel("Reply").build();
        Intent replyIntent = new Intent(this, ReplyReceiver.class);
        replyIntent.putExtra("chatId", chatId);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_MUTABLE; 
        }
        PendingIntent replyPending = PendingIntent.getBroadcast(this, chatId.hashCode(), replyIntent, flags);
        
        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                R.drawable.ic_stat_mofie, "Reply", replyPending)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build();

        // 3. Setup Click Action (Open Chat)
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.putExtra("chatId", chatId);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        int openFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            openFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent openPending = PendingIntent.getActivity(this, chatId.hashCode() + 1, openIntent, openFlags);

        // 4. Build Notification (WhatsApp Style)
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_mofie)
                .setColor(Color.parseColor("#00A884")) 
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH) 
                .setDefaults(NotificationCompat.DEFAULT_ALL) // Sound & Vibration
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(openPending)
                .setFullScreenIntent(openPending, true) // ✅ Forces the pop-up banner
                .setGroup(chatId) 
                .addAction(replyAction); 

        NotificationManager mgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) {
            mgr.notify(chatId.hashCode(), builder.build());
        }
        
        if (wakeLock.isHeld()) wakeLock.release();
    }
}
