import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Box, Typography } from '@mui/material';

export default function ServerQRCode({ value, size = 180 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }, (err) => {
      setError(err ? 'Could not generate QR code' : null);
    });
  }, [value, size]);

  if (!value) return null;

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          p: 1.5, borderRadius: 2, bgcolor: '#fff',
          boxShadow: '0 10px 24px -10px rgba(0,0,0,0.35)',
        }}
      >
        <canvas ref={canvasRef} width={size} height={size} />
      </Box>
      {error ? (
        <Typography variant="caption" color="error">{error}</Typography>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{value}</Typography>
      )}
    </Box>
  );
}
