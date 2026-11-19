package com.mofie.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
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
    // FIXED: Point to your actual Cloudflare Worker URL
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

        // Immediately update the notification to show "Sending..."
        updateBanner(context, chatId, "Sending...");

        final PendingResult pendingResult = goAsync();

        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                // FIXED: Use device-protected storage so it works when directBootAware
                Context storageCtx = context;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    storageCtx = context.createDeviceProtectedStorageContext();
                }
                SharedPreferences prefs = storageCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

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
                e.printStackTrace();
                updateBanner(context, chatId, "Failed to send reply");
            } finally {
                pendingResult.finish();
            }
        });
    }

    private String refreshIdToken(String refreshToken, String apiKey) {
        try {
            // FIXED: Correct Google Secure Token URL
            URL url = new URL("https://securetoken.googleapis.com/v1/token?key=" + apiKey);
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
                // FIXED: Google returns "access_token" for refreshed ID tokens, not "id_token"
                return new JSONObject(resp).getString("access_token"); 
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
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }
        
        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
             // Print error stream for debugging
             Scanner s = new Scanner(conn.getErrorStream()).useDelimiter("\\A");
             String err = s.hasNext() ? s.next() : "";
             System.out.println("Worker Error: " + err);
        }
        
        return responseCode == 200;
    }

    private void updateBanner(Context context, String chatId, String statusText) {
        NotificationManager mgr = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) {
            NotificationCompat.Builder repliedNotif = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_mofie)
                .setContentTitle("Mofie")
                .setContentText(statusText)
                .setTimeoutAfter(3000); // Give the user 3 seconds to see it
            mgr.notify(chatId.hashCode(), repliedNotif.build());
        }
    }
}
