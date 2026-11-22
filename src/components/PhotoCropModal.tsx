import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  ZoomIn,
  RotateCw,
  Check,
  X,
  RefreshCw,
  Move,
  Image as ImageIcon,
} from 'lucide-react';

interface PhotoCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePhoto: (croppedDataUrl: string) => void;
  initialPhotoUrl?: string;
  title?: string;
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  onClose,
  onSavePhoto,
  initialPhotoUrl,
  title = 'Upload, Capture & Crop ID Photograph',
}) => {
  const [mode, setMode] = useState<'upload' | 'camera' | 'crop'>('upload');
  const [sourceUrl, setSourceUrl] = useState<string>(initialPhotoUrl || '');
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'square'>('portrait');
  const [zoom, setZoom] = useState<number>(1.0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialPhotoUrl) {
        setSourceUrl(initialPhotoUrl);
        setMode('crop');
      } else {
        setSourceUrl('');
        setMode('upload');
      }
      setZoom(1.0);
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);
      setCameraError(null);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, initialPhotoUrl]);

  // Start camera when mode === 'camera'
  useEffect(() => {
    if (!isOpen || mode !== 'camera') {
      stopCamera();
      return;
    }
    let cancelled = false;
    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera API is not available in this browser context. Please upload from Gallery.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        setCameraError(
          err?.message
            ? `Camera access denied or unavailable (${err.message}). Use Gallery Upload instead.`
            : 'Unable to access camera. Use Gallery Upload instead.'
        );
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, mode, facingMode]);

  // Load image into ref and draw live crop preview
  useEffect(() => {
    if (!sourceUrl || mode !== 'crop') return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      drawCropPreview();
    };
    img.src = sourceUrl;
  }, [sourceUrl, mode]);

  useEffect(() => {
    if (mode === 'crop' && loadedImageRef.current) {
      drawCropPreview();
    }
  }, [zoom, offsetX, offsetY, rotation, aspectRatio, mode]);

  const drawCropPreview = () => {
    const canvas = previewCanvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return;
    const w = aspectRatio === 'portrait' ? 300 : 320;
    const h = aspectRatio === 'portrait' ? 380 : 320;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);

    const rot90 = rotation % 180 !== 0;
    const imgW = rot90 ? img.height : img.width;
    const imgH = rot90 ? img.width : img.height;
    const baseScale = Math.max(w / imgW, h / imgH);
    const finalScale = baseScale * zoom;

    ctx.scale(finalScale, finalScale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    // Subtle rule-of-thirds crop guide lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 3, 0);
    ctx.lineTo(w / 3, h);
    ctx.moveTo((2 * w) / 3, 0);
    ctx.lineTo((2 * w) / 3, h);
    ctx.moveTo(0, h / 3);
    ctx.lineTo(w, h / 3);
    ctx.moveTo(0, (2 * h) / 3);
    ctx.lineTo(w, (2 * h) / 3);
    ctx.stroke();
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourceUrl(reader.result);
        setZoom(1.0);
        setOffsetX(0);
        setOffsetY(0);
        setRotation(0);
        setMode('crop');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.94);
    stopCamera();
    setSourceUrl(dataUrl);
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
    setMode('crop');
  };

  const handleSaveCropped = () => {
    const img = loadedImageRef.current;
    if (!img) return;
    const outW = aspectRatio === 'portrait' ? 450 : 480;
    const outH = aspectRatio === 'portrait' ? 570 : 480;
    const previewW = aspectRatio === 'portrait' ? 300 : 320;
    const scaleRatio = outW / previewW;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    ctx.save();
    ctx.translate(outW / 2 + offsetX * scaleRatio, outH / 2 + offsetY * scaleRatio);
    ctx.rotate((rotation * Math.PI) / 180);

    const rot90 = rotation % 180 !== 0;
    const imgW = rot90 ? img.height : img.width;
    const imgH = rot90 ? img.width : img.height;
    const baseScale = Math.max(outW / imgW, outH / imgH);
    const finalScale = baseScale * zoom;

    ctx.scale(finalScale, finalScale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    onSavePhoto(outCanvas.toDataURL('image/jpeg', 0.93));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Camera className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4 flex items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
              mode === 'upload'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Gallery Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
              mode === 'camera'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Capture</span>
          </button>
          {sourceUrl && (
            <button
              type="button"
              onClick={() => setMode('crop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
                mode === 'crop'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Crop &amp; Adjust</span>
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {mode === 'upload' && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
              <ImageIcon className="w-10 h-10 text-slate-400 mb-3" />
              <span className="text-sm font-bold text-slate-800">Select Passport / ID Photograph</span>
              <span className="text-xs text-slate-500 mt-1">
                PNG, JPG, or WEBP • Opens interactive crop &amp; fit tool automatically
              </span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          )}

          {mode === 'camera' && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                  <p className="font-bold">Camera Unavailable</p>
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs"
                  >
                    Switch to Gallery Upload
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 aspect-[4/3] flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-white/60 rounded-lg" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Switch Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCaptureFrame}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Photo</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'crop' && sourceUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('portrait')}
                    className={`px-2.5 py-1 rounded-md border font-semibold ${
                      aspectRatio === 'portrait'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    3:4 ID Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('square')}
                    className={`px-2.5 py-1 rounded-md border font-semibold ${
                      aspectRatio === 'square'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    1:1 Square
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate 90°</span>
                </button>
              </div>

              <div className="flex justify-center bg-slate-100 rounded-xl p-3 border border-slate-200">
                <canvas
                  ref={previewCanvasRef}
                  onMouseDown={(e) => {
                    setIsDragging(true);
                    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
                  }}
                  onMouseMove={(e) => {
                    if (!isDragging || !dragStartRef.current) return;
                    setOffsetX(dragStartRef.current.ox + (e.clientX - dragStartRef.current.x));
                    setOffsetY(dragStartRef.current.oy + (e.clientY - dragStartRef.current.y));
                  }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  className="rounded-lg border-2 border-indigo-600 shadow-sm cursor-move max-w-full"
                />
              </div>
              <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1">
                <Move className="w-3 h-3" />
                <span>Drag image inside frame or adjust sliders to auto-fit ID photo</span>
              </p>

              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="flex justify-between font-semibold text-slate-700 mb-1">
                    <span>Zoom</span>
                    <span className="font-mono">{zoom.toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="flex justify-between font-semibold text-slate-700 mb-1">
                    <span>Pan X</span>
                    <span className="font-mono">{Math.round(offsetX)}px</span>
                  </label>
                  <input
                    type="range"
                    min={-150}
                    max={150}
                    step={2}
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="flex justify-between font-semibold text-slate-700 mb-1">
                    <span>Pan Y</span>
                    <span className="font-mono">{Math.round(offsetY)}px</span>
                  </label>
                  <input
                    type="range"
                    min={-150}
                    max={150}
                    step={2}
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffsetX(0);
              setOffsetY(0);
              setRotation(0);
            }}
            disabled={mode !== 'crop'}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Reset Crop
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            {mode === 'crop' && sourceUrl && (
              <button
                type="button"
                onClick={handleSaveCropped}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Cropped Photo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
