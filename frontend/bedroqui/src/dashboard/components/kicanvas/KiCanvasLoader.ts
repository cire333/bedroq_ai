// KiCanvasLoader.ts - Handles loading and managing KiCanvas dependency
export class KiCanvasLoader {
  private static instance: KiCanvasLoader;
  private loadPromise: Promise<void> | null = null;
  private isLoaded = false;

  static getInstance(): KiCanvasLoader {
    if (!KiCanvasLoader.instance) {
      KiCanvasLoader.instance = new KiCanvasLoader();
    }
    return KiCanvasLoader.instance;
  }

  async ensureLoaded(scriptPath: string = '/kicanvas.js'): Promise<void> {
    if (this.isLoaded) return;
    
    if (!this.loadPromise) {
      this.loadPromise = this.loadScript(scriptPath);
    }
    
    return this.loadPromise;
  }

  private async loadScript(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof customElements !== 'undefined' && 
          customElements.get('kicanvas-embed')) {
        this.isLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.type = 'module';
      script.src = scriptPath;
      
      script.onload = () => {
        // Wait for custom elements to be defined
        setTimeout(() => {
          this.isLoaded = true;
          resolve();
        }, 100);
      };
      
      script.onerror = () => {
        reject(new Error(`Failed to load KiCanvas from ${scriptPath}`));
      };
      
      document.head.appendChild(script);
    });
  }

  isKiCanvasLoaded(): boolean {
    return this.isLoaded;
  }
}