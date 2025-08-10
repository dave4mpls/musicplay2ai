/**
 * SliderControl Component
 * A reusable slider control to be rendered on a canvas.
 */
    class SliderControl {
        constructor(config) {
            this.ctx = config.ctx;
            this.label = config.label;
            this.x = config.x;
            this.y = config.y;
            this.width = config.width || 100;
            this.height = 24; // Full interactive height
            this.min = config.min || 0;
            this.max = config.max || 127;
            this.value = config.initialValue;
            this.font = config.font || '12px sans-serif';
        }

        getBounds() {
            const trackHeight = 6;
            const handleWidth = 12;
            const trackX = this.x;
            const trackY = this.y + this.height / 2 - trackHeight / 2;
            const handleX = trackX + ((this.value - this.min) / (this.max - this.min)) * this.width - (handleWidth / 2);
            const handleY = this.y;
            
            return {
                track: { x: trackX, y: trackY, width: this.width, height: trackHeight },
                handle: { x: handleX, y: handleY, width: handleWidth, height: this.height }
            };
        }

        draw() {
            const bounds = this.getBounds();
            this.ctx.save();
            this.ctx.font = this.font;
            this.ctx.fillStyle = '#333';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(this.label, bounds.track.x, bounds.track.y - 10);

            // Draw track
            this.ctx.fillStyle = '#a0a0a0';
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.track.x, bounds.track.y, bounds.track.width, bounds.track.height, 3);
            this.ctx.fill();

            // Draw handle
            this.ctx.fillStyle = '#3b82f6';
            this.ctx.strokeStyle = '#2563eb';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.handle.x, bounds.handle.y, bounds.handle.width, bounds.handle.height, 4);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw value
            this.ctx.textAlign = 'right';
            this.ctx.fillText(this.value, bounds.track.x + bounds.track.width, bounds.track.y - 10);
            this.ctx.restore();
        }

        updateValueFromPosition(x) {
            const bounds = this.getBounds();
            const relativeX = x - bounds.track.x;
            const ratio = Math.max(0, Math.min(1, relativeX / bounds.track.width));
            this.value = Math.round(this.min + ratio * (this.max - this.min));
        }

        isPointOnControl(x, y) {
            const bounds = this.getBounds();
            const interactiveArea = {
                x: bounds.track.x,
                y: bounds.handle.y,
                width: bounds.track.width,
                height: bounds.handle.height
            };
            return x >= interactiveArea.x && x <= interactiveArea.x + interactiveArea.width &&
                   y >= interactiveArea.y && y <= interactiveArea.y + interactiveArea.height;
        }
    }
export { SliderControl };