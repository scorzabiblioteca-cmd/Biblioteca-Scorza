package com.biblioscorza.app.util;

import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.CloudinaryResp;
import com.biblioscorza.app.data.Models.Firma;

import java.io.File;
import java.util.HashMap;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/** Pide firma a nuestra API y sube directo a Cloudinary. El API_SECRET nunca está en la app. */
public final class ImageUploader {
    public interface Listener { void ok(String url); void error(String msg); }

    public static void subir(File foto, Listener l) {
        Api.call(ApiClient.api().firmaImagen(new HashMap<>()), new Api.Result<Firma>() {
            @Override public void ok(Firma f, String m) {
                RequestBody file = RequestBody.create(foto, MediaType.parse("image/jpeg"));
                MultipartBody.Part part = MultipartBody.Part.createFormData("file", foto.getName(), file);
                ApiClient.cloudinary().subir(f.cloudName, part, txt(f.apiKey), txt(String.valueOf(f.timestamp)),
                        txt(f.folder), txt(f.signature)).enqueue(new Callback<CloudinaryResp>() {
                    @Override public void onResponse(Call<CloudinaryResp> c, Response<CloudinaryResp> r) {
                        if (r.isSuccessful() && r.body() != null && r.body().secure_url != null) l.ok(r.body().secure_url);
                        else l.error("Cloudinary rechazó la imagen (" + r.code() + ")");
                    }
                    @Override public void onFailure(Call<CloudinaryResp> c, Throwable t) { l.error("No se pudo subir la foto. Revisa tu internet."); }
                });
            }
            @Override public void error(String msg, int http, String code) { l.error(msg); }
        });
    }

    private static RequestBody txt(String s) { return RequestBody.create(s, MediaType.parse("text/plain")); }
}
