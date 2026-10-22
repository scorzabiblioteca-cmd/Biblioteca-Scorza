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
import com.biblioscorza.app.util.Api;

import java.util.ArrayList;
import java.util.List;

/** Flujo: identificar alumno -> escanear libro(s) -> confirmar. */
public class PrestamoActivity extends AppCompatActivity {
    private static final String TAG = "PrestamoActivity";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Alumno> sugerencias = new ArrayList<>();
    private final List<PrestamoReq.Item> items = new ArrayList<>();
    private final List<String> lineas = new ArrayList<>();
    private AutoCompleteTextView etAlumno;
    private TextView tvAlumno, tvItems, tvMsg;
    private Button btnScanLibro, btnConfirmar;
    private AlumnoSugerenciaAdapter alumnosAdapter;
    private Alumno alumno;
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
                    procesarLibro(r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR));
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_prestamo);
        etAlumno = findViewById(R.id.etAlumno);
        tvAlumno = findViewById(R.id.tvAlumno);
        tvItems = findViewById(R.id.tvItems);
        tvMsg = findViewById(R.id.tvMsg);
        btnScanLibro = findViewById(R.id.btnScanLibro);
        btnConfirmar = findViewById(R.id.btnConfirmar);
        alumnosAdapter = new AlumnoSugerenciaAdapter();
        etAlumno.setAdapter(alumnosAdapter);
        etAlumno.setThreshold(2);
        etAlumno.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { }
            @Override public void afterTextChanged(Editable text) {
                if (textoDeEscaner) return;
                String textoActual = text.toString().trim();
                boolean completandoSugerencia = false;
                for (Alumno sugerencia : sugerencias) {
                    if (sugerencia.toString().equals(textoActual)) {
                        completandoSugerencia = true;
                        break;
                    }
                }
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
                    sugerencias.clear();
                    alumnosAdapter.notifyDataSetChanged();
                    tvMsg.setText("");
                    if (consulta.length() < 2) return;
                    busquedaPendiente = () -> buscarCoincidencias(consulta, solicitud);
                    main.postDelayed(busquedaPendiente, 300);
                };
                main.post(cambioTextoPendiente);
            }
        });
        etAlumno.setOnItemClickListener((parent, view, position, id) -> {
            seleccionSugerenciaPendiente = true;
            if (busquedaPendiente != null) main.removeCallbacks(busquedaPendiente);
            solicitudBusqueda++;
            if (position >= 0 && position < alumnosAdapter.getCount()) {
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
            buscarCoincidencias(etAlumno.getText().toString().trim(), ++solicitudBusqueda);
        });
        findViewById(R.id.btnScanAlumno).setOnClickListener(v -> escanearAlumno.launch(
                new Intent(this, ScannerActivity.class).putExtra(ScannerActivity.EXTRA_GUIA, "Escanea el QR del alumno")));
        btnScanLibro.setOnClickListener(v -> escanearLibro.launch(
                new Intent(this, ScannerActivity.class).putExtra(ScannerActivity.EXTRA_GUIA, "Escanea el QR del ejemplar o el ISBN")));
        btnConfirmar.setOnClickListener(v -> confirmar());
        String pre = getIntent().getStringExtra("codigo");
        if (pre != null) procesarLibro(pre);
        actualizar();
    }

    private void buscarCoincidencias(String consulta, int solicitud) {
        if (consulta.isEmpty()) {
            tvMsg.setText("Escribe el nombre, apellido o código del alumno.");
            return;
        }
        sugerencias.clear();
        alumnosAdapter.notifyDataSetChanged();
        tvMsg.setText("Buscando alumnos...");
        Api.call(ApiClient.api().buscarAlumnos(consulta, "ACTIVO", 15), new Api.Result<Paged<Alumno>>() {
            @Override public void ok(Paged<Alumno> data, String message) {
                if (solicitud != solicitudBusqueda || !consulta.equals(etAlumno.getText().toString().trim())) return;
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
        tvAlumno.setText(seleccionado.nombreCompleto()
                + (seleccionado.grado != null ? " — " + seleccionado.grado + "° " + (seleccionado.seccion == null ? "" : seleccionado.seccion) : "")
                + "\nCódigo: " + seleccionado.codigoAlumno);
        tvMsg.setText("");
        actualizar();
    }

    private void invalidarSeleccion() {
        alumno = null;
        tvAlumno.setText("");
        actualizar();
    }

    private void procesarLibro(String valor) {
        tvMsg.setText("");
        if (valor == null) return;
        if (valor.toUpperCase().matches("^(LIB|ESP)-\\d+$")) {
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
                    lineas.add(e.codigoInterno + " — " + e.titulo);
                    actualizar();
                }
                @Override public void error(String msg, int h, String c) { tvMsg.setText(msg); }
            });
        } else {
            consultarFichaIsbn(valor.replaceAll("[\\s-]", ""));
        }
    }

    private void consultarFichaIsbn(String isbn) {
        if (isbn == null || !isbn.matches("\\d{10,13}")) {
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
                        lineas.set(i, libro.titulo + " × " + it.cantidad);
                        actualizar();
                        return;
                    }
                }
                PrestamoReq.Item it = new PrestamoReq.Item();
                it.libroId = libro.id;
                it.cantidad = 1;
                items.add(it);
                lineas.add(libro.titulo + " × 1");
                actualizar();
            }
            @Override public void error(String msg, int http, String code) {
                tvMsg.setText(http == 0 ? "No hay conexión para consultar el inventario." : msg);
            }
        });
    }

    private void actualizar() {
        tvItems.setText(lineas.isEmpty() ? "" : "Libros a prestar:\n• " + String.join("\n• ", lineas));
        btnScanLibro.setEnabled(alumno != null);
        btnConfirmar.setEnabled(alumno != null && !items.isEmpty());
    }

    private void confirmar() {
        if (alumno == null) {
            tvMsg.setText("Selecciona un alumno activo antes de confirmar el préstamo.");
            return;
        }
        if (items.isEmpty()) {
            tvMsg.setText("Agrega al menos un libro o ejemplar al préstamo.");
            return;
        }
        PrestamoReq solicitud = new PrestamoReq();
        solicitud.alumnoId = alumno.id;
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
            ((TextView) row.findViewById(R.id.tvIdentificadorAlumno)).setText(
                    "Código: " + item.codigoAlumno + " · ID: " + item.id);
            return row;
        }
    }
}
