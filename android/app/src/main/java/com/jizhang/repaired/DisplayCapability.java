package com.jizhang.repaired;
import android.app.Activity;
import android.content.res.Configuration;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
final class DisplayCapability {
    private final Activity activity;private boolean fullscreen;
    DisplayCapability(Activity activity){this.activity=activity;fullscreen=activity.getSharedPreferences("display",0).getBoolean("fullscreen",false);}
    void set(boolean enabled){fullscreen=enabled;activity.getSharedPreferences("display",0).edit().putBoolean("fullscreen",enabled).apply();apply();}
    void apply(){
        boolean dark=(activity.getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;
        if(Build.VERSION.SDK_INT>=30){WindowInsetsController c=activity.getWindow().getInsetsController();if(c!=null){int flags=WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;c.setSystemBarsAppearance(dark?0:flags,flags);c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);if(fullscreen)c.hide(WindowInsets.Type.systemBars());else c.show(WindowInsets.Type.systemBars());}}
        else {int flags=dark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;if(Build.VERSION.SDK_INT>=26&&!dark)flags|=View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;if(fullscreen)flags|=View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;activity.getWindow().getDecorView().setSystemUiVisibility(flags);}
    }
}
