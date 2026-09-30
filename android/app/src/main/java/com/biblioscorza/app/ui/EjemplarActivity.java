package com.biblioscorza.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.bumptech.glide.Glide;
import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Ejemplar;
import com.biblioscorza.app.data.Models.EjemplarPatch;
import com.biblioscorza.app.util.Api;
import com.biblioscorza.app.util.QrGenerator;

public class EjemplarActivity extends AppCompatActivity {
    private String codigo;
    private TextView tvError;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_ejemplar);
        tvError = findViewById(R.id.tvError);
        codigo = getIntent().getStringExtra("codigo");
    }

    @Override protected void onResume() { super.onResume(); cargar(); }

    private void cargar() {
        if (codigo == null) return;
        Api.call(ApiClient.api().ejemplarPorCodigo(codigo), new Api.Result<Ejemplar>() {
            @Override public void ok(Ejemplar e, String m) { mostrar(e); }
            @Override public void error(String msg, int h, String c) { tvError.setText(msg); }
        });
    }

    private static String etiqueta(String s) {
        if (s == null) return "—";
        if (s.equals("DANADO")) return "Dañado";
        return s.charAt(0) + s.substring(1).toLowerCase();
    }

    private void mostrar(Ejemplar e) {
        tvError.setText("");
        ((TextView) findViewById(R.id.tvTitulo)).setText(e.titulo);
        ImageView portada = findViewById(R.id.ivPortada);
        if (e.imagenUrl != null) { portada.setVisibility(View.VISIBLE); Glide.with(this).load(e.imagenUrl).into(portada); }
        StringBuilder sb = new StringBuilder();
        sb.append("ISBN: ").append(e.isbn == null ? "—" : e.isbn)
          .append("\nCódigo: ").append(e.codigoInterno)
          .append("\nEstado: ").append(etiqueta(e.estado))
          .append("\nCondición: ").append(etiqueta(e.condicion))
          .append("\nUbicación: ").append(e.ubicacion == null ? "Sin ubicación" : e.ubicacion);
        if (e.ultimoPrestamo != null) {
            sb.append("\nÚltimo préstamo: ").append(e.ultimoPrestamo.prestatario);
            if (e.ultimoPrestamo.fechaPrestamo != null) sb.append(" (").append(e.ultimoPrestamo.fechaPrestamo, 0, 10).append(")");
        }
        ((TextView) findViewById(R.id.tvDatos)).setText(sb.toString());
        try { ((ImageView) findViewById(R.id.ivQr)).setImageBitmap(QrGenerator.generar(e.codigoInterno, 400)); }
        catch (Exception ex) { tvError.setText("No se pudo generar el QR"); }
        ((TextView) findViewById(R.id.tvCodigo)).setText(e.codigoInterno);

        LinearLayout cont = findViewById(R.id.acciones);
        cont.removeAllViews();
        if (e.acciones == null) return;
        for (String a : e.acciones) agregarBoton(cont, e, a);
    }

    private void agregarBoton(LinearLayout cont, Ejemplar e, String accion) {
        String texto; String estado = null;
        switch (accion) {
            case "PRESTAR": texto = "Prestar"; break;
            case "DEVOLVER": texto = "Devolver"; break;
            case "MARCAR_DANADO": texto = "Marcar como dañado"; estado = "DANADO"; break;
            case "MARCAR_PERDIDO": texto = "Marcar como perdido"; estado = "PERDIDO"; break;
            case "MARCAR_REPARACION": texto = "Enviar a reparación"; estado = "REPARACION"; break;
            case "MARCAR_DISPONIBLE": texto = "Marcar como disponible"; estado = "DISPONIBLE"; break;
            case "DAR_BAJA": texto = "Dar de baja"; estado = "BAJA"; break;
            default: return;
        }
        Button btn = new Button(new android.view.ContextThemeWrapper(this, R.style.BsButton), null, 0);
        btn.setText(texto);
        final String nuevo = estado;
        btn.setOnClickListener(v -> {
            if (accion.equals("PRESTAR")) startActivity(new Intent(this, PrestamoActivity.class).putExtra("codigo", e.codigoInterno));
            else if (accion.equals("DEVOLVER")) startActivity(new Intent(this, DevolucionActivity.class).putExtra("codigo", e.codigoInterno));
            else new AlertDialog.Builder(this).setTitle(texto).setMessage(e.codigoInterno + " — " + e.titulo)
                    .setPositiveButton("Confirmar", (d, w) -> cambiarEstado(e, nuevo))
                    .setNegativeButton("Cancelar", null).show();
        });
        cont.addView(btn, new LinearLayout.LayoutParams(-1, (int) (56 * getResources().getDisplayMetrics().density)));
    }

    private void cambiarEstado(Ejemplar e, String nuevo) {
        Api.call(ApiClient.api().cambiarEstado(e.id, new EjemplarPatch(nuevo)), new Api.Result<Ejemplar>() {
            @Override public void ok(Ejemplar r, String m) { mostrar(r); }
            @Override public void error(String msg, int h, String c) { tvError.setText(msg); }
        });
    }
}
