package com.jizhang.repaired;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;

/** SAF grants access to a user-chosen document, never broad storage permission. */
final class FileCapability {
    private static final int OPEN=101, SAVE=102, MAX_BYTES=32*1024*1024;
    private final Activity activity; private final Executor executor; private final ResultSink result;
    private String pendingId; private byte[] bytes;
    FileCapability(Activity activity, Executor executor, ResultSink result) { this.activity=activity; this.executor=executor; this.result=result; }
    void launch(String id, String action, JSONObject payload) {
        activity.runOnUiThread(()->{
            if(pendingId!=null){result.send(id,false,false,null,"已有文件操作正在进行");return;}
            try {
                Intent intent;
                if(action.equals("file.open")) intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                else {
                    bytes=payload.getString("content").getBytes(StandardCharsets.UTF_8);
                    if(bytes.length>MAX_BYTES)throw new IllegalArgumentException("文件超过 32 MB");
                    String name=payload.getString("name"), mime=payload.getString("mime");
                    if(!name.matches("Bill-[0-9-]+\\.(json|csv|beancount)"))throw new IllegalArgumentException("文件名无效");
                    if(!mime.equals("application/json")&&!mime.equals("text/csv")&&!mime.equals("text/plain"))throw new IllegalArgumentException("文件类型无效");
                    intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name);
                }
                pendingId=id;activity.startActivityForResult(intent,action.equals("file.open")?OPEN:SAVE);
            } catch(Exception e){pendingId=null;bytes=null;result.send(id,false,false,null,e.getMessage());}
        });
    }
    void onResult(int code,int resultCode,Intent intent) {
        if(code!=OPEN&&code!=SAVE)return;
        String id=pendingId;byte[] output=bytes;if(id==null)return;
        if(resultCode!=Activity.RESULT_OK||intent==null||intent.getData()==null){pendingId=null;bytes=null;result.send(id,false,true,null,null);return;}
        Uri uri=intent.getData();
        executor.execute(()->{
            Object data=null;String error=null;
            try {
                if(code==OPEN) {
                    try(InputStream in=activity.getContentResolver().openInputStream(uri);ByteArrayOutputStream buffer=new ByteArrayOutputStream()) {
                        if(in==null)throw new IllegalStateException("文件无法读取");
                        byte[] chunk=new byte[8192];int count;
                        while((count=in.read(chunk))!=-1){if(buffer.size()+count>MAX_BYTES)throw new IllegalArgumentException("文件超过 32 MB");buffer.write(chunk,0,count);}
                        data=new String(buffer.toByteArray(),StandardCharsets.UTF_8);
                    }
                } else {
                    if(output==null)throw new IllegalStateException("导出已中断，请重试");
                    try(OutputStream out=activity.getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IllegalStateException("无法保存文件");out.write(output);out.flush();data=true;}
                }
            } catch(Exception e){error="文件操作失败："+e.getMessage();}
            final Object value=data;final String problem=error;
            activity.runOnUiThread(()->{pendingId=null;bytes=null;result.send(id,problem==null,false,value,problem);});
        });
    }
}
