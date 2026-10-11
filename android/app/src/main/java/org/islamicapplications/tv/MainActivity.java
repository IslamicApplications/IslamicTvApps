package org.islamicapplications.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The TV app (https://islamicapplications.github.io/IslamicTvApps/) full screen, as an
 * Android TV app: the screen stays on, sound plays without a first button press (so the
 * Azan plays on time after the TV turns on), and the page keeps running in the background.
 */
public class MainActivity extends Activity {
    static final String APP_URL = "https://islamicapplications.github.io/IslamicTvApps/";
    private static final String APP_HOST = "islamicapplications.github.io";
    private static final long RETRY_MS = 30_000;

    private WebView web;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retry = () -> web.loadUrl(APP_URL);

    /** The app is on screen (read by AzanAlarmReceiver: no need to open it) */
    static volatile boolean inFront;
    /** Opened by the Azan alarm: that Azan's time (0 otherwise), until the prayer is over or the remote is used */
    private long wakeAzanAt;
    private boolean wakeWasAsleep;
    private boolean wakeOtherApp;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 10, 15));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // The Azan and the Quran may start without a tap or a key press
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Lets the page know it runs in this app (it then skips "Press OK to Start")
        settings.setUserAgentString(settings.getUserAgentString() + " IslamicTvApp/" + versionName());

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (APP_HOST.equals(url.getHost())) return false;
                // Other sites (sunnah.com, mosque websites) open in a browser if the TV has one
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                // No internet yet (e.g. just after the TV turned on): show a note and try again
                view.loadDataWithBaseURL(null, OFFLINE_PAGE, "text/html", "utf-8", null);
                handler.removeCallbacks(retry);
                handler.postDelayed(retry, RETRY_MS);
            }
        });

        // "Open for the Azan" is for TVs only (on a phone it would interrupt calls and other apps)
        if (getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK)) {
            web.addJavascriptInterface(new AzanBridge(this), "IslamicTvAzan");
        }

        setContentView(web);
        hideSystemBars();
        // Android 13+ (and every Android 16+ device) sends Back here, not as a key
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBack);
        }
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(APP_URL);
        web.requestFocus();
        handleAzanAlarm(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAzanAlarm(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        inFront = true;
        // "Alarms & reminders" may have just been allowed in the TV's settings
        AzanAlarms.scheduleNext(this);
    }

    @Override
    protected void onPause() {
        inFront = false;
        super.onPause();
    }

    /** Opened by the Azan alarm: the screen turns on (over the lock screen) and the page is told by wakeAzanAt. */
    private void handleAzanAlarm(Intent intent) {
        long azanAt = intent == null ? 0 : intent.getLongExtra(AzanAlarms.EXTRA_AZAN_AT, 0);
        if (azanAt == 0) return;
        intent.removeExtra(AzanAlarms.EXTRA_AZAN_AT);
        wakeAzanAt = azanAt;
        wakeWasAsleep = intent.getBooleanExtra(AzanAlarmReceiver.EXTRA_WAS_ASLEEP, false);
        wakeOtherApp = intent.getBooleanExtra(AzanAlarmReceiver.EXTRA_OTHER_APP, false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }

    /** The Azan time the alarm opened the app for, until the prayer is over (0: not opened by it). */
    long azanWakePending() {
        return wakeAzanAt;
    }

    /**
     * The Azan, the Iqamah and the prayer are over: back to the app that was on, or, if
     * the TV was in standby, the TV's own sleep timer may turn it off again.
     */
    void finishAzanWake() {
        if (wakeAzanAt == 0) return;
        boolean otherApp = wakeOtherApp;
        boolean wasAsleep = wakeWasAsleep;
        endAzanWake();
        if (otherApp) moveTaskToBack(true);
        else if (wasAsleep) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            // The page's screen wake lock keeps the screen on through the WebView itself
            web.setKeepScreenOn(false);
        }
    }

    /** The remote was used (or the prayer is over): the app no longer goes back by itself. */
    private void endAzanWake() {
        wakeAzanAt = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(false);
            setTurnScreenOn(false);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }

    @Override
    public void onUserInteraction() {
        super.onUserInteraction();
        // Someone has the remote: the app stays, and the screen stays on as usual
        if (wakeAzanAt != 0) endAzanWake();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Before Android 13 Back arrives as a key; later it goes to the callback in onCreate
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            if (event.getAction() == KeyEvent.ACTION_UP) onBack();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    /**
     * The remote's Back: the page first closes a screen that opened by itself (the Azan
     * popup, the Iqamah countdown), then its dialogs and the Quran (history entries).
     * On the prayer times the first press shows "Press Back again to leave"; a second one
     * goes to the home screen (Google's TV guideline TV-DB), and the app keeps running
     * as it does after Home.
     */
    private void onBack() {
        // (Android 13+ Back doesn't count as onUserInteraction)
        if (wakeAzanAt != 0) endAzanWake();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web.evaluateJavascript("window.tvBack ? window.tvBack() : false", (handled) -> {
            if ("true".equals(handled)) return;
            if (web.canGoBack()) {
                web.goBack();
                return;
            }
            // No note on the "Waiting for the internet" page: leave at once
            web.evaluateJavascript("window.tvLeave ? window.tvLeave() : true", (leave) -> {
                if ("true".equals(leave)) moveTaskToBack(true);
            });
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(retry);
        web.destroy();
        super.onDestroy();
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }

    private static final String OFFLINE_PAGE =
        "<html><body style=\"margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;"
            + "justify-content:center;background:#080a0f;color:#e5e7eb;font-family:sans-serif;text-align:center\">"
            + "<h1 style=\"color:#fbbf24;font-size:44px;margin:0 0 16px\">Waiting for the internet…</h1>"
            + "<p style=\"font-size:26px;color:#9ca3af\">The prayer times open as soon as the TV is connected.</p>"
            + "</body></html>";
}
