package com.biblioscorza.app.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

import com.bumptech.glide.Glide;
import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Agregado;
import com.biblioscorza.app.data.Models.AgregarReq;
import com.biblioscorza.app.data.Models.Libro;
import com.biblioscorza.app.data.Models.LibroReq;
import com.biblioscorza.app.data.Models.Ubicacion;
import com.biblioscorza.app.util.Api;
import com.biblioscorza.app.util.ImageUploader;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class LibroFormActivity extends AppCompatActivity {
    private static final String[] NIVELES = {"Nivel (opcional)", "INICIAL", "PRIMARIA", "SECUNDARIA", "GENERAL"};
    private static final String[] TIPOS = {"CANTIDAD", "INDIVIDUAL"};
    private static final String[] PREFIJOS = {"LIB", "ESP"};

    private EditText etIsbn, etTitulo, etSubtitulo, etAutor, etEditorial, etCategoria, etAnio, etEdicion, etGrado, etCantidad, etDescripcion, etObs;
    private Spinner spNivel, spTipo, spPrefijo, spUbicacion;
    private ImageView ivFoto;
    private TextView tvError, tvFotoEstado;
    private Button btnGuardar;
    private final List<Ubicacion> ubicaciones = new ArrayList<>();
    private String imagenUrl;
    private boolean subiendo, rapido;
    private File fotoArchivo;

    private final ActivityResultLauncher<Intent> escanear = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                    etIsbn.setText(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR));
                    verificarIsbn();
                }
            });

    private final ActivityResultLauncher<Uri> tomarFoto = registerForActivityResult(
            new ActivityResultContracts.TakePicture(), ok -> { if (ok) subirFoto(); });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_libro_form);
        etIsbn = findViewById(R.id.etIsbn); etTitulo = findViewById(R.id.etTitulo); etSubtitulo = findViewById(R.id.etSubtitulo);
        etAutor = findViewById(R.id.etAutor); etEditorial = findViewById(R.id.etEditorial); etCategoria = findViewById(R.id.etCategoria);
        etAnio = findViewById(R.id.etAnio); etEdicion = findViewById(R.id.etEdicion); etGrado = findViewById(R.id.etGrado);
        etCantidad = findViewById(R.id.etCantidad); etDescripcion = findViewById(R.id.etDescripcion); etObs = findViewById(R.id.etObs);
        spNivel = findViewById(R.id.spNivel); spTipo = findViewById(R.id.spTipo); spPrefijo = findViewById(R.id.spPrefijo);
        spUbicacion = findViewById(R.id.spUbicacion); ivFoto = findViewById(R.id.ivFoto);
        tvError = findViewById(R.id.tvError); tvFotoEstado = findViewById(R.id.tvFotoEstado); btnGuardar = findViewById(R.id.btnGuardar);

        spNivel.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, NIVELES));
        spTipo.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"Control por cantidad", "Control individual (QR por ejemplar)"}));
        spPrefijo.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"Prefijo LIB (libro común)", "Prefijo ESP (libro especial)"}));
        spTipo.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> p, View v, int pos, long id) {
                spPrefijo.setVisibility(pos == 1 ? View.VISIBLE : View.GONE);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> p) { }
        });
        spPrefijo.setVisibility(View.GONE);

        rapido = getIntent().getBooleanExtra("rapido", false);
        String isbn = getIntent().getStringExtra("isbn");
        if (isbn != null) etIsbn.setText(isbn);

        cargarUbicaciones();
        findViewById(R.id.btnScanIsbn).setOnClickListener(v -> escanear.launch(new Intent(this, ScannerActivity.class)
                .putExtra(ScannerActivity.EXTRA_GUIA, "Escanea el código de barras (ISBN) del libro")));
        findViewById(R.id.btnFoto).setOnClickListener(v -> abrirCamaraFoto());
        btnGuardar.setOnClickListener(v -> guardar());
    }

    private void cargarUbicaciones() {
        Api.call(ApiClient.api().ubicaciones(), new Api.Result<List<Ubicacion>>() {
            @Override public void ok(List<Ubicacion> d, String m) {
                ubicaciones.clear(); ubicaciones.addAll(d);
                List<String> nombres = new ArrayList<>();
                nombres.add("Sin ubicación");
                for (Ubicacion u : d) nombres.add(u.toString());
                spUbicacion.setAdapter(new ArrayAdapter<>(LibroFormActivity.this, android.R.layout.simple_spinner_dropdown_item, nombres));
                if (!d.isEmpty()) spUbicacion.setSelection(1); // ubicación por defecto: la primera
            }
            @Override public void error(String m, int h, String c) { tvError.setText(m); }
        });
    }

    private void verificarIsbn() {
        String isbn = etIsbn.getText().toString().trim();
        if (isbn.isEmpty()) return;
        Api.call(ApiClient.api().libroPorIsbn(isbn), new Api.Result<Libro>() {
            @Override public void ok(Libro l, String m) {
                new AlertDialog.Builder(LibroFormActivity.this).setTitle("Libro existente")
                        .setMessage(l.titulo + "\nCantidad actual: " + l.total)
                        .setPositiveButton("Agregar otro ejemplar", (d, w) ->
                                Api.call(ApiClient.api().agregarEjemplares(l.id, new AgregarReq()), new Api.Result<Agregado>() {
                                    @Override public void ok(Agregado a, String mm) {
                                        Toast.makeText(LibroFormActivity.this, "Agregado. Total: " + a.libro.total, Toast.LENGTH_LONG).show();
                                        finish();
                                    }
                                    @Override public void error(String msg, int h, String c) { tvError.setText(msg); }
                                }))
                        .setNegativeButton("Cancelar", null).show();
            }
            @Override public void error(String m, int h, String c) { /* no existe: continuar con el registro */ }
        });
    }

    private void abrirCamaraFoto() {
        try {
            File dir = new File(getCacheDir(), "fotos");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            fotoArchivo = new File(dir, "portada_" + System.currentTimeMillis() + ".jpg");
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", fotoArchivo);
            tomarFoto.launch(uri);
        } catch (Exception e) {
            tvError.setText("No se pudo abrir la cámara");
        }
    }

    private void subirFoto() {
        Glide.with(this).load(fotoArchivo).into(ivFoto);
        ivFoto.setVisibility(View.VISIBLE);
        tvFotoEstado.setText("Subiendo foto…");
        subiendo = true;
        ImageUploader.subir(fotoArchivo, new ImageUploader.Listener() {
            @Override public void ok(String url) { imagenUrl = url; subiendo = false; tvFotoEstado.setText("Foto subida ✓"); }
            @Override public void error(String msg) { subiendo = false; tvFotoEstado.setText(msg); }
        });
    }

    private static String t(EditText e) { String s = e.getText().toString().trim(); return s.isEmpty() ? null : s; }
    private static Integer n(EditText e) {
        try { return Integer.valueOf(e.getText().toString().trim()); } catch (Exception ex) { return null; }
    }

    private void guardar() {
        tvError.setText("");
        if (subiendo) { tvError.setText("Espera a que termine de subir la foto"); return; }
        if (t(etTitulo) == null) { tvError.setText("El título es obligatorio"); return; }
        LibroReq r = new LibroReq();
        r.isbn = t(etIsbn); r.titulo = t(etTitulo); r.subtitulo = t(etSubtitulo); r.autor = t(etAutor);
        r.editorial = t(etEditorial); r.categoria = t(etCategoria); r.edicion = t(etEdicion);
        r.descripcion = t(etDescripcion); r.observaciones = t(etObs);
        r.anioPublicacion = n(etAnio); r.gradoRecomendado = n(etGrado);
        r.cantidad = n(etCantidad) == null ? 1 : n(etCantidad);
        if (r.cantidad < 0) { tvError.setText("La cantidad no puede ser negativa"); return; }
        int nv = spNivel.getSelectedItemPosition();
        r.nivelEducativo = nv == 0 ? null : NIVELES[nv];
        r.tipoControl = TIPOS[spTipo.getSelectedItemPosition()];
        r.prefijoCodigo = PREFIJOS[spPrefijo.getSelectedItemPosition()];
        int up = spUbicacion.getSelectedItemPosition();
        r.ubicacionId = up > 0 ? ubicaciones.get(up - 1).id : null;
        r.imagenUrl = imagenUrl;

        btnGuardar.setEnabled(false);
        Api.call(ApiClient.api().crearLibro(r), new Api.Result<Libro>() {
            @Override public void ok(Libro l, String m) {
                Toast.makeText(LibroFormActivity.this, m != null ? m : "Libro registrado", Toast.LENGTH_LONG).show();
                setResult(RESULT_OK);
                finish(); // en modo rápido regresa solo al escáner
            }
            @Override public void error(String msg, int http, String code) { tvError.setText(msg); btnGuardar.setEnabled(true); }
        });
    }
}
