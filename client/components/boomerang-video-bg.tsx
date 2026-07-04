'use client';

import { useRef, useEffect, useState } from 'react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260611_183632_c311af08-e4b7-458f-81e7-79847a49b3d3.mp4';
const MAX_W = 960;
const FPS = 30;

export default function BoomerangVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<HTMLCanvasElement[]>([]);
  const idxRef = useRef(0);
  const dirRef = useRef(1);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<'video' | 'canvas'>('video');
  const [corsError, setCorsError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const captureFrame = () => {
      if (!video.videoWidth || corsError) return;
      try {
        const w = Math.min(video.videoWidth, MAX_W);
        const h = Math.round(video.videoHeight * (w / video.videoWidth));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')?.drawImage(video, 0, 0, w, h);
        frames.current.push(c);
      } catch {
        setCorsError(true);
      }
    };

    // Use requestVideoFrameCallback when available, fall back to rAF
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const cb = () => {
        if (!cancelled) {
          captureFrame();
          if (!video.ended) (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(cb);
        }
      };
      (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(cb);
    } else {
      const loop = () => {
        if (cancelled || video.ended) return;
        captureFrame();
        requestAnimationFrame(loop);
      };
      loop();
    }

    const startBoomerang = () => {
      if (cancelled || frames.current.length === 0 || corsError) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const f = frames.current;
      canvas.width = f[0].width;
      canvas.height = f[0].height;
      const ctx = canvas.getContext('2d')!;
      setPhase('canvas');

      let last = 0;
      const ms = 1000 / FPS;
      const tick = (t: number) => {
        if (cancelled) return;
        if (t - last >= ms) {
          last = t;
          ctx.drawImage(f[idxRef.current], 0, 0);
          idxRef.current += dirRef.current;
          if (idxRef.current >= f.length - 1) dirRef.current = -1;
          else if (idxRef.current <= 0) dirRef.current = 1;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    video.addEventListener('ended', startBoomerang);
    video.play().catch(() => {});

    return () => {
      cancelled = true;
      video.removeEventListener('ended', startBoomerang);
      cancelAnimationFrame(rafRef.current);
    };
  }, [corsError]);

  return (
    <div className="absolute inset-0 z-0 scale-[1.08] origin-center overflow-hidden">
      {/* Fallback: loop the video directly if CORS blocks canvas capture */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        playsInline
        crossOrigin="anonymous"
        loop={corsError}
        style={{ display: phase === 'canvas' ? 'none' : 'block' }}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        style={{ display: phase === 'canvas' ? 'block' : 'none' }}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/55" />
    </div>
  );
}
