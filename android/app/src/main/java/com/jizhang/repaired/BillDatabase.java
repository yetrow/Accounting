package com.jizhang.repaired;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Owns database lifecycle. Neither Activity nor WebView owns the book. */
public final class BillDatabase extends SQLiteOpenHelper {
    public static final int VERSION = 2;
    private final Context context;
    private static final Set<String> READS = new HashSet<>(Arrays.asList(
        "SELECT key,value FROM metadata", "SELECT * FROM accounts ORDER BY rowid",
        "SELECT * FROM categories ORDER BY rowid", "SELECT * FROM transactions ORDER BY rowid",
        "SELECT * FROM budgets ORDER BY month", "SELECT snapshot FROM recovery WHERE id=1",
        "SELECT payload FROM audit_log ORDER BY revision"
    ));
    public BillDatabase(Context context) {
        super(context.getApplicationContext(), "bill.db", null, VERSION);
        this.context = context.getApplicationContext();
        setWriteAheadLoggingEnabled(true);
    }
    @Override public void onConfigure(SQLiteDatabase db) { db.setForeignKeyConstraintsEnabled(true); }
    @Override public void onCreate(SQLiteDatabase db) { migrate(db, 0, VERSION); }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { migrate(db, oldVersion, newVersion); }
    @Override public void onDowngrade(SQLiteDatabase db, int oldVersion, int newVersion) { throw new IllegalStateException("数据库版本较新，不能降级打开"); }
    private void migrate(SQLiteDatabase db, int oldVersion, int newVersion) {
        // SQLiteOpenHelper wraps onCreate/onUpgrade and user_version in one transaction.
        for (int version=oldVersion+1; version<=newVersion; version++) {
            String name = String.format(java.util.Locale.ROOT, "migrations/%03d.sql", version);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(context.getAssets().open(name), StandardCharsets.UTF_8))) {
                String line;
                // Each non-comment line is one complete SQL statement, including triggers.
                while ((line=reader.readLine()) != null) if (!line.trim().isEmpty() && !line.trim().startsWith("--")) db.execSQL(line);
            } catch (Exception error) { throw new IllegalStateException("数据库迁移失败："+name, error); }
        }
    }
    public JSONArray read(JSONArray queries) throws Exception {
        SQLiteDatabase db=getReadableDatabase(); db.beginTransaction();
        try {
            JSONArray results=new JSONArray();
            for(int i=0;i<queries.length();i++) {
                JSONObject request=queries.getJSONObject(i); String sql=request.getString("sql");
                if(!READS.contains(sql) || request.getJSONArray("params").length()!=0) throw new IllegalArgumentException("不支持的读取操作");
                JSONArray rows=new JSONArray();
                try(Cursor cursor=db.rawQuery(sql,null)) {
                    while(cursor.moveToNext()) {
                        JSONObject row=new JSONObject();
                        for(int c=0;c<cursor.getColumnCount();c++) {
                            Object value;
                            switch(cursor.getType(c)) {
                                case Cursor.FIELD_TYPE_NULL: value=JSONObject.NULL; break;
                                case Cursor.FIELD_TYPE_INTEGER: value=cursor.getLong(c); break;
                                case Cursor.FIELD_TYPE_FLOAT: value=cursor.getDouble(c); break;
                                default: value=cursor.getString(c);
                            }
                            row.put(cursor.getColumnName(c),value);
                        }
                        rows.put(row);
                    }
                }
                results.put(rows);
            }
            db.setTransactionSuccessful(); return results;
        } finally { db.endTransaction(); }
    }
    public void commit(long expected, JSONArray statements) throws Exception {
        SQLiteDatabase db=getWritableDatabase(); db.beginTransaction();
        try {
            long revision;
            try(Cursor cursor=db.rawQuery("SELECT value FROM metadata WHERE key='revision'",null)) { if(!cursor.moveToFirst())throw new IllegalStateException("版本记录损坏"); revision=Long.parseLong(cursor.getString(0)); }
            if(revision!=expected)throw new IllegalStateException("CONFLICT");
            for(int i=0;i<statements.length();i++) {
                JSONObject statement=statements.getJSONObject(i);String sql=statement.getString("sql");
                if(sql.contains(";")||!isWriteAllowed(sql))throw new IllegalArgumentException("不支持的写入操作");
                JSONArray params=statement.getJSONArray("params");Object[] args=new Object[params.length()];
                for(int p=0;p<args.length;p++)args[p]=params.isNull(p)?null:params.get(p);
                db.execSQL(sql,args);
            }
            try(Cursor cursor=db.rawQuery("SELECT COUNT(*) FROM audit_log WHERE revision=?",new String[]{String.valueOf(expected+1)})) {
                if(!cursor.moveToFirst()||cursor.getInt(0)!=1)throw new IllegalStateException("缺少本次操作的审计记录");
            }
            db.execSQL("UPDATE metadata SET value=? WHERE key='revision'",new Object[]{String.valueOf(expected+1)});
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    private boolean isWriteAllowed(String sql) {
        if(sql.equals("UPDATE metadata SET value='1' WHERE key='initialized'"))return true;
        if(sql.equals("INSERT OR REPLACE INTO recovery(id,snapshot) VALUES(1,?)"))return true;
        if(sql.equals("INSERT INTO audit_log(id,revision,at,kind,payload) VALUES(?,?,?,?,?)"))return true;
        return sql.matches("(INSERT INTO|UPDATE|DELETE FROM) (accounts|categories|transactions|budgets)( .*)?");
    }
}
