package com.lge.kdadmin;

import android.app.*; import android.os.*; import android.graphics.Color; import android.view.*; import android.widget.*; import java.io.*; import java.net.*; import java.util.*;

public class MainActivity extends Activity {
 EditText server,user,pass,device,pkg; TextView status;
 public void onCreate(Bundle b){super.onCreate(b); LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.VERTICAL);r.setPadding(20,20,20,20);
 TextView t=new TextView(this);t.setText("KDAdmin");t.setTextSize(28);t.setTextColor(Color.BLACK);r.addView(t);
 status=new TextView(this);status.setText("Not connected");r.addView(status);
 server=f("Server URL","https://YOUR-SERVER");user=f("Username","");pass=f("Password","");device=f("Device ID","");pkg=f("Package name","com.google.android.apps.maps");
 r.addView(server);r.addView(user);r.addView(pass);r.addView(device);r.addView(pkg);
 Button login=b("Login / register");login.setOnClickListener(v->request("/v1/auth/login","POST"));r.addView(login);
 Button lock=b("Lock device");lock.setOnClickListener(v->command("LOCK",null));r.addView(lock);
 Button hide=b("Hide package");hide.setOnClickListener(v->command("HIDE",pkg.getText().toString()));r.addView(hide);
 Button unhide=b("Unhide package");unhide.setOnClickListener(v->command("UNHIDE",pkg.getText().toString()));r.addView(unhide);
 Button suspend=b("Suspend package");suspend.setOnClickListener(v->command("SUSPEND",pkg.getText().toString()));r.addView(suspend);
 Button unsuspend=b("Unsuspend package");unsuspend.setOnClickListener(v->command("UNSUSPEND",pkg.getText().toString()));r.addView(unsuspend);
 setContentView(r); }
 EditText f(String h,String v){EditText e=new EditText(this);e.setHint(h);e.setText(v);e.setSingleLine(true);return e;}
 Button b(String s){Button b=new Button(this);b.setText(s);return b;}
 void request(String path,String method){new Thread(()->{try{URL u=new URL(server.getText().toString().replaceAll("/+$","")+path);HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod(method);c.setConnectTimeout(8000);c.setReadTimeout(8000);if(method.equals("POST")){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");String body="{\"username\":\""+esc(user.getText().toString())+"\",\"password\":\""+esc(pass.getText().toString())+"\"}";c.getOutputStream().write(body.getBytes("UTF-8"));}int code=c.getResponseCode();runOnUiThread(()->status.setText("HTTP "+code));}catch(Exception e){runOnUiThread(()->status.setText("Error: "+e.getClass().getSimpleName()));}}).start();}
 void command(String action,String pkg){new Thread(()->{try{URL u=new URL(server.getText().toString().replaceAll("/+$","")+"/v1/devices/"+URLEncoder.encode(device.getText().toString(),"UTF-8")+"/commands");HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setRequestProperty("Content-Type","application/json");String p=pkg==null?"null":"\""+esc(pkg)+"\"";String body="{\"action\":\""+action+"\",\"package\":"+p+"}";c.getOutputStream().write(body.getBytes("UTF-8"));int code=c.getResponseCode();runOnUiThread(()->status.setText(action+" -> HTTP "+code));}catch(Exception e){runOnUiThread(()->status.setText("Error: "+e.getClass().getSimpleName()));}}).start();}
 String esc(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
}
