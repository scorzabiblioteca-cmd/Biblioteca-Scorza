package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.LoginData;
import com.biblioscorza.app.data.Models.LoginReq;
import com.biblioscorza.app.data.TokenStore;
import com.biblioscorza.app.util.Api;

public class LoginActivity extends AppCompatActivity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (TokenStore.token(this) != null) { irAlInicio(); return; }
        setContentView(R.layout.activity_login);
        EditText u = findViewById(R.id.etUsuario), p = findViewById(R.id.etClave);
        TextView err = findViewById(R.id.tvError);
        Button btn = findViewById(R.id.btnIngresar);
        ProgressBar progreso = findViewById(R.id.progresoLogin);
        btn.setOnClickListener(v -> {
            err.setText("");
            String user = u.getText().toString().trim(), pass = p.getText().toString();
            if (user.isEmpty() || pass.isEmpty()) { err.setText("Escribe tu usuario y contraseña"); return; }
            btn.setEnabled(false);
            btn.setText("Ingresando…");
            progreso.setVisibility(View.VISIBLE);
            Api.call(ApiClient.api().login(new LoginReq(user, pass)), new Api.Result<LoginData>() {
                @Override public void ok(LoginData d, String m) {
                    if (d == null || d.token == null || d.user == null) {
                        err.setText("No se pudo validar la respuesta del servidor. Inténtalo de nuevo.");
                        restaurarBoton(btn, progreso);
                        return;
                    }
                    TokenStore.guardar(LoginActivity.this, d.token, d.user.nombreCompleto);
                    irAlInicio();
                }
                @Override public void error(String m, int http, String code) {
                    if (http == 0) err.setText("No hay conexión con el servidor. Revisa tu internet.");
                    else if (http == 401) err.setText("Usuario o contraseña incorrectos.");
                    else err.setText("No se pudo iniciar sesión. Inténtalo de nuevo.");
                    restaurarBoton(btn, progreso);
                }
            });
        });
    }

    private void restaurarBoton(Button btn, ProgressBar progreso) {
        btn.setEnabled(true);
        btn.setText("Ingresar");
        progreso.setVisibility(View.GONE);
    }

    private void irAlInicio() {
        startActivity(new Intent(this, HomeActivity.class));
        finish();
    }
}
