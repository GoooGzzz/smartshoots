import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
  onScanned: (text: string) => void;
}

// NEW: rather than a native Capacitor barcode-scanning plugin (which
// would mean a new Gradle dependency I can't verify builds correctly
// without a real Android SDK to test against), this scans QR codes
// using only standard web APIs already proven to work in this app:
// getUserMedia for the camera feed, a <canvas> to sample frames, and
// jsQR (pure JS, no native code) to decode them. Needs the CAMERA
// permission declared in AndroidManifest.xml - Capacitor's WebView
// bridges that to Android's runtime permission prompt automatically.
export default function ScanServerQRDialog({ open, onClose, onScanned }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err: any) {
        setError(err?.message || "Couldn't access the camera. Check camera permission for this app.");
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        onScanned(code.data);
        return; // stop the loop - the dialog will close from the parent
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('scanQrTitle')}</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
            <Box sx={{
              position: 'absolute', inset: 0, border: '3px solid rgba(255,255,255,0.6)',
              borderRadius: 2, m: 4, pointerEvents: 'none',
            }} />
          </Box>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('scanQrHint')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}
