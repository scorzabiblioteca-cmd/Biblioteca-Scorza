package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.TokenStore;

public class HomeActivity extends AppCompatActivity {
    private final ActivityResultLauncher<Intent> escanearEjemplar =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> {
                if (r.getResultCode() == RESULT_OK && r.getData() != null) {
                    String codigo = r.getData().getStringExtra(ScannerActivity.EXTRA_VALOR);
                    Intent i = new Intent(this, EjemplarActivity.class);
                    i.putExtra("codigo", codigo);
                    startActivity(i);
                }
            });

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_home);
        ((TextView) findViewById(R.id.tvUsuario)).setText("Sesión: " + TokenStore.usuario(this));
        findViewById(R.id.btnRegistrar).setOnClickListener(v -> startActivity(new Intent(this, LibroFormActivity.class)));
        findViewById(R.id.btnEscanearIsbn).setOnClickListener(v ->
                startActivity(new Intent(this, ScannerActivity.class).putExtra(ScannerActivity.EXTRA_MODO, ScannerActivity.MODO_RAPIDO)));
        findViewById(R.id.btnEscanearEjemplar).setOnClickListener(v ->
                escanearEjemplar.launch(new Intent(this, ScannerActivity.class)
                        .putExtra(ScannerActivity.EXTRA_GUIA, "Apunta al QR del ejemplar")));
        findViewById(R.id.btnPrestamo).setOnClickListener(v -> startActivity(new Intent(this, PrestamoActivity.class)));
        findViewById(R.id.btnDevolucion).setOnClickListener(v -> startActivity(new Intent(this, DevolucionActivity.class)));
        findViewById(R.id.btnBuscar).setOnClickListener(v -> startActivity(new Intent(this, BuscarActivity.class)));
        findViewById(R.id.btnSalir).setOnClickListener(v -> {
            TokenStore.limpiar(this);
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }
}
