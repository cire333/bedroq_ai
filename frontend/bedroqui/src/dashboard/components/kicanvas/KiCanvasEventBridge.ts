// KiCanvasEventBridge.ts - Bridges KiCanvas events to React patterns
export class KiCanvasEventBridge {
  private element: HTMLElement;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(element: HTMLElement) {
    this.element = element;
    this.setupInternalEventListeners();
  }

  private setupInternalEventListeners() {
    // KiCanvas events (when implemented)
    const kicanvasEvents = [
      'kicanvas:load',
      'kicanvas:error', 
      'kicanvas:click',
      'kicanvas:select',
      'kicanvas:documentchange',
      'kicanvas:loadstart'
    ];

    kicanvasEvents.forEach(eventName => {
      this.element.addEventListener(eventName, (event) => {
        this.emit(eventName, event);
      });
    });

    // Canvas events
    const canvas = this.element.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('wheel', (event) => {
        this.emit('zoom', { 
          delta: event.deltaY,
          x: event.clientX,
          y: event.clientY 
        });
      });

      canvas.addEventListener('mousedown', (event) => {
        this.emit('pan-start', { x: event.clientX, y: event.clientY });
      });
    }
  }

  on(eventName: string, callback: Function) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);
  }

  off(eventName: string, callback: Function) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(eventName: string, data: any) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  destroy() {
    this.listeners.clear();
  }
}