package com.biblioscorza.app.util;

import com.google.mlkit.vision.barcode.common.Barcode;

import java.util.Locale;
import java.util.regex.Pattern;

public final class ScannedCode {
    public static final String TYPE_ISBN = "ISBN";
    public static final String TYPE_EJEMPLAR = "EJEMPLAR";
    public static final String TYPE_QR = "QR";
    public static final String TYPE_EAN8 = "EAN8";
    public static final String TYPE_INVALIDO = "INVALIDO";

    private static final Pattern CODIGO_EJEMPLAR = Pattern.compile("^(LIB|ESP)-\\d+$");

    private ScannedCode() { }

    public static String clasificar(int formato, String valor) {
        if (valor == null) return TYPE_INVALIDO;
        String normalizado = valor.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        if (formato == Barcode.FORMAT_QR_CODE) {
            return esCodigoEjemplar(valor) ? TYPE_EJEMPLAR : TYPE_QR;
        }
        if (formato == Barcode.FORMAT_EAN_8) return TYPE_EAN8;
        if (formato == Barcode.FORMAT_CODE_128 && esCodigoEjemplar(valor)) {
            return TYPE_EJEMPLAR;
        }
        if ((formato == Barcode.FORMAT_EAN_13 || formato == Barcode.FORMAT_CODE_128)
                && esIsbn(normalizado)) {
            return TYPE_ISBN;
        }
        return TYPE_INVALIDO;
    }

    public static boolean esCodigoEjemplar(String valor) {
        return valor != null && CODIGO_EJEMPLAR.matcher(valor.trim().toUpperCase(Locale.ROOT)).matches();
    }

    public static boolean esIsbn(String valor) {
        if (valor == null) return false;
        String isbn = valor.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        if (isbn.matches("\\d{13}")) {
            if (!isbn.startsWith("978") && !isbn.startsWith("979")) return false;
            int suma = 0;
            for (int i = 0; i < 12; i++) {
                suma += (isbn.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
            }
            return (10 - suma % 10) % 10 == isbn.charAt(12) - '0';
        }
        if (!isbn.matches("\\d{9}[\\dX]")) return false;
        int suma = 0;
        for (int i = 0; i < 10; i++) {
            int digito = isbn.charAt(i) == 'X' ? 10 : isbn.charAt(i) - '0';
            suma += digito * (10 - i);
        }
        return suma % 11 == 0;
    }
}
