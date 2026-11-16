package com.mofie.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class BackgroundService extends Service {
    private static final String CHANNEL_ID = "mofie_bg_service";

    @Override
    public void onCreate() {
        super.onCreate();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Mofie background service",
                    NotificationManager.IMPORTANCE_LOW
            );

            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null) {
                mgr.createNotificationChannel(channel);
            }
        }

        Notification notification;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notification = new Notification.Builder(this, CHANNEL_ID)
                    .setContentTitle("Mofie is running")
                    .setContentText("Keeping messages available")
                    .setSmallIcon(R.drawable.ic_stat_mofie)
                    .build();
        } else {
            notification = new Notification.Builder(this)
                    .setContentTitle("Mofie is running")
                    .setContentText("Keeping messages available")
                    .setSmallIcon(R.drawable.ic_stat_mofie)
                    .build();
        }

        startForeground(1, notification);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
