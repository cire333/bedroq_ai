// Fixed KiCanvasViewer.tsx with proper controller creation and file validation
import React, { useState, useCallback, useEffect } from 'react';
import { KiCanvasBase } from './KiCanvasBase';
import { KiCanvasController } from './KiCanvasController';

export interface KiCanvasViewerProps {
  src?: string;
  data?: string;
  dataType?: 'schematic' | 'board' | 'project';
  controls?: 'none' | 'basic' | 'full';
  className?: string;
  style?: React.CSSProperties;
  scriptPath?: string;
  showToolbar?: boolean;
  showStatusBar?: boolean;
  toolbarPosition?: 'top' | 'bottom';
  customToolbarItems?: React.ReactNode;
  onLoad?: (element: HTMLElement) => void;
  onError?: (error: Error) => void;
  onSelectionChange?: (selection: any[]) => void;
}

export const KiCanvasViewer: React.FC<KiCanvasViewerProps> = ({
  src,
  showToolbar = true,
  showStatusBar = true,
  toolbarPosition = 'top',
  customToolbarItems,
  onLoad,
  onError,
  onSelectionChange,
  ...baseProps
}) => {
  const [controller, setController] = useState<KiCanvasController | null>(null);
  const [selection, setSelection] = useState<any[]>([]);
  const [canvasInfo, setCanvasInfo] = useState<any>(null);
  const [fileValidated, setFileValidated] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Validate file before loading
  const validateFile = useCallback(async (filePath: string) => {
    try {
      console.log('Validating file:', filePath);
      const response = await fetch(filePath, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`File not accessible: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('File content type:', contentType);

      // Check if it's actually a KiCAD file (should not be HTML)
      if (contentType && contentType.includes('text/html')) {
        throw new Error('File appears to be HTML (possibly 404 page). Check the file path.');
      }

      setFileValidated(true);
      setFileError(null);
      console.log('File validation passed');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
      setFileError(errorMsg);
      setFileValidated(false);
      console.error('File validation failed:', errorMsg);
      onError?.(new Error(`File validation failed: ${errorMsg}`));
    }
  }, [onError]);

  // Validate file when src changes
  useEffect(() => {
    if (src) {
      setFileValidated(false);
      setFileError(null);
      validateFile(src);
    }
  }, [src, validateFile]);

  const handleLoad = useCallback((element: HTMLElement) => {
    console.log('Creating controller for element:', element);
    
    // Wait a bit for KiCanvas to fully initialize
    setTimeout(() => {
      const ctrl = new KiCanvasController(element);
      setController(ctrl);
      
      // Get initial canvas info
      const info = ctrl.getCanvasInfo();
      setCanvasInfo(info);
      console.log('Controller created with canvas info:', info);
      
      onLoad?.(element);
    }, 500);
  }, [onLoad]);

  const handleError = useCallback((error: Error) => {
    console.error('KiCanvas error:', error);
    setController(null);
    onError?.(error);
  }, [onError]);

  // Update canvas info periodically
  useEffect(() => {
    if (controller) {
      const interval = setInterval(() => {
        const info = controller.getCanvasInfo();
        if (info) setCanvasInfo(info);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [controller]);

  // Toolbar component
  const toolbar = showToolbar && (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '8px 12px',
      borderBottom: toolbarPosition === 'top' ? '1px solid #e0e0e0' : 'none',
      borderTop: toolbarPosition === 'bottom' ? '1px solid #e0e0e0' : 'none',
      backgroundColor: '#f8f9fa',
      flexShrink: 0
    }}>
      <button 
        onClick={() => {
          console.log('Zoom in button clicked');
          controller?.zoomIn();
        }}
        disabled={!controller || !fileValidated}
        style={{ 
          padding: '6px 12px', 
          cursor: (!controller || !fileValidated) ? 'not-allowed' : 'pointer',
          backgroundColor: (!controller || !fileValidated) ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Zoom In"
      >
        🔍+
      </button>
      <button 
        onClick={() => {
          console.log('Zoom out button clicked');
          controller?.zoomOut();
        }}
        disabled={!controller || !fileValidated}
        style={{ 
          padding: '6px 12px', 
          cursor: (!controller || !fileValidated) ? 'not-allowed' : 'pointer',
          backgroundColor: (!controller || !fileValidated) ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Zoom Out"
      >
        🔍-
      </button>
      <button 
        onClick={() => {
          console.log('Zoom to fit button clicked');
          controller?.zoomToFit();
        }}
        disabled={!controller || !fileValidated}
        style={{ 
          padding: '6px 12px', 
          cursor: (!controller || !fileValidated) ? 'not-allowed' : 'pointer',
          backgroundColor: (!controller || !fileValidated) ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Zoom to Fit"
      >
        📐
      </button>
      <button 
        onClick={() => {
          console.log('Reset view button clicked');
          controller?.resetView();
        }}
        disabled={!controller || !fileValidated}
        style={{ 
          padding: '6px 12px', 
          cursor: (!controller || !fileValidated) ? 'not-allowed' : 'pointer',
          backgroundColor: (!controller || !fileValidated) ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Reset View"
      >
        🔄
      </button>
      <button 
        onClick={() => {
          console.log('Download button clicked');
          controller?.downloadAsImage();
        }}
        disabled={!controller || !fileValidated}
        style={{ 
          padding: '6px 12px', 
          cursor: (!controller || !fileValidated) ? 'not-allowed' : 'pointer',
          backgroundColor: (!controller || !fileValidated) ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Download as PNG"
      >
        💾
      </button>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#ccc', margin: '0 8px' }} />
      
      {customToolbarItems}
      
      <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
        {fileError && (
          <span style={{ color: '#dc3545' }}>❌ File Error</span>
        )}
        {!fileValidated && !fileError && src && (
          <span style={{ color: '#ffc107' }}>🔄 Validating...</span>
        )}
        {fileValidated && !controller && (
          <span style={{ color: '#ffc107' }}>🔄 Loading...</span>
        )}
        {controller && fileValidated && (
          <span style={{ color: '#28a745' }}>✅ Ready</span>
        )}
        {selection.length > 0 && (
          <span style={{ marginLeft: '12px' }}>
            {selection.length} selected
          </span>
        )}
      </div>
    </div>
  );

  // Status bar component
  const statusBar = showStatusBar && (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '4px 12px',
      borderTop: '1px solid #e0e0e0',
      backgroundColor: '#f8f9fa',
      fontSize: '11px',
      color: '#666',
      flexShrink: 0
    }}>
      <div>
        {canvasInfo ? (
          <span>{canvasInfo.width} × {canvasInfo.height}</span>
        ) : (
          <span>No canvas info</span>
        )}
      </div>
      <div>
        {fileError ? (
          <span style={{ color: '#dc3545' }}>File Error: {fileError}</span>
        ) : fileValidated ? (
          <span style={{ color: '#28a745' }}>File OK</span>
        ) : (
          <span>Checking file...</span>
        )}
      </div>
      <div>
        {src ? (
          <span title={src}>{src.split('/').pop()}</span>
        ) : (
          <span>No file</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      ...baseProps.style 
    }}>
      {toolbarPosition === 'top' && toolbar}
      
      <div style={{ flex: 1, minHeight: 0 }}>
        {fileValidated ? (
          <KiCanvasBase
            {...baseProps}
            src={src}
            onLoad={handleLoad}
            onError={handleError}
            onSelectionChange={(selection) => {
              setSelection(selection);
              onSelectionChange?.(selection);
            }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : fileError ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ color: '#dc3545', fontSize: '18px', marginBottom: '8px' }}>
                ❌ File Error
              </div>
              <div style={{ marginBottom: '12px' }}>
                {fileError}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Expected path: <code>{src}</code>
              </div>
              <button
                onClick={() => src && validateFile(src)}
                style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
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
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666'
          }}>
            <div>🔄 Validating file...</div>
          </div>
        )}
      </div>
      
      {toolbarPosition === 'bottom' && toolbar}
      {statusBar}
    </div>
  );
};

export default KiCanvasViewer;