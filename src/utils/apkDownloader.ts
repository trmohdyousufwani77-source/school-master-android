/**
 * Utility to verify and download the School Master Android Application Package (.apk)
 * with real-time streaming progress reporting and availability fallback handling.
 */

export const OFFICIAL_APK_VERSION = '1.0.4';
export const OFFICIAL_APK_URL = '/SchoolMaster-release.apk';
export const OFFICIAL_APK_FILENAME = `SchoolMaster_v${OFFICIAL_APK_VERSION}_release.apk`;
export const OFFICIAL_APK_MIN_ANDROID = 'Android 8.0 (Oreo) or higher';

export interface ApkDownloadProgress {
  loadedBytes: number;
  totalBytes: number;
  percent: number | null;
}

export interface ApkDownloadResult {
  success: boolean;
  filename: string;
  sizeMb: string;
  errorMessage?: string;
}

export function downloadAndroidApkPackage(_schoolName: string = 'Primary & Middle School'): {
  filename: string;
  sizeMb: string;
} {
  const anchor = document.createElement('a');
  anchor.href = OFFICIAL_APK_URL;
  anchor.download = OFFICIAL_APK_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  return {
    filename: OFFICIAL_APK_FILENAME,
    sizeMb: '5.8 MB',
  };
}

/**
 * Downloads the official Android APK with live progress updates and clear
 * unavailability detection so users receive accurate feedback and installation steps.
 */
export async function downloadAndroidApkWithProgress(
  onProgress?: (progress: ApkDownloadProgress) => void,
  apkUrl: string = OFFICIAL_APK_URL
): Promise<ApkDownloadResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      success: false,
      filename: OFFICIAL_APK_FILENAME,
      sizeMb: '0 MB',
      errorMessage:
        'You appear to be offline. Please connect to the internet to download the Android APK.',
    };
  }

  try {
    const response = await fetch(apkUrl, { method: 'GET', cache: 'no-cache' });
    if (!response.ok) {
      return {
        success: false,
        filename: OFFICIAL_APK_FILENAME,
        sizeMb: '0 MB',
        errorMessage: `The official APK download link is currently unavailable (HTTP ${response.status}). Please try again later or contact the school administrator.`,
      };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    // Guard against SPA HTML fallback pages being saved as corrupt .apk files
    if (contentType.includes('text/html')) {
      return {
        success: false,
        filename: OFFICIAL_APK_FILENAME,
        sizeMb: '0 MB',
        errorMessage:
          'The official Android APK package is currently unavailable on this server. Please check back shortly or contact the administrator.',
      };
    }

    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

    let blob: Blob;

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loadedBytes += value.byteLength;
          const percent =
            totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null;
          onProgress?.({ loadedBytes, totalBytes, percent });
        }
      }

      if (loadedBytes === 0) {
        return {
          success: false,
          filename: OFFICIAL_APK_FILENAME,
          sizeMb: '0 MB',
          errorMessage:
            'Downloaded APK file was empty. The download link may be temporarily unavailable.',
        };
      }

      blob = new Blob(chunks as BlobPart[], { type: 'application/vnd.android.package-archive' });
      onProgress?.({ loadedBytes, totalBytes: totalBytes || loadedBytes, percent: 100 });
    } else {
      blob = await response.blob();
      onProgress?.({ loadedBytes: blob.size, totalBytes: blob.size, percent: 100 });
    }

    const sizeMb = `${(blob.size / (1024 * 1024)).toFixed(1)} MB`;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = OFFICIAL_APK_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);

    return {
      success: true,
      filename: OFFICIAL_APK_FILENAME,
      sizeMb,
    };
  } catch (err: any) {
    return {
      success: false,
      filename: OFFICIAL_APK_FILENAME,
      sizeMb: '0 MB',
      errorMessage:
        err?.message && !/failed to fetch/i.test(err.message)
          ? `Unable to download APK: ${err.message}`
          : 'Unable to reach the official Android APK download link. Please check your internet connection and try again.',
    };
  }
}
