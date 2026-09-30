package com.biblioscorza.app.data;

import com.biblioscorza.app.App;
import com.biblioscorza.app.BuildConfig;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public final class ApiClient {
    private static ApiService service;
    private static ApiService.Cloudinary cloudinary;

    public static synchronized ApiService api() {
        if (service == null) {
            OkHttpClient.Builder b = new OkHttpClient.Builder()
                    .connectTimeout(20, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .addInterceptor(chain -> {
                        okhttp3.Request.Builder r = chain.request().newBuilder().header("Accept", "application/json");
                        String t = TokenStore.token(App.get());
                        if (t != null) r.header("Authorization", "Bearer " + t);
                        return chain.proceed(r.build());
                    });
            if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor log = new HttpLoggingInterceptor();
                log.setLevel(HttpLoggingInterceptor.Level.BASIC); // BASIC: no imprime tokens ni cuerpos
                b.addInterceptor(log);
            }
            service = new Retrofit.Builder().baseUrl(BuildConfig.API_BASE_URL)
                    .client(b.build()).addConverterFactory(GsonConverterFactory.create()).build()
                    .create(ApiService.class);
        }
        return service;
    }

    public static synchronized ApiService.Cloudinary cloudinary() {
        if (cloudinary == null) {
            cloudinary = new Retrofit.Builder().baseUrl("https://api.cloudinary.com/v1_1/")
                    .client(new OkHttpClient.Builder().callTimeout(90, TimeUnit.SECONDS).build())
                    .addConverterFactory(GsonConverterFactory.create()).build()
                    .create(ApiService.Cloudinary.class);
        }
        return cloudinary;
    }
}
