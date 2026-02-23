import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface UseSwipeGestureOptions {
  onSwipeRight: () => void;
  threshold?: number; // Distancia mínima en píxeles para activar el gesto
  edgeThreshold?: number; // Distancia desde el borde izquierdo para iniciar el gesto
  enabled?: boolean; // Si está habilitado o no
}

/**
 * Hook para detectar gestos de arrastre desde el borde izquierdo de la pantalla
 * hacia la derecha para abrir el sidebar en dispositivos móviles
 */
export function useSwipeGesture({ 
  onSwipeRight, 
  threshold = 50, 
  edgeThreshold = 20,
  enabled = true 
}: UseSwipeGestureOptions) {
  const isMobile = useIsMobile();
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const isSwipeActive = React.useRef(false);

  React.useEffect(() => {
    // Solo activar en dispositivos móviles y si está habilitado
    if (!isMobile || !enabled) {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      // Solo activar si el toque comienza cerca del borde izquierdo
      if (touch.clientX <= edgeThreshold) {
        isSwipeActive.current = true;
      } else {
        isSwipeActive.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwipeActive.current || touchStartX.current === null || touchStartY.current === null) {
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // Verificar que el movimiento sea principalmente horizontal y hacia la derecha
      if (deltaX > 0 && deltaX > deltaY && deltaX >= threshold) {
        onSwipeRight();
        isSwipeActive.current = false;
        touchStartX.current = null;
        touchStartY.current = null;
      }
    };

    const handleTouchEnd = () => {
      touchStartX.current = null;
      touchStartY.current = null;
      isSwipeActive.current = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeRight, threshold, edgeThreshold, isMobile, enabled]);
}
