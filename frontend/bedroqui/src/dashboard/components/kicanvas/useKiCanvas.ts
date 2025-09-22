import { KiCanvasLoader } from './KiCanvasLoader';
import { KiCanvasController } from './KiCanvasController';

// React Hook for KiCanvas integration
import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseKiCanvasOptions {
  scriptPath?: string;
  onLoad?: (controller: KiCanvasController) => void;
  onError?: (error: Error) => void;
}

export function useKiCanvas(options: UseKiCanvasOptions = {}) {
  const elementRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<KiCanvasController | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { scriptPath = '/kicanvas.js', onLoad, onError } = options;

  const initialize = useCallback(async () => {
    if (!elementRef.current || controllerRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load KiCanvas
      const loader = KiCanvasLoader.getInstance();
      await loader.ensureLoaded(scriptPath);

      // Create controller
      controllerRef.current = new KiCanvasController(elementRef.current);
      
      // Set up load event
      controllerRef.current.on('kicanvas:load', () => {
        setIsLoaded(true);
        setIsLoading(false);
        if (controllerRef.current) {
          onLoad?.(controllerRef.current);
        }
      });

      // Set up error event
      controllerRef.current.on('kicanvas:error', (error: any) => {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        setError(errorObj);
        setIsLoading(false);
        onError?.(errorObj);
      });

      setIsLoading(false);

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setIsLoading(false);
      onError?.(errorObj);
    }
  }, [scriptPath, onLoad, onError]);

  useEffect(() => {
    initialize();

    return () => {
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
    };
  }, [initialize]);

  return {
    elementRef,
    controller: controllerRef.current,
    isLoaded,
    isLoading,
    error
  };
}