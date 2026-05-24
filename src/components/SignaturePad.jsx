import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Eraser } from 'lucide-react';

const SignaturePad = forwardRef(function SignaturePad({ label = 'Please sign below', height = 200 }, ref) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      padRef.current?.clear();
    }

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgba(255, 255, 255, 0)',
      penColor: '#1d2731',
    });

    padRef.current.addEventListener('endStroke', () => {
      setHasInk(!padRef.current.isEmpty());
    });

    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      padRef.current?.off();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => { padRef.current?.clear(); setHasInk(false); },
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: () => padRef.current?.toDataURL('image/png'),
  }), []);

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="signature-container">
        <canvas ref={canvasRef} className="signature-canvas" style={{ height }} />
      </div>
      <div className="signature-actions">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => { padRef.current?.clear(); setHasInk(false); }}
          disabled={!hasInk}
        >
          <Eraser size={12} /> Clear signature
        </button>
        <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>
          {hasInk ? 'Signature captured' : 'Signature is required'}
        </span>
      </div>
    </div>
  );
});

export default SignaturePad;
