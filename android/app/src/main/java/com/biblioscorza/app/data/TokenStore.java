package com.biblioscorza.app.data;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

/** Guarda el token JWT cifrado en el dispositivo. */
public final class TokenStore {
    private static SharedPreferences prefs;

    private static synchronized SharedPreferences p(Context c) {
        if (prefs == null) {
            try {
                MasterKey mk = new MasterKey.Builder(c).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build();
                prefs = EncryptedSharedPreferences.create(c, "bs_secure", mk,
                        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
            } catch (Exception e) {
                throw new IllegalStateException("No se pudo abrir el almacenamiento seguro", e);
            }
        }
        return prefs;
    }

    public static String token(Context c) { return p(c).getString("token", null); }
    public static String usuario(Context c) { return p(c).getString("usuario", ""); }
    public static void guardar(Context c, String token, String usuario) {
        p(c).edit().putString("token", token).putString("usuario", usuario).apply();
    }
    public static void limpiar(Context c) { p(c).edit().clear().apply(); }
}
