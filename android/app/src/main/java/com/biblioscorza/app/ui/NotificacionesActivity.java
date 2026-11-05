package com.biblioscorza.app.ui;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Notificacion;
import com.biblioscorza.app.data.Models.NotificacionLeida;
import com.biblioscorza.app.data.Models.NotificacionLeidaReq;
import com.biblioscorza.app.data.Models.Notificaciones;
import com.biblioscorza.app.data.Models.NotificacionesLeidas;
import com.biblioscorza.app.util.Api;
import com.google.android.material.card.MaterialCardView;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class NotificacionesActivity extends AppCompatActivity {
    private static final int PAGE_SIZE = 100;

    private final List<Notificacion> notificaciones = new ArrayList<>();
    private ListView lista;
    private ProgressBar progreso;
    private TextView estado, resumen;
    private Button marcarTodas;
    private Adaptador adaptador;
    private int generacionCarga;
    private int noLeidas;
    private boolean cargando;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notificaciones);
        TopBarController.bind(this);
        findViewById(R.id.btnVolverCentro).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        lista = findViewById(R.id.listaNotificaciones);
        progreso = findViewById(R.id.progresoNotificaciones);
        estado = findViewById(R.id.tvEstadoNotificaciones);
        resumen = findViewById(R.id.tvResumenNotificaciones);
        marcarTodas = findViewById(R.id.btnMarcarTodasNotificaciones);
        adaptador = new Adaptador();
        lista.setAdapter(adaptador);
        lista.setOnItemClickListener((parent, view, position, id) -> abrirNotificacion(notificaciones.get(position)));
        marcarTodas.setOnClickListener(v -> marcarTodasLeidas());
        estado.setOnClickListener(v -> cargarTodas());
        cargarTodas();
    }

    void recargar() {
        if (!cargando) cargarTodas();
    }

    private void cargarTodas() {
        int generacion = ++generacionCarga;
        cargando = true;
        progreso.setVisibility(View.VISIBLE);
        estado.setVisibility(notificaciones.isEmpty() ? View.VISIBLE : View.GONE);
        estado.setText(notificaciones.isEmpty() ? "Cargando notificaciones…" : "Actualizando…");
        marcarTodas.setEnabled(false);
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        cargarPagina(1, generacion, ids, 0, 0);
    }

    private void cargarPagina(int pagina, int generacion, Set<Long> ids,
                              int totalEsperado, int noLeidasRespuesta) {
        Api.call(ApiClient.api().notificaciones(pagina, PAGE_SIZE), new Api.Result<Notificaciones>() {
            @Override public void ok(Notificaciones data, String message) {
                if (generacion != generacionCarga || isFinishing() || isDestroyed()) return;
                if (data == null || data.items == null) {
                    fallarCarga(generacion, "El servidor devolvió notificaciones incompletas.");
                    return;
                }
                int totalDeRespuesta = totalEsperado;
                int noLeidasDeRespuesta = noLeidasRespuesta;
                if (pagina == 1) {
                    notificaciones.clear();
                    totalDeRespuesta = data.total;
                    noLeidasDeRespuesta = data.noLeidas;
                    ids.clear();
                }
                for (Notificacion notificacion : data.items) {
                    if (notificacion != null && ids.add(notificacion.id)) notificaciones.add(notificacion);
                }
                int ultimaPaginaEsperada = Math.max(1,
                        (totalDeRespuesta + PAGE_SIZE - 1) / PAGE_SIZE);
                if (pagina < ultimaPaginaEsperada && !data.items.isEmpty()) {
                    cargarPagina(pagina + 1, generacion, ids, totalDeRespuesta,
                            noLeidasDeRespuesta);
                    return;
                }
                if (notificaciones.size() < totalDeRespuesta) {
                    fallarCarga(generacion, "No se pudieron recuperar todas las páginas de notificaciones.");
                    return;
                }
                finalizarCarga(generacion, noLeidasDeRespuesta);
            }

            @Override public void error(String msg, int http, String code) {
                if (generacion != generacionCarga || isFinishing() || isDestroyed()) return;
                fallarCarga(generacion, http == 403
                        ? "Tu perfil no tiene permiso para consultar notificaciones."
                        : "No se pudieron cargar las notificaciones: " + msg);
            }
        });
    }

    private void finalizarCarga(int generacion, int noLeidasRespuesta) {
        if (generacion != generacionCarga) return;
        cargando = false;
        noLeidas = noLeidasRespuesta;
        progreso.setVisibility(View.GONE);
        resumen.setText(notificaciones.size() + " notificación(es) · " + noLeidas + " sin leer");
        marcarTodas.setVisibility(noLeidas > 0 ? View.VISIBLE : View.GONE);
        marcarTodas.setEnabled(true);
        estado.setVisibility(notificaciones.isEmpty() ? View.VISIBLE : View.GONE);
        estado.setText(notificaciones.isEmpty()
                ? "No tienes notificaciones por ahora.\nToca aquí para actualizar."
                : "");
        lista.setVisibility(notificaciones.isEmpty() ? View.GONE : View.VISIBLE);
        adaptador.notifyDataSetChanged();
        TopBarController.actualizarContador(this, noLeidas);
    }

    private void fallarCarga(int generacion, String mensaje) {
        if (generacion != generacionCarga) return;
        cargando = false;
        progreso.setVisibility(View.GONE);
        estado.setVisibility(View.VISIBLE);
        estado.setText(mensaje + "\nToca aquí para reintentar.");
        if (notificaciones.isEmpty()) lista.setVisibility(View.GONE);
        marcarTodas.setEnabled(true);
    }

    private void abrirNotificacion(Notificacion notificacion) {
        TextView contenido = new TextView(this);
        contenido.setText(notificacion.mensaje == null || notificacion.mensaje.trim().isEmpty()
                ? "Sin descripción disponible." : notificacion.mensaje);
        contenido.setTextColor(Color.parseColor("#334B5E"));
        contenido.setTextSize(15);
        int padding = dp(20);
        contenido.setPadding(padding, dp(14), padding, dp(8));

        AlertDialog.Builder dialogo = new AlertDialog.Builder(this)
                .setTitle(notificacion.titulo == null ? "Notificación" : notificacion.titulo)
                .setView(contenido)
                .setNegativeButton("Cerrar", null);
        if (notificacion.leidaEn == null) {
            dialogo.setPositiveButton("Marcar como leída", (d, which) -> marcarLeida(notificacion));
        }
        if (enlaceAdmitido(notificacion.enlace)) {
            dialogo.setNeutralButton("Abrir sección", (d, which) -> abrirEnlace(notificacion.enlace));
        }
        AlertDialog alerta = dialogo.create();
        alerta.show();
        if (alerta.getButton(AlertDialog.BUTTON_POSITIVE) != null) {
            alerta.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.parseColor("#087F8C"));
        }
        if (alerta.getButton(AlertDialog.BUTTON_NEUTRAL) != null) {
            alerta.getButton(AlertDialog.BUTTON_NEUTRAL).setTextColor(Color.parseColor("#2563EB"));
        }
    }

    private void marcarLeida(Notificacion notificacion) {
        Api.call(ApiClient.api().marcarNotificacionLeida(
                notificacion.id, new NotificacionLeidaReq()), new Api.Result<NotificacionLeida>() {
            @Override public void ok(NotificacionLeida data, String message) {
                notificacion.leidaEn = data == null || data.leidaEn == null ? "leída" : data.leidaEn;
                noLeidas = Math.max(0, noLeidas - 1);
                resumen.setText(notificaciones.size() + " notificación(es) · " + noLeidas + " sin leer");
                TopBarController.actualizarContador(NotificacionesActivity.this, noLeidas);
                adaptador.notifyDataSetChanged();
                cargarTodas();
            }

            @Override public void error(String msg, int http, String code) {
                Toast.makeText(NotificacionesActivity.this,
                        "No se pudo marcar la notificación: " + msg, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void marcarTodasLeidas() {
        marcarTodas.setEnabled(false);
        Api.call(ApiClient.api().marcarTodasNotificacionesLeidas(),
                new Api.Result<NotificacionesLeidas>() {
                    @Override public void ok(NotificacionesLeidas data, String message) {
                        noLeidas = 0;
                        resumen.setText(notificaciones.size() + " notificación(es) · 0 sin leer");
                        TopBarController.actualizarContador(NotificacionesActivity.this, 0);
                        Toast.makeText(NotificacionesActivity.this,
                                data == null ? "Notificaciones actualizadas."
                                        : data.actualizadas + " notificación(es) marcada(s) como leída(s).",
                                Toast.LENGTH_LONG).show();
                        cargarTodas();
                    }

                    @Override public void error(String msg, int http, String code) {
                        marcarTodas.setEnabled(true);
                        Toast.makeText(NotificacionesActivity.this,
                                "No se pudieron marcar las notificaciones: " + msg,
                                Toast.LENGTH_LONG).show();
                    }
                });
    }

    private boolean enlaceAdmitido(String enlace) {
        return "/prestamos".equals(enlace) || "/devoluciones".equals(enlace)
                || (enlace != null && enlace.startsWith("/libros"));
    }

    private void abrirEnlace(String enlace) {
        Class<?> destino = "/prestamos".equals(enlace) ? PrestamoActivity.class
                : "/devoluciones".equals(enlace) ? DevolucionActivity.class
                : BuscarActivity.class;
        startActivity(new android.content.Intent(this, destino));
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private int colorTipo(String tipo) {
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

    private String simboloTipo(String tipo) {
        if ("VENCIDO".equals(tipo)) return "!";
        if ("POR_VENCER".equals(tipo)) return "◷";
        if ("PRESTAMO".equals(tipo)) return "+";
        if ("DEVOLUCION".equals(tipo)) return "✓";
        return "★";
    }

    private String fecha(String valor) {
        if (valor == null || valor.length() < 10) return "";
        try {
            Date parsed = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).parse(valor.substring(0, 10));
            return parsed == null ? valor : new SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(parsed);
        } catch (ParseException e) {
            return valor;
        }
    }

    private GradientDrawable fondo(int color, int radio) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radio));
        return drawable;
    }

    private final class Adaptador extends BaseAdapter {
        @Override public int getCount() { return notificaciones.size(); }
        @Override public Notificacion getItem(int position) { return notificaciones.get(position); }
        @Override public long getItemId(int position) { return getItem(position).id; }

        @Override public View getView(int position, View convertView, ViewGroup parent) {
            View fila = convertView == null
                    ? LayoutInflater.from(NotificacionesActivity.this)
                    .inflate(R.layout.row_notificacion, parent, false)
                    : convertView;
            Notificacion notificacion = getItem(position);
            boolean noLeida = notificacion.leidaEn == null;
            int acento = colorTipo(notificacion.tipo);
            MaterialCardView tarjeta = fila.findViewById(R.id.cardNotificacion);
            tarjeta.setCardBackgroundColor(Color.parseColor(noLeida ? "#F0F9FF" : "#FFFFFF"));
            tarjeta.setStrokeColor(Color.parseColor(noLeida ? "#BAE6FD" : "#E2E8F0"));
            TextView icono = fila.findViewById(R.id.tvIconoNotificacion);
            icono.setText(simboloTipo(notificacion.tipo));
            icono.setBackground(fondo(acento, 14));
            TextView tipo = fila.findViewById(R.id.tvTipoNotificacion);
            tipo.setText(etiquetaTipo(notificacion.tipo));
            tipo.setTextColor(acento);
            ((TextView) fila.findViewById(R.id.tvTituloNotificacion))
                    .setText(notificacion.titulo == null ? "Notificación" : notificacion.titulo);
            TextView mensaje = fila.findViewById(R.id.tvMensajeNotificacion);
            mensaje.setText(notificacion.mensaje == null ? "" : notificacion.mensaje);
            mensaje.setVisibility(TextUtils.isEmpty(notificacion.mensaje) ? View.GONE : View.VISIBLE);
            ((TextView) fila.findViewById(R.id.tvFechaNotificacion))
                    .setText(fecha(notificacion.creadaEn));
            TextView estadoItem = fila.findViewById(R.id.tvEstadoNotificacion);
            estadoItem.setText(noLeida ? "NUEVA" : "LEÍDA");
            estadoItem.setTextColor(noLeida ? Color.WHITE : Color.parseColor("#64748B"));
            estadoItem.setBackground(fondo(noLeida ? acento : Color.parseColor("#E2E8F0"), 20));
            tarjeta.setContentDescription(notificacion.titulo + ", "
                    + (noLeida ? "sin leer" : "leída") + ". Toca para abrir.");
            return fila;
        }
    }
}
