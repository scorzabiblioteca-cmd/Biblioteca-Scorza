package com.biblioscorza.app.data;

import java.util.List;

/** Modelos JSON (Gson). Los nombres coinciden con la API (camelCase). */
public final class Models {
    private Models() {}

    public static class ApiResponse<T> {
        public boolean success;
        public String message;
        public String code;
        public T data;
    }

    public static class Paged<T> { public List<T> items; public int total; }

    public static class User { public long id; public String username, nombreCompleto; public List<String> roles; }
    public static class LoginData { public String token; public User user; }
    public static class LoginReq {
        public String username, password;
        public LoginReq(String u, String p) { username = u; password = p; }
    }

    public static class Libro {
        public long id;
        public String isbn, titulo, subtitulo, autores, editorial, categoria, imagenUrl, tipoControl, ubicaciones, estado;
        public int total, disponibles, prestados, danados, perdidos;
    }

    /** Petición de alta de libro. Los campos null no se envían (Gson los omite). */
    public static class LibroReq {
        public String isbn, titulo, subtitulo, autor, editorial, categoria, edicion, descripcion, nivelEducativo;
        public String tipoControl, prefijoCodigo, observaciones, imagenUrl;
        public Integer anioPublicacion, gradoRecomendado, cantidad;
        public Long ubicacionId;
    }

    public static class AgregarReq {
        public int cantidad = 1;
        public Long ubicacionId;
    }
    public static class Agregado { public Libro libro; public List<String> codigos; }

    public static class Ubicacion {
        public long id; public String codigo, descripcion;
        @Override public String toString() { return descripcion != null ? codigo + " — " + descripcion : codigo; }
    }

    public static class UltimoPrestamo { public String prestatario, fechaPrestamo, fechaDevolucion, estado; }
    public static class Ejemplar {
        public long id, libroId;
        public String codigoInterno, estado, condicion, ubicacion, titulo, isbn, imagenUrl;
        public UltimoPrestamo ultimoPrestamo;
        public List<String> acciones;
    }
    public static class EjemplarPatch {
        public String estado;
        public EjemplarPatch(String e) { estado = e; }
    }

    public static class Alumno {
        public long id; public String codigoAlumno, dni, nombres, apellidos, seccion; public Integer grado;
        public String nombreCompleto() { return apellidos + ", " + nombres; }
    }

    public static class PrestamoReq {
        public String alumnoDni, alumnoCodigo;
        public List<Item> items;
        public static class Item {
            public String codigoEjemplar; public Long libroId; public Integer cantidad;
        }
    }

    public static class PrestamoActivo {
        public long detalleId, prestamoId;
        public String codigoInterno, titulo, prestatario, fechaPrestamo, fechaPrevistaDevolucion;
        public boolean vencido;
    }
    public static class DevolucionReq {
        public String codigoEjemplar, resultado, observaciones;
    }

    public static class Firma { public String cloudName, apiKey, folder, signature; public long timestamp; }
    public static class CloudinaryResp { public String secure_url; }
}
