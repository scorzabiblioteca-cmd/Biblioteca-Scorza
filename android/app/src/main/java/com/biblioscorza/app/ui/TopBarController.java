package com.biblioscorza.app.ui;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Perfil;
import com.biblioscorza.app.data.TokenStore;
import com.biblioscorza.app.util.Api;

final class TopBarController {
    private final AppCompatActivity activity;
    private final TextView avatar;
    private final TextView badge;
    private final View notificationsButton;

    private TopBarController(AppCompatActivity activity) {
        this.activity = activity;
        avatar = activity.findViewById(R.id.btnPerfil);
        badge = activity.findViewById(R.id.tvNotificaciones);
        notificationsButton = activity.findViewById(R.id.btnNotificaciones);
        configurar();
    }

    static void bind(AppCompatActivity activity) {
        new TopBarController(activity);
    }

    static void actualizarContador(AppCompatActivity activity, int noLeidas) {
        TextView badge = activity.findViewById(R.id.tvNotificaciones);
        View button = activity.findViewById(R.id.btnNotificaciones);
        if (badge == null || button == null) return;
        mostrarContador(badge, button, noLeidas);
    }

    private void configurar() {
        String nombre = TokenStore.usuario(activity);
        avatar.setText(iniciales(nombre));
        avatar.setContentDescription("Perfil de " + (nombre.isEmpty() ? "usuario" : nombre));
        avatar.setOnClickListener(v -> cargarPerfil());
        notificationsButton.setOnClickListener(v -> {
            if (activity instanceof NotificacionesActivity) {
                ((NotificacionesActivity) activity).recargar();
            } else {
                activity.startActivity(new Intent(activity, NotificacionesActivity.class));
            }
        });
        activity.getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override public void onResume(LifecycleOwner owner) {
                cargarContador();
            }
        });
    }

    private void cargarContador() {
        Api.call(ApiClient.api().notificaciones(1, 1),
                new Api.Result<com.biblioscorza.app.data.Models.Notificaciones>() {
                    @Override public void ok(
                            com.biblioscorza.app.data.Models.Notificaciones data, String message) {
                        if (activity.isFinishing() || activity.isDestroyed() || data == null) return;
                        mostrarContador(badge, notificationsButton, data.noLeidas);
                    }

                    @Override public void error(String msg, int http, String code) {
                        if (http != 403) {
                            android.util.Log.w("TopBarController",
                                    "Could not refresh notification count (HTTP " + http + "): " + msg);
                        }
                    }
                });
    }

    private static void mostrarContador(TextView badge, View button, int noLeidas) {
        if (noLeidas <= 0) {
            badge.setVisibility(View.GONE);
            button.setContentDescription("Notificaciones, ninguna sin leer");
            return;
        }
        badge.setText(noLeidas > 99 ? "99+" : String.valueOf(noLeidas));
        badge.setVisibility(View.VISIBLE);
        button.setContentDescription("Notificaciones, " + noLeidas + " sin leer");
    }

    private void cargarPerfil() {
        Api.call(ApiClient.api().perfil(), new Api.Result<Perfil>() {
            @Override public void ok(Perfil profile, String message) {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (profile == null) {
                    aviso("El servidor devolvió un perfil incompleto.");
                    return;
                }
                mostrarPerfil(profile);
            }

            @Override public void error(String msg, int http, String code) {
                if (!activity.isFinishing() && !activity.isDestroyed()) {
                    aviso("No se pudo cargar el perfil: " + msg);
                }
            }
        });
    }

    private void mostrarPerfil(Perfil profile) {
        String nombre = texto(profile.nombreCompleto, TokenStore.usuario(activity));
        String roles = profile.roles == null || profile.roles.isEmpty()
                ? "No especificado" : String.join(", ", profile.roles);

        LinearLayout contenido = columna();
        contenido.setPadding(dp(20), dp(12), dp(20), dp(6));

        LinearLayout cabecera = new LinearLayout(activity);
        cabecera.setGravity(android.view.Gravity.CENTER_VERTICAL);
        cabecera.setPadding(dp(16), dp(18), dp(16), dp(18));
        cabecera.setBackground(degradado("#17324D", "#176078", 20));
        TextView inicial = textoVista(iniciales(nombre), 22, "#FFFFFF", true);
        inicial.setGravity(android.view.Gravity.CENTER);
        inicial.setBackground(redondeado("#12A884", 50));
        cabecera.addView(inicial, new LinearLayout.LayoutParams(dp(58), dp(58)));

        LinearLayout datosNombre = columna();
        LinearLayout.LayoutParams nombreParams = new LinearLayout.LayoutParams(0, -2, 1);
        nombreParams.setMarginStart(dp(14));
        TextView nombreVista = textoVista(nombre, 18, "#FFFFFF", true);
        nombreVista.setMaxLines(2);
        nombreVista.setEllipsize(android.text.TextUtils.TruncateAt.END);
        datosNombre.addView(nombreVista);
        TextView estadoCuenta = textoVista("Cuenta de biblioteca", 12, "#BDE9E2", false);
        LinearLayout.LayoutParams cuentaParams = new LinearLayout.LayoutParams(-1, -2);
        cuentaParams.topMargin = dp(4);
        datosNombre.addView(estadoCuenta, cuentaParams);
        cabecera.addView(datosNombre, nombreParams);
        contenido.addView(cabecera);
        contenido.addView(filaPerfil("@", "USUARIO",
                texto(profile.username, "No especificado"), "#EFF6FF", "#2563EB"));
        contenido.addView(filaPerfil("✉", "CORREO",
                texto(profile.email, "No registrado"), "#F5F3FF", "#7C3AED"));
        contenido.addView(filaPerfil("★", "ROL", roles, "#ECFDF5", "#059669"));

        AlertDialog alerta = new AlertDialog.Builder(activity)
                .setView(contenido)
                .setNegativeButton("Cerrar sesión", (dialog, which) -> cerrarSesion())
                .setPositiveButton("Listo", null)
                .create();
        alerta.show();
        if (alerta.getButton(AlertDialog.BUTTON_POSITIVE) != null) {
            alerta.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.parseColor("#087F8C"));
        }
        alerta.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(Color.parseColor("#DC2626"));
    }

    private View filaPerfil(String iconoTexto, String etiqueta, String valor,
                            String fondo, String acento) {
        LinearLayout fila = new LinearLayout(activity);
        fila.setGravity(android.view.Gravity.CENTER_VERTICAL);
        fila.setPadding(dp(12), dp(10), dp(12), dp(10));
        fila.setBackground(redondeado(fondo, 14));

        TextView icono = textoVista(iconoTexto, 16, acento, true);
        icono.setGravity(android.view.Gravity.CENTER);
        icono.setBackground(redondeado("#FFFFFF", 12));
        fila.addView(icono, new LinearLayout.LayoutParams(dp(38), dp(38)));

        LinearLayout textos = columna();
        LinearLayout.LayoutParams textosParams = new LinearLayout.LayoutParams(0, -2, 1);
        textosParams.setMarginStart(dp(12));
        textos.addView(textoVista(etiqueta, 10, acento, true));
        TextView valorVista = textoVista(valor, 14, "#17324D", true);
        valorVista.setMaxLines(2);
        valorVista.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams valorParams = new LinearLayout.LayoutParams(-1, -2);
        valorParams.topMargin = dp(3);
        textos.addView(valorVista, valorParams);
        fila.addView(textos, textosParams);

        LinearLayout.LayoutParams filaParams = new LinearLayout.LayoutParams(-1, -2);
        filaParams.topMargin = dp(9);
        fila.setLayoutParams(filaParams);
        return fila;
    }

    private void cerrarSesion() {
        TokenStore.limpiar(activity);
        Intent intent = new Intent(activity, LoginActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        activity.startActivity(intent);
    }

    private void aviso(String mensaje) {
        Toast.makeText(activity, mensaje, Toast.LENGTH_LONG).show();
    }

    private LinearLayout columna() {
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private TextView textoVista(String texto, int sizeSp, String color, boolean negrita) {
        TextView view = new TextView(activity);
        view.setText(texto);
        view.setTextColor(Color.parseColor(color));
        view.setTextSize(sizeSp);
        if (negrita) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private GradientDrawable redondeado(String color, int radioDp) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.parseColor(color));
        shape.setCornerRadius(dp(radioDp));
        return shape;
    }

    private GradientDrawable degradado(String inicio, String fin, int radioDp) {
        GradientDrawable shape = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.parseColor(inicio), Color.parseColor(fin)});
        shape.setCornerRadius(dp(radioDp));
        return shape;
    }

    private int dp(int value) {
        return (int) (value * activity.getResources().getDisplayMetrics().density + 0.5f);
    }

    private static String iniciales(String nombre) {
        if (nombre == null || nombre.trim().isEmpty()) return "U";
        String[] partes = nombre.trim().split("\\s+");
        StringBuilder resultado = new StringBuilder();
        resultado.append(Character.toUpperCase(partes[0].charAt(0)));
        if (partes.length > 1) resultado.append(Character.toUpperCase(partes[partes.length - 1].charAt(0)));
        return resultado.toString();
    }

    private static String texto(String valor, String alternativa) {
        return valor == null || valor.trim().isEmpty() ? alternativa : valor;
    }
}
