package com.jizhang.repaired;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Lifecycle and wiring only. Bookkeeping, persistence and file IO live elsewhere. */
public final class MainActivity extends Activity {
    private WebView web;private BillDatabase db;private FileCapability files;private DisplayCapability display;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        FrameLayout root=new FrameLayout(this);web=new WebView(this);
        boolean dark=(getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;
        int background=Color.parseColor(dark?"#151e19":"#f5f4ef");root.setBackgroundColor(background);web.setBackgroundColor(background);
        web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(false);web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.getSettings().setTextZoom(Math.round(100*getResources().getConfiguration().fontScale));
        web.setWebChromeClient(new WebChromeClient());web.setWebViewClient(new LocalContentClient(this));
        db=new BillDatabase(this);display=new DisplayCapability(this);files=new FileCapability(this,io,this::result);
        web.addJavascriptInterface(new BillBridge(this,db,files,display,io,this::result),"BillNative");
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
        if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);root.setOnApplyWindowInsetsListener((view,insets)->{android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());view.setPadding(safe.left,safe.top,safe.right,safe.bottom);return insets;});}
        display.apply();web.loadUrl(LocalContentClient.ORIGIN);
    }
    private void result(String id,boolean ok,boolean cancelled,Object data,String error){
        try{JSONObject value=new JSONObject();value.put("ok",ok);value.put("cancelled",cancelled);if(data!=null)value.put("data",data);if(error!=null)value.put("error",error);
            String js="window.billNativeResult&&window.billNativeResult("+JSONObject.quote(id)+","+value+")";
            runOnUiThread(()->{if(!isDestroyed())web.evaluateJavascript(js,null);});
        }catch(Exception ignored){/* Callback cannot outlive the Activity. Database commits remain durable. */}
    }
    @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);web.getSettings().setTextZoom(Math.round(100*config.fontScale));display.apply();}
    @Override protected void onActivityResult(int code,int resultCode,Intent data){super.onActivityResult(code,resultCode,data);files.onResult(code,resultCode,data);}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus&&display!=null)display.apply();}
    @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.dispatchEvent(new Event('cancel'));return true;}return false;})()",value->{if(!"true".equals(value))MainActivity.super.onBackPressed();});}
    @Override protected void onDestroy(){web.removeJavascriptInterface("BillNative");web.destroy();io.execute(()->db.close());io.shutdown();super.onDestroy();}
}
