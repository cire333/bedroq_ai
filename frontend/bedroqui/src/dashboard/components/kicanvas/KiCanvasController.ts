// Fixed KiCanvasController.ts - Complete controller implementation
export class KiCanvasController {
  private element: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private observer: MutationObserver | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
    this.findCanvas();
    this.observeCanvasChanges();
  }

  private findCanvas() {
    this.canvas = this.element.querySelector('canvas');
    if (this.canvas) {
      console.log('Canvas found:', this.canvas);
    }
  }

  private observeCanvasChanges() {
    this.observer = new MutationObserver(() => {
      if (!this.canvas) {
        this.findCanvas();
      }
    });

    this.observer.observe(this.element, {
      childList: true,
      subtree: true
    });
  }

  // Zoom controls via simulated mouse wheel events
  zoomIn(steps: number = 1) {
    if (!this.canvas) {
      console.warn('Cannot zoom in: canvas not found');
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < steps; i++) {
      this.canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -120,
        clientX: centerX,
        clientY: centerY,
        bubbles: true,
        cancelable: true
      }));
    }
    console.log('Zoom in executed');
  }

  zoomOut(steps: number = 1) {
    if (!this.canvas) {
      console.warn('Cannot zoom out: canvas not found');
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < steps; i++) {
      this.canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 120,
        clientX: centerX,
        clientY: centerY,
        bubbles: true,
        cancelable: true
      }));
    }
    console.log('Zoom out executed');
  }

  zoomToFit() {
    if (!this.canvas) {
      console.warn('Cannot zoom to fit: canvas not found');
      return;
    }

    // Try to call internal KiCanvas methods first
    if (this.tryApiCall('zoomToFit')) {
      console.log('Zoom to fit via API');
      return;
    }

    // Fallback: keyboard shortcut
    this.sendKeyboardShortcut('f');
    console.log('Zoom to fit via keyboard shortcut');
  }

  resetView() {
    if (!this.canvas) {
      console.warn('Cannot reset view: canvas not found');
      return;
    }

    if (this.tryApiCall('resetView')) {
      console.log('Reset view via API');
      return;
    }

    // Fallback: keyboard shortcut
    this.sendKeyboardShortcut('Escape');
    console.log('Reset view via keyboard shortcut');
  }

  pan(deltaX: number, deltaY: number) {
    if (!this.canvas) {
      console.warn('Cannot pan: canvas not found');
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // Simulate mouse drag
    this.canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: startX, clientY: startY, button: 0, buttons: 1, bubbles: true
    }));

    this.canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: startX + deltaX, clientY: startY + deltaY, button: 0, buttons: 1, bubbles: true
    }));

    this.canvas.dispatchEvent(new MouseEvent('mouseup', {
      clientX: startX + deltaX, clientY: startY + deltaY, button: 0, buttons: 0, bubbles: true
    }));

    console.log(`Pan executed: ${deltaX}, ${deltaY}`);
  }

  async downloadAsImage(filename: string = 'kicanvas-export', format: 'png' | 'jpeg' = 'png') {
    if (!this.canvas) {
      console.warn('Cannot export: canvas not found');
      return;
    }

    try {
      const dataUrl = this.canvas.toDataURL(`image/${format}`);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Image downloaded:', filename);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  getCanvasInfo() {
    if (!this.canvas) {
      console.warn('Cannot get canvas info: canvas not found');
      return null;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      displayWidth: rect.width,
      displayHeight: rect.height,
      rect
    };
  }

  private tryApiCall(methodName: string, ...args: any[]): boolean {
    const possiblePaths = [
      (this.element as any).kicanvas,
      (this.element as any).__kicanvas__,
      (this.element as any).viewer,
      (this.element as any)._viewer
    ];

    for (const apiObject of possiblePaths) {
      if (apiObject && typeof apiObject[methodName] === 'function') {
        try {
          apiObject[methodName](...args);
          return true;
        } catch (error) {
          console.warn(`API call ${methodName} failed:`, error);
        }
      }
    }
    return false;
  }

  private sendKeyboardShortcut(key: string, modifiers: any = {}) {
    if (!this.canvas) return;
    
    this.canvas.focus();
    this.canvas.dispatchEvent(new KeyboardEvent('keydown', {
      key, ...modifiers, bubbles: true
    }));
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}