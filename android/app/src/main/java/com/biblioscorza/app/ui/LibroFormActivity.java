package com.biblioscorza.app.ui;

import android.content.Intent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
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
import com.biblioscorza.app.data.Models.LibroEdicion;
import com.biblioscorza.app.data.Models.LibroReq;
import com.biblioscorza.app.data.Models.Ubicacion;
import com.biblioscorza.app.util.Api;
import com.biblioscorza.app.util.ImageUploader;
import com.biblioscorza.app.data.Models.ConsultaIsbn;
import com.biblioscorza.app.data.Models.LibroDatos;
import com.biblioscorza.app.data.Models.LibroRegistrado;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class LibroFormActivity extends AppCompatActivity {
    private static final String[] NIVELES = {"Nivel (opcional)", "INICIAL", "PRIMARIA", "SECUNDARIA", "GENERAL"};
    private static final String[] TIPOS = {"CANTIDAD", "INDIVIDUAL"};
    private static final String[] PREFIJOS = {"LIB", "ESP"};

    private EditText etIsbn, etTitulo, etSubtitulo, etAutor, etEditorial, etCategoria, etAnio, etEdicion, etGrado, etCantidad, etDescripcion, etObs, etIdioma;
    private Spinner spNivel, spTipo, spPrefijo, spUbicacion;
    private ImageView ivFoto;
    private TextView tvError, tvFotoEstado, tvUbicacionInfo;
    private Button btnGuardar;
    private final List<Ubicacion> ubicaciones = new ArrayList<>();
    private String imagenUrl;
    private String urlFotoSubida;
    private String mimeFotoPendiente;
    private boolean subiendo, editando, ubicacionesCargadas, datosEdicionCargados, ubicacionesMultiples;
    private long libroId;
    private Long ubicacionActual;
    private File imagenPendiente, archivoCaptura;
    private boolean tieneInventario;
    private boolean trackingChanges, hasUnsavedChanges;

    private final ActivityResultLauncher<Intent> escanear = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                    etIsbn.setText(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR));
                    verificarIsbn();
                }
            });

    private final ActivityResultLauncher<Uri> tomarFoto = registerForActivityResult(
            new ActivityResultContracts.TakePicture(), ok -> {
                if (ok && archivoCaptura != null && imagenValida(archivoCaptura)) {
                    reemplazarImagenPendiente(archivoCaptura, "image/jpeg");
                } else {
                    if (archivoCaptura != null) archivoCaptura.delete();
                    if (ok) tvError.setText("La fotografía capturada no es válida");
                    if (imagenPendiente != null) mostrarImagen(imagenPendiente);
                    else restaurarPortadaGuardada();
                }
                archivoCaptura = null;
            });
    private final ActivityResultLauncher<String> elegirFoto = registerForActivityResult(
            new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) copiarFotoSeleccionada(uri);
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_libro_form);
        etIsbn = findViewById(R.id.etIsbn); etTitulo = findViewById(R.id.etTitulo); etSubtitulo = findViewById(R.id.etSubtitulo);
        etAutor = findViewById(R.id.etAutor); etEditorial = findViewById(R.id.etEditorial); etCategoria = findViewById(R.id.etCategoria);
        etAnio = findViewById(R.id.etAnio); etEdicion = findViewById(R.id.etEdicion); etGrado = findViewById(R.id.etGrado);
        etCantidad = findViewById(R.id.etCantidad); etDescripcion = findViewById(R.id.etDescripcion); etObs = findViewById(R.id.etObs);
        etIdioma = findViewById(R.id.etIdioma);
        spNivel = findViewById(R.id.spNivel); spTipo = findViewById(R.id.spTipo); spPrefijo = findViewById(R.id.spPrefijo);
        spUbicacion = findViewById(R.id.spUbicacion); ivFoto = findViewById(R.id.ivFoto);
        tvError = findViewById(R.id.tvError); tvFotoEstado = findViewById(R.id.tvFotoEstado);
        tvUbicacionInfo = findViewById(R.id.tvUbicacionInfo); btnGuardar = findViewById(R.id.btnGuardar);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        spNivel.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, NIVELES));
        spTipo.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"Control por cantidad", "Control individual (QR por ejemplar)"}));
        spPrefijo.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"Prefijo LIB (libro común)", "Prefijo ESP (libro especial)"}));
        spTipo.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            private int seleccionAnterior = -1;

            @Override public void onItemSelected(android.widget.AdapterView<?> p, View v, int pos, long id) {
                if (seleccionAnterior >= 0 && seleccionAnterior != pos && trackingChanges) {
                    hasUnsavedChanges = true;
                }
                seleccionAnterior = pos;
                spPrefijo.setVisibility(pos == 1 ? View.VISIBLE : View.GONE);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> p) { }
        });
        spPrefijo.setVisibility(View.GONE);

        editando = getIntent().hasExtra("libroId");
        libroId = getIntent().getLongExtra("libroId", 0);
        if (editando) {
            ((TextView) findViewById(R.id.tvTituloFormulario)).setText("Editar libro");
            btnGuardar.setText("Guardar cambios");
            findViewById(R.id.spTipo).setVisibility(View.GONE);
            findViewById(R.id.spPrefijo).setVisibility(View.GONE);
            findViewById(R.id.etCantidad).setVisibility(View.GONE);
            findViewById(R.id.btnScanIsbn).setVisibility(View.GONE);
            btnGuardar.setEnabled(false);
            cargarLibroParaEditar();
        }
        String isbn = getIntent().getStringExtra("isbn");
        if (!editando) {
            if (isbn != null) etIsbn.setText(isbn);
            aplicarDatoInicial(etTitulo, "titulo");
            aplicarDatoInicial(etSubtitulo, "subtitulo");
            aplicarDatoInicial(etAutor, "autor");
            aplicarDatoInicial(etEditorial, "editorial");
            aplicarDatoInicial(etCategoria, "categoria");
            aplicarDatoInicial(etEdicion, "edicion");
            aplicarDatoInicial(etDescripcion, "descripcion");
            Integer anio = getIntent().hasExtra("anioPublicacion")
                    ? getIntent().getIntExtra("anioPublicacion", 0) : null;
            if (anio != null && anio > 0) etAnio.setText(String.valueOf(anio));
            imagenUrl = getIntent().getStringExtra("imagenUrl");
            if (imagenUrl != null && !imagenUrl.trim().isEmpty()) mostrarImagen(imagenUrl);
        }

        cargarUbicaciones();
        findViewById(R.id.btnScanIsbn).setOnClickListener(v -> escanear.launch(new Intent(this, ScannerActivity.class)
                .putExtra(ScannerActivity.EXTRA_GUIA, "Escanea el código de barras (ISBN) del libro")));
        findViewById(R.id.btnFoto).setOnClickListener(v -> elegirOrigenFoto());
        btnGuardar.setOnClickListener(v -> guardar());
        observarCambiosSinGuardar(etIsbn, etTitulo, etSubtitulo, etAutor, etEditorial, etCategoria,
                etAnio, etEdicion, etGrado, etCantidad, etDescripcion, etObs, etIdioma);
        observarCambiosSinGuardar(spNivel, spPrefijo, spUbicacion);
        trackingChanges = true;
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (!hasUnsavedChanges) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }
                new AlertDialog.Builder(LibroFormActivity.this)
                        .setTitle("Hay cambios sin guardar")
                        .setMessage("¿Quieres salir y descartar los cambios?")
                        .setNegativeButton("Seguir editando", null)
                        .setPositiveButton("Salir sin guardar", (dialog, which) -> {
                            hasUnsavedChanges = false;
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                        })
                        .show();
            }
        });
    }

    private void observarCambiosSinGuardar(EditText... campos) {
        for (EditText campo : campos) {
            campo.addTextChangedListener(new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence texto, int inicio, int cuenta, int despues) { }
                @Override public void onTextChanged(CharSequence texto, int inicio, int antes, int cuenta) { }
                @Override public void afterTextChanged(Editable texto) {
                    if (trackingChanges) hasUnsavedChanges = true;
                }
            });
        }
    }

    private void observarCambiosSinGuardar(Spinner... campos) {
        for (Spinner campo : campos) {
            campo.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
                private int seleccionAnterior = -1;

                @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                    if (seleccionAnterior >= 0 && seleccionAnterior != position && trackingChanges) {
                        hasUnsavedChanges = true;
                    }
                    seleccionAnterior = position;
                }

                @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
            });
        }
    }

    private void cargarLibroParaEditar() {
        Api.call(ApiClient.api().libro(libroId), new Api.Result<LibroEdicion>() {
            @Override public void ok(LibroEdicion libro, String m) {
                if (libro == null) {
                    tvError.setText("No se recibieron los datos del libro");
                    return;
                }
                trackingChanges = false;
                etIsbn.setText(libro.isbn == null ? "" : libro.isbn);
                etTitulo.setText(libro.titulo == null ? "" : libro.titulo);
                etSubtitulo.setText(libro.subtitulo == null ? "" : libro.subtitulo);
                etAutor.setText(libro.autores == null ? "" : libro.autores);
                etEditorial.setText(libro.editorial == null ? "" : libro.editorial);
                etCategoria.setText(libro.categoria == null ? "" : libro.categoria);
                etAnio.setText(libro.anioPublicacion == null ? "" : String.valueOf(libro.anioPublicacion));
                etEdicion.setText(libro.edicion == null ? "" : libro.edicion);
                etIdioma.setText(libro.idioma == null ? "es" : libro.idioma);
                etGrado.setText(libro.gradoRecomendado == null ? "" : String.valueOf(libro.gradoRecomendado));
                etDescripcion.setText(libro.descripcion == null ? "" : libro.descripcion);
                etObs.setText(libro.observaciones == null ? "" : libro.observaciones);
                seleccionarNivel(libro.nivelEducativo);
                imagenUrl = libro.imagenUrl;
                if (imagenUrl != null) mostrarImagen(imagenUrl);
                ubicacionActual = libro.ubicacionInventario;
                ubicacionesMultiples = libro.ubicacionesMultiples;
                tieneInventario = libro.tieneInventario;
                if (ubicacionesMultiples) {
                    tvUbicacionInfo.setText("Este libro está repartido en varias ubicaciones; la edición de ubicación se bloquea para proteger su inventario.");
                } else if (!tieneInventario) {
                    tvUbicacionInfo.setText("No hay ejemplares registrados; asigna una ubicación al agregar inventario.");
                }
                datosEdicionCargados = true;
                configurarUbicaciones();
                hasUnsavedChanges = false;
                trackingChanges = true;
                btnGuardar.setEnabled(true);
            }
            @Override public void error(String msg, int h, String c) {
                tvError.setText("No se pudo cargar el libro: " + msg);
            }
        });
    }

    private void aplicarDatoInicial(EditText campo, String clave) {
        String valor = getIntent().getStringExtra(clave);
        if (valor != null && !valor.trim().isEmpty()) campo.setText(valor);
    }

    private void cargarUbicaciones() {
        Api.call(ApiClient.api().ubicaciones(), new Api.Result<List<Ubicacion>>() {
            @Override public void ok(List<Ubicacion> d, String m) {
                ubicaciones.clear(); ubicaciones.addAll(d);
                List<String> nombres = new ArrayList<>();
                if (editando) {
                    nombres.add("No cambiar ubicación");
                    nombres.add("Sin ubicación");
                } else {
                    nombres.add("Sin ubicación");
                }
                for (Ubicacion u : d) nombres.add(u.toString());
                spUbicacion.setAdapter(new ArrayAdapter<>(LibroFormActivity.this, android.R.layout.simple_spinner_dropdown_item, nombres));
                ubicacionesCargadas = true;
                if (!editando && !d.isEmpty()) spUbicacion.setSelection(1);
                configurarUbicaciones();
            }
            @Override public void error(String m, int h, String c) { tvError.setText(m); }
        });
    }

    private void configurarUbicaciones() {
        if (!editando || !ubicacionesCargadas || !datosEdicionCargados) return;
        if (ubicacionesMultiples || !tieneInventario) {
            spUbicacion.setSelection(0);
            spUbicacion.setEnabled(false);
            return;
        }
        spUbicacion.setEnabled(true);
        if (ubicacionActual == null) {
            spUbicacion.setSelection(0);
            return;
        }
        for (int i = 0; i < ubicaciones.size(); i++) {
            if (ubicaciones.get(i).id == ubicacionActual) {
                spUbicacion.setSelection(i + 2);
                return;
            }
        }
        spUbicacion.setSelection(0);
    }

    
private void verificarIsbn() {
    String isbn = etIsbn.getText().toString().trim();

    if (isbn.isEmpty()) return;

    Api.call(
        ApiClient.api().libroPorIsbn(isbn),
        new Api.Result<ConsultaIsbn>() {

            @Override
            public void ok(ConsultaIsbn resultado, String m) {
                if (resultado == null) {
                    tvError.setText("No se recibió información del ISBN");
                    return;
                }

                // Caso 1: el libro ya está registrado en la biblioteca.
                if (resultado.existente != null) {
                    LibroRegistrado existente = resultado.existente;
                    if (editando) {
                        if (existente.id != libroId) {
                            tvError.setText("Ese ISBN ya pertenece a otro libro");
                        }
                        return;
                    }

                    new AlertDialog.Builder(LibroFormActivity.this)
                        .setTitle("Libro existente")
                        .setView(LibroDetalleDialog.contenido(LibroFormActivity.this, existente))
                        .setPositiveButton("Agregar otro ejemplar", (d, w) -> {
                            AgregarReq req = new AgregarReq();
                            req.cantidad = 1;

                            Api.call(
                                ApiClient.api().agregarEjemplares(
                                    existente.id, req
                                ),
                                new Api.Result<Agregado>() {
                                    @Override
                                    public void ok(Agregado a, String mm) {
                                        String mensaje = "Ejemplar agregado";
                                        if (a != null && a.libro != null) {
                                            mensaje += ". Total: " + a.libro.total;
                                        }

                                        Toast.makeText(
                                            LibroFormActivity.this,
                                            mensaje,
                                            Toast.LENGTH_LONG
                                        ).show();

                                        finish();
                                    }

                                    @Override
                                    public void error(
                                        String msg, int http, String code
                                    ) {
                                        tvError.setText(msg);
                                    }
                                }
                            );
                        })
                        .setNegativeButton("Cerrar", null)
                        .show();

                    return;
                }

                // Caso 2: no está registrado, pero Google Books
                // encontró información bibliográfica.
                LibroDatos datos = resultado.libro;

                if (datos != null) {
                    if (datos.titulo != null) {
                        etTitulo.setText(datos.titulo);
                    }
                    if (datos.subtitulo != null) {
                        etSubtitulo.setText(datos.subtitulo);
                    }
                    if (datos.autor != null) {
                        etAutor.setText(datos.autor);
                    }
                    if (datos.editorial != null) {
                        etEditorial.setText(datos.editorial);
                    }
                    if (datos.categoria != null) {
                        etCategoria.setText(datos.categoria);
                    }
                    if (datos.anioPublicacion != null) {
                        etAnio.setText(
                            String.valueOf(datos.anioPublicacion)
                        );
                    }
                    if (datos.edicion != null) {
                        etEdicion.setText(datos.edicion);
                    }
                    if (datos.descripcion != null) {
                        etDescripcion.setText(datos.descripcion);
                    }
                    if (datos.imagenUrl != null) {
                        imagenUrl = datos.imagenUrl;
                        mostrarImagen(imagenUrl);
                    }

                    Toast.makeText(
                        LibroFormActivity.this,
                        "Datos encontrados. Revisa y registra el libro.",
                        Toast.LENGTH_LONG
                    ).show();
                } else {
                    Toast.makeText(
                        LibroFormActivity.this,
                        "ISBN no registrado. Ingresa los datos manualmente.",
                        Toast.LENGTH_LONG
                    ).show();
                }
            }

            @Override
            public void error(String m, int h, String c) {
                new AlertDialog.Builder(LibroFormActivity.this)
                    .setTitle("No se pudo consultar el ISBN")
                    .setMessage(h == 0
                        ? "Revisa tu conexión. Puedes reintentar o continuar el registro manualmente."
                        : "El servidor no pudo completar la consulta. Puedes reintentar o continuar manualmente.")
                    .setPositiveButton("Reintentar", (d, w) -> verificarIsbn())
                    .setNegativeButton("Continuar manualmente", null)
                    .show();
            }
        }
    );
}


    private void elegirOrigenFoto() {
        String[] opciones = editando || imagenUrl != null
                ? new String[]{"Elegir de galería", "Tomar fotografía", "Mantener fotografía actual"}
                : new String[]{"Elegir de galería", "Tomar fotografía"};
        new AlertDialog.Builder(this)
                .setTitle("Fotografía del libro")
                .setItems(opciones, (dialog, opcion) -> {
                    if (opcion == 0) elegirFoto.launch("image/*");
                    else if (opcion == 1) abrirCamaraFoto();
                    else restaurarPortadaGuardada();
                })
                .show();
    }

    private void abrirCamaraFoto() {
        try {
            File dir = new File(getCacheDir(), "fotos");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No se pudo preparar el almacenamiento temporal");
            archivoCaptura = new File(dir, "portada_" + System.currentTimeMillis() + ".jpg");
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", archivoCaptura);
            tomarFoto.launch(uri);
        } catch (RuntimeException e) {
            archivoCaptura = null;
            tvError.setText("No se pudo abrir la cámara. Verifica que esté disponible.");
        }
    }

    private void copiarFotoSeleccionada(Uri uri) {
        String mime = getContentResolver().getType(uri);
        if (mime == null || !mime.startsWith("image/")) {
            tvError.setText("Selecciona un archivo de imagen");
            return;
        }
        String extension;
        if ("image/jpeg".equalsIgnoreCase(mime)) extension = ".jpg";
        else if ("image/png".equalsIgnoreCase(mime)) extension = ".png";
        else if ("image/webp".equalsIgnoreCase(mime)) extension = ".webp";
        else {
            tvError.setText("Formato de imagen no compatible. Usa JPG, PNG o WEBP.");
            return;
        }

        File copia = new File(getCacheDir(), "portada_" + System.currentTimeMillis() + extension);
        try (InputStream input = getContentResolver().openInputStream(uri);
             FileOutputStream output = new FileOutputStream(copia)) {
            if (input == null) throw new IllegalArgumentException("No se pudo abrir la imagen seleccionada");
            byte[] buffer = new byte[8192];
            int leidos;
            long total = 0;
            while ((leidos = input.read(buffer)) != -1) {
                total += leidos;
                if (total > 15L * 1024 * 1024) throw new IllegalArgumentException("La imagen supera el límite de 15 MB");
                output.write(buffer, 0, leidos);
            }
            if (!imagenValida(copia)) throw new IllegalArgumentException("El archivo seleccionado no es una imagen válida");
            reemplazarImagenPendiente(copia, mime);
        } catch (Exception e) {
            copia.delete();
            tvError.setText(e.getMessage() == null ? "No se pudo leer la imagen seleccionada" : e.getMessage());
        }
    }

    private static boolean imagenValida(File archivo) {
        if (archivo == null || !archivo.isFile() || archivo.length() == 0) return false;
        BitmapFactory.Options opciones = new BitmapFactory.Options();
        opciones.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(archivo.getAbsolutePath(), opciones);
        return opciones.outWidth > 0 && opciones.outHeight > 0;
    }

    private void reemplazarImagenPendiente(File archivo, String mime) {
        if (imagenPendiente != null && !imagenPendiente.equals(archivo)) imagenPendiente.delete();
        imagenPendiente = archivo;
        mimeFotoPendiente = mime;
        urlFotoSubida = null;
        if (trackingChanges) hasUnsavedChanges = true;
        tvError.setText("");
        tvFotoEstado.setText("Vista previa lista; se subirá al guardar.");
        mostrarImagen(archivo);
    }

    private void mostrarImagen(Object fuente) {
        Glide.with(this).load(fuente).placeholder(R.drawable.ic_book_stack)
                .error(R.drawable.ic_book_stack).centerInside().into(ivFoto);
        ivFoto.setVisibility(View.VISIBLE);
    }

    private void restaurarPortadaGuardada() {
        if (imagenPendiente != null) imagenPendiente.delete();
        imagenPendiente = null;
        mimeFotoPendiente = null;
        urlFotoSubida = null;
        if (imagenUrl != null && !imagenUrl.trim().isEmpty()) {
            mostrarImagen(imagenUrl);
            tvFotoEstado.setText("Se conservará la fotografía actual.");
        } else {
            ivFoto.setImageResource(R.drawable.ic_book_stack);
            ivFoto.setVisibility(View.GONE);
            tvFotoEstado.setText("No hay una fotografía guardada.");
        }
    }

    private void seleccionarNivel(String valor) {
        spNivel.setSelection(0);
        for (int i = 0; i < NIVELES.length; i++) {
            if (valor != null && NIVELES[i].equals(valor)) {
                spNivel.setSelection(i);
                return;
            }
        }
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
        r.idioma = t(etIdioma) == null ? "es" : t(etIdioma);
        int nv = spNivel.getSelectedItemPosition();
        r.nivelEducativo = nv == 0 ? null : NIVELES[nv];
        if (editando) {
            int posicion = spUbicacion.getSelectedItemPosition();
            if (!ubicacionesMultiples && posicion == 1) r.ubicacionId = 0L;
            else if (!ubicacionesMultiples && posicion >= 2) r.ubicacionId = ubicaciones.get(posicion - 2).id;
        } else {
            r.cantidad = n(etCantidad) == null ? 1 : n(etCantidad);
            if (r.cantidad < 0) { tvError.setText("La cantidad no puede ser negativa"); return; }
            r.tipoControl = TIPOS[spTipo.getSelectedItemPosition()];
            r.prefijoCodigo = PREFIJOS[spPrefijo.getSelectedItemPosition()];
            int posicion = spUbicacion.getSelectedItemPosition();
            r.ubicacionId = posicion > 0 ? ubicaciones.get(posicion - 1).id : null;
        }
        guardarConImagen(r);
    }

    private void guardarConImagen(LibroReq solicitud) {
        btnGuardar.setEnabled(false);
        if (imagenPendiente != null && urlFotoSubida == null) {
            subiendo = true;
            tvFotoEstado.setText("Subiendo fotografía…");
            ImageUploader.subir(imagenPendiente, mimeFotoPendiente, new ImageUploader.Listener() {
                @Override public void ok(String url) {
                    subiendo = false;
                    urlFotoSubida = url;
                    solicitud.imagenUrl = url;
                    guardarLibro(solicitud);
                }
                @Override public void error(String mensaje) {
                    subiendo = false;
                    tvFotoEstado.setText("No se pudo subir la fotografía.");
                    tvError.setText(mensaje);
                    btnGuardar.setEnabled(true);
                }
            });
            return;
        }
        solicitud.imagenUrl = urlFotoSubida != null ? urlFotoSubida : imagenUrl;
        guardarLibro(solicitud);
    }

    private void guardarLibro(LibroReq solicitud) {
        Api.Result<Libro> respuesta = new Api.Result<Libro>() {
            @Override public void ok(Libro libro, String mensaje) {
                if (imagenPendiente != null) imagenPendiente.delete();
                imagenPendiente = null;
                Toast.makeText(LibroFormActivity.this,
                        mensaje != null ? mensaje : editando ? "Cambios guardados" : "Libro registrado",
                        Toast.LENGTH_LONG).show();
                setResult(RESULT_OK);
                finish();
            }
            @Override public void error(String mensaje, int http, String code) {
                tvError.setText(mensaje);
                btnGuardar.setEnabled(true);
            }
        };
        if (editando) Api.call(ApiClient.api().actualizarLibro(libroId, solicitud), respuesta);
        else Api.call(ApiClient.api().crearLibro(solicitud), respuesta);
    }
}
