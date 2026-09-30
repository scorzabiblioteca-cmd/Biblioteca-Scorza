package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Alumno;
import com.biblioscorza.app.data.Models.Ejemplar;
import com.biblioscorza.app.data.Models.Libro;
import com.biblioscorza.app.data.Models.PrestamoReq;
import com.biblioscorza.app.util.Api;

import java.util.ArrayList;
import java.util.List;

/** Flujo: identificar alumno -> escanear libro(s) -> confirmar. */
public class PrestamoActivity extends AppCompatActivity {
    private EditText etAlumno;
    private TextView tvAlumno, tvItems, tvMsg;
    private Button btnScanLibro, btnConfirmar;
    private Alumno alumno;
    private final List<PrestamoReq.Item> items = new ArrayList<>();
    private final List<String> lineas = new ArrayList<>();

    private final ActivityResultLauncher<Intent> escanearAlumno = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                    etAlumno.setText(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR));
                    buscarAlumno();
                }
            });
    private final ActivityResultLauncher<Intent> escanearLibro = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null)
                    procesarLibro(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR));
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_prestamo);
        etAlumno = findViewById(R.id.etAlumno); tvAlumno = findViewById(R.id.tvAlumno);
        tvItems = findViewById(R.id.tvItems); tvMsg = findViewById(R.id.tvMsg);
        btnScanLibro = findViewById(R.id.btnScanLibro); btnConfirmar = findViewById(R.id.btnConfirmar);
        findViewById(R.id.btnBuscarAlumno).setOnClickListener(v -> buscarAlumno());
        findViewById(R.id.btnScanAlumno).setOnClickListener(v -> escanearAlumno.launch(
                new Intent(this, ScannerActivity.class).putExtra(ScannerActivity.EXTRA_GUIA, "Escanea el QR del alumno")));
        btnScanLibro.setOnClickListener(v -> escanearLibro.launch(
                new Intent(this, ScannerActivity.class).putExtra(ScannerActivity.EXTRA_GUIA, "Escanea el QR del ejemplar o el ISBN")));
        btnConfirmar.setOnClickListener(v -> confirmar());
        String pre = getIntent().getStringExtra("codigo");   // viene desde la ficha del ejemplar
        if (pre != null) procesarLibro(pre);
    }

    private void buscarAlumno() {
        tvMsg.setText("");
        String v = etAlumno.getText().toString().trim();
        if (v.isEmpty()) { tvMsg.setText("Escribe el DNI o código del alumno"); return; }
        Api.Result<Alumno> cb = new Api.Result<Alumno>() {
            @Override public void ok(Alumno a, String m) {
                alumno = a;
                tvAlumno.setText(a.nombreCompleto() + (a.grado != null ? " — " + a.grado + "° " + (a.seccion == null ? "" : a.seccion) : ""));
                btnScanLibro.setEnabled(true);
                actualizar();
            }
            @Override public void error(String msg, int h, String c) { alumno = null; tvAlumno.setText(""); tvMsg.setText(msg); btnScanLibro.setEnabled(false); }
        };
        if (v.matches("\\d{8,}")) Api.call(ApiClient.api().alumnoPorDni(v), cb);
        else Api.call(ApiClient.api().alumnoPorCodigo(v), cb);
    }

    private void procesarLibro(String valor) {
        tvMsg.setText("");
        if (valor == null) return;
        if (valor.toUpperCase().matches("^(LIB|ESP)-\\d+$")) {
            String codigo = valor.toUpperCase();
            for (PrestamoReq.Item it : items) if (codigo.equals(it.codigoEjemplar)) { tvMsg.setText("Ese ejemplar ya está en la lista"); return; }
            Api.call(ApiClient.api().ejemplarPorCodigo(codigo), new Api.Result<Ejemplar>() {
                @Override public void ok(Ejemplar e, String m) {
                    if (!"DISPONIBLE".equals(e.estado)) { tvMsg.setText(e.codigoInterno + " no está disponible (" + e.estado + ")"); return; }
                    PrestamoReq.Item it = new PrestamoReq.Item(); it.codigoEjemplar = e.codigoInterno;
                    items.add(it); lineas.add(e.codigoInterno + " — " + e.titulo); actualizar();
                }
                @Override public void error(String msg, int h, String c) { tvMsg.setText(msg); }
            });
        } else {
            Api.call(ApiClient.api().libroPorIsbn(valor.replaceAll("[\\s-]", "")), new Api.Result<Libro>() {
                @Override public void ok(Libro l, String m) {
                    if (!"CANTIDAD".equals(l.tipoControl)) { tvMsg.setText("\"" + l.titulo + "\" es de control individual: escanea el QR del ejemplar"); return; }
                    if (l.disponibles <= 0) { tvMsg.setText("No hay copias disponibles de \"" + l.titulo + "\""); return; }
                    for (int i = 0; i < items.size(); i++) {
                        PrestamoReq.Item it = items.get(i);
                        if (it.libroId != null && it.libroId == l.id) {
                            if (it.cantidad >= l.disponibles) { tvMsg.setText("No hay más copias disponibles"); return; }
                            it.cantidad++; lineas.set(i, l.titulo + " × " + it.cantidad); actualizar(); return;
                        }
                    }
                    PrestamoReq.Item it = new PrestamoReq.Item(); it.libroId = l.id; it.cantidad = 1;
                    items.add(it); lineas.add(l.titulo + " × 1"); actualizar();
                }
                @Override public void error(String msg, int h, String c) { tvMsg.setText(msg); }
            });
        }
    }

    private void actualizar() {
        tvItems.setText(lineas.isEmpty() ? "" : "Libros a prestar:\n• " + String.join("\n• ", lineas));
        btnConfirmar.setEnabled(alumno != null && !items.isEmpty());
    }

    private void confirmar() {
        PrestamoReq r = new PrestamoReq();
        String v = etAlumno.getText().toString().trim();
        if (alumno.dni != null && alumno.dni.equals(v)) r.alumnoDni = v; else r.alumnoCodigo = alumno.codigoAlumno;
        r.items = items;
        btnConfirmar.setEnabled(false);
        Api.call(ApiClient.api().prestar(r), new Api.Result<Object>() {
            @Override public void ok(Object d, String m) {
                android.widget.Toast.makeText(PrestamoActivity.this, m == null ? "Préstamo registrado" : m, android.widget.Toast.LENGTH_LONG).show();
                finish();
            }
            @Override public void error(String msg, int h, String c) { tvMsg.setText(msg); btnConfirmar.setEnabled(true); }
        });
    }
}
