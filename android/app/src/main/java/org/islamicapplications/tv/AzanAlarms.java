package org.islamicapplications.tv;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "Open for the Azan": the page sends the coming Azan times (the next week, only the
 * prayers turned on) and the app keeps one alarm set, for the next of them. The alarm
 * opens the app a little before the Azan (AzanAlarmReceiver), over another app or with
 * the TV in standby, and the page then plays the Azan and the Iqamah as usual.
 */
final class AzanAlarms {
    private static final String PREFS = "azan_alarms";
    private static final String KEY_TIMES = "times";

    /** The app opens this long before the Azan, so the page is ready when the minute starts. */
    static final long LEAD_MS = 45_000;
    /** An alarm that arrives this late (the TV was in deep sleep) no longer opens the app. */
    static final long TOO_LATE_MS = 2 * 60_000;
    /** Without "Alarms & reminders" Android picks the moment within a window this long (at least 10 minutes). */
    private static final long INEXACT_WINDOW_MS = 10 * 60_000;

    static final String EXTRA_AZAN_AT = "azanAt";

    private AzanAlarms() {}

    /** Saves the coming Azan times (a JSON array of {at: epoch ms, prayer}) and sets the alarm for the next one. */
    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TIMES, json).apply();
        scheduleNext(context);
    }

    /** Sets the alarm for the next Azan still to come (none: the alarm is cancelled). */
    static void scheduleNext(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        long now = System.currentTimeMillis();
        long next = 0;
        try {
            JSONArray times = new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TIMES, "[]"));
            for (int i = 0; i < times.length(); i++) {
                JSONObject time = times.optJSONObject(i);
                long at = time == null ? 0 : time.optLong("at");
                // Still worth opening for (an Azan that starts within the lead time opens at once)
                if (at > now + 5_000 && (next == 0 || at < next)) next = at;
            }
        } catch (Exception ignored) {
        }

        Intent intent = new Intent(context, AzanAlarmReceiver.class).putExtra(EXTRA_AZAN_AT, next);
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (next == 0) {
            alarms.cancel(pending);
            return;
        }
        long trigger = Math.max(now, next - LEAD_MS);
        if (canBeExact(context)) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending);
        } else {
            // Opens somewhere in the 10 minutes before (never after) the Azan
            alarms.setWindow(AlarmManager.RTC_WAKEUP, Math.max(now, trigger - INEXACT_WINDOW_MS), INEXACT_WINDOW_MS, pending);
        }
    }

    /** Android 12+ sets alarms to the minute only with "Alarms & reminders" allowed for the app. */
    static boolean canBeExact(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return alarms != null && alarms.canScheduleExactAlarms();
    }
}
