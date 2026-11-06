package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.ConsultaIsbn;
import com.biblioscorza.app.data.Models.DevolucionReq;
import com.biblioscorza.app.data.Models.Ejemplar;
import com.biblioscorza.app.data.Models.PrestamoActivo;
import com.biblioscorza.app.data.Models.PrestamosActivos;
import com.biblioscorza.app.util.Api;
import com.biblioscorza.app.util.ScannedCode;

import java.util.ArrayList;
import java.util.List;

public class DevolucionActivity extends AppCompatActivity {
    private static final String[] ETIQ = {"Buena condición", "Deteriorado", "Dañado", "Perdido"};
    private static final String[] VALOR = {"BUENO", "DETERIORADO", "DANADO", "PERDIDO"};
    private TextView tvDatos, tvMsg, tvListaTitulo;
    private Spinner spResultado;
    private EditText etObs;
    private Button btnConfirmar, btnScan;
    private ListView lvPrestamos;
    private ArrayAdapter<String> prestamosAdapter;
    private final List<PrestamoActivo> prestamos = new ArrayList<>();
    private PrestamoActivo actual;
    private String codigoEjemplarRequerido;

    private final ActivityResultLauncher<Intent> escanear = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() != RESULT_OK || r.getData() == null) {
                    btnScan.setEnabled(true);
                    return;
                }
                String tipo = r.getData().getStringExtra(ScannerActivity.EXTRA_TIPO);
                String valor = r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR);
                if (ScannedCode.TYPE_ISBN.equals(tipo) && ScannedCode.esIsbn(valor)) {
                    buscarLibroPorIsbn(valor);
                } else if (ScannedCode.TYPE_EJEMPLAR.equals(tipo) && ScannedCode.esCodigoEjemplar(valor)) {
                    buscarEjemplar(valor, true);
                } else {
                    tvMsg.setText("Escanea un ISBN válido o el QR/código interno de un ejemplar.");
                    btnScan.setEnabled(true);
                }
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_devolucion);
        TopBarController.bind(this);
        findViewById(R.id.btnVolver).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        tvDatos = findViewById(R.id.tvDatos); tvMsg = findViewById(R.id.tvMsg);
        tvListaTitulo = findViewById(R.id.tvListaTitulo);
        spResultado = findViewById(R.id.spResultado); etObs = findViewById(R.id.etObs);
        btnConfirmar = findViewById(R.id.btnConfirmar); btnScan = findViewById(R.id.btnScan);
        lvPrestamos = findViewById(R.id.lvPrestamos);
        spResultado.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, ETIQ));
        prestamosAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, new ArrayList<>());
        lvPrestamos.setAdapter(prestamosAdapter);
        lvPrestamos.setChoiceMode(ListView.CHOICE_MODE_SINGLE);
        btnScan.setOnClickListener(v -> {
            resetearSeleccion();
            btnScan.setEnabled(false);
            escanear.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_DEVOLUCION,
                        "Escanea el ISBN o QR del libro que devuelven"));
        });
        lvPrestamos.setOnItemClickListener((parent, view, position, id) -> seleccionarPrestamo(position));
        btnConfirmar.setOnClickListener(v -> confirmar());
        String pre = getIntent().getStringExtra("codigo");
        if (pre != null) buscarEjemplar(pre, true);
    }

    private void buscarLibroPorIsbn(String isbn) {
        tvMsg.setText("");
        resetearSeleccion();
        Api.call(ApiClient.api().libroPorIsbn(isbn.replaceAll("[\\s-]", "")),
                new Api.Result<ConsultaIsbn>() {
            @Override public void ok(ConsultaIsbn consulta, String mensaje) {
                if (consulta == null || consulta.existente == null) {
                    tvMsg.setText("El ISBN no corresponde a un libro registrado con préstamos activos.");
                    btnScan.setEnabled(true);
                    return;
                }
                cargarPrestamos(consulta.existente.id, null);
            }
            @Override public void error(String msg, int http, String code) {
                tvMsg.setText(http == 0 ? msg : "No se pudo consultar el ISBN. " + msg);
                btnScan.setEnabled(true);
            }
        });
    }

    private void buscarEjemplar(String codigo, boolean exigirEjemplarEscaneado) {
        if (codigo == null) return;
        tvMsg.setText("");
        resetearSeleccion();
        codigoEjemplarRequerido = exigirEjemplarEscaneado ? codigo.trim().toUpperCase() : null;
        Api.call(ApiClient.api().ejemplarPorCodigo(codigo.trim().toUpperCase()), new Api.Result<Ejemplar>() {
            @Override public void ok(Ejemplar ejemplar, String mensaje) {
                if (ejemplar == null) {
                    tvMsg.setText("No se encontró el ejemplar escaneado.");
                    btnScan.setEnabled(true);
                    return;
                }
                cargarPrestamos(ejemplar.libroId, exigirEjemplarEscaneado ? ejemplar.codigoInterno : null);
            }
            @Override public void error(String msg, int http, String code) {
                tvMsg.setText(msg);
                btnScan.setEnabled(true);
            }
        });
    }

    private void cargarPrestamos(long libroId, String codigoEjemplarEscaneado) {
        Api.call(ApiClient.api().prestamosActivosPorLibro(libroId), new Api.Result<PrestamosActivos>() {
            @Override public void ok(PrestamosActivos respuesta, String mensaje) {
                btnScan.setEnabled(true);
                prestamos.clear();
                if (respuesta != null && respuesta.items != null) prestamos.addAll(respuesta.items);
                prestamosAdapter.clear();
                for (PrestamoActivo prestamo : prestamos) {
                    prestamosAdapter.add(descripcion(prestamo));
                }
                if (prestamos.isEmpty()) {
                    tvListaTitulo.setVisibility(View.GONE);
                    lvPrestamos.setVisibility(View.GONE);
                    tvMsg.setText("Este libro no tiene préstamos activos para devolver.");
                    return;
                }
                tvListaTitulo.setVisibility(View.VISIBLE);
                lvPrestamos.setVisibility(View.VISIBLE);
                tvMsg.setText(codigoEjemplarEscaneado == null
                        ? "Selecciona el préstamo que corresponde a la devolución."
                        : "Selecciona el préstamo del ejemplar escaneado.");
                if (codigoEjemplarEscaneado != null) {
                    int posicion = buscarPosicionEjemplar(codigoEjemplarEscaneado);
                    if (posicion >= 0) seleccionarPrestamo(posicion);
                    else tvMsg.setText("El ejemplar escaneado no tiene un préstamo activo. No se puede devolver otro ejemplar mediante este QR.");
                }
            }
            @Override public void error(String msg, int http, String code) {
                btnScan.setEnabled(true);
                tvMsg.setText("No se pudieron cargar los préstamos activos. " + msg);
            }
        });
    }

    private int buscarPosicionEjemplar(String codigo) {
        for (int i = 0; i < prestamos.size(); i++) {
            if (codigo.equalsIgnoreCase(prestamos.get(i).codigoInterno)) return i;
        }
        return -1;
    }

    private String descripcion(PrestamoActivo prestamo) {
        String codigo = prestamo.codigoInterno == null ? "Control por cantidad" : prestamo.codigoInterno;
        String fecha = prestamo.fechaPrestamo == null ? "Fecha no disponible" : prestamo.fechaPrestamo.substring(0, 10);
        String vencimiento = prestamo.fechaPrevistaDevolucion == null
                ? "Sin fecha prevista" : prestamo.fechaPrevistaDevolucion.substring(0, 10);
        return codigo + " · " + (prestamo.prestatario == null ? "Prestatario no disponible" : prestamo.prestatario)
                + "\nPréstamo: " + fecha + " · Devolución prevista: " + vencimiento
                + (prestamo.vencido ? " · VENCIDO" : "");
    }

    private void seleccionarPrestamo(int position) {
        if (position < 0 || position >= prestamos.size()) return;
        PrestamoActivo seleccionado = prestamos.get(position);
        if (codigoEjemplarRequerido != null
                && !codigoEjemplarRequerido.equalsIgnoreCase(seleccionado.codigoInterno)) {
            tvMsg.setText("El QR identifica " + codigoEjemplarRequerido
                    + ". Selecciona únicamente el préstamo de ese ejemplar.");
            return;
        }
        actual = seleccionado;
        lvPrestamos.setItemChecked(position, true);
        tvDatos.setText(actual.titulo + "\n" + (actual.codigoInterno == null
                ? "Control por cantidad" : actual.codigoInterno)
                + "\n\nPrestado a: " + actual.prestatario
                + "\nDesde: " + fecha(actual.fechaPrestamo)
                + "\nDevolver antes de: " + fecha(actual.fechaPrevistaDevolucion)
                + (actual.vencido ? "  (VENCIDO)" : ""));
        mostrarFormulario(true);
        tvMsg.setText("Préstamo seleccionado. Revisa los datos y confirma la devolución.");
    }

    private String fecha(String valor) {
        return valor == null ? "No disponible" : valor.substring(0, Math.min(10, valor.length()));
    }

    private void resetearSeleccion() {
        actual = null;
        codigoEjemplarRequerido = null;
        prestamos.clear();
        if (prestamosAdapter != null) prestamosAdapter.clear();
        tvDatos.setText("");
        tvListaTitulo.setVisibility(View.GONE);
        lvPrestamos.setVisibility(View.GONE);
        mostrarFormulario(false);
    }

    private void mostrarFormulario(boolean mostrar) {
        int visibilidad = mostrar ? View.VISIBLE : View.GONE;
        spResultado.setVisibility(visibilidad);
        etObs.setVisibility(visibilidad);
        btnConfirmar.setVisibility(visibilidad);
    }

    private void confirmar() {
        if (actual == null) {
            tvMsg.setText("Selecciona un préstamo activo antes de confirmar la devolución.");
            return;
        }
        DevolucionReq r = new DevolucionReq();
        r.prestamoDetalleId = actual.detalleId;
        r.resultado = VALOR[spResultado.getSelectedItemPosition()];
        String o = etObs.getText().toString().trim();
        r.observaciones = o.isEmpty() ? null : o;
        btnConfirmar.setEnabled(false);
        Api.call(ApiClient.api().devolver(r), new Api.Result<Object>() {
            @Override public void ok(Object d, String m) {
                Toast.makeText(DevolucionActivity.this, m == null ? "Devolución registrada" : m, Toast.LENGTH_LONG).show();
                finish();
            }
            @Override public void error(String msg, int h, String c) { tvMsg.setText(msg); btnConfirmar.setEnabled(true); }
        });
    }
}
