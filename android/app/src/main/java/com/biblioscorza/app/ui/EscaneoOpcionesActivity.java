package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.util.ScannedCode;

public class EscaneoOpcionesActivity extends AppCompatActivity {
    private final ActivityResultLauncher<Intent> escanearRegistro =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), resultado -> {
                if (resultado.getResultCode() != RESULT_OK || resultado.getData() == null) return;
                String valor = resultado.getData().getStringExtra(ScannerActivity.EXTRA_VALOR);
                String tipo = resultado.getData().getStringExtra(ScannerActivity.EXTRA_TIPO);
                if (!ScannedCode.TYPE_ISBN.equals(tipo)) {
                    Toast.makeText(this, "Para registrar un libro, escanea un ISBN válido.", Toast.LENGTH_LONG).show();
                    return;
                }
                startActivity(new Intent(this, LibroFormActivity.class)
                        .putExtra("isbn", valor)
                        .putExtra("consultarIsbn", true));
            });

    private final ActivityResultLauncher<Intent> escanearBusqueda =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), resultado -> {
                if (resultado.getResultCode() != RESULT_OK || resultado.getData() == null) return;
                String codigo = resultado.getData().getStringExtra(ScannerActivity.EXTRA_VALOR);
                String tipo = resultado.getData().getStringExtra(ScannerActivity.EXTRA_TIPO);
                if (ScannedCode.TYPE_EJEMPLAR.equals(tipo)) {
                    startActivity(new Intent(this, EjemplarActivity.class).putExtra("codigo", codigo));
                } else if (ScannedCode.TYPE_ISBN.equals(tipo)) {
                    startActivity(new Intent(this, BuscarActivity.class).putExtra("q", codigo));
                } else {
                    Toast.makeText(this, "El código no corresponde a un ISBN ni a un ejemplar.", Toast.LENGTH_LONG).show();
                }
            });

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_escaneo_opciones);
        TopBarController.bind(this);
        findViewById(R.id.btnVolver).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        findViewById(R.id.btnEscanearRegistro).setOnClickListener(v -> escanearRegistro.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_REGISTRO_LIBRO,
                        "Escanea el código de barras ISBN del libro")));
        findViewById(R.id.btnEscanearBusqueda).setOnClickListener(v -> escanearBusqueda.launch(
                ScannerActivity.crearIntent(this, ScannerActivity.CONTEXTO_BUSQUEDA_LIBRO,
                        "Escanea el ISBN o QR del ejemplar")));
    }
}
