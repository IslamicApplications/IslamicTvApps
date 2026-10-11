package org.islamicapplications.tv;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

/**
 * window.IslamicTvAzan on the page (TVs only): "Open for the Azan". The page sends the
 * coming Azan times, shows whether the two permissions it needs are allowed, and says
 * when the prayer it was opened for is over. Calls arrive on a WebView thread.
 */
final class AzanBridge {
    private final MainActivity activity;

    AzanBridge(MainActivity activity) {
        this.activity = activity;
    }

    /** The coming Azan times, a JSON array of {at: epoch ms, prayer}; [] turns it off. */
    @JavascriptInterface
    public void setAlarms(String json) {
        AzanAlarms.save(activity.getApplicationContext(), json);
    }

    /** {"exact": alarms on the minute allowed, "overlay": may open over other apps} */
    @JavascriptInterface
    public String status() {
        try {
            return new JSONObject()
                .put("exact", AzanAlarms.canBeExact(activity))
                .put("overlay", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(activity))
                .toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /** Opens the TV's "Alarms & reminders" page for the app (or the app's settings). */
    @JavascriptInterface
    public void openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
        else openSettings(null);
    }

    /** Opens the TV's "Display over other apps" page for the app (or the app's settings). */
    @JavascriptInterface
    public void openOverlaySettings() {
        openSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
    }

    /** The Azan time the alarm opened the app for (0: it wasn't, or the remote has been used since). */
    @JavascriptInterface
    public long wakePending() {
        return activity.azanWakePending();
    }

    /** The prayer is over: back to the app that was on before. */
    @JavascriptInterface
    public void wakeDone() {
        activity.runOnUiThread(activity::finishAzanWake);
    }

    private void openSettings(String action) {
        Uri app = Uri.parse("package:" + activity.getPackageName());
        activity.runOnUiThread(() -> {
            // Many TVs leave these pages out: the app's own settings page instead
            try {
                if (action != null) {
                    activity.startActivity(new Intent(action, app));
                    return;
                }
            } catch (Exception ignored) {
            }
            try {
                activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, app));
            } catch (Exception ignored) {
            }
        });
    }
}
