package com.biblioscorza.app.ui;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.card.MaterialCardView;
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
    private TextView tvDatos, tvMsg, tvCantidadSeleccionada;
    private Spinner spResultado;
    private EditText etObs;
    private Button btnConfirmar, btnScan;
    private LinearLayout listaPrestamos;
    private View cardPrestamos, cardDevolucion;
    private final List<PrestamoActivo> prestamos = new ArrayList<>();
    private final List<PrestamoActivo> seleccionados = new ArrayList<>();
    private final List<CheckBox> checksPrestamos = new ArrayList<>();
    private String codigoEjemplarRequerido;
    private long libroActualId;
    private boolean procesandoDevolucion;
    private String errorDevolucionPendiente;

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
        tvCantidadSeleccionada = findViewById(R.id.tvCantidadSeleccionada);
        spResultado = findViewById(R.id.spResultado); etObs = findViewById(R.id.etObs);
        btnConfirmar = findViewById(R.id.btnConfirmar); btnScan = findViewById(R.id.btnScan);
        listaPrestamos = findViewById(R.id.listaPrestamos);
        cardPrestamos = findViewById(R.id.cardPrestamos);
        cardDevolucion = findViewById(R.id.cardDevolucion);
        spResultado.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, ETIQ));
        tvMsg.setVisibility(View.VISIBLE);
        tvMsg.setText("Escanea un ISBN o el QR de un ejemplar para ver los préstamos activos.");
        btnScan.setOnClickListener(v -> {
            resetearSeleccion();
            btnScan.setEnabled(false);
            escanear.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_DEVOLUCION,
                        "Escanea el ISBN o QR del libro que devuelven"));
        });
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
        libroActualId = libroId;
        Api.call(ApiClient.api().prestamosActivosPorLibro(libroId), new Api.Result<PrestamosActivos>() {
            @Override public void ok(PrestamosActivos respuesta, String mensaje) {
                btnScan.setEnabled(true);
                prestamos.clear();
                if (respuesta != null && respuesta.items != null) prestamos.addAll(respuesta.items);
                listaPrestamos.removeAllViews();
                checksPrestamos.clear();
                for (int i = 0; i < prestamos.size(); i++) {
                    agregarFilaPrestamo(prestamos.get(i), i);
                }
                if (prestamos.isEmpty()) {
                    cardPrestamos.setVisibility(View.GONE);
                    tvMsg.setText("Este libro no tiene préstamos activos para devolver.");
                    return;
                }
                cardPrestamos.setVisibility(View.VISIBLE);
                listaPrestamos.setVisibility(View.VISIBLE);
                tvMsg.setText(codigoEjemplarEscaneado == null
                        ? "Marca una o más copias que te están devolviendo."
                        : "Se seleccionó el ejemplar leído. Revisa los datos antes de confirmar.");
                if (codigoEjemplarEscaneado != null) {
                    int posicion = buscarPosicionEjemplar(codigoEjemplarEscaneado);
                    if (posicion >= 0) {
                        checksPrestamos.get(posicion).setChecked(true);
                    }
                    else tvMsg.setText("El ejemplar escaneado no tiene un préstamo activo. No se puede devolver otro ejemplar mediante este QR.");
                }
                if (errorDevolucionPendiente != null) {
                    tvMsg.setText(errorDevolucionPendiente);
                    errorDevolucionPendiente = null;
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

    private String descripcion(PrestamoActivo prestamo, int position) {
        String codigo = prestamo.codigoInterno == null
                ? "Copia " + numeroCopiaCantidad(position) + " · Control por cantidad"
                : prestamo.codigoInterno;
        String fecha = prestamo.fechaPrestamo == null ? "Fecha no disponible" : prestamo.fechaPrestamo.substring(0, 10);
        String vencimiento = prestamo.fechaPrevistaDevolucion == null
                ? "Sin fecha prevista" : prestamo.fechaPrevistaDevolucion.substring(0, 10);
        return codigo + " · " + (prestamo.prestatario == null ? "Prestatario no disponible" : prestamo.prestatario)
                + "\nPréstamo: " + fecha + " · Devolución prevista: " + vencimiento
                + (prestamo.vencido ? " · VENCIDO" : "");
    }

    private void agregarFilaPrestamo(PrestamoActivo prestamo, int position) {
        float density = getResources().getDisplayMetrics().density;
        MaterialCardView tarjeta = new MaterialCardView(this);
        tarjeta.setRadius(16 * density);
        tarjeta.setCardElevation(0);
        tarjeta.setStrokeWidth(Math.max(1, (int) density));
        tarjeta.setStrokeColor(Color.rgb(226, 232, 240));
        tarjeta.setCardBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardParams.bottomMargin = (int) (10 * density);
        tarjeta.setLayoutParams(cardParams);

        CheckBox check = new CheckBox(this);
        check.setText(descripcion(prestamo, position));
        check.setTextColor(Color.rgb(30, 41, 59));
        check.setTextSize(14);
        check.setLineSpacing(2 * density, 1f);
        check.setPadding((int) (16 * density), (int) (10 * density),
                (int) (16 * density), (int) (10 * density));
        check.setMinHeight((int) (76 * density));
        tarjeta.addView(check);
        checksPrestamos.add(check);

        check.setOnCheckedChangeListener((button, checked) ->
                cambiarSeleccion(position, prestamo, tarjeta, checked));
        tarjeta.setOnClickListener(v -> {
            if (check.isEnabled()) check.setChecked(!check.isChecked());
        });
        if (codigoEjemplarRequerido != null
                && !codigoEjemplarRequerido.equalsIgnoreCase(prestamo.codigoInterno)) {
            check.setEnabled(false);
            tarjeta.setAlpha(0.55f);
        }
        listaPrestamos.addView(tarjeta);
    }

    private int numeroCopiaCantidad(int position) {
        PrestamoActivo actual = prestamos.get(position);
        int numero = 0;
        for (int i = 0; i <= position; i++) {
            PrestamoActivo prestamo = prestamos.get(i);
            if (prestamo.codigoInterno == null && prestamo.prestamoId == actual.prestamoId) numero++;
        }
        return numero;
    }

    private void cambiarSeleccion(int position, PrestamoActivo prestamo,
                                  MaterialCardView tarjeta, boolean marcado) {
        if (procesandoDevolucion) return;
        if (marcado && !seleccionados.contains(prestamo) && seleccionados.size() >= 100) {
            CheckBox check = checksPrestamos.get(position);
            check.setOnCheckedChangeListener(null);
            check.setChecked(false);
            check.setOnCheckedChangeListener((button, checked) ->
                    cambiarSeleccion(position, prestamo, tarjeta, checked));
            tvMsg.setText("Puedes devolver hasta 100 ejemplares por operación.");
            return;
        }
        if (marcado) {
            if (!seleccionados.contains(prestamo)) seleccionados.add(prestamo);
            tarjeta.setStrokeColor(Color.rgb(23, 50, 77));
            tarjeta.setStrokeWidth((int) (2 * getResources().getDisplayMetrics().density));
            tarjeta.setCardBackgroundColor(Color.rgb(239, 246, 255));
        } else {
            seleccionados.remove(prestamo);
            tarjeta.setStrokeColor(Color.rgb(226, 232, 240));
            tarjeta.setStrokeWidth(Math.max(1, (int) getResources().getDisplayMetrics().density));
            tarjeta.setCardBackgroundColor(Color.WHITE);
        }
        actualizarResumenSeleccion();
    }

    private void actualizarResumenSeleccion() {
        int cantidad = seleccionados.size();
        tvCantidadSeleccionada.setText(cantidad == 0 ? "Ninguna copia seleccionada"
                : cantidad + (cantidad == 1 ? " copia seleccionada" : " copias seleccionadas"));
        tvCantidadSeleccionada.setVisibility(View.VISIBLE);
        if (cantidad == 0) {
            tvDatos.setText("");
            findViewById(R.id.tvDatosTitulo).setVisibility(View.GONE);
            tvDatos.setVisibility(View.GONE);
            mostrarFormulario(false);
            btnConfirmar.setText("Confirmar devolución");
            btnConfirmar.setEnabled(false);
            errorDevolucionPendiente = null;
            tvMsg.setText("Marca una o más copias que te están devolviendo.");
            return;
        }

        StringBuilder resumen = new StringBuilder("Cantidad a devolver: ")
                .append(cantidad).append(cantidad == 1 ? " ejemplar" : " ejemplares");
        for (PrestamoActivo seleccionado : seleccionados) {
            resumen.append("\n\n").append(seleccionado.titulo)
                    .append("\n").append(seleccionado.codigoInterno == null
                            ? "Control por cantidad" : seleccionado.codigoInterno)
                    .append("\nPrestado a: ").append(seleccionado.prestatario)
                    .append("\nDesde: ").append(fecha(seleccionado.fechaPrestamo))
                    .append("\nDevolver antes de: ").append(fecha(seleccionado.fechaPrevistaDevolucion))
                    .append(seleccionado.vencido ? "  (VENCIDO)" : "");
        }
        tvDatos.setText(resumen);
        findViewById(R.id.tvDatosTitulo).setVisibility(View.VISIBLE);
        tvDatos.setVisibility(View.VISIBLE);
        mostrarFormulario(true);
        btnConfirmar.setText("Confirmar devolución · " + cantidad);
        btnConfirmar.setEnabled(!procesandoDevolucion);
        tvMsg.setText("Se devolverán " + cantidad
                + (cantidad == 1 ? " ejemplar." : " ejemplares."));
    }

    private String fecha(String valor) {
        return valor == null ? "No disponible" : valor.substring(0, Math.min(10, valor.length()));
    }

    private void resetearSeleccion() {
        seleccionados.clear();
        codigoEjemplarRequerido = null;
        prestamos.clear();
        checksPrestamos.clear();
        if (listaPrestamos != null) listaPrestamos.removeAllViews();
        tvDatos.setText("");
        cardPrestamos.setVisibility(View.GONE);
        listaPrestamos.setVisibility(View.GONE);
        tvCantidadSeleccionada.setVisibility(View.GONE);
        findViewById(R.id.tvDatosTitulo).setVisibility(View.GONE);
        tvDatos.setVisibility(View.GONE);
        mostrarFormulario(false);
        btnConfirmar.setText("Confirmar devolución");
        btnConfirmar.setEnabled(false);
    }

    private void mostrarFormulario(boolean mostrar) {
        int visibilidad = mostrar ? View.VISIBLE : View.GONE;
        cardDevolucion.setVisibility(visibilidad);
        spResultado.setVisibility(visibilidad);
        etObs.setVisibility(visibilidad);
        btnConfirmar.setVisibility(visibilidad);
    }

    private void confirmar() {
        if (procesandoDevolucion) return;
        if (seleccionados.isEmpty()) {
            tvMsg.setText("Selecciona al menos un ejemplar antes de confirmar la devolución.");
            return;
        }
        String o = etObs.getText().toString().trim();
        String observaciones = o.isEmpty() ? null : o;
        procesandoDevolucion = true;
        setSeleccionHabilitada(false);
        btnConfirmar.setEnabled(false);
        btnConfirmar.setText("Registrando devolución…");
        registrarSiguienteDevolucion(new ArrayList<>(seleccionados), 0,
                VALOR[spResultado.getSelectedItemPosition()], observaciones);
    }

    private void registrarSiguienteDevolucion(List<PrestamoActivo> porDevolver, int posicion,
                                               String resultado, String observaciones) {
        if (posicion >= porDevolver.size()) {
            Toast.makeText(this, porDevolver.size()
                    + (porDevolver.size() == 1 ? " devolución registrada" : " devoluciones registradas"),
                    Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        DevolucionReq solicitud = new DevolucionReq();
        solicitud.prestamoDetalleId = porDevolver.get(posicion).detalleId;
        solicitud.resultado = resultado;
        solicitud.observaciones = observaciones;
        Api.call(ApiClient.api().devolver(solicitud), new Api.Result<Object>() {
            @Override public void ok(Object d, String m) {
                registrarSiguienteDevolucion(porDevolver, posicion + 1, resultado, observaciones);
            }
            @Override public void error(String msg, int h, String c) {
                procesandoDevolucion = false;
                seleccionados.clear();
                mostrarFormulario(false);
                btnConfirmar.setEnabled(false);
                int registradas = posicion;
                errorDevolucionPendiente = registradas == 0
                        ? "No se pudo registrar la devolución. " + msg
                        : "Se registraron " + registradas + " de " + porDevolver.size()
                                + " devoluciones. Se actualizó la lista; revisa las copias pendientes. " + msg;
                cargarPrestamos(libroActualId, codigoEjemplarRequerido);
            }
        });
    }

    private void setSeleccionHabilitada(boolean habilitada) {
        for (int i = 0; i < checksPrestamos.size(); i++) {
            CheckBox check = checksPrestamos.get(i);
            boolean habilitarFila = habilitada && (codigoEjemplarRequerido == null
                    || codigoEjemplarRequerido.equalsIgnoreCase(prestamos.get(i).codigoInterno));
            check.setEnabled(habilitarFila);
            listaPrestamos.getChildAt(i).setClickable(habilitarFila);
        }
        btnScan.setEnabled(habilitada);
        spResultado.setEnabled(habilitada);
        etObs.setEnabled(habilitada);
    }
}
