package org.islamicapplications.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Opens the app when the TV turns on, so the prayer times and the Azan are back without
 * anyone opening it. On Android 10 and later this needs "Display over other apps" allowed
 * for the app (Settings → Apps → Special app access).
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) return;
        try {
            context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) {
            // Not allowed to open from the background: the app opens from the launcher as usual
        }
    }
}
