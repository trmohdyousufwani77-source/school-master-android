#!/usr/bin/env bash
set -e

echo "=== Building Android APK for Smart School Master ==="

WORK_DIR="/tmp/android_apk_build"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/src/in/gov/up/schoolmaster"
mkdir -p "$WORK_DIR/gen"
mkdir -p "$WORK_DIR/bin"
mkdir -p "$WORK_DIR/res/values"
mkdir -p "$WORK_DIR/res/mipmap-mdpi"
mkdir -p "$WORK_DIR/res/mipmap-hdpi"
mkdir -p "$WORK_DIR/res/mipmap-xhdpi"
mkdir -p "$WORK_DIR/res/mipmap-xxhdpi"
mkdir -p "$WORK_DIR/assets/www"

# 1. Generate Icons
echo "Generating app launcher icons..."
convert -background none -resize 48x48 /app/applet/public/pwa-192x192.svg "$WORK_DIR/res/mipmap-mdpi/ic_launcher.png"
convert -background none -resize 72x72 /app/applet/public/pwa-192x192.svg "$WORK_DIR/res/mipmap-hdpi/ic_launcher.png"
convert -background none -resize 96x96 /app/applet/public/pwa-192x192.svg "$WORK_DIR/res/mipmap-xhdpi/ic_launcher.png"
convert -background none -resize 144x144 /app/applet/public/pwa-512x512.svg "$WORK_DIR/res/mipmap-xxhdpi/ic_launcher.png"

# 2. Strings.xml
cat << 'EOF' > "$WORK_DIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Smart School Master</string>
</resources>
EOF

# 3. AndroidManifest.xml
cat << 'EOF' > "$WORK_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="in.gov.up.schoolmaster"
    android:versionCode="104"
    android:versionName="1.0.4">

    <uses-sdk
        android:minSdkVersion="21"
        android:targetSdkVersion="33" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout"
            android:windowSoftInputMode="adjustResize"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# 4. MainActivity.java
cat << 'EOF' > "$WORK_DIR/src/in/gov/up/schoolmaster/MainActivity.java"
package in.gov.up.schoolmaster;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView mWebView;
    private ValueCallback<Uri[]> mFilePathCallback;
    private static final int FILECHOOSER_RESULTCODE = 101;
    private static final String CLOUD_URL = "https://ais-pre-nu5yauvtrpwkfmgp7wl44o-370699773036.asia-northeast1.run.app";
    private static final String OFFLINE_URL = "file:///android_asset/www/index.html";

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFF0F172A); // Dark slate header matching app theme
        }

        mWebView = new WebView(this);
        setContentView(mWebView);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setGeolocationEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file:///")) {
                    view.loadUrl(url);
                    return true;
                } else if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && !failingUrl.startsWith("file:///")) {
                    view.loadUrl(OFFLINE_URL);
                    Toast.makeText(MainActivity.this, "Offline mode activated - loading local database", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            @TargetApi(Build.VERSION_CODES.M)
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                if (request != null && request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 400) {
                    view.loadUrl(OFFLINE_URL);
                    Toast.makeText(MainActivity.this, "Portal unreachable (HTTP " + errorResponse.getStatusCode() + ") - loaded offline mode", Toast.LENGTH_SHORT).show();
                }
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            @TargetApi(Build.VERSION_CODES.LOLLIPOP)
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    mFilePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Check network and load appropriate route
        if (isNetworkAvailable()) {
            mWebView.loadUrl(CLOUD_URL);
        } else {
            mWebView.loadUrl(OFFLINE_URL);
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if ((keyCode == KeyEvent.KEYCODE_BACK) && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (mFilePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }
}
EOF

# 5. Copy built web assets into assets/www
echo "Copying web app into APK assets..."
cp -r /app/applet/dist/* "$WORK_DIR/assets/www/"

# Modify asset paths in assets/www/index.html to be relative if needed
sed -i 's|href="/|href="./|g' "$WORK_DIR/assets/www/index.html"
sed -i 's|src="/|src="./|g' "$WORK_DIR/assets/www/index.html"

# 6. Generate R.java
echo "Compiling Android resources with aapt..."
aapt package -m -J "$WORK_DIR/gen" \
    -M "$WORK_DIR/AndroidManifest.xml" \
    -S "$WORK_DIR/res" \
    -I /usr/lib/android-sdk/platforms/android-23/android.jar

# 7. Compile Java to Bytecode
echo "Compiling Java sources with javac..."
javac -source 8 -target 8 \
    -bootclasspath /usr/lib/android-sdk/platforms/android-23/android.jar \
    -d "$WORK_DIR/bin" \
    "$WORK_DIR/gen/in/gov/up/schoolmaster/R.java" \
    "$WORK_DIR/src/in/gov/up/schoolmaster/MainActivity.java"

# 8. Convert class files to Dalvik Executable (classes.dex)
echo "Generating Dalvik Executable (classes.dex) with dx..."
dx --dex --output="$WORK_DIR/bin/classes.dex" "$WORK_DIR/bin"

# 9. Package Initial APK
echo "Packaging unaligned APK with aapt..."
aapt package -f \
    -M "$WORK_DIR/AndroidManifest.xml" \
    -S "$WORK_DIR/res" \
    -A "$WORK_DIR/assets" \
    -I /usr/lib/android-sdk/platforms/android-23/android.jar \
    -F "$WORK_DIR/bin/unaligned.apk"

# Add classes.dex into APK
echo "Adding classes.dex to APK..."
cd "$WORK_DIR/bin"
aapt add unaligned.apk classes.dex

# 10. Align APK on 4-byte boundaries
echo "Aligning APK with zipalign..."
zipalign -f -p 4 unaligned.apk aligned.apk

# 11. Create or use keystore and sign APK
echo "Generating production release signing key..."
KEYSTORE="/app/applet/schoolmaster-release.keystore"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair -v \
        -keystore "$KEYSTORE" \
        -alias schoolmaster \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass SchoolMaster2026 \
        -keypass SchoolMaster2026 \
        -dname "CN=Mohd Yousuf, OU=UDISE Student Management, O=Smart School Master, L=Lucknow, ST=Uttar Pradesh, C=IN"
fi

echo "Signing APK with apksigner (v1, v2, v3 schemes)..."
apksigner sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:SchoolMaster2026 \
    --ks-key-alias schoolmaster \
    --key-pass pass:SchoolMaster2026 \
    --out "$WORK_DIR/bin/SchoolMaster-release.apk" \
    aligned.apk

# 12. Verify APK Signature
echo "Verifying APK signature..."
apksigner verify --verbose "$WORK_DIR/bin/SchoolMaster-release.apk"

# 13. Output APK Details
echo "Inspecting generated APK badging..."
aapt dump badging "$WORK_DIR/bin/SchoolMaster-release.apk" | head -n 15

# 14. Deploy APK to public/ and dist/
echo "Deploying release APK to public and dist directories..."
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/public/SchoolMaster-release.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/public/SchoolMaster_v1.0.4_release.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/public/SchoolMaster.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/public/school_master_v1.0.0.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/public/school_master_release.apk

mkdir -p /app/applet/dist
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/dist/SchoolMaster-release.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/dist/SchoolMaster_v1.0.4_release.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/dist/SchoolMaster.apk
cp "$WORK_DIR/bin/SchoolMaster-release.apk" /app/applet/dist/school_master_v1.0.0.apk

echo "APK build complete!"
ls -lh /app/applet/public/SchoolMaster-release.apk
