package app.fleettrackmate.driver.tracking;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.location.Location;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import app.fleettrackmate.driver.MainActivity;
import app.fleettrackmate.driver.R;

/**
 * Records AND sends the driver's position natively, inside the foreground
 * service, so it keeps working while the phone sleeps.
 *
 * THE BUG THIS FIXES: sending used to live in JavaScript. Android (TECNO's
 * HiOS especially) freezes the WebView when the screen goes off, so fixes
 * piled up and went out in a burst only when the driver next opened the app:
 * the manager saw nothing live, and long stretches went dark. Here the GPS,
 * the queue and the upload all live in the service the OS keeps running.
 *
 * Every fix is kept at one per RECORD_INTERVAL_MS of GPS time, written to a
 * queue file first, then delivered:
 *   - a fresh fix goes to `update-location`, which moves the live marker;
 *   - anything that endpoint does not file in history (it keeps only 30 m or
 *     better), and any backlog, goes to `sync-trail` with its real time.
 * The queue only grows while there is no connection. It flushes the moment a
 * network comes back, and on a 60-second retry while anything is waiting.
 */
public class TrackingService extends Service {
    private static final String TAG = "FtmTracking";

    static final String PREFS = "ftm_native_tracker";
    private static final String CHANNEL_ID = "ftm_tracking";
    private static final int NOTIFICATION_ID = 7301;
    private static final String QUEUE_FILE = "ftm_location_queue.json";

    private static final long RECORD_INTERVAL_MS = 30_000;
    private static final long LIVE_MAX_AGE_MS = 60_000;
    private static final long RETRY_MS = 60_000;
    private static final float MAX_ACCURACY_M = 100f;
    private static final int MAX_QUEUE = 5000;
    private static final int BATCH = 100;

    /** The plugin, while the app's JS is listening. */
    interface Listener {
        void onFix(JSONObject fix);
    }

    static volatile Listener listener;
    static volatile TrackingService running;

    private FusedLocationProviderClient fused;
    private LocationCallback callback;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<JSONObject> queue = new ArrayList<>();

    private long lastRecordedFixAt = 0;
    volatile long lastSentAt = 0;
    volatile long lastFixAt = 0;
    volatile String lastError = null;

    private final Runnable retry = new Runnable() {
        @Override
        public void run() {
            submitFlush();
            handler.postDelayed(this, RETRY_MS);
        }
    };

    // ── lifecycle ────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        running = this;
        fused = LocationServices.getFusedLocationProviderClient(this);
        createChannel();
        loadQueue();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("active", false) || prefs.getString("driverId", null) == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startLocationUpdates();
        registerNetworkCallback();
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
        submitFlush();
        // Restarted by the system if it is killed, with the config above.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        // Every pending retry, including the post-reconnect ones, goes with it.
        handler.removeCallbacksAndMessages(null);
        if (callback != null) fused.removeLocationUpdates(callback);
        if (networkCallback != null) {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                cm.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
            }
        }
        running = null;
        io.shutdown();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ── location ─────────────────────────────────────────────────────

    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            lastError = "NOT_AUTHORIZED";
            Log.w(TAG, "Location permission missing; not tracking");
            return;
        }
        if (callback != null) return; // already running

        // Every 10 s, no distance filter: a parked phone must keep reporting,
        // or the record goes silent and reads as "No signal".
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000)
                .setMinUpdateIntervalMillis(5_000)
                .setMinUpdateDistanceMeters(0f)
                .build();

        callback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                for (Location location : result.getLocations()) onFix(location);
            }
        };
        try {
            fused.requestLocationUpdates(request, callback, Looper.getMainLooper());
        } catch (SecurityException e) {
            lastError = "NOT_AUTHORIZED";
            callback = null;
        }
    }

    private void onFix(Location location) {
        long fixAt = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();
        lastFixAt = fixAt;

        JSONObject point = new JSONObject();
        try {
            point.put("latitude", location.getLatitude());
            point.put("longitude", location.getLongitude());
            point.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 0);
            point.put("speed", location.hasSpeed() ? location.getSpeed() * 3.6 : 0); // km/h
            point.put("heading", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            point.put("fixAt", fixAt);
        } catch (Exception ignored) {
        }

        // Every fix to the UI while JS is awake; only some to the record.
        Listener l = listener;
        if (l != null) l.onFix(point);

        if (fixAt - lastRecordedFixAt < RECORD_INTERVAL_MS && fixAt >= lastRecordedFixAt) return;
        if (location.hasAccuracy() && location.getAccuracy() > MAX_ACCURACY_M) return;
        lastRecordedFixAt = fixAt;

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            point.put("driverId", prefs.getString("driverId", ""));
            point.put("adminCode", prefs.getString("adminCode", ""));
            point.put("battery", batteryLevel());
        } catch (Exception ignored) {
        }
        if (io.isShutdown()) return;
        io.execute(() -> {
            synchronized (queue) {
                queue.add(point);
                while (queue.size() > MAX_QUEUE) queue.remove(0);
                saveQueue();
            }
            flush();
        });
    }

    // ── delivery ─────────────────────────────────────────────────────

    /** Queue a flush unless the service is already shutting down. */
    private void submitFlush() {
        if (io.isShutdown()) return;
        try {
            io.execute(this::flush);
        } catch (java.util.concurrent.RejectedExecutionException ignored) {
            // Stopped between the check and the call; nothing left to send to.
        }
    }

    /** Runs on the io thread only, so deliveries never overlap. */
    private void flush() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String url = prefs.getString("functionUrl", null);
        String key = prefs.getString("anonKey", null);
        if (url == null || key == null) return;

        List<JSONObject> pending;
        synchronized (queue) {
            if (queue.isEmpty()) return;
            pending = new ArrayList<>(queue);
        }

        // 1. The newest fix, if fresh, takes the live path (moves the marker).
        JSONObject newest = pending.get(pending.size() - 1);
        if (System.currentTimeMillis() - newest.optLong("fixAt") <= LIVE_MAX_AGE_MS) {
            try {
                JSONObject body = new JSONObject();
                body.put("action", "update-location");
                body.put("driverId", newest.optString("driverId"));
                body.put("adminCode", newest.optString("adminCode"));
                body.put("latitude", newest.optDouble("latitude"));
                body.put("longitude", newest.optDouble("longitude"));
                body.put("speed", Math.max(0, newest.optDouble("speed", 0)));
                body.put("accuracy", newest.optDouble("accuracy", 0));
                if (newest.has("battery")) body.put("batteryLevel", newest.optInt("battery"));
                body.put("isBackground", listener == null);
                Response r = post(url, key, body);
                if (!r.ok()) {
                    handleFailure(r);
                    return; // offline or refused: everything stays queued
                }
                lastSentAt = System.currentTimeMillis();
                // Filed in history only when it was accurate; otherwise keep it
                // for sync-trail below, which files every point.
                if (r.json != null && r.json.optBoolean("accurate", true)) {
                    remove(newest);
                    pending.remove(pending.size() - 1);
                }
            } catch (Exception e) {
                lastError = e.getMessage();
                return;
            }
        }

        // 2. Everything else, in order, with real times.
        while (!pending.isEmpty()) {
            JSONObject head = pending.get(0);
            String driverId = head.optString("driverId");
            String adminCode = head.optString("adminCode");
            List<JSONObject> batch = new ArrayList<>();
            for (JSONObject p : pending) {
                if (batch.size() >= BATCH) break;
                if (driverId.equals(p.optString("driverId")) && adminCode.equals(p.optString("adminCode"))) batch.add(p);
            }
            try {
                JSONArray trail = new JSONArray();
                for (JSONObject p : batch) {
                    JSONObject t = new JSONObject();
                    t.put("latitude", p.optDouble("latitude"));
                    t.put("longitude", p.optDouble("longitude"));
                    t.put("speed", Math.max(0, p.optDouble("speed", 0)));
                    t.put("accuracy", p.optDouble("accuracy", 0));
                    t.put("timestamp", iso(p.optLong("fixAt")));
                    trail.put(t);
                }
                JSONObject body = new JSONObject();
                body.put("action", "sync-trail");
                body.put("driverId", driverId);
                body.put("adminCode", adminCode);
                body.put("trailPoints", trail);
                Response r = post(url, key, body);
                if (r.ok() || r.code == 400) {
                    // 400 is a malformed batch; retrying it forever would wedge
                    // the queue behind it.
                    for (JSONObject p : batch) remove(p);
                    pending.removeAll(batch);
                    if (r.ok()) lastSentAt = System.currentTimeMillis();
                } else {
                    handleFailure(r);
                    return;
                }
            } catch (Exception e) {
                lastError = e.getMessage();
                return;
            }
        }
        lastError = null;
    }

    private void handleFailure(Response r) {
        lastError = r.code == 0 ? "offline" : "http " + r.code;
        // The driver was removed or the code revoked: stop rather than retry.
        if (r.code == 403 || r.code == 404) {
            Log.w(TAG, "Server refused this driver (" + r.code + "); stopping");
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("active", false).apply();
            synchronized (queue) {
                queue.clear();
                saveQueue();
            }
            handler.post(this::stopSelf);
        }
    }

    private static final class Response {
        final int code;
        final JSONObject json;

        Response(int code, JSONObject json) {
            this.code = code;
            this.json = json;
        }

        boolean ok() {
            return code >= 200 && code < 300;
        }
    }

    private Response post(String url, String key, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(20_000);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("apikey", key);
            conn.setRequestProperty("Authorization", "Bearer " + key);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }
            int code = conn.getResponseCode();
            InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            JSONObject json = null;
            if (in != null) {
                byte[] buf = readAll(in);
                try {
                    json = new JSONObject(new String(buf, StandardCharsets.UTF_8));
                } catch (Exception ignored) {
                }
            }
            return new Response(code, json);
        } catch (Exception e) {
            // No network, DNS, timeout — or a real fault, which must be visible.
            Log.w(TAG, "POST failed: " + e);
            lastError = String.valueOf(e);
            return new Response(0, null);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void registerNetworkCallback() {
        if (networkCallback != null) return;
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                // Back online: send what was kept, now — and again shortly
                // after, because the first attempt often lands before DNS and
                // routing are ready, and the regular retry is a minute away.
                submitFlush();
                for (long delay : new long[] {3_000, 10_000, 30_000}) {
                    handler.postDelayed(TrackingService.this::submitFlush, delay);
                }
            }
        };
        try {
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception e) {
            networkCallback = null;
        }
    }

    // ── queue persistence ────────────────────────────────────────────

    int queuedCount() {
        synchronized (queue) {
            return queue.size();
        }
    }

    private void remove(JSONObject point) {
        synchronized (queue) {
            queue.remove(point);
            saveQueue();
        }
    }

    private void loadQueue() {
        File file = new File(getFilesDir(), QUEUE_FILE);
        if (!file.exists()) return;
        try (FileInputStream in = new FileInputStream(file)) {
            JSONArray arr = new JSONArray(new String(readAll(in), StandardCharsets.UTF_8));
            synchronized (queue) {
                queue.clear();
                for (int i = 0; i < arr.length(); i++) queue.add(arr.getJSONObject(i));
            }
        } catch (Exception e) {
            Log.w(TAG, "Queue unreadable; starting empty", e);
        }
    }

    /** Caller holds the queue lock. Written whole: it is small and capped. */
    private void saveQueue() {
        JSONArray arr = new JSONArray();
        for (JSONObject p : queue) arr.put(p);
        File tmp = new File(getFilesDir(), QUEUE_FILE + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(arr.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "Queue write failed", e);
            return;
        }
        //noinspection ResultOfMethodCallIgnored
        tmp.renameTo(new File(getFilesDir(), QUEUE_FILE));
    }

    // ── helpers ──────────────────────────────────────────────────────

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static String iso(long ms) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(ms));
    }

    private int batteryLevel() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            int level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            return level >= 0 && level <= 100 ? level : 100;
        } catch (Exception e) {
            return 100;
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "On duty", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shown while your location is shared with your fleet manager.");
        channel.setShowBadge(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_trackmate)
                .setColor(Color.parseColor("#00FF39"))
                .setContentTitle("TrackMate — on duty")
                .setContentText("Sharing your location with your fleet manager.")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(content)
                .build();
    }
}
