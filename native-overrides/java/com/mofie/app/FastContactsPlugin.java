package com.mofie.app;

import android.content.ContentResolver;
import android.database.Cursor;
import android.provider.ContactsContract;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "FastContacts")
public class FastContactsPlugin extends Plugin {
    @PluginMethod
    public void getContacts(PluginCall call) {
        JSArray contacts = new JSArray();
        Set<String> uniquePhones = new HashSet<>();
        ContentResolver cr = getContext().getContentResolver();
        
        Cursor cursor = cr.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            new String[]{
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            },
            null, null,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
        );
        
        if (cursor != null && cursor.getCount() > 0) {
            while (cursor.moveToNext()) {
                String name = cursor.getString(cursor.getColumnIndex(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME));
                String phone = cursor.getString(cursor.getColumnIndex(
                    ContactsContract.CommonDataKinds.Phone.NUMBER));
                    
                if (phone != null && !phone.isEmpty()) {
                    String stripped = phone.replaceAll("[\\s\\-()]", "");
                    if (!uniquePhones.contains(stripped)) {
                        JSObject obj = new JSObject();
                        obj.put("name", name != null ? name : "Unknown");
                        obj.put("phone", phone);
                        contacts.put(obj);
                        uniquePhones.add(stripped);
                    }
                }
            }
            cursor.close();
        }
        
        JSObject ret = new JSObject();
        ret.put("contacts", contacts);
        call.resolve(ret);
    }
}
