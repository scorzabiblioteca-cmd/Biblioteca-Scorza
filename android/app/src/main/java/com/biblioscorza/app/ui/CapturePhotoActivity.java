package com.biblioscorza.app.ui;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.biblioscorza.app.R;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.util.concurrent.ExecutionException;

public class CapturePhotoActivity extends AppCompatActivity {
    public static final String EXTRA_PHOTO_PATH = "photo_path";
    private static final String TAG = "CapturePhotoActivity";

    private PreviewView preview;
    private Button captureButton;
    private TextView status;
    private ImageCapture imageCapture;
    private File captureFile;
    private boolean completed;

    private final ActivityResultLauncher<String> requestCameraPermission =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) startCamera();
                else showCameraError("Se necesita permiso de cámara para tomar la fotografía.");
            });

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_capture_photo);
        TopBarController.bind(this);

        preview = findViewById(R.id.photoPreview);
        captureButton = findViewById(R.id.btnTakePhoto);
        status = findViewById(R.id.tvPhotoStatus);
        View back = findViewById(R.id.btnVolver);
        back.setVisibility(View.VISIBLE);
        back.setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        captureButton.setOnClickListener(v -> capturePhoto());

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA);
        }
    }

    private void startCamera() {
        if (isFinishing() || isDestroyed()) return;
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();
                if (isFinishing() || isDestroyed()) return;

                int rotation = preview.getDisplay() == null
                        ? android.view.Surface.ROTATION_0 : preview.getDisplay().getRotation();
                Preview cameraPreview = new Preview.Builder().setTargetRotation(rotation).build();
                cameraPreview.setSurfaceProvider(preview.getSurfaceProvider());
                imageCapture = new ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                        .setTargetRotation(rotation)
                        .build();

                provider.unbindAll();
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA,
                        cameraPreview, imageCapture);
                captureButton.setEnabled(true);
                status.setText("Coloca el libro en el encuadre y toma la fotografía.");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Log.e(TAG, "Camera startup interrupted", e);
                showCameraError("Se interrumpió el inicio de la cámara.");
            } catch (ExecutionException | RuntimeException e) {
                Log.e(TAG, "Camera startup failed", e);
                showCameraError("No se pudo abrir la cámara.");
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void capturePhoto() {
        if (imageCapture == null || captureFile != null) return;
        File directory = new File(getCacheDir(), "fotos");
        if (!directory.exists() && !directory.mkdirs()) {
            showCameraError("No se pudo preparar el archivo de la fotografía.");
            return;
        }

        captureFile = new File(directory, "portada_" + System.currentTimeMillis() + ".jpg");
        captureButton.setEnabled(false);
        status.setText("Tomando fotografía…");
        ImageCapture.OutputFileOptions output =
                new ImageCapture.OutputFileOptions.Builder(captureFile).build();
        imageCapture.takePicture(output, ContextCompat.getMainExecutor(this),
                new ImageCapture.OnImageSavedCallback() {
                    @Override public void onImageSaved(ImageCapture.OutputFileResults result) {
                        if (isFinishing() || isDestroyed()) {
                            captureFile.delete();
                            return;
                        }
                        completed = true;
                        setResult(RESULT_OK, new Intent().putExtra(
                                EXTRA_PHOTO_PATH, captureFile.getAbsolutePath()));
                        finish();
                    }

                    @Override public void onError(ImageCaptureException exception) {
                        Log.e(TAG, "Photo capture failed", exception);
                        if (captureFile != null) captureFile.delete();
                        captureFile = null;
                        captureButton.setEnabled(true);
                        status.setText("No se pudo tomar la fotografía. Inténtalo otra vez.");
                    }
                });
    }

    private void showCameraError(String message) {
        if (isFinishing() || isDestroyed()) return;
        status.setText(message);
        captureButton.setEnabled(false);
    }

    @Override protected void onDestroy() {
        if (!completed && captureFile != null) captureFile.delete();
        super.onDestroy();
    }
}
