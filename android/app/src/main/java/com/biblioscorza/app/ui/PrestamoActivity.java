package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AutoCompleteTextView;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.Filter;
import android.widget.Filterable;
import android.widget.RadioGroup;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Alumno;
import com.biblioscorza.app.data.Models.ConsultaIsbn;
import com.biblioscorza.app.data.Models.Ejemplar;
import com.biblioscorza.app.data.Models.Paged;
import com.biblioscorza.app.data.Models.PrestamoReq;
import com.biblioscorza.app.data.Models.Profesor;
import com.biblioscorza.app.util.Api;
import com.biblioscorza.app.util.ScannedCode;

import java.util.ArrayList;
import java.util.List;

/** Flujo: identificar alumno -> escanear libro(s) -> confirmar. */
public class PrestamoActivity extends AppCompatActivity {
    private static final String TAG = "PrestamoActivity";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Alumno> sugerencias = new ArrayList<>();
    private final List<Profesor> sugerenciasProfesores = new ArrayList<>();
    private final List<PrestamoReq.Item> items = new ArrayList<>();
    private final List<String> lineas = new ArrayList<>();
    private AutoCompleteTextView etAlumno;
    private TextView tvAlumno, tvDatosPrestatario, tvItems, tvMsg;
    private Button btnScanLibro, btnConfirmar;
    private AlumnoSugerenciaAdapter alumnosAdapter;
    private ProfesorSugerenciaAdapter profesoresAdapter;
    private boolean buscandoProfesor;
    private Alumno alumno;
    private Profesor profesor;
    private Runnable busquedaPendiente, cambioTextoPendiente;
    private int solicitudBusqueda;
    private boolean textoDeEscaner, seleccionSugerenciaPendiente;
    private String consultaEscrita = "";

    private final ActivityResultLauncher<Intent> escanearAlumno = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                    buscarAlumnoEscaneado(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR));
                }
            });
    private final ActivityResultLauncher<Intent> escanearLibro = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null)
                    procesarLibro(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR),
                            r.getData().getStringExtra(ScannerActivity.EXTRA_TIPO));
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_prestamo);
        TopBarController.bind(this);
        findViewById(R.id.btnVolver).setVisibility(View.VISIBLE);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        etAlumno = findViewById(R.id.etAlumno);
        tvAlumno = findViewById(R.id.tvAlumno);
        tvDatosPrestatario = findViewById(R.id.tvDatosPrestatario);
        tvItems = findViewById(R.id.tvItems);
        tvMsg = findViewById(R.id.tvMsg);
        btnScanLibro = findViewById(R.id.btnScanLibro);
        btnConfirmar = findViewById(R.id.btnConfirmar);
        RadioGroup rgTipoPrestatario = findViewById(R.id.rgTipoPrestatario);
        alumnosAdapter = new AlumnoSugerenciaAdapter();
        profesoresAdapter = new ProfesorSugerenciaAdapter();
        etAlumno.setAdapter(alumnosAdapter);
        etAlumno.setThreshold(2);
        rgTipoPrestatario.setOnCheckedChangeListener((group, checkedId) -> {
            buscandoProfesor = checkedId == R.id.rbProfesor;
            if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
            solicitudBusqueda++;
            invalidarSeleccion();
            sugerencias.clear();
            sugerenciasProfesores.clear();
            alumnosAdapter.notifyDataSetChanged();
            profesoresAdapter.notifyDataSetChanged();
            textoDeEscaner = true;
            etAlumno.setText("");
            textoDeEscaner = false;
            consultaEscrita = "";
            etAlumno.setHint(buscandoProfesor
                    ? "Nombre, apellido o DNI del profesor"
                    : "Nombre, apellido o código del alumno");
            etAlumno.setAdapter(buscandoProfesor ? profesoresAdapter : alumnosAdapter);
            findViewById(R.id.btnBuscarAlumno).setContentDescription(
                    buscandoProfesor ? "Buscar profesores" : "Buscar alumnos");
            ((Button) findViewById(R.id.btnBuscarAlumno)).setText(
                    buscandoProfesor ? "Buscar profesores" : "Buscar coincidencias");
            findViewById(R.id.btnScanAlumno).setVisibility(
                    buscandoProfesor ? View.GONE : View.VISIBLE);
            tvMsg.setText("");
        });
        etAlumno.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { }
            @Override public void afterTextChanged(Editable text) {
                if (textoDeEscaner) return;
                String textoActual = text.toString().trim();
                boolean completandoSugerencia = esNombreDeSugerencia(textoActual);
                if (!completandoSugerencia) {
                    consultaEscrita = textoActual;
                    invalidarSeleccion();
                }
                if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
                int solicitud = ++solicitudBusqueda;
                String consulta = textoActual;
                if (cambioTextoPendiente != null) main.removeCallbacks(cambioTextoPendiente);
                cambioTextoPendiente = () -> {
                    if (seleccionSugerenciaPendiente) {
                        seleccionSugerenciaPendiente = false;
                        return;
                    }
                    invalidarSeleccion();
                    limpiarSugerencias();
                    tvMsg.setText("");
                    if (consulta.length() < 2) return;
                    busquedaPendiente = () -> buscarPrestatarios(consulta, solicitud);
                    main.postDelayed(busquedaPendiente, 300);
                };
                main.post(cambioTextoPendiente);
            }
        });
        etAlumno.setOnItemClickListener((parent, view, position, id) -> {
            seleccionSugerenciaPendiente = true;
            if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
            solicitudBusqueda++;
            if (buscandoProfesor && position >= 0 && position < profesoresAdapter.getCount()) {
                Profesor candidato = profesoresAdapter.getItem(position);
                if (coincide(candidato, consultaEscrita)) {
                    seleccionarProfesor(candidato);
                } else {
                    tvMsg.setText("Espera a que se actualicen las sugerencias para esa búsqueda.");
                }
            } else if (!buscandoProfesor && position >= 0 && position < alumnosAdapter.getCount()) {
                Alumno candidato = alumnosAdapter.getItem(position);
                if (coincide(candidato, consultaEscrita)) {
                    seleccionarAlumno(candidato);
                } else {
                    tvMsg.setText("Espera a que se actualicen las sugerencias para esa búsqueda.");
                }
            }
        });
        findViewById(R.id.btnBuscarAlumno).setOnClickListener(v -> {
            if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
            buscarPrestatarios(etAlumno.getText().toString().trim(), ++solicitudBusqueda);
        });
        findViewById(R.id.btnScanAlumno).setOnClickListener(v -> escanearAlumno.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_PRESTAMO, "Escanea el QR del alumno")));
        btnScanLibro.setOnClickListener(v -> escanearLibro.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_PRESTAMO,
                        "Escanea el QR del ejemplar o el código de barras ISBN")));
        btnConfirmar.setOnClickListener(v -> confirmar());
        String pre = getIntent().getStringExtra("codigo");
        if (pre != null) procesarLibro(pre, ScannedCode.TYPE_EJEMPLAR);
        actualizar();
    }

    private void buscarPrestatarios(String consulta, int solicitud) {
        if (buscandoProfesor) buscarCoincidenciasProfesor(consulta, solicitud);
        else buscarCoincidencias(consulta, solicitud);
    }

    private void buscarCoincidenciasProfesor(String consulta, int solicitud) {
        if (consulta.isEmpty()) {
            tvMsg.setText("Escribe el nombre, apellido o DNI del profesor.");
            return;
        }
        sugerenciasProfesores.clear();
        profesoresAdapter.notifyDataSetChanged();
        tvMsg.setText("Buscando profesores...");
        Api.call(ApiClient.api().buscarProfesores(consulta, "ACTIVO", 1, 15),
                new Api.Result<Paged<Profesor>>() {
                    @Override public void ok(Paged<Profesor> data, String message) {
                        if (solicitud != solicitudBusqueda
                                || !consulta.equals(etAlumno.getText().toString().trim())
                                || !buscandoProfesor) return;
                        sugerenciasProfesores.clear();
                        if (data == null || data.items == null) {
                            profesoresAdapter.notifyDataSetChanged();
                            tvMsg.setText("El servidor devolvió una lista de profesores incompleta.");
                            return;
                        }
                        java.util.Set<Long> ids = new java.util.HashSet<>();
                        for (Profesor item : data.items) {
                            if (item != null && item.id > 0
                                    && !item.nombreCompleto().isEmpty()
                                    && ids.add(item.id)) {
                                sugerenciasProfesores.add(item);
                            }
                        }
                        profesoresAdapter.notifyDataSetChanged();
                        if (sugerenciasProfesores.isEmpty()) {
                            tvMsg.setText(data.items.isEmpty()
                                    ? "No se encontraron profesores activos con ese dato."
                                    : "La API no devolvió profesores con identificador y nombre válidos.");
                        } else {
                            tvMsg.setText("Selecciona al profesor correcto. Se muestran "
                                    + sugerenciasProfesores.size() + " coincidencia(s).");
                            if (etAlumno.hasFocus() && !isFinishing() && !isDestroyed()) {
                                etAlumno.showDropDown();
                            }
                        }
                    }

                    @Override public void error(String msg, int http, String code) {
                        if (solicitud != solicitudBusqueda || !buscandoProfesor) return;
                        sugerenciasProfesores.clear();
                        profesoresAdapter.notifyDataSetChanged();
                        Log.w(TAG, "Teacher lookup failed (HTTP " + http + ", code " + code + "): " + msg);
                        tvMsg.setText("No se pudo buscar al profesor: " + msg + ". Puedes reintentar.");
                    }
                });
    }

    private void buscarCoincidencias(String consulta, int solicitud) {
        if (consulta.isEmpty()) {
            tvMsg.setText("Escribe el nombre, apellido o código del alumno.");
            return;
        }
        limpiarSugerencias();
        tvMsg.setText("Buscando alumnos...");
        Api.call(ApiClient.api().buscarAlumnos(consulta, "ACTIVO", 15), new Api.Result<Paged<Alumno>>() {
            @Override public void ok(Paged<Alumno> data, String message) {
                if (solicitud != solicitudBusqueda || buscandoProfesor
                        || !consulta.equals(etAlumno.getText().toString().trim())) return;
                sugerencias.clear();
                if (data == null || data.items == null) {
                    alumnosAdapter.notifyDataSetChanged();
                    tvMsg.setText("El servidor devolvió una lista de alumnos incompleta.");
                    return;
                }
                java.util.Set<Long> ids = new java.util.HashSet<>();
                for (Alumno item : data.items) {
                    if (item != null && ids.add(item.id)) sugerencias.add(item);
                }
                alumnosAdapter.notifyDataSetChanged();
                if (sugerencias.isEmpty()) {
                    tvMsg.setText("No se encontraron alumnos activos con ese dato.");
                } else {
                    tvMsg.setText("Selecciona al alumno correcto. Se muestran " + sugerencias.size() + " coincidencia(s).");
                    if (etAlumno.hasFocus() && !isFinishing() && !isDestroyed()) etAlumno.showDropDown();
                }
            }
            @Override public void error(String msg, int http, String code) {
                if (solicitud != solicitudBusqueda) return;
                sugerencias.clear();
                alumnosAdapter.notifyDataSetChanged();
                Log.w(TAG, "Student lookup failed (HTTP " + http + ", code " + code + "): " + msg);
                tvMsg.setText("No se pudo buscar al alumno: " + msg + ". Puedes reintentar.");
            }
        });
    }

    private static boolean coincide(Alumno alumno, String consulta) {
        if (alumno == null || consulta.isEmpty()) return false;
        String q = consulta.toLowerCase(java.util.Locale.ROOT);
        String nombres = ((alumno.nombres == null ? "" : alumno.nombres)
                + " " + (alumno.apellidos == null ? "" : alumno.apellidos)).toLowerCase(java.util.Locale.ROOT);
        String apellidos = ((alumno.apellidos == null ? "" : alumno.apellidos)
                + " " + (alumno.nombres == null ? "" : alumno.nombres)).toLowerCase(java.util.Locale.ROOT);
        return nombres.contains(q) || apellidos.contains(q) || String.valueOf(alumno.id).contains(q)
                || (alumno.codigoAlumno != null && alumno.codigoAlumno.toLowerCase(java.util.Locale.ROOT).contains(q))
                || (alumno.dni != null && alumno.dni.contains(q));
    }

    private static boolean coincide(Profesor profesor, String consulta) {
        if (profesor == null || consulta.isEmpty()) return false;
        String q = consulta.toLowerCase(java.util.Locale.ROOT);
        String nombres = ((profesor.nombres == null ? "" : profesor.nombres)
                + " " + (profesor.apellidos == null ? "" : profesor.apellidos))
                .toLowerCase(java.util.Locale.ROOT);
        String apellidos = ((profesor.apellidos == null ? "" : profesor.apellidos)
                + " " + (profesor.nombres == null ? "" : profesor.nombres))
                .toLowerCase(java.util.Locale.ROOT);
        return nombres.contains(q) || apellidos.contains(q)
                || String.valueOf(profesor.id).contains(q)
                || (profesor.dni != null && profesor.dni.toLowerCase(java.util.Locale.ROOT).contains(q));
    }

    private boolean esNombreDeSugerencia(String consulta) {
        if (buscandoProfesor) {
            for (Profesor sugerencia : sugerenciasProfesores) {
                if (sugerencia.nombreCompleto().equals(consulta)) return true;
            }
        } else {
            for (Alumno sugerencia : sugerencias) {
                if (sugerencia.nombreCompleto().equals(consulta)) return true;
            }
        }
        return false;
    }

    private void limpiarSugerencias() {
        sugerencias.clear();
        sugerenciasProfesores.clear();
        alumnosAdapter.notifyDataSetChanged();
        profesoresAdapter.notifyDataSetChanged();
    }

    private void buscarAlumnoEscaneado(String valor) {
        if (valor == null || valor.trim().isEmpty()) {
            tvMsg.setText("El escáner no devolvió un identificador de alumno.");
            return;
        }
        if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
        if (cambioTextoPendiente != null) main.removeCallbacks(cambioTextoPendiente);
        final int solicitud = ++solicitudBusqueda;
        invalidarSeleccion();
        sugerencias.clear();
        alumnosAdapter.notifyDataSetChanged();
        textoDeEscaner = true;
        etAlumno.setText(valor.trim());
        textoDeEscaner = false;
        String codigo = valor.trim();
        consultaEscrita = codigo;
        Api.Result<Alumno> resultado = new Api.Result<Alumno>() {
            @Override public void ok(Alumno encontrado, String message) {
                if (solicitud != solicitudBusqueda || !codigo.equals(etAlumno.getText().toString().trim())) return;
                seleccionarAlumno(encontrado);
            }
            @Override public void error(String msg, int http, String code) {
                if (solicitud != solicitudBusqueda) return;
                tvMsg.setText("No se encontró un alumno para el código escaneado: " + msg);
            }
        };
        if (codigo.matches("\\d{8,}")) Api.call(ApiClient.api().alumnoPorDni(codigo), resultado);
        else Api.call(ApiClient.api().alumnoPorCodigo(codigo), resultado);
    }

    private void seleccionarAlumno(Alumno seleccionado) {
        if (seleccionado == null || !"ACTIVO".equals(seleccionado.estado)) {
            invalidarSeleccion();
            tvMsg.setText("El alumno no existe o no está activo.");
            return;
        }
        alumno = seleccionado;
        profesor = null;
        String nombre = seleccionado.nombreCompleto();
        textoDeEscaner = true;
        etAlumno.setText(nombre, false);
        etAlumno.setSelection(etAlumno.length());
        textoDeEscaner = false;
        consultaEscrita = nombre;
        tvAlumno.setText(nombre);
        StringBuilder detalle = new StringBuilder();
        if (seleccionado.codigoAlumno != null && !seleccionado.codigoAlumno.trim().isEmpty()) {
            detalle.append("Código: ").append(seleccionado.codigoAlumno).append("\n");
        }
        detalle.append("ID: ").append(seleccionado.id);
        if (seleccionado.dni != null && !seleccionado.dni.trim().isEmpty()) {
            detalle.append("\nDNI: ").append(seleccionado.dni);
        }
        if (seleccionado.grado != null) {
            detalle.append("\nGrado: ").append(seleccionado.grado).append("°");
            if (seleccionado.seccion != null && !seleccionado.seccion.trim().isEmpty()) {
                detalle.append(" ").append(seleccionado.seccion);
            }
        }
        tvDatosPrestatario.setText(detalle);
        tvDatosPrestatario.setVisibility(View.VISIBLE);
        tvMsg.setText("");
        actualizar();
    }

    private void seleccionarProfesor(Profesor seleccionado) {
        if (seleccionado == null || !"ACTIVO".equals(seleccionado.estado)) {
            invalidarSeleccion();
            tvMsg.setText("El profesor no existe o no está activo.");
            return;
        }
        profesor = seleccionado;
        alumno = null;
        String nombre = seleccionado.nombreCompleto();
        textoDeEscaner = true;
        etAlumno.setText(nombre, false);
        etAlumno.setSelection(etAlumno.length());
        textoDeEscaner = false;
        consultaEscrita = nombre;
        tvAlumno.setText(nombre);
        StringBuilder detalle = new StringBuilder("ID: ").append(seleccionado.id)
                .append("\nDNI: ").append(seleccionado.dni == null
                        || seleccionado.dni.trim().isEmpty() ? "No registrado" : seleccionado.dni);
        if (seleccionado.area != null && !seleccionado.area.trim().isEmpty()) {
            detalle.append("\nÁrea: ").append(seleccionado.area);
        }
        if (seleccionado.correo != null && !seleccionado.correo.trim().isEmpty()) {
            detalle.append("\nCorreo: ").append(seleccionado.correo);
        }
        tvDatosPrestatario.setText(detalle);
        tvDatosPrestatario.setVisibility(View.VISIBLE);
        tvMsg.setText("");
        actualizar();
    }

    private void invalidarSeleccion() {
        alumno = null;
        profesor = null;
        tvAlumno.setText("");
        tvDatosPrestatario.setText("");
        tvDatosPrestatario.setVisibility(View.GONE);
        actualizar();
    }

    private void procesarLibro(String valor, String tipo) {
        tvMsg.setText("");
        if (valor == null) return;
        if (ScannedCode.TYPE_EJEMPLAR.equals(tipo) && ScannedCode.esCodigoEjemplar(valor)) {
            String codigo = valor.toUpperCase();
            for (PrestamoReq.Item it : items) {
                if (codigo.equals(it.codigoEjemplar)) {
                    tvMsg.setText("Ese ejemplar ya está en la lista");
                    return;
                }
            }
            Api.call(ApiClient.api().ejemplarPorCodigo(codigo), new Api.Result<Ejemplar>() {
                @Override public void ok(Ejemplar e, String m) {
                    if (!"DISPONIBLE".equals(e.estado)) {
                        tvMsg.setText(e.codigoInterno + " no está disponible (" + e.estado + ")");
                        return;
                    }
                    PrestamoReq.Item it = new PrestamoReq.Item();
                    it.codigoEjemplar = e.codigoInterno;
                    items.add(it);
                    lineas.add(e.titulo);
                    actualizar();
                }
                @Override public void error(String msg, int h, String c) { tvMsg.setText(msg); }
            });
        } else if (ScannedCode.TYPE_ISBN.equals(tipo) && ScannedCode.esIsbn(valor)) {
            consultarFichaIsbn(valor.replaceAll("[\\s-]", ""));
        } else {
            tvMsg.setText("El código no es un ISBN válido ni un código registrado de ejemplar.");
        }
    }

    private void consultarFichaIsbn(String isbn) {
        if (!ScannedCode.esIsbn(isbn)) {
            tvMsg.setText("El código escaneado no es un ISBN válido ni un código de ejemplar.");
            return;
        }
        Api.call(ApiClient.api().libroPorIsbn(isbn), new Api.Result<ConsultaIsbn>() {
            @Override public void ok(ConsultaIsbn consulta, String m) {
                if (consulta == null) {
                    tvMsg.setText("El servidor devolvió una respuesta incompleta.");
                } else if (consulta.existente == null) {
                    tvMsg.setText("Este ISBN no está registrado en la biblioteca.");
                } else {
                    new AlertDialog.Builder(PrestamoActivity.this)
                            .setTitle("Ficha del libro")
                            .setView(LibroDetalleDialog.contenido(PrestamoActivity.this, consulta.existente))
                            .setPositiveButton("Continuar préstamo", (d, w) -> agregarIsbnAlPrestamo(isbn))
                            .setNegativeButton("Cerrar", null)
                            .show();
                }
            }
            @Override public void error(String msg, int http, String code) {
                tvMsg.setText(http == 0
                        ? "No hay conexión para consultar el ISBN. Inténtalo nuevamente."
                        : "No se pudo consultar el ISBN. " + msg);
            }
        });
    }

    private void agregarIsbnAlPrestamo(String isbn) {
        Api.call(ApiClient.api().libroPorIsbn(isbn), new Api.Result<ConsultaIsbn>() {
            @Override public void ok(ConsultaIsbn consulta, String m) {
                if (consulta == null || consulta.existente == null) {
                    tvMsg.setText("Este ISBN no está registrado en la biblioteca.");
                    return;
                }
                com.biblioscorza.app.data.Models.LibroRegistrado libro = consulta.existente;
                if (!"CANTIDAD".equals(libro.tipoControl)) {
                    tvMsg.setText("\"" + libro.titulo + "\" es de control individual: escanea el QR del ejemplar");
                    return;
                }
                if (libro.disponibles == null) {
                    tvMsg.setText("El inventario no devolvió la cantidad disponible. Vuelve a consultar el libro.");
                    return;
                }
                if (libro.disponibles <= 0) {
                    tvMsg.setText("No hay copias disponibles de \"" + libro.titulo + "\"");
                    return;
                }
                for (int i = 0; i < items.size(); i++) {
                    PrestamoReq.Item it = items.get(i);
                    if (it.libroId != null && it.libroId == libro.id) {
                        if (it.cantidad >= libro.disponibles) {
                            tvMsg.setText("No hay más copias disponibles");
                            return;
                        }
                        it.cantidad++;
                        lineas.set(i, libro.titulo);
                        actualizar();
                        return;
                    }
                }
                PrestamoReq.Item it = new PrestamoReq.Item();
                it.libroId = libro.id;
                it.cantidad = 1;
                items.add(it);
                lineas.add(libro.titulo);
                actualizar();
            }
            @Override public void error(String msg, int http, String code) {
                tvMsg.setText(http == 0 ? "No hay conexión para consultar el inventario." : msg);
            }
        });
    }

    private void actualizar() {
        tvItems.setText(lineas.isEmpty() ? "" : "Libros a prestar:\n• " + String.join("\n• ", lineas));
        boolean prestatarioSeleccionado = alumno != null || profesor != null;
        btnScanLibro.setEnabled(prestatarioSeleccionado);
        btnConfirmar.setEnabled(prestatarioSeleccionado && !items.isEmpty());
    }

    private void confirmar() {
        if (alumno == null && profesor == null) {
            tvMsg.setText(buscandoProfesor
                    ? "Selecciona un profesor activo antes de confirmar el préstamo."
                    : "Selecciona un alumno activo antes de confirmar el préstamo.");
            return;
        }
        if (items.isEmpty()) {
            tvMsg.setText("Agrega al menos un libro o ejemplar al préstamo.");
            return;
        }
        PrestamoReq solicitud = new PrestamoReq();
        if (profesor != null) solicitud.profesorId = profesor.id;
        else solicitud.alumnoId = alumno.id;
        solicitud.items = items;
        btnConfirmar.setEnabled(false);
        Api.call(ApiClient.api().prestar(solicitud), new Api.Result<Object>() {
            @Override public void ok(Object data, String message) {
                android.widget.Toast.makeText(PrestamoActivity.this,
                        message == null ? "Préstamo registrado" : message, android.widget.Toast.LENGTH_LONG).show();
                finish();
            }
            @Override public void error(String msg, int http, String code) {
                tvMsg.setText(msg);
                actualizar();
            }
        });
    }

    @Override protected void onDestroy() {
        if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
        if (cambioTextoPendiente != null) main.removeCallbacks(cambioTextoPendiente);
        solicitudBusqueda++;
        super.onDestroy();
    }

    private final class AlumnoSugerenciaAdapter extends BaseAdapter implements Filterable {
        private final Filter filtroSinRecorte = new Filter() {
            @Override protected FilterResults performFiltering(CharSequence constraint) {
                FilterResults results = new FilterResults();
                results.count = getCount();
                return results;
            }

            @Override protected void publishResults(CharSequence constraint, FilterResults results) {
                notifyDataSetChanged();
            }

            @Override public CharSequence convertResultToString(Object resultValue) {
                return resultValue instanceof Alumno
                        ? ((Alumno) resultValue).nombreCompleto() : "";
            }
        };

        @Override public int getCount() { return sugerencias.size(); }
        @Override public Alumno getItem(int position) { return sugerencias.get(position); }
        @Override public long getItemId(int position) { return getItem(position).id; }
        @Override public Filter getFilter() { return filtroSinRecorte; }

        @Override public View getView(int position, View convertView, ViewGroup parent) {
            View row = convertView == null
                    ? LayoutInflater.from(PrestamoActivity.this)
                    .inflate(R.layout.row_alumno_sugerencia, parent, false)
                    : convertView;
            Alumno item = getItem(position);
            ((TextView) row.findViewById(R.id.tvNombreAlumno)).setText(item.nombreCompleto());
            StringBuilder detalles = new StringBuilder();
            if (item.codigoAlumno != null && !item.codigoAlumno.trim().isEmpty()) {
                detalles.append("Código: ").append(item.codigoAlumno).append(" · ");
            }
            if (item.dni != null && !item.dni.trim().isEmpty()) {
                detalles.append("DNI: ").append(item.dni).append(" · ");
            }
            detalles.append("ID: ").append(item.id);
            TextView identificador = row.findViewById(R.id.tvIdentificadorAlumno);
            identificador.setText(detalles);
            identificador.setVisibility(View.VISIBLE);
            return row;
        }
    }

    private final class ProfesorSugerenciaAdapter extends BaseAdapter implements Filterable {
        private final Filter filtroSinRecorte = new Filter() {
            @Override protected FilterResults performFiltering(CharSequence constraint) {
                FilterResults results = new FilterResults();
                results.count = getCount();
                return results;
            }

            @Override protected void publishResults(CharSequence constraint, FilterResults results) {
                notifyDataSetChanged();
            }

            @Override public CharSequence convertResultToString(Object resultValue) {
                return resultValue instanceof Profesor
                        ? ((Profesor) resultValue).nombreCompleto() : "";
            }
        };

        @Override public int getCount() { return sugerenciasProfesores.size(); }
        @Override public Profesor getItem(int position) { return sugerenciasProfesores.get(position); }
        @Override public long getItemId(int position) { return getItem(position).id; }
        @Override public Filter getFilter() { return filtroSinRecorte; }

        @Override public View getView(int position, View convertView, ViewGroup parent) {
            View row = convertView == null
                    ? LayoutInflater.from(PrestamoActivity.this)
                    .inflate(R.layout.row_alumno_sugerencia, parent, false)
                    : convertView;
            Profesor item = getItem(position);
            ((TextView) row.findViewById(R.id.tvNombreAlumno)).setText(item.nombreCompleto());
            TextView detalles = row.findViewById(R.id.tvIdentificadorAlumno);
            StringBuilder info = new StringBuilder("ID: ").append(item.id)
                    .append(" · DNI: ")
                    .append(item.dni == null || item.dni.trim().isEmpty() ? "No registrado" : item.dni);
            if (item.area != null && !item.area.trim().isEmpty()) info.append(" · Área: ").append(item.area);
            if (item.correo != null && !item.correo.trim().isEmpty()) {
                info.append("\n").append(item.correo);
            }
            detalles.setText(info);
            detalles.setVisibility(View.VISIBLE);
            row.setContentDescription(item.nombreCompleto() + ". " + info);
            return row;
        }
    }
}
