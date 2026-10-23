package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Categoria;
import com.biblioscorza.app.data.Models.Libro;
import com.biblioscorza.app.data.Models.Paged;
import com.biblioscorza.app.data.Models.Ubicacion;
import com.biblioscorza.app.util.Api;
//wazaaaaaaaa
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class BuscarActivity extends AppCompatActivity {
    private final List<Libro> libros = new ArrayList<>();
    private final Set<Long> libroIds = new HashSet<>();
    private EditText etBuscar;
    private TextView tvMsg, tvFiltros;
    private ProgressBar progreso;
    private Spinner spCategoria, spNivel, spDisponibilidad, spTipoControl, spUbicacion, spEstado;
    private Button btnMas;
    private LibroBusquedaAdapter adapter;
    private int busquedaActual;
    private int catalogosPendientes;
    private int pagina, totalResultados;
    private boolean cargando;
    private final List<String> erroresCatalogos = new ArrayList<>();

    private final ActivityResultLauncher<Intent> editarLibro = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), resultado -> {
                if (resultado.getResultCode() == RESULT_OK) buscar();
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_buscar);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        etBuscar = findViewById(R.id.etBuscar);
        tvMsg = findViewById(R.id.tvMsg);
        tvFiltros = findViewById(R.id.tvFiltros);
        progreso = findViewById(R.id.progreso);
        spCategoria = findViewById(R.id.spCategoria);
        spNivel = findViewById(R.id.spNivel);
        spDisponibilidad = findViewById(R.id.spDisponibilidad);
        spTipoControl = findViewById(R.id.spTipoControl);
        spUbicacion = findViewById(R.id.spUbicacion);
        spEstado = findViewById(R.id.spEstado);

        ListView lista = findViewById(R.id.lista);
        adapter = new LibroBusquedaAdapter(this, libros);
        lista.setAdapter(adapter);
        lista.setOnItemClickListener((p, v, pos, id) -> detalle(libros.get(pos)));
        findViewById(R.id.btnBuscar).setOnClickListener(v -> buscar());
        findViewById(R.id.btnLimpiar).setOnClickListener(v -> limpiarFiltros());
        btnMas = findViewById(R.id.btnMas);
        btnMas.setOnClickListener(v -> buscarMas());

        configurar(spNivel, opciones(
                "Nivel educativo · Todos", "", "Inicial", "INICIAL",
                "Primaria", "PRIMARIA", "Secundaria", "SECUNDARIA", "General", "GENERAL"));
        configurar(spDisponibilidad, opciones(
                "Disponibilidad · Todas", "", "Disponibles", "disponibles",
                "Sin ejemplares disponibles", "sin_disponibles"));
        configurar(spTipoControl, opciones(
                "Control · Todos", "", "Por cantidad", "CANTIDAD", "Individual", "INDIVIDUAL"));
        configurar(spEstado, opciones(
                "Estado · Activos", "ACTIVO", "Archivados", "ARCHIVADO", "Todos", "todos"));
        configurar(spCategoria, opciones("Categoría · Todas", ""));
        configurar(spUbicacion, opciones("Ubicación · Todas", ""));
        cargarCatalogos();
    }

    private void cargarCatalogos() {
        catalogosPendientes = 2;
        Api.call(ApiClient.api().categorias(), new Api.Result<List<Categoria>>() {
            @Override public void ok(List<Categoria> data, String message) {
                List<FilterOption> values = opciones("Categoría · Todas", "");
                if (data == null) {
                    erroresCatalogos.add("El servidor devolvió categorías incompletas.");
                } else {
                    for (Categoria categoria : data) {
                        values.add(new FilterOption(categoria.nombre, String.valueOf(categoria.id)));
                    }
                }
                configurar(spCategoria, values);
                catalogoListo();
            }
            @Override public void error(String msg, int http, String code) {
                erroresCatalogos.add("No se pudieron cargar las categorías: " + msg);
                catalogoListo();
            }
        });
        Api.call(ApiClient.api().ubicaciones(), new Api.Result<List<Ubicacion>>() {
            @Override public void ok(List<Ubicacion> data, String message) {
                List<FilterOption> values = opciones("Ubicación · Todas", "");
                if (data == null) {
                    erroresCatalogos.add("El servidor devolvió ubicaciones incompletas.");
                } else {
                    for (Ubicacion ubicacion : data) {
                        values.add(new FilterOption(ubicacion.toString(), String.valueOf(ubicacion.id)));
                    }
                }
                configurar(spUbicacion, values);
                catalogoListo();
            }
            @Override public void error(String msg, int http, String code) {
                erroresCatalogos.add("No se pudieron cargar las ubicaciones: " + msg);
                catalogoListo();
            }
        });
    }

    private void catalogoListo() {
        catalogosPendientes--;
        if (catalogosPendientes == 0) {
            tvFiltros.setText(erroresCatalogos.isEmpty() ? "" : String.join("\n", erroresCatalogos));
            buscar();
        }
    }

    private void buscar() {
        cargarPagina(false);
    }

    private void buscarMas() {
        cargarPagina(true);
    }

    private void cargarPagina(boolean siguiente) {
        if (siguiente && cargando) return;
        if (!siguiente) {
            pagina = 0;
            totalResultados = 0;
        }
        final int paginaSolicitada = siguiente ? pagina + 1 : 1;
        final int solicitud = ++busquedaActual;
        String texto = etBuscar.getText().toString().trim();
        cargando = true;
        progreso.setVisibility(ProgressBar.VISIBLE);
        btnMas.setEnabled(false);
        tvMsg.setText("");
        Api.call(ApiClient.api().buscarLibros(
                texto, paginaSolicitada, 30, valor(spEstado), valorLong(spCategoria), valor(spNivel),
                valor(spDisponibilidad), valor(spTipoControl), valorLong(spUbicacion)),
                new Api.Result<Paged<Libro>>() {
                    @Override public void ok(Paged<Libro> data, String message) {
                        if (solicitud != busquedaActual) return;
                        cargando = false;
                        progreso.setVisibility(ProgressBar.GONE);
                        if (paginaSolicitada == 1) {
                            libros.clear();
                            libroIds.clear();
                        }
                        if (data == null || data.items == null) {
                            adapter.notifyDataSetChanged();
                            tvMsg.setText("El servidor devolvió una lista incompleta. Inténtalo de nuevo.");
                            actualizarPaginacion();
                            return;
                        }
                        for (Libro libro : data.items) {
                            if (libroIds.add(libro.id)) libros.add(libro);
                        }
                        pagina = paginaSolicitada;
                        totalResultados = data.total;
                        adapter.notifyDataSetChanged();
                        tvMsg.setText(libros.isEmpty() ? "Sin resultados"
                                : libros.size() + " de " + totalResultados + " resultado(s)");
                        actualizarPaginacion();
                    }
                    @Override public void error(String msg, int http, String code) {
                        if (solicitud != busquedaActual) return;
                        cargando = false;
                        progreso.setVisibility(ProgressBar.GONE);
                        if (paginaSolicitada == 1) {
                            libros.clear();
                            libroIds.clear();
                            adapter.notifyDataSetChanged();
                        }
                        tvMsg.setText("No se pudo realizar la búsqueda: " + msg);
                        actualizarPaginacion();
                    }
                });
    }

    private void actualizarPaginacion() {
        btnMas.setEnabled(!cargando);
        btnMas.setVisibility(!libros.isEmpty() && libros.size() < totalResultados
                ? android.view.View.VISIBLE : android.view.View.GONE);
    }

    private void limpiarFiltros() {
        etBuscar.setText("");
        spCategoria.setSelection(0);
        spNivel.setSelection(0);
        spDisponibilidad.setSelection(0);
        spTipoControl.setSelection(0);
        spUbicacion.setSelection(0);
        spEstado.setSelection(2);
        buscar();
    }

    private void detalle(Libro libro) {
        String mensaje = "ISBN: " + valor(libro.isbn)
                + "\nAutor(es): " + valor(libro.autores)
                + "\nEditorial: " + valor(libro.editorial)
                + "\nCategoría: " + valor(libro.categoria)
                + "\nNivel educativo: " + valor(libro.nivelEducativo)
                + "\nControl: " + ("CANTIDAD".equals(libro.tipoControl) ? "por cantidad" : "individual")
                + "\n\nInventario del libro"
                + "\nTotal de ejemplares: " + cantidad(libro.total)
                + "\nDisponibles: " + cantidad(libro.disponibles)
                + "\nPrestados: " + cantidad(libro.prestados)
                + "\nDañados: " + cantidad(libro.danados)
                + "\nPerdidos: " + cantidad(libro.perdidos)
                + "\n\nUbicación: " + valor(libro.ubicaciones);
        new AlertDialog.Builder(this)
                .setTitle(libro.titulo)
                .setMessage(mensaje)
                .setNeutralButton("Editar", (dialog, which) ->
                        editarLibro.launch(new Intent(this, LibroFormActivity.class).putExtra("libroId", libro.id)))
                .setPositiveButton("Cerrar", null)
                .show();
    }

    private static void configurar(Spinner spinner, List<FilterOption> values) {
        ArrayAdapter<FilterOption> spinnerAdapter = new ArrayAdapter<>(
                spinner.getContext(), android.R.layout.simple_spinner_item, values);
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(spinnerAdapter);
    }

    private static List<FilterOption> opciones(String... pares) {
        List<FilterOption> result = new ArrayList<>();
        for (int i = 0; i < pares.length; i += 2) result.add(new FilterOption(pares[i], pares[i + 1]));
        return result;
    }

    private static String valor(Spinner spinner) {
        Object selected = spinner.getSelectedItem();
        return selected instanceof FilterOption ? ((FilterOption) selected).value : null;
    }

    private static Long valorLong(Spinner spinner) {
        String value = valor(spinner);
        return value == null || value.isEmpty() ? null : Long.valueOf(value);
    }

    private static String cantidad(Integer cantidad) {
        return cantidad == null ? "No informado" : String.valueOf(cantidad);
    }

    private static String valor(String texto) {
        return texto == null || texto.trim().isEmpty() ? "No registrado" : texto;
    }

    private static final class FilterOption {
        final String label;
        final String value;

        FilterOption(String label, String value) {
            this.label = label;
            this.value = value;
        }

        @Override public String toString() { return label; }
    }
}
