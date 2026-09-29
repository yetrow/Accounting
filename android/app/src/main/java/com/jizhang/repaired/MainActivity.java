package com.jizhang.repaired;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Offline-only WebView. The bridge is never exposed to third-party content. */
public final class MainActivity extends Activity {
    private static final int OPEN = 101, SAVE = 102, MAX_BYTES = 8 * 1024 * 1024;
    private WebView web;
    private FrameLayout root;
    private String requestId;
    private byte[] exportBytes;
    private SharedPreferences preferences;
    private boolean fullscreen;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("display", MODE_PRIVATE);
        fullscreen = preferences.getBoolean("fullscreen", true);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247,243,235));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247,243,235));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(false);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "LedgerAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isLocal(Uri.parse(url));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri)) return response404();
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..")) return response404();
                try { return new WebResourceResponse(mime(path), "UTF-8", getAssets().open("web" + path)); }
                catch (Exception error) { return response404(); }
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view,insets)->{
                android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
                return insets;
            });
        }
        if (Build.VERSION.SDK_INT >= 30) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attrs);
        }
        applyFullscreen();
        web.loadUrl("https://app.local/");
    }
    private boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && "app.local".equals(uri.getHost()) && uri.getPort() == -1; }
    private WebResourceResponse response404() { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0])); }
    private String mime(String path) {
        if(path.endsWith(".html"))return "text/html";
        if(path.endsWith(".js"))return "application/javascript";
        if(path.endsWith(".css"))return "text/css";
        if(path.endsWith(".svg"))return "image/svg+xml";
        if(path.endsWith(".png"))return "image/png";
        if(path.endsWith(".woff2"))return "font/woff2";
        return "application/octet-stream";
    }
    private void applyFullscreen() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null){
                controller.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if(fullscreen)controller.hide(WindowInsets.Type.systemBars());else controller.show(WindowInsets.Type.systemBars());
            }
            root.requestApplyInsets();
        } else {
            int flags=View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if(fullscreen)flags |= View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if(focus)applyFullscreen(); }
    public final class Bridge {
        @JavascriptInterface public boolean isFullscreen(){return preferences.getBoolean("fullscreen",true);}
        @JavascriptInterface public void setFullscreen(boolean enabled){runOnUiThread(()->{fullscreen=enabled;preferences.edit().putBoolean("fullscreen",enabled).apply();applyFullscreen();});}
        @JavascriptInterface public void importJson(String id){runOnUiThread(()->{
            if(requestId!=null){result(id,false,false,null,"已有文件操作正在进行");return;}
            requestId=id;
            Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
            try{startActivityForResult(intent,OPEN);}catch(Exception e){requestId=null;result(id,false,false,null,"无法打开系统文件选择器");}
        });}
        @JavascriptInterface public void exportJson(String id,String name,String content){
            if(content==null||content.length()>MAX_BYTES){result(id,false,false,null,"导出文件过大");return;}
            byte[] bytes=content.getBytes(StandardCharsets.UTF_8);
            if(bytes.length>MAX_BYTES){result(id,false,false,null,"导出文件超过 8 MB");return;}
            runOnUiThread(()->{
                if(requestId!=null){result(id,false,false,null,"已有文件操作正在进行");return;}
                requestId=id;exportBytes=bytes;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"记账数据-"+new java.text.SimpleDateFormat("yyyy-MM-dd",java.util.Locale.ROOT).format(new java.util.Date())+".json");
                try{startActivityForResult(intent,SAVE);}catch(Exception e){requestId=null;exportBytes=null;result(id,false,false,null,"无法打开系统保存窗口");}
            });
        }
    }
    @Override protected void onActivityResult(int code,int resultCode,Intent data){
        super.onActivityResult(code,resultCode,data);
        if(code!=OPEN&&code!=SAVE)return;
        final String id=requestId;
        final byte[] bytes=exportBytes;
        if(id==null)return;
        if(resultCode!=RESULT_OK||data==null||data.getData()==null){requestId=null;exportBytes=null;result(id,false,true,null,null);return;}
        final Uri uri=data.getData();
        new Thread(()->{
            try {
                if(code==OPEN){
                    try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream buffer=new ByteArrayOutputStream()){
                        if(in==null)throw new java.io.IOException("无法读取文件");
                        byte[] chunk=new byte[8192];int count;
                        while((count=in.read(chunk))!=-1){if(buffer.size()+count>MAX_BYTES)throw new java.io.IOException("文件超过 8 MB");buffer.write(chunk,0,count);}
                        result(id,true,false,new String(buffer.toByteArray(),StandardCharsets.UTF_8),null);
                    }
                }else{
                    if(bytes==null)throw new java.io.IOException("导出已中断，请重试");
                    try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){
                        if(out==null)throw new java.io.IOException("无法写入目标位置");
                        out.write(bytes);out.flush();
                    }
                    result(id,true,false,null,null);
                }
            }catch(Exception e){result(id,false,false,null,"文件操作失败："+e.getMessage());}
            finally{runOnUiThread(()->{requestId=null;exportBytes=null;});}
        },"ledger-file-io").start();
    }
    private void result(String id,boolean ok,boolean cancelled,String text,String error){
        try{
            JSONObject value=new JSONObject();value.put("ok",ok);value.put("cancelled",cancelled);if(text!=null)value.put("data",text);if(error!=null)value.put("error",error);
            String js="window.ledgerNativeResult && window.ledgerNativeResult("+JSONObject.quote(id)+","+value.toString()+")";
            runOnUiThread(()->{if(!isDestroyed())web.evaluateJavascript(js,null);});
        }catch(Exception ignored){}
    }
    @Override public void onBackPressed(){
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.dispatchEvent(new Event('cancel'));return true;}return false;})()",value->{if(!"true".equals(value))MainActivity.super.onBackPressed();});
    }
    @Override protected void onDestroy(){web.removeJavascriptInterface("LedgerAndroid");web.destroy();super.onDestroy();}
}
