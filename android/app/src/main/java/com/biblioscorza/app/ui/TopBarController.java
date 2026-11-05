package com.biblioscorza.app.ui;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Notificacion;
import com.biblioscorza.app.data.Models.NotificacionLeida;
import com.biblioscorza.app.data.Models.NotificacionLeidaReq;
import com.biblioscorza.app.data.Models.Notificaciones;
import com.biblioscorza.app.data.Models.NotificacionesLeidas;
import com.biblioscorza.app.data.Models.Perfil;
import com.biblioscorza.app.data.TokenStore;
import com.biblioscorza.app.util.Api;

import java.util.List;
import java.util.ArrayList;

final class TopBarController {
    private final Activity activity;
    private final TextView avatar;
    private final TextView badge;
    private final View notificationsButton;

    private TopBarController(Activity activity) {
        this.activity = activity;
        avatar = activity.findViewById(R.id.btnPerfil);
        badge = activity.findViewById(R.id.tvNotificaciones);
        notificationsButton = activity.findViewById(R.id.btnNotificaciones);
        bind();
    }

    static void bind(Activity activity) {
        new TopBarController(activity);
    }

    private void bind() {
        String nombre = TokenStore.usuario(activity);
        avatar.setText(iniciales(nombre));
        avatar.setContentDescription("Perfil de " + (nombre.isEmpty() ? "usuario" : nombre));
        avatar.setOnClickListener(v -> cargarPerfil());
        notificationsButton.setOnClickListener(v -> cargarNotificaciones(true));
        cargarNotificaciones(false);
    }

    private void cargarNotificaciones(boolean mostrarLista) {
        Api.call(ApiClient.api().notificaciones(1, 20), new Api.Result<Notificaciones>() {
            @Override public void ok(Notificaciones data, String message) {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (data == null || data.items == null) {
                    if (mostrarLista) aviso("El servidor devolvió notificaciones incompletas.");
                    return;
                }
                actualizarBadge(data.noLeidas);
                if (mostrarLista) mostrarNotificaciones(data.items, data.noLeidas, data.total, false);
            }

            @Override public void error(String msg, int http, String code) {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (mostrarLista) {
                    aviso(http == 403
                            ? "Las notificaciones están disponibles para el perfil bibliotecario."
                            : "No se pudieron cargar las notificaciones: " + msg);
                }
            }
        });
    }

    private void actualizarBadge(int noLeidas) {
        if (noLeidas <= 0) {
            badge.setVisibility(View.GONE);
            notificationsButton.setContentDescription("Notificaciones, ninguna sin leer");
            return;
        }
        badge.setText(noLeidas > 99 ? "99+" : String.valueOf(noLeidas));
        badge.setVisibility(View.VISIBLE);
        notificationsButton.setContentDescription("Notificaciones, " + noLeidas + " sin leer");
    }

    private void mostrarNotificaciones(List<Notificacion> notifications, int noLeidas,
                                       int total, boolean todas) {
        LinearLayout contenido = columna();
        contenido.setPadding(dp(18), dp(12), dp(18), dp(4));

        LinearLayout resumen = new LinearLayout(activity);
        resumen.setGravity(android.view.Gravity.CENTER_VERTICAL);
        resumen.setPadding(dp(16), dp(14), dp(16), dp(14));
        resumen.setBackground(degradado("#176078", "#178277", 20));
        TextView resumenTexto = textoVista(
                noLeidas == 0 ? "Todo al día" : noLeidas + " pendiente(s)",
                16, Color.WHITE, true);
        resumen.addView(resumenTexto, new LinearLayout.LayoutParams(0, -2, 1));
        TextView resumenIcono = textoVista(noLeidas == 0 ? "✓" : "!", 18, Color.WHITE, true);
        resumenIcono.setGravity(android.view.Gravity.CENTER);
        resumenIcono.setBackground(redondeado(noLeidas == 0 ? "#12A884" : "#EF6C45", 24));
        resumenIcono.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(38)));
        resumen.addView(resumenIcono);
        contenido.addView(resumen);

        TextView verTodas = null;
        if (!todas && total > notifications.size()) {
            verTodas = textoVista("Ver todas las notificaciones  →", 14, "#FFFFFF", true);
            verTodas.setGravity(android.view.Gravity.CENTER);
            verTodas.setPadding(dp(14), dp(13), dp(14), dp(13));
            verTodas.setBackground(ripple(degradado("#2563EB", "#7C3AED", 14), "#553B82F6"));
            verTodas.setClickable(true);
            verTodas.setFocusable(true);
            LinearLayout.LayoutParams todasParams = new LinearLayout.LayoutParams(-1, -2);
            todasParams.topMargin = dp(10);
            contenido.addView(verTodas, todasParams);
        }

        if (notifications.isEmpty()) {
            TextView vacio = textoVista("No tienes notificaciones por ahora.", 15, "#526A7D", false);
            vacio.setGravity(android.view.Gravity.CENTER);
            vacio.setPadding(dp(16), dp(28), dp(16), dp(28));
            contenido.addView(vacio);
        } else {
            ScrollView lista = new ScrollView(activity);
            lista.setFillViewport(false);
            LinearLayout items = columna();
            LinearLayout.LayoutParams listaParams = new LinearLayout.LayoutParams(-1, dp(360));
            listaParams.topMargin = dp(12);
            for (Notificacion notification : notifications) {
                items.addView(filaNotificacion(notification));
            }
            lista.addView(items);
            contenido.addView(lista, listaParams);
        }

        AlertDialog.Builder dialogo = new AlertDialog.Builder(activity)
                .setTitle("Notificaciones")
                .setView(contenido);
        if (noLeidas > 0) {
            dialogo.setNeutralButton("Marcar todas leídas", (dialog, which) -> marcarTodasLeidas());
        }
        AlertDialog alert = dialogo.setPositiveButton("Listo", null).create();
        alert.show();
        pintarBotones(alert);
        if (verTodas != null) {
            TextView action = verTodas;
            action.setOnClickListener(v -> {
                action.setEnabled(false);
                action.setText("Cargando notificaciones…");
                cargarTodasLasNotificaciones(action, alert);
            });
        }
    }

    private void cargarTodasLasNotificaciones(View action, AlertDialog dialogoActual) {
        int pageSize = 100;
        List<Notificacion> notifications = new ArrayList<>();
        Api.call(ApiClient.api().notificaciones(1, pageSize), new Api.Result<Notificaciones>() {
            @Override public void ok(Notificaciones data, String message) {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (data == null || data.items == null) {
                    restaurarAccionTodas(action);
                    aviso("El servidor devolvió notificaciones incompletas.");
                    return;
                }
                notifications.addAll(data.items);
                cargarPaginaNotificaciones(
                        2, pageSize, data.total, data.noLeidas, notifications, action, dialogoActual);
            }

            @Override public void error(String msg, int http, String code) {
                if (!activity.isFinishing() && !activity.isDestroyed()) {
                    restaurarAccionTodas(action);
                    aviso("No se pudieron cargar todas las notificaciones: " + msg);
                }
            }
        });
    }

    private void cargarPaginaNotificaciones(int pagina, int pageSize, int total, int noLeidas,
                                            List<Notificacion> acumuladas, View action,
                                            AlertDialog dialogoActual) {
        if (acumuladas.size() >= total) {
            dialogoActual.dismiss();
            mostrarNotificaciones(acumuladas, noLeidas, total, true);
            return;
        }
        Api.call(ApiClient.api().notificaciones(pagina, pageSize), new Api.Result<Notificaciones>() {
            @Override public void ok(Notificaciones data, String message) {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (data == null || data.items == null || data.items.isEmpty()) {
                    restaurarAccionTodas(action);
                    aviso("No se pudieron recuperar todas las páginas de notificaciones.");
                    return;
                }
                acumuladas.addAll(data.items);
                cargarPaginaNotificaciones(
                        pagina + 1, pageSize, total, noLeidas, acumuladas, action, dialogoActual);
            }

            @Override public void error(String msg, int http, String code) {
                if (!activity.isFinishing() && !activity.isDestroyed()) {
                    restaurarAccionTodas(action);
                    aviso("No se pudieron cargar todas las notificaciones: " + msg);
                }
            }
        });
    }

    private void restaurarAccionTodas(View action) {
        action.setEnabled(true);
        ((TextView) action).setText("Ver todas las notificaciones  →");
    }

    private View filaNotificacion(Notificacion notification) {
        int color = colorNotificacion(notification.tipo);
        LinearLayout tarjeta = new LinearLayout(activity);
        tarjeta.setGravity(android.view.Gravity.CENTER_VERTICAL);
        tarjeta.setOrientation(LinearLayout.HORIZONTAL);
        tarjeta.setPadding(dp(12), dp(12), dp(12), dp(12));
        tarjeta.setBackground(ripple(redondeado(notification.leidaEn == null ? "#F0F9FF" : "#F8FAFC", 16),
                "#DCEAF5"));
        tarjeta.setClickable(true);
        tarjeta.setFocusable(true);

        TextView icono = textoVista(simboloNotificacion(notification.tipo), 18, Color.WHITE, true);
        icono.setGravity(android.view.Gravity.CENTER);
        icono.setBackground(redondeado(color, 14));
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(44), dp(44));
        iconParams.setMarginEnd(dp(12));
        tarjeta.addView(icono, iconParams);

        LinearLayout textos = columna();
        LinearLayout.LayoutParams textosParams = new LinearLayout.LayoutParams(0, -2, 1);
        TextView tipo = textoVista(etiquetaTipo(notification.tipo), 10, color, true);
        textos.addView(tipo);
        TextView titulo = textoVista(texto(notification.titulo, "Notificación"), 15, "#17324D", true);
        titulo.setMaxLines(1);
        titulo.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams tituloParams = new LinearLayout.LayoutParams(-1, -2);
        tituloParams.topMargin = dp(3);
        textos.addView(titulo, tituloParams);
        TextView mensaje = textoVista(texto(notification.mensaje, "Ver detalles"), 12, "#526A7D", false);
        mensaje.setMaxLines(2);
        mensaje.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams mensajeParams = new LinearLayout.LayoutParams(-1, -2);
        mensajeParams.topMargin = dp(3);
        textos.addView(mensaje, mensajeParams);
        tarjeta.addView(textos, textosParams);

        TextView estado = textoVista(notification.leidaEn == null ? "NUEVA" : "LEÍDA",
                9, notification.leidaEn == null ? "#FFFFFF" : "#64748B", true);
        estado.setGravity(android.view.Gravity.CENTER);
        estado.setPadding(dp(7), dp(5), dp(7), dp(5));
        estado.setBackground(redondeado(
                notification.leidaEn == null ? color : Color.parseColor("#E2E8F0"), 20));
        LinearLayout.LayoutParams estadoParams = new LinearLayout.LayoutParams(-2, -2);
        estadoParams.setMarginStart(dp(8));
        tarjeta.addView(estado, estadoParams);

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
        cardParams.bottomMargin = dp(9);
        tarjeta.setOnClickListener(v -> mostrarDetalle(notification));
        tarjeta.setContentDescription(texto(notification.titulo, "Notificación") + ". "
                + (notification.leidaEn == null ? "Sin leer." : "Leída.") + " Abrir detalles.");
        tarjeta.setLayoutParams(cardParams);
        return tarjeta;
    }

    private void mostrarDetalle(Notificacion notification) {
        int color = colorNotificacion(notification.tipo);
        LinearLayout contenido = columna();
        contenido.setPadding(dp(20), dp(14), dp(20), dp(6));

        TextView etiqueta = textoVista(etiquetaTipo(notification.tipo), 11, color, true);
        contenido.addView(etiqueta);
        TextView mensaje = textoVista(texto(notification.mensaje, "Sin detalles disponibles."),
                15, "#334B5E", false);
        LinearLayout.LayoutParams mensajeParams = new LinearLayout.LayoutParams(-1, -2);
        mensajeParams.topMargin = dp(8);
        contenido.addView(mensaje, mensajeParams);
        TextView estado = textoVista(notification.leidaEn == null
                        ? "●  Pendiente de lectura" : "✓  Ya leída",
                12, notification.leidaEn == null ? "#C2410C" : "#0F766E", true);
        LinearLayout.LayoutParams estadoParams = new LinearLayout.LayoutParams(-1, -2);
        estadoParams.topMargin = dp(16);
        estado.setPadding(dp(12), dp(10), dp(12), dp(10));
        estado.setBackground(redondeado(notification.leidaEn == null ? "#FFF7ED" : "#ECFDF5", 12));
        contenido.addView(estado, estadoParams);

        AlertDialog.Builder dialogo = new AlertDialog.Builder(activity)
                .setTitle(texto(notification.titulo, "Notificación"))
                .setView(contenido);

        if (notification.leidaEn == null) {
            dialogo.setPositiveButton("Marcar leída", (dialog, which) -> marcarLeida(notification));
        }
        if (enlaceAdmitido(notification.enlace)) {
            dialogo.setNeutralButton("Abrir", (dialog, which) -> abrirEnlace(notification.enlace));
        }
        AlertDialog alert = dialogo.setNegativeButton("Volver", null).create();
        alert.show();
        pintarBotones(alert);
    }

    private void marcarLeida(Notificacion notification) {
        Api.call(ApiClient.api().marcarNotificacionLeida(
                notification.id, new NotificacionLeidaReq()), new Api.Result<NotificacionLeida>() {
            @Override public void ok(NotificacionLeida data, String message) {
                notification.leidaEn = data == null || data.leidaEn == null ? "leída" : data.leidaEn;
                cargarNotificaciones(false);
                aviso("Notificación marcada como leída.");
            }

            @Override public void error(String msg, int http, String code) {
                aviso("No se pudo actualizar la notificación: " + msg);
            }
        });
    }

    private void marcarTodasLeidas() {
        Api.call(ApiClient.api().marcarTodasNotificacionesLeidas(),
                new Api.Result<NotificacionesLeidas>() {
                    @Override public void ok(NotificacionesLeidas data, String message) {
                        actualizarBadge(0);
                        aviso(data == null || data.actualizadas == 0
                                ? "No había notificaciones pendientes."
                                : data.actualizadas + " notificación(es) marcada(s) como leída(s).");
                    }

                    @Override public void error(String msg, int http, String code) {
                        aviso("No se pudieron marcar las notificaciones: " + msg);
                    }
                });
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
        TextView inicial = textoVista(iniciales(nombre), 22, Color.WHITE, true);
        inicial.setGravity(android.view.Gravity.CENTER);
        inicial.setBackground(redondeado("#12A884", 50));
        cabecera.addView(inicial, new LinearLayout.LayoutParams(dp(58), dp(58)));
        LinearLayout datosNombre = columna();
        LinearLayout.LayoutParams nombreParams = new LinearLayout.LayoutParams(0, -2, 1);
        nombreParams.setMarginStart(dp(14));
        TextView nombreVista = textoVista(nombre, 18, Color.WHITE, true);
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

        AlertDialog alert = new AlertDialog.Builder(activity)
                .setView(contenido)
                .setNegativeButton("Cerrar sesión", (dialog, which) -> cerrarSesion())
                .setPositiveButton("Listo", null)
                .create();
        alert.show();
        pintarBotones(alert);
        alert.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(Color.parseColor("#DC2626"));
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

    private void pintarBotones(AlertDialog alert) {
        if (alert.getButton(AlertDialog.BUTTON_POSITIVE) != null) {
            alert.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.parseColor("#087F8C"));
        }
        if (alert.getButton(AlertDialog.BUTTON_NEUTRAL) != null) {
            alert.getButton(AlertDialog.BUTTON_NEUTRAL).setTextColor(Color.parseColor("#7C3AED"));
        }
        if (alert.getButton(AlertDialog.BUTTON_NEGATIVE) != null) {
            alert.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(Color.parseColor("#526A7D"));
        }
    }

    private LinearLayout columna() {
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private TextView textoVista(String text, int sizeSp, int color, boolean bold) {
        return textoVista(text, sizeSp, String.format("#%06X", 0xFFFFFF & color), bold);
    }

    private TextView textoVista(String text, int sizeSp, String color, boolean bold) {
        TextView view = new TextView(activity);
        view.setText(text);
        view.setTextColor(Color.parseColor(color));
        view.setTextSize(sizeSp);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private GradientDrawable redondeado(String color, int radiusDp) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.parseColor(color));
        shape.setCornerRadius(dp(radiusDp));
        return shape;
    }

    private GradientDrawable redondeado(int color, int radiusDp) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radiusDp));
        return shape;
    }

    private GradientDrawable degradado(String inicio, String fin, int radiusDp) {
        GradientDrawable shape = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.parseColor(inicio), Color.parseColor(fin)});
        shape.setCornerRadius(dp(radiusDp));
        return shape;
    }

    private RippleDrawable ripple(GradientDrawable background, String color) {
        return new RippleDrawable(ColorStateList.valueOf(Color.parseColor(color)), background, null);
    }

    private int dp(int value) {
        return (int) (value * activity.getResources().getDisplayMetrics().density + 0.5f);
    }

    private int colorNotificacion(String tipo) {
        if ("VENCIDO".equals(tipo)) return Color.parseColor("#DC2626");
        if ("POR_VENCER".equals(tipo)) return Color.parseColor("#EA580C");
        if ("PRESTAMO".equals(tipo)) return Color.parseColor("#2563EB");
        if ("DEVOLUCION".equals(tipo)) return Color.parseColor("#059669");
        return Color.parseColor("#7C3AED");
    }

    private String etiquetaTipo(String tipo) {
        if ("VENCIDO".equals(tipo)) return "PRÉSTAMO VENCIDO";
        if ("POR_VENCER".equals(tipo)) return "PRÓXIMO A VENCER";
        if ("PRESTAMO".equals(tipo)) return "PRÉSTAMO";
        if ("DEVOLUCION".equals(tipo)) return "DEVOLUCIÓN";
        if ("INVENTARIO".equals(tipo)) return "INVENTARIO";
        return "BIBLIOTECA";
    }

    private String simboloNotificacion(String tipo) {
        if ("VENCIDO".equals(tipo)) return "!";
        if ("POR_VENCER".equals(tipo)) return "◷";
        if ("PRESTAMO".equals(tipo)) return "+";
        if ("DEVOLUCION".equals(tipo)) return "✓";
        return "★";
    }

    private boolean enlaceAdmitido(String enlace) {
        return "/prestamos".equals(enlace) || "/devoluciones".equals(enlace)
                || (enlace != null && enlace.startsWith("/libros"));
    }

    private void abrirEnlace(String enlace) {
        Class<?> destino = "/prestamos".equals(enlace) ? PrestamoActivity.class
                : "/devoluciones".equals(enlace) ? DevolucionActivity.class
                : BuscarActivity.class;
        activity.startActivity(new Intent(activity, destino));
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
