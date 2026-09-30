package com.biblioscorza.app.ui;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.biblioscorza.app.R;
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Agregado;
import com.biblioscorza.app.data.Models.AgregarReq;
import com.biblioscorza.app.data.Models.Libro;
import com.biblioscorza.app.util.Api;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Escáner CameraX + ML Kit.
 *  - MODO_RAW (por defecto): devuelve el texto leído a quien lo llamó (EXTRA_VALOR).
 *  - MODO_RAPIDO: registro masivo de ISBN. Libro existente -> "Agregar otro ejemplar"; nuevo -> formulario.
 *    Después vuelve solo al escáner.
 */
@OptIn(markerClass = ExperimentalGetImage.class)
public class ScannerActivity extends AppCompatActivity {
    public static final String EXTRA_MODO = "modo", EXTRA_GUIA = "guia", EXTRA_VALOR = "valor";
    public static final String MODO_RAW = "RAW", MODO_RAPIDO = "RAPIDO";

    private final AtomicBoolean ocupado = new AtomicBoolean(false);
    private final Handler main = new Handler(Looper.getMainLooper());
    private ExecutorService executor;
    private BarcodeScanner scanner;
    private String modo;
    private PreviewView preview;

    private final ActivityResultLauncher<String> pedirPermiso =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), ok -> {
                if (ok) iniciarCamara();
                else { Toast.makeText(this, "Se necesita permiso de cámara para escanear", Toast.LENGTH_LONG).show(); finish(); }
            });

    private final ActivityResultLauncher<Intent> formulario =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> ocupado.set(false));

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_scanner);
        preview = findViewById(R.id.preview);
        modo = getIntent().getStringExtra(EXTRA_MODO) == null ? MODO_RAW : getIntent().getStringExtra(EXTRA_MODO);
        String guia = getIntent().getStringExtra(EXTRA_GUIA);
        ((TextView) findViewById(R.id.tvGuia)).setText(guia != null ? guia
                : MODO_RAPIDO.equals(modo) ? "Registro rápido: escanea el código de barras (ISBN) de cada libro"
                : "Apunta al código");
        executor = Executors.newSingleThreadExecutor();
        scanner = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_QR_CODE, Barcode.FORMAT_CODE_128)
                .build());
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) iniciarCamara();
        else pedirPermiso.launch(Manifest.permission.CAMERA);
    }

    private void iniciarCamara() {
        ListenableFuture<ProcessCameraProvider> f = ProcessCameraProvider.getInstance(this);
        f.addListener(() -> {
            try {
                ProcessCameraProvider provider = f.get();
                Preview p = new Preview.Builder().build();
                p.setSurfaceProvider(preview.getSurfaceProvider());
                ImageAnalysis analisis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
                analisis.setAnalyzer(executor, proxy -> {
                    if (proxy.getImage() == null) { proxy.close(); return; }
                    InputImage img = InputImage.fromMediaImage(proxy.getImage(), proxy.getImageInfo().getRotationDegrees());
                    scanner.process(img)
                            .addOnSuccessListener(lista -> {
                                for (Barcode bc : lista) {
                                    String raw = bc.getRawValue();
                                    if (raw != null && !raw.isEmpty() && ocupado.compareAndSet(false, true)) {
                                        main.post(() -> alLeer(raw.trim()));
                                        break;
                                    }
                                }
                            })
                            .addOnCompleteListener(t -> proxy.close());
                });
                provider.unbindAll();
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, p, analisis);
            } catch (Exception e) {
                Toast.makeText(this, "No se pudo iniciar la cámara", Toast.LENGTH_LONG).show();
                finish();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void alLeer(String valor) {
        if (MODO_RAW.equals(modo)) {
            setResult(RESULT_OK, new Intent().putExtra(EXTRA_VALOR, valor));
            finish();
            return;
        }
        String isbn = valor.replaceAll("[\\s-]", "");
        if (!isbn.matches("\\d{10,13}")) {
            Toast.makeText(this, "Eso no parece un ISBN. Escanea el código de barras del libro.", Toast.LENGTH_SHORT).show();
            main.postDelayed(() -> ocupado.set(false), 1500);
            return;
        }
        Api.call(ApiClient.api().libroPorIsbn(isbn), new Api.Result<Libro>() {
            @Override public void ok(Libro l, String m) { libroExistente(l); }
            @Override public void error(String msg, int http, String code) {
                if ("LIBRO_NO_ENCONTRADO".equals(code)) {
                    formulario.launch(new Intent(ScannerActivity.this, LibroFormActivity.class)
                            .putExtra("isbn", isbn).putExtra("rapido", true));
                } else {
                    Toast.makeText(ScannerActivity.this, msg, Toast.LENGTH_LONG).show();
                    main.postDelayed(() -> ocupado.set(false), 1500);
                }
            }
        });
    }

    private void libroExistente(Libro l) {
        new AlertDialog.Builder(this)
                .setTitle("Libro existente")
                .setMessage(l.titulo + "\n\nCantidad actual: " + l.total + "\nDisponibles: " + l.disponibles)
                .setCancelable(false)
                .setPositiveButton("Agregar otro ejemplar", (d, w) -> {
                    Api.call(ApiClient.api().agregarEjemplares(l.id, new AgregarReq()), new Api.Result<Agregado>() {
                        @Override public void ok(Agregado a, String m) {
                            String extra = a.codigos != null && !a.codigos.isEmpty() ? " (" + a.codigos.get(0) + ")" : "";
                            Toast.makeText(ScannerActivity.this, "Agregado. Total: " + a.libro.total + extra, Toast.LENGTH_LONG).show();
                            ocupado.set(false);
                        }
                        @Override public void error(String msg, int http, String code) {
                            Toast.makeText(ScannerActivity.this, msg, Toast.LENGTH_LONG).show();
                            ocupado.set(false);
                        }
                    });
                })
                .setNegativeButton("Seguir escaneando", (d, w) -> ocupado.set(false))
                .show();
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        if (executor != null) executor.shutdown();
        if (scanner != null) scanner.close();
    }
}
