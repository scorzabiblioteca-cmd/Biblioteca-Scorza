package com.biblioscorza.app.ui;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.biblioscorza.app.R;
import com.biblioscorza.app.util.ScannedCode;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Escáner compartido CameraX + ML Kit. Las operaciones corresponden a la actividad invocadora.
 */
@OptIn(markerClass = ExperimentalGetImage.class)
public class ScannerActivity extends AppCompatActivity {
    private static final String TAG = "ScannerActivity";
    public static final String EXTRA_CONTEXTO = "contexto", EXTRA_GUIA = "guia";
    public static final String EXTRA_VALOR = "valor", EXTRA_TIPO = "tipo";
    public static final String CONTEXTO_REGISTRO_LIBRO = "REGISTRO_LIBRO";
    public static final String CONTEXTO_BUSQUEDA_LIBRO = "BUSQUEDA_LIBRO";
    public static final String CONTEXTO_PRESTAMO = "PRESTAMO";
    public static final String CONTEXTO_DEVOLUCION = "DEVOLUCION";

    private final AtomicBoolean ocupado = new AtomicBoolean(false);
    private final AtomicReference<String> codigoEnfocado = new AtomicReference<>();
    private final AtomicLong ultimaDeteccion = new AtomicLong();
    private final Handler main = new Handler(Looper.getMainLooper());
    private ExecutorService executor;
    private BarcodeScanner scanner;
    private String contexto, textoGuia;
    private PreviewView preview;
    private View marcoEscaneo;
    private TextView tvGuia;
    private Button btnLinterna, btnReintentar;
    private ProcessCameraProvider cameraProvider;
    private Camera camera;
    private boolean camaraIniciada, iniciandoCamara, linternaEncendida;

    private final ActivityResultLauncher<String> pedirPermiso =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
                if (concedido) iniciarCamara();
                else mostrarErrorCamara("Se necesita permiso de cámara. Puedes concederlo e intentarlo de nuevo.");
            });

    public static Intent crearIntent(Context context, String contexto, String guia) {
        return new Intent(context, ScannerActivity.class)
                .putExtra(EXTRA_CONTEXTO, contexto)
                .putExtra(EXTRA_GUIA, guia);
    }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_scanner);
        TopBarController.bind(this);
        preview = findViewById(R.id.preview);
        marcoEscaneo = findViewById(R.id.marcoEscaneo);
        tvGuia = findViewById(R.id.tvGuia);
        btnLinterna = findViewById(R.id.btnLinterna);
        btnReintentar = findViewById(R.id.btnReintentar);
        findViewById(R.id.btnCerrar).setOnClickListener(v -> finish());
        contexto = getIntent().getStringExtra(EXTRA_CONTEXTO);
        if (contexto == null) contexto = CONTEXTO_BUSQUEDA_LIBRO;
        String guia = getIntent().getStringExtra(EXTRA_GUIA);
        textoGuia = guia != null ? guia : "Apunta al código para escanearlo";
        tvGuia.setText(textoGuia);

        executor = Executors.newSingleThreadExecutor();
        scanner = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_QR_CODE, Barcode.FORMAT_CODE_128, Barcode.FORMAT_UPC_A)
                .build());
        findViewById(R.id.btnVolver).setVisibility(View.VISIBLE);
        findViewById(R.id.btnVolver).setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        btnLinterna.setOnClickListener(v -> alternarLinterna());
        btnReintentar.setOnClickListener(v -> reintentarCamara());
        preview.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) enfocar(event.getX(), event.getY());
            return true;
        });

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            iniciarCamara();
        } else {
            tvGuia.setText("Permite el acceso a la cámara para escanear códigos.");
            pedirPermiso.launch(Manifest.permission.CAMERA);
        }
    }

    private void iniciarCamara() {
        if (camaraIniciada || iniciandoCamara || isFinishing() || isDestroyed()) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            mostrarErrorCamara("Se necesita permiso de cámara para escanear.");
            return;
        }
        iniciandoCamara = true;
        btnReintentar.setVisibility(View.GONE);
        tvGuia.setText(textoGuia);
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                if (isFinishing() || isDestroyed()) return;
                ProcessCameraProvider provider = future.get();
                Preview vistaPrevia = new Preview.Builder().build();
                vistaPrevia.setSurfaceProvider(preview.getSurfaceProvider());
                ImageAnalysis analisis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
                analisis.setAnalyzer(executor, this::analizarImagen);
                provider.unbindAll();
                cameraProvider = provider;
                camera = provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, vistaPrevia, analisis);
                camaraIniciada = true;
                iniciandoCamara = false;
                actualizarControlLinterna();
                preview.post(() -> enfocar(preview.getWidth() / 2f, preview.getHeight() / 2f));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                mostrarErrorCamara("Se interrumpió el inicio de la cámara.");
                Log.e(TAG, "Camera initialization was interrupted", e);
            } catch (ExecutionException | IllegalStateException | IllegalArgumentException | SecurityException e) {
                mostrarErrorCamara("No se pudo abrir la cámara. Comprueba los permisos y que otra aplicación no la esté usando.");
                Log.e(TAG, "Camera initialization failed", e);
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void analizarImagen(ImageProxy proxy) {
        if (proxy.getImage() == null) {
            proxy.close();
            return;
        }
        try {
            InputImage image = InputImage.fromMediaImage(proxy.getImage(), proxy.getImageInfo().getRotationDegrees());
            scanner.process(image)
                    .addOnSuccessListener(this::procesarCodigos)
                    .addOnFailureListener(error -> Log.w(TAG, "Barcode analysis failed", error))
                    .addOnCompleteListener(task -> proxy.close());
        } catch (IllegalArgumentException | IllegalStateException e) {
            proxy.close();
            Log.w(TAG, "Could not analyze camera frame", e);
        }
    }

    private void procesarCodigos(List<Barcode> codigos) {
        if (isFinishing() || isDestroyed()) return;
        Barcode detectado = null;
        for (Barcode barcode : codigos) {
            String raw = barcode.getRawValue();
            if (raw != null && !raw.trim().isEmpty()) {
                detectado = barcode;
                break;
            }
        }
        long ahora = SystemClock.elapsedRealtime();
        if (detectado == null) {
            if (ahora - ultimaDeteccion.get() > 900) codigoEnfocado.set(null);
            return;
        }
        String valor = detectado.getRawValue().trim();
        String anterior = codigoEnfocado.getAndSet(valor);
        ultimaDeteccion.set(ahora);
        boolean nuevoCodigo = !valor.equals(anterior);
        if (nuevoCodigo && ocupado.compareAndSet(false, true)) {
            String leido = valor;
            int formato = detectado.getFormat();
            main.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                marcoEscaneo.setBackgroundResource(R.drawable.scanner_frame_detected);
                tvGuia.setText("Código detectado. Procesando…");
                alLeer(leido, formato);
            });
        }
    }

    private void enfocar(float x, float y) {
        if (camera == null || preview.getWidth() <= 0 || preview.getHeight() <= 0) return;
        MeteringPoint point = preview.getMeteringPointFactory().createPoint(x, y);
        FocusMeteringAction action = new FocusMeteringAction.Builder(
                point, FocusMeteringAction.FLAG_AF | FocusMeteringAction.FLAG_AE)
                .setAutoCancelDuration(3, TimeUnit.SECONDS)
                .build();
        ListenableFuture<androidx.camera.core.FocusMeteringResult> focus = camera.getCameraControl().startFocusAndMetering(action);
        focus.addListener(() -> {
            try {
                focus.get();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Log.w(TAG, "Focus action was interrupted", e);
            } catch (ExecutionException e) {
                Log.w(TAG, "Camera could not focus at the selected point", e);
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void alternarLinterna() {
        if (camera == null || !camera.getCameraInfo().hasFlashUnit()) {
            Toast.makeText(this, "Este dispositivo no tiene linterna disponible.", Toast.LENGTH_SHORT).show();
            return;
        }
        boolean activar = !linternaEncendida;
        ListenableFuture<Void> future = camera.getCameraControl().enableTorch(activar);
        future.addListener(() -> {
            try {
                future.get();
                if (isFinishing() || isDestroyed()) return;
                linternaEncendida = activar;
                btnLinterna.setText(linternaEncendida ? "Apagar linterna" : "Linterna");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Toast.makeText(this, "No se pudo cambiar la linterna.", Toast.LENGTH_SHORT).show();
            } catch (ExecutionException e) {
                Log.w(TAG, "Torch could not be changed", e);
                Toast.makeText(this, "No se pudo cambiar la linterna.", Toast.LENGTH_SHORT).show();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    @Override protected void onPause() {
        if (linternaEncendida && camera != null) {
            camera.getCameraControl().enableTorch(false);
            linternaEncendida = false;
            btnLinterna.setText("Linterna");
        }
        super.onPause();
    }

    private void actualizarControlLinterna() {
        boolean disponible = camera != null && camera.getCameraInfo().hasFlashUnit();
        btnLinterna.setEnabled(disponible);
        btnLinterna.setText(disponible ? "Linterna" : "Sin linterna");
    }

    private void reintentarCamara() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            pedirPermiso.launch(Manifest.permission.CAMERA);
        } else {
            iniciarCamara();
        }
    }

    private void mostrarErrorCamara(String mensaje) {
        if (isFinishing() || isDestroyed()) return;
        iniciandoCamara = false;
        tvGuia.setText(mensaje);
        btnReintentar.setVisibility(View.VISIBLE);
        actualizarControlLinterna();
    }

    private void alLeer(String valor, int formato) {
        String tipo = ScannedCode.clasificar(formato, valor);
        tvGuia.setText("Lectura exitosa: " + tipo);
        main.postDelayed(() -> {
            if (isFinishing() || isDestroyed()) return;
            setResult(RESULT_OK, new Intent()
                    .putExtra(EXTRA_VALOR, valor)
                    .putExtra(EXTRA_TIPO, tipo)
                    .putExtra(EXTRA_CONTEXTO, contexto));
            finish();
        }, 450);
    }

    @Override protected void onDestroy() {
        if (cameraProvider != null) cameraProvider.unbindAll();
        if (scanner != null) scanner.close();
        if (executor != null) executor.shutdownNow();
        main.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
