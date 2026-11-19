package com.mofie.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import java.util.concurrent.Executors;

public class ReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mofie_native_auth";
    private static final String WORKER_URL = "https://workers.dev";
    private static final String CHANNEL_ID = "mofie_messages_high_v5";

    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) return;

        CharSequence replyCharSeq = remoteInput.getCharSequence(MyFirebaseMessagingService.KEY_REPLY);
        String chatId = intent.getStringExtra("chatId");
        if (replyCharSeq == null || chatId == null) return;

        String replyText = replyCharSeq.toString().trim();
        if (replyText.isEmpty()) return;

        final PendingResult pendingResult = goAsync();

        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String idToken = prefs.getString("idToken", null);
                String refreshToken = prefs.getString("refreshToken", null);
                String apiKey = prefs.getString("apiKey", null);

                // Always refresh token in case the app was killed for over an hour
                if (refreshToken != null && apiKey != null) {
                    String freshToken = refreshIdToken(refreshToken, apiKey);
                    if (freshToken != null) {
                        idToken = freshToken;
                        prefs.edit().putString("idToken", idToken).apply();
                    }
                }

                if (idToken != null) {
                    boolean ok = sendToWorkerQuickReply(idToken, chatId, replyText);
                    updateBanner(context, chatId, ok ? "You: " + replyText : "Failed to send");
                } else {
                    updateBanner(context, chatId, "Open Mofie once to sync quick reply");
                }
            } catch (Exception e) {
                updateBanner(context, chatId, "Failed to send reply");
            } finally {
                pendingResult.finish();
            }
        });
    }

    private String refreshIdToken(String refreshToken, String apiKey) {
        try {
            URL url = new URL("https://googleapis.com" + apiKey);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setDoOutput(true);

            String body = "grant_type=refresh_token&refresh_token=" + refreshToken;
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() == 200) {
                Scanner s = new Scanner(conn.getInputStream()).useDelimiter("\\A");
                String resp = s.hasNext() ? s.next() : "";
                return new JSONObject(resp).getString("id_token");
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean sendToWorkerQuickReply(String idToken, String chatId, String text) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("idToken", idToken);
        payload.put("chatId", chatId);
        payload.put("text", text);

        URL url = new URL(WORKER_URL + "/quick-reply");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }
        return conn.getResponseCode() == 200;
    }

    private void updateBanner(Context context, String chatId, String statusText) {
        NotificationManager mgr = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) {
            NotificationCompat.Builder repliedNotif = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_mofie)
                .setContentTitle("Mofie")
                .setContentText(statusText)
                .setTimeoutAfter(1500);
            mgr.notify(chatId.hashCode(), repliedNotif.build());
        }
    }
}
