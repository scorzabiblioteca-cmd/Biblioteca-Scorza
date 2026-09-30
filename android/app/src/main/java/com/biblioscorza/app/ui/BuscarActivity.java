package com.biblioscorza.app.ui;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Libro;
import com.biblioscorza.app.data.Models.Paged;
import com.biblioscorza.app.util.Api;

import java.util.ArrayList;
import java.util.List;

public class BuscarActivity extends AppCompatActivity {
    private final Handler h = new Handler(Looper.getMainLooper());
    private final List<Libro> libros = new ArrayList<>();
    private final List<String> textos = new ArrayList<>();
    private ArrayAdapter<String> adapter;
    private TextView tvMsg;
    private Runnable pendiente;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_buscar);
        tvMsg = findViewById(R.id.tvMsg);
        ListView lista = findViewById(R.id.lista);
        adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, textos);
        lista.setAdapter(adapter);
        lista.setOnItemClickListener((p, v, pos, id) -> detalle(libros.get(pos)));
        ((EditText) findViewById(R.id.etBuscar)).addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void onTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void afterTextChanged(Editable s) {
                if (pendiente != null) h.removeCallbacks(pendiente);
                String q = s.toString().trim();
                pendiente = () -> buscar(q);
                h.postDelayed(pendiente, 350); // espera a que termine de escribir
            }
        });
        buscar("");
    }

    private void buscar(String q) {
        Api.call(ApiClient.api().buscarLibros(q, 30), new Api.Result<Paged<Libro>>() {
            @Override public void ok(Paged<Libro> d, String m) {
                libros.clear(); textos.clear();
                for (Libro l : d.items) {
                    libros.add(l);
                    textos.add(l.titulo + "\n" + (l.autores == null ? "" : l.autores + " · ") + "Disp. " + l.disponibles + "/" + l.total);
                }
                adapter.notifyDataSetChanged();
                tvMsg.setText(d.items.isEmpty() ? "Sin resultados" : d.total + " resultado(s)");
            }
            @Override public void error(String msg, int http, String c) { tvMsg.setText(msg); }
        });
    }

    private void detalle(Libro l) {
        String s = "ISBN: " + (l.isbn == null ? "—" : l.isbn)
                + "\nAutor: " + (l.autores == null ? "—" : l.autores)
                + "\nEditorial: " + (l.editorial == null ? "—" : l.editorial)
                + "\nControl: " + ("CANTIDAD".equals(l.tipoControl) ? "por cantidad" : "individual")
                + "\n\nTotal: " + l.total + "   Disponibles: " + l.disponibles + "   Prestados: " + l.prestados
                + "\nDañados: " + l.danados + "   Perdidos: " + l.perdidos
                + "\n\nUbicación: " + (l.ubicaciones == null ? "Sin ubicación" : l.ubicaciones);
        new AlertDialog.Builder(this).setTitle(l.titulo).setMessage(s).setPositiveButton("Cerrar", null).show();
    }
}
