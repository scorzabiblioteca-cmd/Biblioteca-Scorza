package com.biblioscorza.app.ui;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.os.Bundle;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
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
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.exifinterface.media.ExifInterface;

import com.biblioscorza.app.R;
import com.google.common.util.concurrent.ListenableFuture;

import org.opencv.android.OpenCVLoader;
import org.opencv.android.Utils;
import org.opencv.core.Core;
import org.opencv.core.CvType;
import org.opencv.core.Mat;
import org.opencv.core.MatOfPoint;
import org.opencv.core.MatOfPoint2f;
import org.opencv.core.Point;
import org.opencv.core.Scalar;
import org.opencv.core.Size;
import org.opencv.imgproc.Imgproc;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@OptIn(markerClass = ExperimentalGetImage.class)
public class CoverScannerActivity extends AppCompatActivity {
    public static final String EXTRA_COVER_PATH = "cover_path";
    private static final String TAG = "CoverScannerActivity";
    private static final int MAX_CAPTURE_DIMENSION = 2400;
    private final ExecutorService cameraExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean captureInProgress = new AtomicBoolean();
    private final AtomicLong lastAnalysis = new AtomicLong();
    private final ActivityResultLauncher<String> requestCameraPermission =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) startCamera();
                else showCameraError("Se necesita permiso de cámara para digitalizar la portada.");
            });

    private PreviewView preview;
    private ImageView reviewImage;
    private CoverQuadOverlay overlay;
    private TextView status;
    private Button captureButton, autoButton, rotateButton, confirmButton, retryButton;
    private View reviewControls;
    private ProcessCameraProvider cameraProvider;
    private ImageCapture imageCapture;
    private Camera camera;
    private File rawCapture, processedCapture;
    private Bitmap reviewBitmap;
    private volatile float[] latestDetected;
    private float[] previousDetected;
    private int stableFrames;
    private boolean autoCapture = true;
    private boolean reviewMode;
    private boolean completed;
    private int previewRotation;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cover_scanner);
        TopBarController.bind(this);
        preview = findViewById(R.id.coverPreview);
        reviewImage = findViewById(R.id.coverReviewImage);
        overlay = findViewById(R.id.coverOverlay);
        status = findViewById(R.id.tvCoverStatus);
        captureButton = findViewById(R.id.btnCaptureCover);
        autoButton = findViewById(R.id.btnAutoCover);
        rotateButton = findViewById(R.id.btnRotateCover);
        confirmButton = findViewById(R.id.btnConfirmCover);
        retryButton = findViewById(R.id.btnRetryCover);
        reviewControls = findViewById(R.id.coverReviewControls);

        View back = findViewById(R.id.btnVolver);
        back.setVisibility(View.VISIBLE);
        back.setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        captureButton.setOnClickListener(v -> capture());
        autoButton.setOnClickListener(v -> {
            autoCapture = !autoCapture;
            autoButton.setText(autoCapture ? "Automático: activado" : "Automático: desactivado");
            stableFrames = 0;
            updateStatus();
        });
        rotateButton.setOnClickListener(v -> rotatePreview());
        confirmButton.setOnClickListener(v -> confirmCover());
        retryButton.setOnClickListener(v -> retry());
        preview.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) focus(event.getX(), event.getY());
            return true;
        });

        if (!OpenCVLoader.initLocal()) {
            showCameraError("No se pudo iniciar el procesador de imagen.");
            captureButton.setEnabled(false);
            autoButton.setEnabled(false);
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) startCamera();
        else requestCameraPermission.launch(Manifest.permission.CAMERA);
    }

    private void startCamera() {
        if (isFinishing() || isDestroyed() || reviewMode) return;
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();
                previewRotation = preview.getDisplay() == null
                        ? android.view.Surface.ROTATION_0 : preview.getDisplay().getRotation();
                Preview cameraPreview = new Preview.Builder()
                        .setTargetRotation(previewRotation).build();
                cameraPreview.setSurfaceProvider(preview.getSurfaceProvider());
                imageCapture = new ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                        .setTargetRotation(previewRotation)
                        .build();
                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setTargetResolution(new android.util.Size(640, 480))
                        .setTargetRotation(previewRotation)
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();
                analysis.setAnalyzer(cameraExecutor, this::analyzeFrame);
                provider.unbindAll();
                cameraProvider = provider;
                camera = provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA,
                        cameraPreview, imageCapture, analysis);
                preview.post(() -> {
                    if (preview.getWidth() > 0) focus(preview.getWidth() / 2f, preview.getHeight() / 2f);
                });
                status.setText("Buscando portada…");
                captureButton.setEnabled(true);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                showCameraError("Se interrumpió el inicio de la cámara.");
                Log.e(TAG, "Camera startup interrupted", e);
            } catch (ExecutionException | RuntimeException e) {
                showCameraError("No se pudo abrir la cámara. Verifica los permisos e inténtalo otra vez.");
                Log.e(TAG, "Camera startup failed", e);
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void analyzeFrame(ImageProxy image) {
        try {
            long now = System.currentTimeMillis();
            if (now - lastAnalysis.get() < 180 || captureInProgress.get() || reviewMode) return;
            lastAnalysis.set(now);
            Mat gray = grayFromYPlane(image);
            Mat oriented = rotateGray(gray, image.getImageInfo().getRotationDegrees());
            gray.release();
            float[] found = findCover(oriented);
            int width = oriented.cols();
            int height = oriented.rows();
            oriented.release();
            runOnUiThread(() -> updateDetection(found, width, height));
        } catch (RuntimeException e) {
            Log.w(TAG, "Could not analyze cover frame", e);
        } finally {
            image.close();
        }
    }

    private Mat grayFromYPlane(ImageProxy image) {
        ImageProxy.PlaneProxy plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int width = image.getWidth();
        int height = image.getHeight();
        byte[] packed = new byte[width * height];
        int rowStride = plane.getRowStride();
        int pixelStride = plane.getPixelStride();
        for (int y = 0; y < height; y++) {
            int rowStart = y * rowStride;
            for (int x = 0; x < width; x++) packed[y * width + x] = buffer.get(rowStart + x * pixelStride);
        }
        Mat gray = new Mat(height, width, CvType.CV_8UC1);
        gray.put(0, 0, packed);
        return gray;
    }

    private Mat rotateGray(Mat source, int degrees) {
        Mat rotated = new Mat();
        if (degrees == 90) Core.rotate(source, rotated, Core.ROTATE_90_CLOCKWISE);
        else if (degrees == 180) Core.rotate(source, rotated, Core.ROTATE_180);
        else if (degrees == 270) Core.rotate(source, rotated, Core.ROTATE_90_COUNTERCLOCKWISE);
        else source.copyTo(rotated);
        return rotated;
    }

    private float[] findCover(Mat gray) {
        Mat blurred = new Mat();
        Mat edges = new Mat();
        Mat hierarchy = new Mat();
        Mat kernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, new Size(3, 3));
        List<MatOfPoint> contours = new ArrayList<>();
        try {
            Imgproc.GaussianBlur(gray, blurred, new Size(5, 5), 0);
            Imgproc.Canny(blurred, edges, 45, 130);
            Imgproc.dilate(edges, edges, kernel);
            Imgproc.findContours(edges, contours, hierarchy, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE);
            double frameArea = gray.cols() * (double) gray.rows();
            double bestScore = 0;
            float[] best = null;
            for (MatOfPoint contour : contours) {
                double area = Math.abs(Imgproc.contourArea(contour));
                if (area < frameArea * 0.09 || area > frameArea * 0.94) continue;
                MatOfPoint2f curve = new MatOfPoint2f(contour.toArray());
                MatOfPoint2f polygon = new MatOfPoint2f();
                Imgproc.approxPolyDP(curve, polygon, Imgproc.arcLength(curve, true) * 0.025, true);
                Point[] corners = polygon.toArray();
                curve.release();
                polygon.release();
                if (corners.length != 4) continue;
                MatOfPoint polygonPoints = new MatOfPoint(corners);
                boolean convex = Imgproc.isContourConvex(polygonPoints);
                polygonPoints.release();
                if (!convex) continue;
                Point[] ordered = orderCorners(corners);
                double width = (distance(ordered[0], ordered[1]) + distance(ordered[3], ordered[2])) / 2;
                double height = (distance(ordered[0], ordered[3]) + distance(ordered[1], ordered[2])) / 2;
                if (width <= 0 || height <= 0) continue;
                double ratio = width / height;
                if (ratio < 0.38 || ratio > 0.98) continue;
                double centerX = (ordered[0].x + ordered[1].x + ordered[2].x + ordered[3].x) / 4;
                double centerY = (ordered[0].y + ordered[1].y + ordered[2].y + ordered[3].y) / 4;
                double offset = Math.hypot(centerX / gray.cols() - 0.5, centerY / gray.rows() - 0.5);
                double score = area * (1 - Math.min(0.65, offset));
                if (score > bestScore) {
                    bestScore = score;
                    best = new float[8];
                    for (int i = 0; i < 4; i++) {
                        best[i * 2] = clamp01((float) (ordered[i].x / gray.cols()));
                        best[i * 2 + 1] = clamp01((float) (ordered[i].y / gray.rows()));
                    }
                }
            }
            return best;
        } finally {
            for (MatOfPoint contour : contours) contour.release();
            blurred.release();
            edges.release();
            hierarchy.release();
            kernel.release();
        }
    }

    private Point[] orderCorners(Point[] corners) {
        Point[] ordered = new Point[4];
        ordered[0] = Collections.min(java.util.Arrays.asList(corners),
                Comparator.comparingDouble(p -> p.x + p.y));
        ordered[2] = Collections.max(java.util.Arrays.asList(corners),
                Comparator.comparingDouble(p -> p.x + p.y));
        ordered[1] = Collections.max(java.util.Arrays.asList(corners),
                Comparator.comparingDouble(p -> p.x - p.y));
        ordered[3] = Collections.min(java.util.Arrays.asList(corners),
                Comparator.comparingDouble(p -> p.x - p.y));
        return ordered;
    }

    private double distance(Point first, Point second) {
        return Math.hypot(first.x - second.x, first.y - second.y);
    }

    private float clamp01(float value) {
        return Math.max(0, Math.min(1, value));
    }

    private void updateDetection(float[] detected, int width, int height) {
        if (isFinishing() || isDestroyed() || reviewMode) return;
        latestDetected = detected;
        overlay.setDetected(detected, width, height);
        if (detected == null) {
            previousDetected = null;
            stableFrames = 0;
            status.setText("Buscando portada… Colócala dentro del marco.");
            return;
        }
        if (previousDetected != null && isStable(previousDetected, detected)) stableFrames++;
        else stableFrames = 1;
        previousDetected = detected.clone();
        if (stableFrames >= 3) {
            status.setText(autoCapture
                    ? "Portada detectada. Mantén el teléfono estable…"
                    : "Portada detectada. Imagen lista para capturar.");
        } else {
            status.setText("Portada detectada. Mantén el teléfono estable…");
        }
        if (autoCapture && stableFrames >= 8) capture();
    }

    private void updateStatus() {
        if (latestDetected == null) status.setText("Buscando portada… Colócala dentro del marco.");
        else if (stableFrames >= 3 && !autoCapture) {
            status.setText("Portada detectada. Imagen lista para capturar.");
        } else {
            status.setText("Portada detectada. Mantén el teléfono estable…");
        }
    }

    private boolean isStable(float[] before, float[] after) {
        float difference = 0;
        for (int i = 0; i < 8; i++) difference += Math.abs(before[i] - after[i]);
        return difference / 8 < 0.012f;
    }

    private void capture() {
        if (imageCapture == null || !captureInProgress.compareAndSet(false, true)) return;
        stableFrames = 0;
        captureButton.setEnabled(false);
        status.setText("Capturando portada…");
        File directory = new File(getCacheDir(), "fotos");
        if (!directory.exists() && !directory.mkdirs()) {
            captureInProgress.set(false);
            captureButton.setEnabled(true);
            status.setText("No se pudo preparar el archivo temporal.");
            return;
        }
        rawCapture = new File(directory, "portada_original_" + System.currentTimeMillis() + ".jpg");
        ImageCapture.OutputFileOptions output = new ImageCapture.OutputFileOptions.Builder(rawCapture).build();
        imageCapture.takePicture(output, ContextCompat.getMainExecutor(this),
                new ImageCapture.OnImageSavedCallback() {
                    @Override public void onImageSaved(ImageCapture.OutputFileResults result) {
                        if (isFinishing() || isDestroyed()) {
                            rawCapture.delete();
                            return;
                        }
                        try {
                            imageExecutor.execute(() -> loadCapturedImage(rawCapture));
                        } catch (java.util.concurrent.RejectedExecutionException e) {
                            rawCapture.delete();
                            Log.w(TAG, "Capture completed after the scanner was closed", e);
                        }
                    }

                    @Override public void onError(ImageCaptureException exception) {
                        captureInProgress.set(false);
                        captureButton.setEnabled(true);
                        status.setText("No se pudo capturar la imagen. Inténtalo otra vez.");
                        Log.e(TAG, "Cover capture failed", exception);
                    }
                });
    }

    private void loadCapturedImage(File file) {
        try {
            Bitmap bitmap = decodeOriented(file);
            float[] points = latestDetected == null ? null : latestDetected.clone();
            runOnUiThread(() -> showReview(bitmap, points));
        } catch (RuntimeException e) {
            Log.e(TAG, "Could not load captured image", e);
            runOnUiThread(() -> {
                captureInProgress.set(false);
                captureButton.setEnabled(true);
                status.setText("No se pudo leer la fotografía. Vuelve a capturarla.");
            });
        }
    }

    private Bitmap decodeOriented(File file) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IllegalArgumentException("Invalid capture");
        int sample = 1;
        while (Math.max(bounds.outWidth / sample, bounds.outHeight / sample) > MAX_CAPTURE_DIMENSION) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap decoded = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        if (decoded == null) throw new IllegalArgumentException("Invalid image data");
        try {
            int orientation = new ExifInterface(file).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            Matrix matrix = new Matrix();
            if (orientation == ExifInterface.ORIENTATION_ROTATE_90) matrix.postRotate(90);
            else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) matrix.postRotate(180);
            else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) matrix.postRotate(270);
            if (matrix.isIdentity()) return decoded;
            Bitmap rotated = Bitmap.createBitmap(decoded, 0, 0, decoded.getWidth(), decoded.getHeight(), matrix, true);
            decoded.recycle();
            return rotated;
        } catch (java.io.IOException e) {
            decoded.recycle();
            throw new IllegalStateException("Could not read capture orientation", e);
        }
    }

    private void showReview(Bitmap bitmap, float[] detected) {
        if (isFinishing() || isDestroyed()) {
            bitmap.recycle();
            return;
        }
        reviewMode = true;
        reviewBitmap = bitmap;
        preview.setVisibility(View.GONE);
        reviewImage.setImageBitmap(bitmap);
        reviewImage.setVisibility(View.VISIBLE);
        overlay.setVisibility(View.VISIBLE);
        overlay.setReview(detected, bitmap.getWidth(), bitmap.getHeight());
        captureButton.setVisibility(View.GONE);
        autoButton.setVisibility(View.GONE);
        retryButton.setVisibility(View.VISIBLE);
        reviewControls.setVisibility(View.VISIBLE);
        confirmButton.setEnabled(true);
        status.setText(detected == null
                ? "No se detectaron los bordes. Ajusta las cuatro esquinas manualmente."
                : "Ajusta las esquinas amarillas si hace falta y confirma el recorte.");
    }

    private void rotatePreview() {
        if (reviewBitmap == null) return;
        Matrix matrix = new Matrix();
        matrix.postRotate(90);
        Bitmap rotated = Bitmap.createBitmap(reviewBitmap, 0, 0,
                reviewBitmap.getWidth(), reviewBitmap.getHeight(), matrix, true);
        reviewBitmap.recycle();
        reviewBitmap = rotated;
        reviewImage.setImageBitmap(rotated);
        overlay.setReview(null, rotated.getWidth(), rotated.getHeight());
    }

    private void retry() {
        if (!reviewMode) {
            retryButton.setVisibility(View.GONE);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED) startCamera();
            else requestCameraPermission.launch(Manifest.permission.CAMERA);
            return;
        }
        if (reviewBitmap != null) {
            reviewBitmap.recycle();
            reviewBitmap = null;
        }
        if (rawCapture != null) rawCapture.delete();
        rawCapture = null;
        reviewMode = false;
        latestDetected = null;
        previousDetected = null;
        stableFrames = 0;
        reviewImage.setImageDrawable(null);
        reviewImage.setVisibility(View.GONE);
        preview.setVisibility(View.VISIBLE);
        overlay.setDetected(null);
        captureButton.setVisibility(View.VISIBLE);
        autoButton.setVisibility(View.VISIBLE);
        captureButton.setEnabled(true);
        retryButton.setVisibility(View.GONE);
        reviewControls.setVisibility(View.GONE);
        captureInProgress.set(false);
        status.setText("Buscando portada…");
    }

    private void confirmCover() {
        if (reviewBitmap == null || processedCapture != null) return;
        if (!validCorners(overlay.getPoints())) {
            status.setText("Ajusta las cuatro esquinas para formar un recorte válido.");
            return;
        }
        confirmButton.setEnabled(false);
        retryButton.setEnabled(false);
        status.setText("Corrigiendo perspectiva…");
        Bitmap source = reviewBitmap;
        float[] corners = overlay.getPoints();
        imageExecutor.execute(() -> {
            try {
                File directory = new File(getCacheDir(), "fotos");
                processedCapture = new File(directory, "portada_final_" + System.currentTimeMillis() + ".jpg");
                rectifyAndSave(source, corners, processedCapture);
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    completed = true;
                    setResult(RESULT_OK, new Intent().putExtra(EXTRA_COVER_PATH, processedCapture.getAbsolutePath()));
                    finish();
                });
            } catch (RuntimeException | java.io.IOException e) {
                Log.e(TAG, "Could not rectify cover image", e);
                runOnUiThread(() -> {
                    confirmButton.setEnabled(true);
                    retryButton.setEnabled(true);
                    status.setText("No se pudo procesar la imagen. Ajusta las esquinas o vuelve a capturar.");
                });
            }
        });
    }

    private boolean validCorners(float[] points) {
        if (points == null || points.length != 8) return false;
        double area = 0;
        for (int i = 0; i < 4; i++) {
            int next = (i + 1) % 4;
            area += points[i * 2] * points[next * 2 + 1]
                    - points[next * 2] * points[i * 2 + 1];
        }
        return Math.abs(area) >= 0.025;
    }

    private void rectifyAndSave(Bitmap sourceBitmap, float[] normalizedPoints, File destination)
            throws java.io.IOException {
        Mat source = new Mat();
        Mat warped = new Mat();
        Mat softened = new Mat();
        Mat sharpened = new Mat();
        MatOfPoint2f sourcePoints = null;
        MatOfPoint2f destinationPoints = null;
        Mat transform = null;
        Bitmap outputBitmap = null;
        try {
            Utils.bitmapToMat(sourceBitmap, source);
            Point[] corners = new Point[4];
            for (int i = 0; i < 4; i++) {
                corners[i] = new Point(
                        clamp01(normalizedPoints[i * 2]) * (source.cols() - 1),
                        clamp01(normalizedPoints[i * 2 + 1]) * (source.rows() - 1));
            }
            double width = Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]));
            double height = Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]));
            int outputWidth = (int) Math.max(1, Math.min(MAX_CAPTURE_DIMENSION, width));
            int outputHeight = (int) Math.max(1, Math.min(MAX_CAPTURE_DIMENSION, height));
            sourcePoints = new MatOfPoint2f(corners);
            destinationPoints = new MatOfPoint2f(
                    new Point(0, 0), new Point(outputWidth - 1, 0),
                    new Point(outputWidth - 1, outputHeight - 1), new Point(0, outputHeight - 1));
            transform = Imgproc.getPerspectiveTransform(sourcePoints, destinationPoints);
            Imgproc.warpPerspective(source, warped, transform, new Size(outputWidth, outputHeight),
                    Imgproc.INTER_CUBIC, Core.BORDER_REPLICATE, new Scalar(255, 255, 255, 255));
            Imgproc.GaussianBlur(warped, softened, new Size(0, 0), 1.0);
            Core.addWeighted(warped, 1.08, softened, -0.08, 1.0, sharpened);
            outputBitmap = Bitmap.createBitmap(outputWidth, outputHeight, Bitmap.Config.ARGB_8888);
            Utils.matToBitmap(sharpened, outputBitmap);
            try (FileOutputStream stream = new FileOutputStream(destination)) {
                if (!outputBitmap.compress(Bitmap.CompressFormat.JPEG, 93, stream)) {
                    throw new java.io.IOException("No se pudo guardar la portada procesada");
                }
            }
        } finally {
            source.release();
            warped.release();
            softened.release();
            sharpened.release();
            if (sourcePoints != null) sourcePoints.release();
            if (destinationPoints != null) destinationPoints.release();
            if (transform != null) transform.release();
            if (outputBitmap != null) outputBitmap.recycle();
        }
    }

    private void focus(float x, float y) {
        if (camera == null || preview.getWidth() <= 0 || preview.getHeight() <= 0) return;
        camera.getCameraControl().startFocusAndMetering(
                new FocusMeteringAction.Builder(preview.getMeteringPointFactory().createPoint(x, y)).build());
    }

    private void showCameraError(String message) {
        if (isFinishing() || isDestroyed()) return;
        status.setText(message);
        captureButton.setEnabled(false);
        retryButton.setVisibility(View.VISIBLE);
    }

    @Override protected void onDestroy() {
        if (cameraProvider != null) cameraProvider.unbindAll();
        cameraExecutor.shutdown();
        imageExecutor.shutdown();
        if (reviewBitmap != null && !reviewBitmap.isRecycled()) reviewBitmap.recycle();
        if (!completed) {
            if (rawCapture != null) rawCapture.delete();
            if (processedCapture != null) processedCapture.delete();
        }
        super.onDestroy();
    }
}
