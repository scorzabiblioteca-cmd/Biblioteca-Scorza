package com.biblioscorza.app.ui;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.Models.Libro;
import com.bumptech.glide.Glide;

import java.util.List;

final class LibroBusquedaAdapter extends BaseAdapter {
    private final Context context;
    private final List<Libro> libros;

    LibroBusquedaAdapter(Context context, List<Libro> libros) {
        this.context = context;
        this.libros = libros;
    }

    @Override public int getCount() { return libros.size(); }
    @Override public Libro getItem(int position) { return libros.get(position); }
    @Override public long getItemId(int position) { return getItem(position).id; }

    @Override public View getView(int position, View convertView, ViewGroup parent) {
        View row = convertView == null
                ? LayoutInflater.from(context).inflate(R.layout.row_libro_busqueda, parent, false)
                : convertView;
        Libro libro = getItem(position);
        ((TextView) row.findViewById(R.id.tvTitulo)).setText(valor(libro.titulo));
        ((TextView) row.findViewById(R.id.tvAutor)).setText("Autor(es): " + valor(libro.autores));
        ((TextView) row.findViewById(R.id.tvDetalles)).setText(
                "ISBN: " + valor(libro.isbn) + " · Categoría: " + valor(libro.categoria));
        int disponibles = libro.disponibles == null ? -1 : libro.disponibles;
        String stock = "Total: " + cantidad(libro.total) + " · Disponibles: " + cantidad(libro.disponibles);
        stock += disponibles > 0 ? " · Disponible" : disponibles == 0 ? " · Sin ejemplares disponibles" : "";
        ((TextView) row.findViewById(R.id.tvStock)).setText(stock);
        ImageView portada = row.findViewById(R.id.ivPortada);
        Glide.with(context).load(libro.imagenUrl)
                .placeholder(android.R.drawable.ic_menu_gallery)
                .error(android.R.drawable.ic_menu_report_image)
                .centerCrop().into(portada);
        return row;
    }

    private static String valor(String texto) {
        return texto == null || texto.trim().isEmpty() ? "No registrado" : texto;
    }

    private static String cantidad(Integer valor) {
        return valor == null ? "No informado" : String.valueOf(valor);
    }
}
