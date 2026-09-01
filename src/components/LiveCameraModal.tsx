import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBlobUrl: string, file: File) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(true);

  // Start camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    setIsInitializing(true);
    setCameraError(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('お使いのブラウザはカメラ撮影に対応していません。ファイル選択をご利用ください。');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access error, trying fallback:', err);
      // If environment (rear camera) fails (e.g. on laptop), try any video device
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (fallbackErr: any) {
        setCameraError(
          fallbackErr?.message || 'カメラへのアクセスが許可されていません。ブラウザのカメラ権限を許可するか、画像ファイルをアップロードしてください。'
        );
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Capture frame from video canvas
  const handleSnap = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(dataUrl, file);
          onClose();
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-900 rounded-3xl max-w-xl w-full overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">レシート撮影カメラ</h3>
              <p className="text-[11px] text-slate-400">レシート・領収書・請求書・明細を枠内に収めてください</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewfinder Area */}
        <div className="relative bg-black flex items-center justify-center aspect-[4/3] sm:aspect-[16/10] overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-slate-300 space-y-3 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-rose-300">{cameraError}</div>
              <p className="text-[11px] text-slate-400">
                カメラ撮影の代わりに、保存済みの写真ファイルをアップロードして解析することも可能です。
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
              >
                閉じてファイル選択に戻る
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Guide Overlay */}
              <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-amber-400/70 rounded-2xl flex flex-col justify-between p-3">
                <div className="flex justify-between text-amber-400/80 text-[10px] font-mono tracking-wider font-bold">
                  <span>[ RECEIPT SCANNER ]</span>
                  <span>AI VISION READY</span>
                </div>
                <div className="text-center text-white/80 text-xs bg-slate-900/60 backdrop-blur-xs py-1 px-3 rounded-full mx-auto font-medium">
                  レシート全体を明るい場所で映してください
                </div>
                <div className="flex justify-between text-amber-400/80 text-[10px] font-mono">
                  <span>+-----+</span>
                  <span>+-----+</span>
                </div>
              </div>

              {isInitializing && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white">
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-xs font-medium">カメラを起動しています...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Capture Controls Footer */}
        {!cameraError && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleCamera}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-medium flex items-center gap-1.5"
              title="カメラを切り替える"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">イン/アウト切替</span>
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleSnap}
              disabled={isInitializing}
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm shadow-lg shadow-amber-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>シャッターを切る</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl text-slate-400 hover:text-slate-200 text-xs font-medium transition"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
