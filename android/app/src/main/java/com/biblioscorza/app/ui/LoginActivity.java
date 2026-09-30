package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

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
        btn.setOnClickListener(v -> {
            err.setText("");
            String user = u.getText().toString().trim(), pass = p.getText().toString();
            if (user.isEmpty() || pass.isEmpty()) { err.setText("Escribe tu usuario y contraseña"); return; }
            btn.setEnabled(false);
            Api.call(ApiClient.api().login(new LoginReq(user, pass)), new Api.Result<LoginData>() {
                @Override public void ok(LoginData d, String m) {
                    TokenStore.guardar(LoginActivity.this, d.token, d.user.nombreCompleto);
                    irAlInicio();
                }
                @Override public void error(String m, int http, String code) { err.setText(m); btn.setEnabled(true); }
            });
        });
    }

    private void irAlInicio() {
        startActivity(new Intent(this, HomeActivity.class));
        finish();
    }
}
