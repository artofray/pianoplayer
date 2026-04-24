export class MotionDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private previousImageData: ImageData | null = null;
  private width: number;
  private height: number;

  constructor(width: number = 160, height: number = 120) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  detect(video: HTMLVideoElement, threshold: number, flipX: boolean): {x: number, y: number, intensity: number}[] {
    const points: {x: number, y: number, intensity: number}[] = [];
    if (!this.ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return points;
    }

    this.ctx.save();
    if (flipX) {
      this.ctx.translate(this.width, 0);
      this.ctx.scale(-1, 1);
    }
    this.ctx.drawImage(video, 0, 0, this.width, this.height);
    this.ctx.restore();

    const currentImageData = this.ctx.getImageData(0, 0, this.width, this.height);
    
    if (this.previousImageData) {
      const currentPixels = currentImageData.data;
      const prevPixels = this.previousImageData.data;
      
      // Subsample the grid for massive performance boost
      // A step of 4 means we check every 4th pixel (sufficient for gross motion)
      const step = 4;

      for (let y = 0; y < this.height; y += step) {
        for (let x = 0; x < this.width; x += step) {
          const index = (y * this.width + x) * 4;
          
          const rDiff = Math.abs(currentPixels[index] - prevPixels[index]);
          const gDiff = Math.abs(currentPixels[index + 1] - prevPixels[index + 1]);
          const bDiff = Math.abs(currentPixels[index + 2] - prevPixels[index + 2]);
          
          const diff = rDiff + gDiff + bDiff;
          
          // Multiply threshold to match older math logic
          if (diff > threshold * 3) {
            points.push({
               x: x / this.width, 
               y: y / this.height, 
               intensity: diff 
            });
          }
        }
      }
    }

    this.previousImageData = currentImageData;
    return points;
  }
}
