package com.biblioscorza.app.ui;

import android.Manifest;
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
import androidx.appcompat.app.AlertDialog;
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
import com.biblioscorza.app.data.ApiClient;
import com.biblioscorza.app.data.Models.Agregado;
import com.biblioscorza.app.data.Models.AgregarReq;
import com.biblioscorza.app.data.Models.ConsultaIsbn;
import com.biblioscorza.app.data.Models.LibroDatos;
import com.biblioscorza.app.data.Models.LibroRegistrado;
import com.biblioscorza.app.util.Api;
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
 * Escáner CameraX + ML Kit.
 * MODO_RAW devuelve el código a quien lo llamó; MODO_RAPIDO conserva el registro de ISBN.
 */
@OptIn(markerClass = ExperimentalGetImage.class)
public class ScannerActivity extends AppCompatActivity {
    private static final String TAG = "ScannerActivity";
    public static final String EXTRA_MODO = "modo", EXTRA_GUIA = "guia", EXTRA_VALOR = "valor";
    public static final String MODO_RAW = "RAW", MODO_RAPIDO = "RAPIDO";

    private final AtomicBoolean ocupado = new AtomicBoolean(false);
    private final AtomicReference<String> codigoEnfocado = new AtomicReference<>();
    private final AtomicLong ultimaDeteccion = new AtomicLong();
    private final Handler main = new Handler(Looper.getMainLooper());
    private ExecutorService executor;
    private BarcodeScanner scanner;
    private String modo, textoGuia;
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

    private final ActivityResultLauncher<Intent> formulario =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> liberarEscaner());

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_scanner);
        preview = findViewById(R.id.preview);
        marcoEscaneo = findViewById(R.id.marcoEscaneo);
        tvGuia = findViewById(R.id.tvGuia);
        btnLinterna = findViewById(R.id.btnLinterna);
        btnReintentar = findViewById(R.id.btnReintentar);
        modo = getIntent().getStringExtra(EXTRA_MODO);
        if (modo == null) modo = MODO_RAW;
        String guia = getIntent().getStringExtra(EXTRA_GUIA);
        textoGuia = guia != null ? guia
                : MODO_RAPIDO.equals(modo) ? "Registro rápido: escanea el código de barras (ISBN) de cada libro"
                : "Apunta al código para escanearlo";
        tvGuia.setText(textoGuia);

        executor = Executors.newSingleThreadExecutor();
        scanner = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_QR_CODE, Barcode.FORMAT_CODE_128)
                .build());
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
        String valor = null;
        for (Barcode barcode : codigos) {
            String raw = barcode.getRawValue();
            if (raw != null && !raw.trim().isEmpty()) {
                valor = raw.trim();
                break;
            }
        }
        long ahora = SystemClock.elapsedRealtime();
        if (valor == null) {
            if (ahora - ultimaDeteccion.get() > 900) codigoEnfocado.set(null);
            return;
        }
        String anterior = codigoEnfocado.getAndSet(valor);
        long vistoAntes = ultimaDeteccion.getAndSet(ahora);
        boolean nuevoCodigo = !valor.equals(anterior) || ahora - vistoAntes > 900;
        if (nuevoCodigo && ocupado.compareAndSet(false, true)) {
            String leido = valor;
            main.post(() -> {
                if (isFinishing() || isDestroyed()) return;
                marcoEscaneo.setBackgroundResource(R.drawable.scanner_frame_detected);
                tvGuia.setText("Código detectado. Procesando…");
                alLeer(leido);
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

    private void liberarEscaner() {
        ocupado.set(false);
        if (!isFinishing() && !isDestroyed()) {
            marcoEscaneo.setBackgroundResource(R.drawable.scanner_frame);
            tvGuia.setText(textoGuia);
        }
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
            main.postDelayed(this::liberarEscaner, 1500);
            return;
        }
        Api.call(ApiClient.api().libroPorIsbn(isbn), new Api.Result<ConsultaIsbn>() {
            @Override public void ok(ConsultaIsbn consulta, String message) {
                if (isFinishing() || isDestroyed()) return;
                if (consulta == null) {
                    mostrarErrorConsulta(isbn, "El servidor devolvió una respuesta incompleta.");
                } else if (consulta.existente != null) {
                    libroExistente(consulta.existente);
                } else {
                    libroNoRegistrado(isbn, consulta.libro, consulta.estadoConsulta);
                }
            }
            @Override public void error(String msg, int http, String code) {
                if (isFinishing() || isDestroyed()) return;
                mostrarErrorConsulta(isbn, http == 0
                        ? "No hay conexión con el servidor. Revisa tu internet."
                        : "No se pudo consultar el ISBN. " + msg);
            }
        });
    }

    private void mostrarErrorConsulta(String isbn, String mensaje) {
        new AlertDialog.Builder(this)
                .setTitle("No se pudo consultar")
                .setMessage(mensaje)
                .setPositiveButton("Reintentar", (d, w) -> alLeer(isbn))
                .setNegativeButton("Cerrar", (d, w) -> liberarEscaner())
                .setOnCancelListener(d -> liberarEscaner())
                .show();
    }

    private void libroNoRegistrado(String isbn, LibroDatos datos, String estadoConsulta) {
        String mensaje = "Este ISBN todavía no está registrado en la biblioteca.";
        if (datos != null) mensaje += "\n\nSe encontraron datos bibliográficos que puedes revisar antes de guardarlo.";
        else if ("no-disponible".equals(estadoConsulta)) {
            mensaje += "\nEl servicio de datos bibliográficos no está disponible; podrás completar el formulario manualmente.";
        }
        new AlertDialog.Builder(this)
                .setTitle("ISBN no registrado")
                .setMessage(mensaje)
                .setPositiveButton("Continuar al registro", (d, w) -> abrirFormulario(isbn, datos))
                .setNegativeButton("Seguir escaneando", (d, w) -> liberarEscaner())
                .setOnCancelListener(d -> liberarEscaner())
                .show();
    }

    private void abrirFormulario(String isbn, LibroDatos datos) {
        Intent intent = new Intent(this, LibroFormActivity.class)
                .putExtra("isbn", isbn)
                .putExtra("rapido", true);
        if (datos != null) {
            if (datos.titulo != null) intent.putExtra("titulo", datos.titulo);
            if (datos.subtitulo != null) intent.putExtra("subtitulo", datos.subtitulo);
            if (datos.autor != null) intent.putExtra("autor", datos.autor);
            if (datos.editorial != null) intent.putExtra("editorial", datos.editorial);
            if (datos.categoria != null) intent.putExtra("categoria", datos.categoria);
            if (datos.anioPublicacion != null) intent.putExtra("anioPublicacion", datos.anioPublicacion);
            if (datos.edicion != null) intent.putExtra("edicion", datos.edicion);
            if (datos.descripcion != null) intent.putExtra("descripcion", datos.descripcion);
            if (datos.imagenUrl != null) intent.putExtra("imagenUrl", datos.imagenUrl);
        }
        formulario.launch(intent);
    }

    private void libroExistente(LibroRegistrado libro) {
        View contenido = LibroDetalleDialog.contenido(this, libro);
        new AlertDialog.Builder(this)
                .setTitle("Ficha del libro")
                .setView(contenido)
                .setPositiveButton("Agregar ejemplar", (d, w) -> {
                    AgregarReq solicitud = new AgregarReq();
                    Api.call(ApiClient.api().agregarEjemplares(libro.id, solicitud), new Api.Result<Agregado>() {
                        @Override public void ok(Agregado agregado, String message) {
                            if (isFinishing() || isDestroyed()) return;
                            String texto = "Ejemplar agregado";
                            if (agregado != null && agregado.libro != null && agregado.libro.total != null) {
                                texto += ". Total: " + agregado.libro.total;
                            }
                            if (agregado != null && agregado.codigos != null && !agregado.codigos.isEmpty()) {
                                texto += " (" + agregado.codigos.get(0) + ")";
                            }
                            Toast.makeText(ScannerActivity.this, texto, Toast.LENGTH_LONG).show();
                            liberarEscaner();
                        }
                        @Override public void error(String msg, int http, String code) {
                            if (isFinishing() || isDestroyed()) return;
                            Toast.makeText(ScannerActivity.this, msg, Toast.LENGTH_LONG).show();
                            liberarEscaner();
                        }
                    });
                })
                .setNegativeButton("Cerrar", (d, w) -> liberarEscaner())
                .setOnCancelListener(d -> liberarEscaner())
                .show();
    }

    @Override protected void onDestroy() {
        if (cameraProvider != null) cameraProvider.unbindAll();
        if (scanner != null) scanner.close();
        if (executor != null) executor.shutdownNow();
        main.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
