// packages/shared-ui/components/KiCanvasViewer.tsx
import React, { useEffect, useRef } from 'react';
import { Paper, Box } from '@mui/material';

interface KiCanvasViewerProps {
  src?: string;
  controls?: 'basic' | 'full';
  height?: string | number;
  data?: string; // For inline KiCAD data
}

export const KiCanvasViewer: React.FC<KiCanvasViewerProps> = ({ 
  src, 
  controls = 'basic', 
  height = 400,
  data 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load KiCanvas when needed
    import('../../kicanvas-integration/dist/kicanvas.js').then(() => {
      // KiCanvas initialization logic
    });
  }, []);

  return (
    <Paper elevation={2} sx={{ height, overflow: 'hidden' }}>
      <Box ref={containerRef} sx={{ width: '100%', height: '100%' }}>
        {data ? (
          <kicanvas-embed controls={controls}>
            <kicanvas-source type="schematic">
              {data}
            </kicanvas-source>
          </kicanvas-embed>
        ) : (
          <kicanvas-embed src={src} controls={controls} />
        )}
      </Box>
    </Paper>
  );
};