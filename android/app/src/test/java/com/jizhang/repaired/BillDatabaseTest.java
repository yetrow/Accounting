package com.jizhang.repaired;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class BillDatabaseTest {
    private BillDatabase helper; private Context context;
    @Before public void setup(){context=RuntimeEnvironment.getApplication();context.deleteDatabase("bill.db");helper=new BillDatabase(context);}
    @After public void close(){helper.close();context.deleteDatabase("bill.db");}
    private JSONObject stmt(String sql,Object...params)throws Exception{return new JSONObject().put("sql",sql).put("params",new JSONArray(params));}
    @Test public void schemaAndForeignKeys()throws Exception{
        SQLiteDatabase db=helper.getWritableDatabase();assertEquals(2,db.getVersion());
        try(Cursor c=db.rawQuery("PRAGMA foreign_keys",null)){assertTrue(c.moveToFirst());assertEquals(1,c.getInt(0));}
        assertEquals(1,helper.read(new JSONArray().put(stmt("SELECT key,value FROM metadata"))).length());
    }
    @Test public void commitIsAtomicAndVersioned()throws Exception{
        JSONArray batch=new JSONArray().put(stmt("INSERT INTO accounts (id,name,opening_minor,archived) VALUES (?,?,?,?)","cash","Cash",0,0)).put(stmt("INSERT INTO audit_log(id,revision,at,kind,payload) VALUES(?,?,?,?,?)","a",1,1,"migration","{}"));
        helper.commit(0,batch);
        try{helper.commit(0,batch);fail("must conflict");}catch(IllegalStateException expected){assertEquals("CONFLICT",expected.getMessage());}
        try{helper.commit(1,new JSONArray().put(stmt("INSERT INTO budgets (month,amount_minor) VALUES (?,?)","2026-10",100)));fail("missing audit must roll back");}catch(IllegalStateException expected){assertTrue(expected.getMessage().contains("审计"));}
        try(Cursor c=helper.getReadableDatabase().rawQuery("SELECT COUNT(*) FROM budgets",null)){c.moveToFirst();assertEquals(0,c.getInt(0));}
        helper.close();helper=new BillDatabase(context);
        try(Cursor c=helper.getReadableDatabase().rawQuery("SELECT value FROM metadata WHERE key='revision'",null)){c.moveToFirst();assertEquals("1",c.getString(0));}
    }
    @Test public void historyIsImmutableAndSqlIsBounded()throws Exception{
        SQLiteDatabase db=helper.getWritableDatabase();db.execSQL("INSERT INTO audit_log VALUES('a',1,1,'test','{}')");
        try{db.execSQL("DELETE FROM audit_log");fail("immutable");}catch(android.database.SQLException expected){}
        try{helper.commit(0,new JSONArray().put(stmt("DROP TABLE accounts")));fail("not an allowed capability");}catch(IllegalArgumentException expected){}
    }
}
