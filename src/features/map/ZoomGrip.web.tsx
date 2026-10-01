import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import type { ZoomGripProps } from './ZoomGrip';
import { dragZoom } from './zoom';
export function ZoomGrip({ gesture, active, onStep, children }: ZoomGripProps) {
  const { colors } = useApp();
  const pointer = useRef<{ id: number; y: number } | null>(null);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const cancel = () => {
      pointer.current = null;
      gesture.end();
    };
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      cancel();
    };
  }, [gesture]);
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="One-handed map zoom. Slide up to zoom in, down to zoom out."
      aria-valuemin={-15}
      aria-valuemax={15}
      aria-valuenow={Math.max(-15, Math.min(15, delta))}
      aria-valuetext="Relative map zoom. Use arrow up or arrow down to adjust."
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          onStep(event.key === 'ArrowUp' ? 0.5 : -0.5);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = { id: event.pointerId, y: event.clientY };
        setDelta(0);
        gesture.start();
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (start?.id === event.pointerId) {
          const dy = event.clientY - start.y;
          setDelta(dragZoom(dy));
          gesture.move(dy);
        }
      }}
      onPointerUp={(event) => {
        if (pointer.current?.id === event.pointerId) {
          pointer.current = null;
          gesture.end(true);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        pointer.current = null;
        gesture.end();
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
        gesture.end();
      }}
      style={{
        width: 44,
        height: 84,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 14,
        background: active ? colors.accentSoft : colors.surface,
        touchAction: 'none',
        userSelect: 'none',
        cursor: active ? 'grabbing' : 'ns-resize',
      }}
    >
      {children}
    </div>
  );
}
