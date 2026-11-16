package com.mofie.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class ReplyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle results = RemoteInput.getResultsFromIntent(intent);
        if (results == null) return;

        CharSequence replyCs = results.getCharSequence(MyFirebaseMessagingService.KEY_REPLY);
        if (replyCs == null || replyCs.length() == 0) return;

        final String replyText = replyCs.toString().trim();
        final String chatId = intent.getStringExtra("chatId");
        if (chatId == null || replyText.isEmpty()) return;

        NotificationManager mgr =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (mgr != null) {
            mgr.cancel(chatId.hashCode());
        }

        final PendingResult pending = goAsync();

        new Thread(() -> {
            try {
                SharedPreferences prefs =
                        context.getSharedPreferences("mofie_native_auth", Context.MODE_PRIVATE);

                String idToken = prefs.getString("idToken", null);
                String refreshToken = prefs.getString("refreshToken", null);
                String apiKey = prefs.getString("apiKey", null);

                int status = (idToken != null) ? postReply(chatId, replyText, idToken) : 401;

                if (status != 200 && refreshToken != null && apiKey != null) {
                    String fresh = refreshIdToken(refreshToken, apiKey);
                    if (fresh != null) {
                        prefs.edit().putString("idToken", fresh).apply();
                        postReply(chatId, replyText, fresh);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                pending.finish();
            }
        }).start();
    }

    private int postReply(String chatId, String text, String idToken) throws Exception {
        URL url = new URL("https://workers.dev");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        conn.setRequestProperty("Content-Type", "application/json");

        JSONObject body = new JSONObject();
        body.put("idToken", idToken);
        body.put("chatId", chatId);
        body.put("text", text);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }

        int code = conn.getResponseCode();
        conn.disconnect();
        return code;
    }

    private String refreshIdToken(String refreshToken, String apiKey) {
        try {
            URL url = new URL("https://googleapis.com" + apiKey);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            String params = "grant_type=refresh_token&refresh_token=" + refreshToken;

            try (OutputStream os = conn.getOutputStream()) {
                os.write(params.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() != 200) return null;

            BufferedReader r = new BufferedReader(
                    new InputStreamReader(conn.getInputStream())
            );
            StringBuilder sb = new StringBuilder();
            String line;

            while ((line = r.readLine()) != null) {
                sb.append(line);
            }

            return new JSONObject(sb.toString()).optString("id_token", null);
        } catch (Exception e) {
            return null;
        }
    }
}
