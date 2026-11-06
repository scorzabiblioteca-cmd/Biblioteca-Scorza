package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.TokenStore;

public class HomeActivity extends AppCompatActivity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_home);
        TopBarController.bind(this);
        ((TextView) findViewById(R.id.tvUsuario)).setText("Sesión: " + TokenStore.usuario(this));
        findViewById(R.id.btnRegistrar).setOnClickListener(v -> startActivity(new Intent(this, LibroFormActivity.class)));
        findViewById(R.id.btnEscaneoOpciones).setOnClickListener(v ->
                startActivity(new Intent(this, EscaneoOpcionesActivity.class)));
        findViewById(R.id.btnCirculacionOpciones).setOnClickListener(v ->
                startActivity(new Intent(this, CirculacionOpcionesActivity.class)));
        findViewById(R.id.btnBuscar).setOnClickListener(v -> startActivity(new Intent(this, BuscarActivity.class)));
        findViewById(R.id.btnSalir).setOnClickListener(v -> {
            TokenStore.limpiar(this);
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }
}
