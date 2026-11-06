package com.biblioscorza.app.ui;

import android.content.Context;
import android.text.InputType;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;

import com.biblioscorza.app.data.Models.LibroRegistrado;

public final class AgregarEjemplaresDialog {
    public interface Listener {
        void onConfirm(int cantidad, AlertDialog dialog);
    }

    private AgregarEjemplaresDialog() { }

    public static AlertDialog mostrar(Context context, LibroRegistrado libro, Listener listener) {
        LinearLayout contenido = new LinearLayout(context);
        contenido.setOrientation(LinearLayout.VERTICAL);
        int horizontal = dp(context, 24);
        contenido.setPadding(horizontal, dp(context, 8), horizontal, 0);

        TextView resumen = new TextView(context);
        resumen.setText(libro.titulo + "\nCantidad actual: " + valor(libro.total)
                + "\nDisponibles: " + valor(libro.disponibles));
        resumen.setTextSize(15);
        resumen.setTextColor(0xFF334155);
        contenido.addView(resumen, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        EditText cantidad = new EditText(context);
        cantidad.setInputType(InputType.TYPE_CLASS_NUMBER);
        cantidad.setSingleLine(true);
        cantidad.setHint("Cantidad que deseas agregar");
        cantidad.setContentDescription("Cantidad de ejemplares a agregar");
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        inputParams.topMargin = dp(context, 12);
        contenido.addView(cantidad, inputParams);

        TextView nota = new TextView(context);
        nota.setText("INDIVIDUAL".equals(libro.tipoControl)
                ? "Ingresa de 1 a 500. Se crearán ejemplares con códigos QR únicos."
                : "Ingresa de 1 a 500. La cantidad se sumará al stock disponible.");
        nota.setTextSize(12);
        nota.setTextColor(0xFF64748B);
        contenido.addView(nota);

        AlertDialog dialog = new AlertDialog.Builder(context)
                .setTitle("Agregar ejemplares")
                .setView(contenido)
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Confirmar", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(view -> {
                    String text = cantidad.getText().toString().trim();
                    int parsed;
                    try {
                        parsed = Integer.parseInt(text);
                    } catch (NumberFormatException e) {
                        cantidad.setError("Ingresa una cantidad válida");
                        return;
                    }
                    if (parsed < 1 || parsed > 500) {
                        cantidad.setError("Ingresa un número entre 1 y 500");
                        return;
                    }
                    listener.onConfirm(parsed, dialog);
                }));
        dialog.show();
        return dialog;
    }

    private static String valor(Integer value) {
        return value == null ? "0" : String.valueOf(value);
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
