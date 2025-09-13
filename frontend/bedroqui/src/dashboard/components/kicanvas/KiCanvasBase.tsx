// Fixed KiCanvasBase.tsx with better error handling and element lifecycle management

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface KiCanvasBaseProps {
  src?: string;
  data?: string;
  dataType?: 'schematic' | 'board' | 'project';
  controls?: 'none' | 'basic' | 'full';
  className?: string;
  style?: React.CSSProperties;
  scriptPath?: string;
  onLoad?: (element: HTMLElement) => void;
  onError?: (error: Error) => void;
  onSelectionChange?: (selection: any[]) => void;
}

export const KiCanvasBase: React.FC<KiCanvasBaseProps> = ({
  src,
  data,
  dataType = 'schematic',
  controls = 'basic',
  className,
  style,
  scriptPath = '/kicanvas.js',
  onLoad,
  onError,
  onSelectionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const kicanvasElementRef = useRef<HTMLElement | null>(null);
  const eventListenersRef = useRef<Array<{ element: HTMLElement; event: string; handler: EventListener }>>([]);
  const [isKiCanvasLoaded, setIsKiCanvasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Helper to safely add event listeners with cleanup tracking
  const safeAddEventListener = useCallback((element: HTMLElement | null, event: string, handler: EventListener) => {
    if (!element) {
      console.warn(`Cannot add event listener for ${event}: element is null`);
      return;
    }

    try {
      element.addEventListener(event, handler);
      eventListenersRef.current.push({ element, event, handler });
    } catch (error) {
      console.warn(`Failed to add event listener for ${event}:`, error);
    }
  }, []);

  // Helper to remove all tracked event listeners
  const cleanupEventListeners = useCallback(() => {
    eventListenersRef.current.forEach(({ element, event, handler }) => {
      try {
        if (element && element.removeEventListener) {
          element.removeEventListener(event, handler);
        }
      } catch (error) {
        console.warn('Failed to remove event listener:', error);
      }
    });
    eventListenersRef.current = [];
  }, []);

  // Check if KiCanvas custom elements are defined
  const checkKiCanvasAvailable = useCallback(() => {
    return typeof window !== 'undefined' &&
           typeof customElements !== 'undefined' &&
           customElements.get('kicanvas-embed') !== undefined;
  }, []);

  // Load KiCanvas script and wait for custom elements
  const loadKiCanvas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if already available
      if (checkKiCanvasAvailable()) {
        setIsKiCanvasLoaded(true);
        setIsLoading(false);
        return;
      }

      // Load the script
      await new Promise<void>((resolve, reject) => {
        // Check if script is already loading/loaded
        const existingScript = document.querySelector(`script[src="${scriptPath}"]`);
        if (existingScript) {
          // Script exists, wait for it to load
          if (checkKiCanvasAvailable()) {
            resolve();
            return;
          }
          
          const onExistingLoad = () => {
            setTimeout(() => {
              if (checkKiCanvasAvailable()) {
                resolve();
              } else {
                reject(new Error('KiCanvas script loaded but custom elements not available'));
              }
            }, 300);
          };
          
          const onExistingError = () => {
            reject(new Error('Failed to load existing KiCanvas script'));
          };

          existingScript.addEventListener('load', onExistingLoad);
          existingScript.addEventListener('error', onExistingError);
          
          // Cleanup listeners after timeout
          setTimeout(() => {
            existingScript.removeEventListener('load', onExistingLoad);
            existingScript.removeEventListener('error', onExistingError);
          }, 5000);
          
          return;
        }

        // Create new script element
        const script = document.createElement('script');
        script.type = 'module';
        script.src = scriptPath;
        
        const onLoad = () => {
          // Wait a bit for custom elements to register
          setTimeout(() => {
            if (checkKiCanvasAvailable()) {
              resolve();
            } else {
              reject(new Error('KiCanvas script loaded but custom elements not available'));
            }
          }, 300);
        };
        
        const onError = () => {
          reject(new Error(`Failed to load KiCanvas from ${scriptPath}`));
        };

        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);
        
        document.head.appendChild(script);

        // Cleanup listeners after timeout
        setTimeout(() => {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        }, 10000);
      });

      setIsKiCanvasLoaded(true);
      setIsLoading(false);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
      onError?.(error);
    }
  }, [scriptPath, checkKiCanvasAvailable, onError]);

  // Create KiCanvas element programmatically after it's loaded
  const createKiCanvasElement = useCallback(() => {
    if (!containerRef.current || !isKiCanvasLoaded) {
      console.log('Cannot create KiCanvas element: container or KiCanvas not ready', {
        hasContainer: !!containerRef.current,
        isKiCanvasLoaded
      });
      return;
    }

    try {
      // Clean up existing element and listeners
      cleanupEventListeners();
      if (kicanvasElementRef.current) {
        kicanvasElementRef.current.remove();
        kicanvasElementRef.current = null;
      }

      console.log('Creating KiCanvas element...');

      // Create kicanvas-embed element
      const kicanvasElement = document.createElement('kicanvas-embed') as HTMLElement;
      
      // Set attributes
      if (src) {
        kicanvasElement.setAttribute('src', src);
        console.log('Set src:', src);
      }
      if (controls) {
        kicanvasElement.setAttribute('controls', controls);
        console.log('Set controls:', controls);
      }
      
      // Set styles
      Object.assign(kicanvasElement.style, {
        width: '100%',
        height: '100%',
        display: 'block'
      });

      // Add data if provided
      if (data) {
        console.log('Adding inline data...');
        const sourceElement = document.createElement('kicanvas-source');
        if (dataType) sourceElement.setAttribute('type', dataType);
        sourceElement.textContent = data;
        kicanvasElement.appendChild(sourceElement);
      }

      // Set up event listeners with safe wrapper
      const handleLoad = (event: Event) => {
        console.log('KiCanvas load event:', event);
        onLoad?.(kicanvasElement);
      };

      const handleError = (event: Event) => {
        console.log('KiCanvas error event:', event);
        const error = new Error((event as any).detail?.message || 'KiCanvas error');
        setError(error);
        onError?.(error);
      };

      const handleSelection = (event: Event) => {
        console.log('KiCanvas selection event:', event);
        if (onSelectionChange) {
          onSelectionChange((event as any).detail?.selection || []);
        }
      };

      // Add event listeners with safety checks
      safeAddEventListener(kicanvasElement, 'kicanvas:load', handleLoad);
      safeAddEventListener(kicanvasElement, 'kicanvas:error', handleError);
      
      if (onSelectionChange) {
        safeAddEventListener(kicanvasElement, 'kicanvas:select', handleSelection);
      }

      // Add to container
      containerRef.current.appendChild(kicanvasElement);
      kicanvasElementRef.current = kicanvasElement;

      console.log('KiCanvas element created and added to DOM');

      // Trigger load callback after a brief delay to ensure element is fully initialized
      setTimeout(() => {
        if (kicanvasElementRef.current) {
          onLoad?.(kicanvasElementRef.current);
        }
      }, 100);

    } catch (err) {
      console.error('Error creating KiCanvas element:', err);
      const error = err instanceof Error ? err : new Error('Failed to create KiCanvas element');
      setError(error);
      onError?.(error);
    }
  }, [
    isKiCanvasLoaded, 
    src, 
    data, 
    dataType, 
    controls, 
    onLoad, 
    onError, 
    onSelectionChange, 
    safeAddEventListener, 
    cleanupEventListeners
  ]);

  // Load KiCanvas on mount
  useEffect(() => {
    console.log('Loading KiCanvas...');
    loadKiCanvas();
  }, [loadKiCanvas]);

  // Create element when KiCanvas is loaded
  useEffect(() => {
    if (isKiCanvasLoaded) {
      console.log('KiCanvas loaded, creating element...');
      createKiCanvasElement();
    }
  }, [isKiCanvasLoaded, createKiCanvasElement]);

  // Update src when it changes
  useEffect(() => {
    if (kicanvasElementRef.current && src) {
      console.log('Updating src to:', src);
      kicanvasElementRef.current.setAttribute('src', src);
    }
  }, [src]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up KiCanvas component...');
      cleanupEventListeners();
      if (kicanvasElementRef.current) {
        kicanvasElementRef.current.remove();
      }
    };
  }, [cleanupEventListeners]);

  // Debug info in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('KiCanvas Debug Info:', {
        isKiCanvasLoaded,
        isLoading,
        error: error?.message,
        hasContainer: !!containerRef.current,
        hasKiCanvasElement: !!kicanvasElementRef.current,
        src,
        scriptPath
      });
    }
  }, [isKiCanvasLoaded, isLoading, error, src, scriptPath]);

  // Render error state
  if (error) {
    return (
      <div className={className} style={style}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          color: '#ff6b6b',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              Error loading KiCanvas
            </div>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              {error.message}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>
              Check console for detailed debug information
            </div>
            <button 
              onClick={() => {
                setError(null);
                loadKiCanvas();
              }}
              style={{ 
                marginTop: '12px', 
                padding: '6px 12px', 
                backgroundColor: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className={className} style={style}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          color: '#666'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>⏳</div>
            <div>Loading KiCanvas...</div>
            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
              Loading from: {scriptPath}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render container for KiCanvas element
  return (
    <div 
      ref={containerRef}
      className={className} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        backgroundColor: '#f9f9f9', // Subtle background to see the container
        ...style 
      }}
    />
  );
};

// Simplified test component for debugging
export const KiCanvasTest: React.FC<{ src: string }> = ({ src }) => {
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  return (
    <div style={{ display: 'flex', height: '600px' }}>
      {/* Debug panel */}
      <div style={{ width: '300px', padding: '16px', backgroundColor: '#f0f0f0', fontSize: '12px' }}>
        <h4>Debug Log</h4>
        <div style={{ height: '500px', overflow: 'auto', fontFamily: 'monospace' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              {log}
            </div>
          ))}
        </div>
      </div>
      
      {/* KiCanvas viewer */}
      <div style={{ flex: 1 }}>
        <KiCanvasBase
          src={src}
          onLoad={(element) => addLog(`✅ KiCanvas loaded successfully: ${element.tagName}`)}
          onError={(error) => addLog(`❌ KiCanvas error: ${error.message}`)}
          onSelectionChange={(selection) => addLog(`🎯 Selection: ${selection.length} items`)}
        />
      </div>
    </div>
  );
};

export default KiCanvasBase;