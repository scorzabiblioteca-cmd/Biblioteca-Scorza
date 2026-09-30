package com.biblioscorza.app.util;

import android.graphics.Bitmap;
import android.graphics.Color;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;

import java.util.EnumMap;
import java.util.Map;

public final class QrGenerator {
    /** El contenido del QR es SOLO el código interno (p. ej. LIB-000145). */
    public static Bitmap generar(String contenido, int tam) throws WriterException {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix m = new MultiFormatWriter().encode(contenido, BarcodeFormat.QR_CODE, tam, tam, hints);
        int[] px = new int[tam * tam];
        for (int y = 0; y < tam; y++)
            for (int x = 0; x < tam; x++) px[y * tam + x] = m.get(x, y) ? Color.BLACK : Color.WHITE;
        Bitmap bmp = Bitmap.createBitmap(tam, tam, Bitmap.Config.ARGB_8888);
        bmp.setPixels(px, 0, tam, 0, 0, tam, tam);
        return bmp;
    }
}
