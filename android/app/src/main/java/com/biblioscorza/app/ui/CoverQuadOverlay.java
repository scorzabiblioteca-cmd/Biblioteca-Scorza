package com.biblioscorza.app.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

import androidx.annotation.Nullable;

public final class CoverQuadOverlay extends View {
    private static final float HANDLE_RADIUS_DP = 15f;
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint handleFill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shade = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF imageRect = new RectF();
    private float[] points;
    private int dragging = -1;
    private boolean reviewMode;
    private float density;
    private float currentImageRatio;

    public CoverQuadOverlay(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        density = getResources().getDisplayMetrics().density;
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(3.2f * density);
        stroke.setColor(0xFFFFD52A);
        glow.setStyle(Paint.Style.STROKE);
        glow.setStrokeWidth(7f * density);
        glow.setColor(0x66FFD52A);
        handleFill.setStyle(Paint.Style.FILL);
        handleFill.setColor(0xFFFFD52A);
        shade.setStyle(Paint.Style.FILL);
        shade.setColor(0x557A5400);
        setWillNotDraw(false);
    }

    void setDetected(float[] normalizedPoints) {
        reviewMode = false;
        points = normalizedPoints == null ? null : normalizedPoints.clone();
        invalidate();
    }

    void setDetected(float[] normalizedPoints, int imageWidth, int imageHeight) {
        currentImageRatio = imageWidth / (float) Math.max(1, imageHeight);
        setDetected(normalizedPoints);
    }

    void setReview(float[] normalizedPoints) {
        reviewMode = true;
        points = normalizedPoints == null ? defaultPoints() : normalizedPoints.clone();
        invalidate();
    }

    float[] getPoints() {
        return points == null ? defaultPoints() : points.clone();
    }

    private float[] defaultPoints() {
        return new float[]{0.04f, 0.03f, 0.96f, 0.03f, 0.96f, 0.97f, 0.04f, 0.97f};
    }

    private void calculateImageRect() {
        imageRect.set(0, 0, getWidth(), getHeight());
        float bitmapRatio = currentImageRatio;
        if (bitmapRatio <= 0) return;
        float viewRatio = getWidth() / (float) Math.max(1, getHeight());
        if (viewRatio > bitmapRatio) {
            float width = getHeight() * bitmapRatio;
            float inset = (getWidth() - width) / 2f;
            imageRect.set(inset, 0, getWidth() - inset, getHeight());
        } else {
            float height = getWidth() / bitmapRatio;
            float inset = (getHeight() - height) / 2f;
            imageRect.set(0, inset, getWidth(), getHeight() - inset);
        }
    }

    void setReview(float[] normalizedPoints, int imageWidth, int imageHeight) {
        currentImageRatio = imageWidth / (float) Math.max(1, imageHeight);
        setReview(normalizedPoints);
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        calculateImageRect();
        if (reviewMode && points != null) {
            drawReview(canvas);
        } else {
            drawTarget(canvas);
            if (points != null) drawDetected(canvas);
        }
    }

    private void drawTarget(Canvas canvas) {
        float boxWidth = Math.min(getWidth() * 0.72f, getHeight() * 0.48f);
        float boxHeight = boxWidth * 1.48f;
        if (boxHeight > getHeight() * 0.62f) {
            boxHeight = getHeight() * 0.62f;
            boxWidth = boxHeight / 1.48f;
        }
        float left = (getWidth() - boxWidth) / 2f;
        float top = (getHeight() - boxHeight) / 2f;
        RectF frame = new RectF(left, top, left + boxWidth, top + boxHeight);
        Paint framePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        framePaint.setStyle(Paint.Style.STROKE);
        framePaint.setStrokeWidth(2 * density);
        framePaint.setColor(0xAAFFFFFF);
        canvas.drawRoundRect(frame, 14 * density, 14 * density, framePaint);
    }

    private void drawDetected(Canvas canvas) {
        path.reset();
        path.moveTo(imageRect.left + points[0] * imageRect.width(),
                imageRect.top + points[1] * imageRect.height());
        for (int i = 2; i < 8; i += 2) {
            path.lineTo(imageRect.left + points[i] * imageRect.width(),
                    imageRect.top + points[i + 1] * imageRect.height());
        }
        path.close();
        canvas.drawPath(path, glow);
        canvas.drawPath(path, stroke);
    }

    private void drawReview(Canvas canvas) {
        float[] p = mapPoints();
        path.reset();
        path.moveTo(p[0], p[1]);
        for (int i = 2; i < 8; i += 2) path.lineTo(p[i], p[i + 1]);
        path.close();
        canvas.drawPath(path, shade);
        canvas.drawPath(path, glow);
        canvas.drawPath(path, stroke);
        for (int i = 0; i < 8; i += 2) {
            canvas.drawCircle(p[i], p[i + 1], HANDLE_RADIUS_DP * density, handleFill);
            Paint center = new Paint(Paint.ANTI_ALIAS_FLAG);
            center.setColor(0xFF17324D);
            canvas.drawCircle(p[i], p[i + 1], 4 * density, center);
        }
    }

    private float[] mapPoints() {
        float[] mapped = new float[8];
        for (int i = 0; i < 8; i += 2) {
            mapped[i] = imageRect.left + points[i] * imageRect.width();
            mapped[i + 1] = imageRect.top + points[i + 1] * imageRect.height();
        }
        return mapped;
    }

    @Override public boolean onTouchEvent(MotionEvent event) {
        if (!reviewMode || points == null) return false;
        float[] mapped = mapPoints();
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            float radius = 32 * density;
            float nearest = radius;
            dragging = -1;
            for (int i = 0; i < 8; i += 2) {
                float dx = event.getX() - mapped[i];
                float dy = event.getY() - mapped[i + 1];
                float distance = (float) Math.hypot(dx, dy);
                if (distance < nearest) {
                    nearest = distance;
                    dragging = i;
                }
            }
            return dragging >= 0;
        }
        if ((event.getAction() == MotionEvent.ACTION_MOVE
                || event.getAction() == MotionEvent.ACTION_UP) && dragging >= 0) {
            points[dragging] = clamp((event.getX() - imageRect.left) / imageRect.width());
            points[dragging + 1] = clamp((event.getY() - imageRect.top) / imageRect.height());
            invalidate();
            if (event.getAction() == MotionEvent.ACTION_UP) dragging = -1;
            return true;
        }
        if (event.getAction() == MotionEvent.ACTION_CANCEL) {
            dragging = -1;
            return true;
        }
        return dragging >= 0;
    }

    private float clamp(float value) {
        return Math.max(0, Math.min(1, value));
    }
}
