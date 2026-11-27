// Сканер QR-кода прямо в приложении. Системная камера iPhone всегда открывает ссылку в Safari,
// а не в установленном с главного экрана приложении, — поэтому сканируем сами и сразу входим.
// Декодер: встроенный BarcodeDetector (Android Chrome) или jsQR (iPhone), грузится по требованию.

import { useEffect, useRef, useState } from 'react';
import { L } from '../i18n/l';
import { Sheet } from './Sheet';
import { pinFromQr } from './qrPin';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function QrScanSheet({ open, onClose, onPin }: { open: boolean; onClose: () => void; onPin: (pin: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    let last = 0;
    setErr(null);
    setBad(false);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        setErr(L('Нет доступа к камере. Разреши камеру в настройках или введи PIN вручную.', 'Камераға рұқсат жоқ. Баптауларда камераға рұқсат бер немесе PIN-ді қолмен енгіз.', 'No camera access. Allow the camera in settings or type the PIN.'));
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = BD ? new BD({ formats: ['qr_code'] }) : null;
      const jsQR = detector ? null : (await import('jsqr')).default;
      const tick = async (now: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (now - last < 180 || v.readyState < 2) return;
        last = now;
        let text: string | undefined;
        if (detector) {
          const r = await detector.detect(v).catch(() => []);
          text = r[0]?.rawValue;
        } else if (ctx && jsQR) {
          // уменьшенный кадр — быстрее на старых телефонах
          const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * k);
          canvas.height = Math.round(v.videoHeight * k);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data;
        }
        if (!text) return;
        const pin = pinFromQr(text);
        if (pin) {
          stopped = true;
          cancelAnimationFrame(raf);
          navigator.vibrate?.(30);
          onPin(pin);
        } else setBad(true);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={L('Сканировать QR', 'QR сканерлеу', 'Scan QR')}
      description={L('Наведи камеру на QR-код в лобби у друга', 'Камераны досыңның лоббиіндегі QR-кодқа бағытта', "Point the camera at the QR code in your friend's lobby")}
    >
      <div className="qr-scan">
        {err ? (
          <p className="muted">{err}</p>
        ) : (
          <div className="qr-view">
            <video ref={video} playsInline muted />
            <span className="qr-frame" aria-hidden />
          </div>
        )}
        {bad && <p className="faint small center">{L('Это не приглашение в игру', 'Бұл ойынға шақыру емес', 'That is not a game invite')}</p>}
      </div>
    </Sheet>
  );
}
