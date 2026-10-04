package com.jizhang.repaired;
import android.app.Activity;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.util.concurrent.Executor;
/** Explicit, allowlisted capabilities; all database work runs on a serial executor. */
public final class BillBridge {
    private final Activity activity;private final BillDatabase db;private final FileCapability files;private final DisplayCapability display;private final Executor io;private final ResultSink result;
    BillBridge(Activity activity,BillDatabase db,FileCapability files,DisplayCapability display,Executor io,ResultSink result){this.activity=activity;this.db=db;this.files=files;this.display=display;this.io=io;this.result=result;}
    @JavascriptInterface public void request(String id,String action,String payload){
        if(id==null||id.length()>100||payload==null||payload.length()>64*1024*1024){result.send(id,false,false,null,"请求无效或过大");return;}
        io.execute(()->{try{
            JSONObject args=new JSONObject(payload);
            switch(action){
                case "db.read":result.send(id,true,false,db.read(args.getJSONArray("queries")),null);break;
                case "db.commit":db.commit(args.getLong("expected"),args.getJSONArray("statements"));result.send(id,true,false,true,null);break;
                case "file.open":case "file.save":files.launch(id,action,args);break;
                case "display.fullscreen":boolean enabled=args.getBoolean("enabled");activity.runOnUiThread(()->{display.set(enabled);result.send(id,true,false,true,null);});break;
                default:throw new IllegalArgumentException("不支持的原生能力");
            }
        }catch(Exception e){result.send(id,false,false,null,e.getMessage());}});
    }
}
