package com.biblioscorza.app.ui;

import android.app.Activity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import com.bumptech.glide.Glide;
import com.biblioscorza.app.R;
import com.biblioscorza.app.data.Models.LibroRegistrado;

final class LibroDetalleDialog {
    private LibroDetalleDialog() {}

    static View contenido(Activity activity, LibroRegistrado libro) {
        View contenido = LayoutInflater.from(activity).inflate(R.layout.dialog_libro_detalle, null);
        ImageView portada = contenido.findViewById(R.id.ivPortadaDetalle);
        TextView titulo = contenido.findViewById(R.id.tvTituloDetalle);
        TextView autores = contenido.findViewById(R.id.tvAutoresDetalle);
        TextView inventario = contenido.findViewById(R.id.tvInventarioDetalle);
        TextView datos = contenido.findViewById(R.id.tvDatosDetalle);

        titulo.setText(valor(libro.titulo));
        autores.setText("Autor(es): " + valor(libro.autores));
        if (libro.imagenUrl != null && !libro.imagenUrl.trim().isEmpty()) {
            Glide.with(activity)
                    .load(libro.imagenUrl)
                    .placeholder(R.drawable.ic_book_stack)
                    .error(R.drawable.ic_book_stack)
                    .centerCrop()
                    .into(portada);
        }

        StringBuilder stock = new StringBuilder("DISPONIBILIDAD\n");
        agregarCantidad(stock, "Total", libro.total);
        agregarCantidad(stock, "Disponibles", libro.disponibles);
        agregarCantidad(stock, "Prestados", libro.prestados);
        agregarCantidad(stock, "Dañados", libro.danados);
        agregarCantidad(stock, "Perdidos", libro.perdidos);
        inventario.setText(stock.toString().trim());

        StringBuilder informacion = new StringBuilder();
        agregarDato(informacion, "Subtítulo", libro.subtitulo);
        agregarDato(informacion, "ISBN", libro.isbn);
        agregarDato(informacion, "Editorial", libro.editorial);
        agregarDato(informacion, "Año de publicación", libro.anioPublicacion);
        agregarDato(informacion, "Edición", libro.edicion);
        agregarDato(informacion, "Categoría", libro.categoria);
        agregarDato(informacion, "Nivel educativo", libro.nivelEducativo);
        agregarDato(informacion, "Grado recomendado", libro.gradoRecomendado);
        agregarDato(informacion, "Ubicación / estantería", libro.ubicaciones);
        agregarDato(informacion, "Tipo de control", libro.tipoControl);
        agregarDato(informacion, "Estado", libro.estado);
        agregarDato(informacion, "Descripción", libro.descripcion);
        datos.setText(informacion.length() == 0 ? "Información complementaria: No registrada" : informacion.toString());
        return contenido;
    }

    private static String valor(String texto) {
        return texto == null || texto.trim().isEmpty() ? "No registrado" : texto.trim();
    }

    private static void agregarCantidad(StringBuilder texto, String etiqueta, Integer cantidad) {
        texto.append(etiqueta).append(": ")
                .append(cantidad == null ? "No registrado" : cantidad)
                .append('\n');
    }

    private static void agregarDato(StringBuilder texto, String etiqueta, Object valor) {
        if (valor == null || valor.toString().trim().isEmpty()) return;
        if (texto.length() > 0) texto.append('\n');
        texto.append(etiqueta).append(": ").append(valor);
    }
}
