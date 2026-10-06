package org.islamicapplications.tv;

import android.app.Activity;
import android.content.Intent;
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

        setContentView(web);
        hideSystemBars();
        // Android 13+ (and every Android 16+ device) sends Back here, not as a key
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBack);
        }
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(APP_URL);
        web.requestFocus();
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
     * With nothing open it does nothing, so the prayer times stay on the screen.
     */
    private void onBack() {
        web.evaluateJavascript("window.tvBack ? window.tvBack() : false", (handled) -> {
            if (!"true".equals(handled) && web.canGoBack()) web.goBack();
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
