package com.biblioscorza.app.util;

import android.content.Context;
import android.content.Intent;

import com.biblioscorza.app.App;
import com.biblioscorza.app.data.Models.ApiResponse;
import com.biblioscorza.app.data.TokenStore;
import com.biblioscorza.app.ui.LoginActivity;
import com.google.gson.Gson;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/** Envuelve Retrofit: entrega datos o un mensaje de error legible. Los callbacks corren en el hilo principal. */
public final class Api {
    public interface Result<T> {
        void ok(T data, String message);
        void error(String message, int http, String code);
    }

    public static <T> void call(Call<ApiResponse<T>> call, Result<T> cb) {
        call.enqueue(new Callback<ApiResponse<T>>() {
            @Override public void onResponse(Call<ApiResponse<T>> c, Response<ApiResponse<T>> r) {
                ApiResponse<T> b = r.body();
                if (r.isSuccessful() && b != null && b.success) { cb.ok(b.data, b.message); return; }
                String msg = "Error inesperado (" + r.code() + ")";
                String code = null;
                try {
                    if (r.errorBody() != null) {
                        ApiResponse<?> e = new Gson().fromJson(r.errorBody().string(), ApiResponse.class);
                        if (e != null && e.message != null) { msg = e.message; code = e.code; }
                    }
                } catch (Exception ignored) { }
                if (r.code() == 401 && !"/auth/login".equals(c.request().url().encodedPath().replaceFirst(".*/api", ""))) {
                    sesionExpirada(App.get());
                }
                cb.error(msg, r.code(), code);
            }
            @Override public void onFailure(Call<ApiResponse<T>> c, Throwable t) {
                cb.error("No hay conexión con el servidor. Revisa tu internet.", 0, null);
            }
        });
    }

    private static void sesionExpirada(Context c) {
        TokenStore.limpiar(c);
        Intent i = new Intent(c, LoginActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        c.startActivity(i);
    }
}
