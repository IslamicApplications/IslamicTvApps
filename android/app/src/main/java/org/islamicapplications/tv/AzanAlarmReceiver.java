package org.islamicapplications.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

/**
 * The Azan alarm (AzanAlarms): wakes the TV from standby and brings the app to the front
 * over whatever is on, then sets the alarm for the next Azan. Opening from the background
 * needs "Display over other apps" allowed, as for opening at start-up.
 */
public class AzanAlarmReceiver extends BroadcastReceiver {
    static final String EXTRA_WAS_ASLEEP = "wasAsleep";
    static final String EXTRA_OTHER_APP = "otherApp";

    @Override
    public void onReceive(Context context, Intent intent) {
        long azanAt = intent.getLongExtra(AzanAlarms.EXTRA_AZAN_AT, 0);
        long now = System.currentTimeMillis();
        AzanAlarms.scheduleNext(context);
        if (azanAt == 0 || now > azanAt + AzanAlarms.TOO_LATE_MS) return;

        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean asleep = power != null && !power.isInteractive();
        if (!asleep && MainActivity.inFront) return;
        if (asleep) {
            // Turns the screen on (and, on a Google TV stick, the TV through HDMI-CEC);
            // the activity's own "turn the screen on" then keeps it on
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock wake = power.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "IslamicTv:azan");
            wake.acquire(60_000);
        }
        try {
            context.startActivity(new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(AzanAlarms.EXTRA_AZAN_AT, azanAt)
                .putExtra(EXTRA_WAS_ASLEEP, asleep)
                .putExtra(EXTRA_OTHER_APP, !asleep));
        } catch (Exception ignored) {
            // Not allowed to open from the background ("Display over other apps" is off)
        }
    }
}
