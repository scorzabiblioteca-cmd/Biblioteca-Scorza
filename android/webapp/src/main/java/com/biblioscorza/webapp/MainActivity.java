package com.biblioscorza.webapp;

import android.app.Activity;
import android.app.DownloadManager;
import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Bundle;
import android.view.ViewGroup;
import android.net.http.SslError;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int STORAGE_PERMISSION_REQUEST = 1002;
    private static final String WEB_HOST = "biblioteca-scorza.vercel.app";

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private DownloadManager.Request pendingDownload;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(20, 43, 76));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternalLinks(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternalLinks(Uri.parse(url));
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params
            ) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback.onReceiveValue(null);
                    fileChooserCallback = null;
                    return true;
                }
            }
        });
        webView.setDownloadListener(createDownloadListener());

        webView.loadUrl(BuildConfig.WEB_URL);
    }

    private DownloadListener createDownloadListener() {
        return (url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !WEB_HOST.equalsIgnoreCase(uri.getHost())) {
                Toast.makeText(this, "Solo se permiten descargas seguras desde BiblioScorza.", Toast.LENGTH_LONG).show();
                return;
            }

            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(uri)
                    .setTitle(fileName)
                    .setDescription("Descargando desde BiblioScorza")
                    .setMimeType(mimeType)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) request.addRequestHeader("Cookie", cookie);
            if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);

            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                pendingDownload = request;
                requestPermissions(
                        new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                        STORAGE_PERMISSION_REQUEST
                );
                return;
            }
            enqueueDownload(request);
        };
    }

    private void enqueueDownload(DownloadManager.Request request) {
        DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        if (manager == null) {
            Toast.makeText(this, "No se pudo iniciar la descarga.", Toast.LENGTH_LONG).show();
            return;
        }
        manager.enqueue(request);
        Toast.makeText(this, "Descarga iniciada. Ábrela desde las notificaciones al finalizar.", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != STORAGE_PERMISSION_REQUEST || pendingDownload == null) return;

        DownloadManager.Request request = pendingDownload;
        pendingDownload = null;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            enqueueDownload(request);
        } else {
            Toast.makeText(this, "Se necesita permiso de almacenamiento para descargar el archivo.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean openExternalLinks(Uri uri) {
        if ("https".equalsIgnoreCase(uri.getScheme()) && WEB_HOST.equalsIgnoreCase(uri.getHost())) {
            return false;
        }
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme)
                && !"http".equalsIgnoreCase(scheme)
                && !"mailto".equalsIgnoreCase(scheme)
                && !"tel".equalsIgnoreCase(scheme)) {
            return true;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            // External links are optional when there is no compatible app installed.
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                );
                fileChooserCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
