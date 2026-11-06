package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.DevolucionReq;
import com.biblioscorza.app.data.Models.PrestamoActivo;
import com.biblioscorza.app.util.Api;
import com.biblioscorza.app.util.ScannedCode;

public class DevolucionActivity extends AppCompatActivity {
    private static final String[] ETIQ = {"Buena condición", "Deteriorado", "Dañado", "Perdido"};
    private static final String[] VALOR = {"BUENO", "DETERIORADO", "DANADO", "PERDIDO"};
    private TextView tvDatos, tvMsg;
    private Spinner spResultado;
    private EditText etObs;
    private View btnConfirmar;
    private PrestamoActivo actual;

    private final ActivityResultLauncher<Intent> escanear = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                    String tipo = r.getData().getStringExtra(ScannerActivity.EXTRA_TIPO);
                    String valor = r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR);
                    if (ScannedCode.TYPE_EJEMPLAR.equals(tipo) && ScannedCode.esCodigoEjemplar(valor)) {
                        buscar(valor);
                    } else {
                        tvMsg.setText("Escanea el QR o código interno de un ejemplar para consultar su préstamo activo.");
                    }
                }
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_devolucion);
        TopBarController.bind(this);
        findViewById(R.id.btnVolver).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        tvDatos = findViewById(R.id.tvDatos); tvMsg = findViewById(R.id.tvMsg);
        spResultado = findViewById(R.id.spResultado); etObs = findViewById(R.id.etObs); btnConfirmar = findViewById(R.id.btnConfirmar);
        spResultado.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, ETIQ));
        findViewById(R.id.btnScan).setOnClickListener(v -> escanear.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_DEVOLUCION,
                        "Escanea el QR o código interno del ejemplar que devuelven")));
        btnConfirmar.setOnClickListener(v -> confirmar());
        String pre = getIntent().getStringExtra("codigo");
        if (pre != null) buscar(pre);
    }

    private void buscar(String codigo) {
        if (codigo == null) return;
        tvMsg.setText(""); mostrarForm(false);
        Api.call(ApiClient.api().prestamoActivo(codigo.trim().toUpperCase()), new Api.Result<PrestamoActivo>() {
            @Override public void ok(PrestamoActivo p, String m) {
                actual = p;
                tvDatos.setText(p.titulo + "\n" + p.codigoInterno + "\n\nPrestado a: " + p.prestatario
                        + "\nDesde: " + p.fechaPrestamo.substring(0, 10)
                        + "\nDevolver antes de: " + p.fechaPrevistaDevolucion + (p.vencido ? "  (VENCIDO)" : ""));
                mostrarForm(true);
            }
            @Override public void error(String msg, int h, String c) { tvDatos.setText(""); tvMsg.setText(msg); }
        });
    }

    private void mostrarForm(boolean s) {
        int v = s ? View.VISIBLE : View.GONE;
        spResultado.setVisibility(v); etObs.setVisibility(v); btnConfirmar.setVisibility(v);
    }

    private void confirmar() {
        DevolucionReq r = new DevolucionReq();
        r.codigoEjemplar = actual.codigoInterno;
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
