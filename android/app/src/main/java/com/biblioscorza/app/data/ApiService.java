package com.biblioscorza.app.data;

import com.biblioscorza.app.data.Models.*;

import java.util.List;
import java.util.Map;

import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.http.*;

public interface ApiService {
    @POST("auth/login") Call<ApiResponse<LoginData>> login(@Body LoginReq body);

    @GET("libros/isbn/{isbn}") Call<ApiResponse<Libro>> libroPorIsbn(@Path("isbn") String isbn);
    @GET("libros") Call<ApiResponse<Paged<Libro>>> buscarLibros(@Query("q") String q, @Query("pageSize") int size);
    @POST("libros") Call<ApiResponse<Libro>> crearLibro(@Body LibroReq body);
    @POST("libros/{id}/ejemplares") Call<ApiResponse<Agregado>> agregarEjemplares(@Path("id") long id, @Body AgregarReq body);

    @GET("ubicaciones") Call<ApiResponse<List<Ubicacion>>> ubicaciones();

    @GET("ejemplares/codigo/{codigo}") Call<ApiResponse<Ejemplar>> ejemplarPorCodigo(@Path("codigo") String codigo);
    @PATCH("ejemplares/{id}") Call<ApiResponse<Ejemplar>> cambiarEstado(@Path("id") long id, @Body EjemplarPatch body);

    @GET("alumnos/dni/{dni}") Call<ApiResponse<Alumno>> alumnoPorDni(@Path("dni") String dni);
    @GET("alumnos/codigo/{codigo}") Call<ApiResponse<Alumno>> alumnoPorCodigo(@Path("codigo") String codigo);

    @POST("prestamos") Call<ApiResponse<Object>> prestar(@Body PrestamoReq body);
    @GET("prestamos/activo/ejemplar/{codigo}") Call<ApiResponse<PrestamoActivo>> prestamoActivo(@Path("codigo") String codigo);
    @POST("devoluciones") Call<ApiResponse<Object>> devolver(@Body DevolucionReq body);

    @POST("imagenes/firma") Call<ApiResponse<Firma>> firmaImagen(@Body Map<String, String> vacio);

    /** Retrofit distinto (base https://api.cloudinary.com/v1_1/) sin token de la API. */
    interface Cloudinary {
        @Multipart @POST("{cloud}/image/upload")
        Call<CloudinaryResp> subir(@Path("cloud") String cloud,
                                   @Part MultipartBody.Part file,
                                   @Part("api_key") RequestBody apiKey,
                                   @Part("timestamp") RequestBody timestamp,
                                   @Part("folder") RequestBody folder,
                                   @Part("signature") RequestBody signature);
    }
}
