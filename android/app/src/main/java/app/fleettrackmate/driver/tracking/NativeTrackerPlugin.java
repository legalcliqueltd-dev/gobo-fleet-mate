package app.fleettrackmate.driver.tracking;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * JS face of {@link TrackingService}. JS starts and stops it and listens for
 * fixes to draw the UI; it no longer records or sends anything on Android —
 * the service does, because it keeps running when the WebView is frozen.
 */
@CapacitorPlugin(name = "NativeTracker")
public class NativeTrackerPlugin extends Plugin {

    @Override
    public void load() {
        TrackingService.listener = this::emitFix;
    }

    @Override
    protected void handleOnDestroy() {
        TrackingService.listener = null;
    }

    private void emitFix(JSONObject fix) {
        try {
            notifyListeners("location", JSObject.fromJSONObject(fix));
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        String driverId = call.getString("driverId");
        String adminCode = call.getString("adminCode");
        String functionUrl = call.getString("functionUrl");
        String anonKey = call.getString("anonKey");
        if (driverId == null || adminCode == null || functionUrl == null || anonKey == null) {
            call.reject("driverId, adminCode, functionUrl and anonKey are required");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(TrackingService.PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("active", true)
                .putString("driverId", driverId)
                .putString("adminCode", adminCode)
                .putString("functionUrl", functionUrl)
                .putString("anonKey", anonKey)
                .apply();
        try {
            ContextCompat.startForegroundService(ctx, new Intent(ctx, TrackingService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start tracking: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(TrackingService.PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("active", false)
                .apply();
        ctx.stopService(new Intent(ctx, TrackingService.class));
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(TrackingService.PREFS, Context.MODE_PRIVATE);
        TrackingService svc = TrackingService.running;
        JSObject out = new JSObject();
        out.put("active", prefs.getBoolean("active", false));
        out.put("running", svc != null);
        out.put("queued", svc != null ? svc.queuedCount() : 0);
        out.put("lastSentAt", svc != null ? svc.lastSentAt : 0);
        out.put("lastFixAt", svc != null ? svc.lastFixAt : 0);
        out.put("lastError", svc != null ? svc.lastError : null);
        call.resolve(out);
    }
}
