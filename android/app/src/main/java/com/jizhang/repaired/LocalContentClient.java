package com.jizhang.repaired;
import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
final class LocalContentClient extends WebViewClient {
    static final String ORIGIN="https://app.local/"; // Never change: legacy DOM storage migration uses this origin.
    private final Context context;
    LocalContentClient(Context context){this.context=context;}
    private boolean local(Uri uri){return "https".equals(uri.getScheme())&&"app.local".equals(uri.getHost())&&uri.getPort()==-1&&uri.getUserInfo()==null;}
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !local(request.getUrl());}
    @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return !local(Uri.parse(url));}
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();String path=uri.getPath();if(!local(uri)||!"GET".equals(request.getMethod())||path==null||path.contains(".."))return blocked();if(path.equals("/"))path="/index.html";
        try{return new WebResourceResponse(mime(path),"UTF-8",context.getAssets().open("web"+path));}catch(Exception e){return blocked();}
    }
    private WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,new ByteArrayInputStream(new byte[0]));}
    private String mime(String path){if(path.endsWith(".html"))return "text/html";if(path.endsWith(".js"))return "application/javascript";if(path.endsWith(".css"))return "text/css";if(path.endsWith(".svg"))return "image/svg+xml";if(path.endsWith(".png"))return "image/png";return "application/octet-stream";}
}
