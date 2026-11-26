package com.mofie.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import java.util.concurrent.Executors;

public class ReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mofie_native_auth";
    private static final String WORKER_URL = "https://mofie-api.hermanedaru.workers.dev";
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

        updateBanner(context, chatId, "Sending…");
        final PendingResult pendingResult = goAsync();

        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                Context storageCtx = context;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    storageCtx = context.createDeviceProtectedStorageContext();
                }
                SharedPreferences prefs = storageCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

                String idToken     = prefs.getString("idToken", null);
                String refreshToken = prefs.getString("refreshToken", null);
                String apiKey      = prefs.getString("apiKey", null);

                // ✅ Bug-fix: refresh returns id_token (JWT), NOT access_token
                if (refreshToken != null && apiKey != null) {
                    String fresh = refreshIdToken(refreshToken, apiKey, prefs);
                    if (fresh != null) {
                        idToken = fresh;
                        prefs.edit().putString("idToken", fresh).apply();
                    }
                }

                if (idToken == null) {
                    updateBanner(context, chatId, "Open Mofie once to enable replies");
                    return;
                }

                boolean ok = sendToWorkerQuickReply(idToken, chatId, replyText);
                updateBanner(context, chatId, ok ? "You: " + replyText : "Failed to send");
            } catch (Exception e) {
                e.printStackTrace();
                updateBanner(context, chatId, "Failed to send reply");
            } finally {
                pendingResult.finish();
            }
        });
    }

    private String refreshIdToken(String refreshToken, String apiKey, SharedPreferences prefs) {
        try {
            URL url = new URL("https://securetoken.googleapis.com/v1/token?key=" + apiKey);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);

            String body = "grant_type=refresh_token&refresh_token="
                + URLEncoder.encode(refreshToken, "UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() == 200) {
                Scanner s = new Scanner(conn.getInputStream()).useDelimiter("\\A");
                String resp = s.hasNext() ? s.next() : "";
                JSONObject json = new JSONObject(resp);

                // Persist rotated refresh token — Google invalidates the old one
                String newRefresh = json.optString("refresh_token", null);
                if (newRefresh != null && !newRefresh.isEmpty()) {
                    prefs.edit().putString("refreshToken", newRefresh).apply();
                }

                String freshId = json.optString("id_token", null);
                if (freshId != null && !freshId.isEmpty()) return freshId;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
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
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }

        int rc = conn.getResponseCode();
        if (rc != 200) {
            Scanner s = new Scanner(conn.getErrorStream() != null
                ? conn.getErrorStream() : conn.getInputStream()).useDelimiter("\\A");
            System.out.println("[ReplyReceiver] worker " + rc + ": " + (s.hasNext() ? s.next() : ""));
        }
        return rc == 200;
    }

    private void updateBanner(Context context, String chatId, String statusText) {
        NotificationManager mgr = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr == null) return;

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.putExtra("chatId", chatId);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            context, chatId.hashCode() + 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mofie)
            .setColor(Color.parseColor("#00A884"))
            .setContentTitle("Mofie")
            .setContentText(statusText)
            .setContentIntent(openPending)
            .setAutoCancel(true)
            .setTimeoutAfter(8000);

        mgr.notify(chatId.hashCode(), b.build());
    }
}
