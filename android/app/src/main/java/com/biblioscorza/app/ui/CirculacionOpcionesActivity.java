package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;

public class CirculacionOpcionesActivity extends AppCompatActivity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_circulacion_opciones);
        TopBarController.bind(this);
        findViewById(R.id.btnVolver).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        findViewById(R.id.btnAbrirPrestamo).setOnClickListener(v ->
                startActivity(new Intent(this, PrestamoActivity.class)));
        findViewById(R.id.btnAbrirDevolucion).setOnClickListener(v ->
                startActivity(new Intent(this, DevolucionActivity.class)));
    }
}
