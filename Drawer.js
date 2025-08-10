// Drawer.js
// This file includes the Drawer class which manages the MIDI instrument selection and settings.


/**
 * ===================================================================
 * MIDI INSTRUMENT DATA
 * ===================================================================
 * Defines the 128 General MIDI instruments, grouped into 16 categories.
 */
const MIDI_INSTRUMENTS = [
    { name: "Piano", instruments: [
        { value: 0, text: "Acoustic Grand Piano" }, { value: 1, text: "Bright Acoustic Piano" },
        { value: 2, text: "Electric Grand Piano" }, { value: 3, text: "Honky-tonk Piano" },
        { value: 4, text: "Electric Piano 1" }, { value: 5, text: "Electric Piano 2" },
        { value: 6, text: "Harpsichord" }, { value: 7, text: "Clavinet" }
    ]},
    { name: "Percussion", instruments: [
        { value: 8, text: "Celesta" }, { value: 9, text: "Glockenspiel" },
        { value: 10, text: "Music Box" }, { value: 11, text: "Vibraphone" },
        { value: 12, text: "Marimba" }, { value: 13, text: "Xylophone" },
        { value: 14, text: "Tubular Bells" }, { value: 15, text: "Dulcimer" },
        { value: 128, text: "Standard Drums"}
    ]},
    { name: "Organ", instruments: [
        { value: 16, text: "Drawbar Organ" }, { value: 17, text: "Percussive Organ" },
        { value: 18, text: "Rock Organ" }, { value: 19, text: "Church Organ" },
        { value: 20, text: "Reed Organ" }, { value: 21, text: "Accordion" },
        { value: 22, text: "Harmonica" }, { value: 23, text: "Tango Accordion" }
    ]},
    { name: "Guitar", instruments: [
        { value: 24, text: "Acoustic Guitar (nylon)" }, { value: 25, text: "Acoustic Guitar (steel)" },
        { value: 26, text: "Electric Guitar (jazz)" }, { value: 27, text: "Electric Guitar (clean)" },
        { value: 28, text: "Electric Guitar (muted)" }, { value: 29, text: "Overdriven Guitar" },
        { value: 30, text: "Distortion Guitar" }, { value: 31, text: "Guitar Harmonics" }
    ]},
    { name: "Bass", instruments: [
        { value: 32, text: "Acoustic Bass" }, { value: 33, text: "Electric Bass (finger)" },
        { value: 34, text: "Electric Bass (pick)" }, { value: 35, text: "Fretless Bass" },
        { value: 36, text: "Slap Bass 1" }, { value: 37, text: "Slap Bass 2" },
        { value: 38, text: "Synth Bass 1" }, { value: 39, text: "Synth Bass 2" }
    ]},
    { name: "Strings", instruments: [
        { value: 40, text: "Violin" }, { value: 41, text: "Viola" }, { value: 42, text: "Cello" },
        { value: 43, text: "Contrabass" }, { value: 44, text: "Tremolo Strings" },
        { value: 45, text: "Pizzicato Strings" }, { value: 46, text: "Orchestral Harp" },
        { value: 47, text: "Timpani" }
    ]},
    { name: "Ensemble", instruments: [
        { value: 48, text: "String Ensemble 1" }, { value: 49, text: "String Ensemble 2" },
        { value: 50, text: "Synth Strings 1" }, { value: 51, text: "Synth Strings 2" },
        { value: 52, text: "Choir Aahs" }, { value: 53, text: "Voice Oohs" },
        { value: 54, text: "Synth Voice" }, { value: 55, text: "Orchestra Hit" }
    ]},
    { name: "Brass", instruments: [
        { value: 56, text: "Trumpet" }, { value: 57, text: "Trombone" }, { value: 58, text: "Tuba" },
        { value: 59, text: "Muted Trumpet" }, { value: 60, text: "French Horn" },
        { value: 61, text: "Brass Section" }, { value: 62, text: "Synth Brass 1" },
        { value: 63, text: "Synth Brass 2" }
    ]},
    { name: "Reed", instruments: [
        { value: 64, text: "Soprano Sax" }, { value: 65, text: "Alto Sax" }, { value: 66, text: "Tenor Sax" },
        { value: 67, text: "Baritone Sax" }, { value: 68, text: "Oboe" }, { value: 69, text: "English Horn" },
        { value: 70, text: "Bassoon" }, { value: 71, text: "Clarinet" }
    ]},
    { name: "Pipe", instruments: [
        { value: 72, text: "Piccolo" }, { value: 73, text: "Flute" }, { value: 74, text: "Recorder" },
        { value: 75, text: "Pan Flute" }, { value: 76, text: "Blown Bottle" },
        { value: 77, text: "Shakuhachi" }, { value: 78, text: "Whistle" }, { value: 79, text: "Ocarina" }
    ]},
    { name: "Synth Lead", instruments: [
        { value: 80, text: "Lead 1 (square)" }, { value: 81, text: "Lead 2 (sawtooth)" },
        { value: 82, text: "Lead 3 (calliope)" }, { value: 83, text: "Lead 4 (chiff)" },
        { value: 84, text: "Lead 5 (charang)" }, { value: 85, text: "Lead 6 (voice)" },
        { value: 86, text: "Lead 7 (fifths)" }, { value: 87, text: "Lead 8 (bass + lead)" }
    ]},
    { name: "Synth Pad", instruments: [
        { value: 88, text: "Pad 1 (new age)" }, { value: 89, text: "Pad 2 (warm)" },
        { value: 90, text: "Pad 3 (polysynth)" }, { value: 91, text: "Pad 4 (choir)" },
        { value: 92, text: "Pad 5 (bowed)" }, { value: 93, text: "Pad 6 (metallic)" },
        { value: 94, text: "Pad 7 (halo)" }, { value: 95, text: "Pad 8 (sweep)" }
    ]},
    { name: "Synth Effects", instruments: [
        { value: 96, text: "FX 1 (rain)" }, { value: 97, text: "FX 2 (soundtrack)" },
        { value: 98, text: "FX 3 (crystal)" }, { value: 99, text: "FX 4 (atmosphere)" },
        { value: 100, text: "FX 5 (brightness)" }, { value: 101, text: "FX 6 (goblins)" },
        { value: 102, text: "FX 7 (echoes)" }, { value: 103, text: "FX 8 (sci-fi)" }
    ]},
    { name: "Ethnic", instruments: [
        { value: 104, text: "Sitar" }, { value: 105, text: "Banjo" }, { value: 106, text: "Shamisen" },
        { value: 107, text: "Koto" }, { value: 108, text: "Kalimba" }, { value: 109, text: "Bag pipe" },
        { value: 110, text: "Fiddle" }, { value: 111, text: "Shanai" }
    ]},
    { name: "Percussive", instruments: [
        { value: 112, text: "Tinkle Bell" }, { value: 113, text: "Agogo" }, { value: 114, text: "Steel Drums" },
        { value: 115, text: "Woodblock" }, { value: 116, text: "Taiko Drum" },
        { value: 117, text: "Melodic Tom" }, { value: 118, text: "Synth Drum" },
        { value: 119, text: "Reverse Cymbal" }
    ]},
    { name: "Sound Effects", instruments: [
        { value: 120, text: "Guitar Fret Noise" }, { value: 121, text: "Breath Noise" },
        { value: 122, text: "Seashore" }, { value: 123, text: "Bird Tweet" },
        { value: 124, text: "Telephone Ring" }, { value: 125, text: "Helicopter" },
        { value: 126, text: "Applause" }, { value: 127, text: "Gunshot" }
    ]}
];

/**
 * ===================================================================
 * UI CONTROL COMPONENTS (REFACTORED)
 * ===================================================================
 * Each control now handles its own pointer interactions. The parent
 * component calls `handleEvent` and the control determines what to do.
 */

class BaseControl {
    constructor(config) {
        this.ctx = config.ctx;
        this.id = config.id || null;
        this.label = config.label || '';
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.font = config.font || '12px sans-serif';
        this.width = config.width || 0;
        this.height = config.height || 0;
        this.onStateChange = config.onStateChange || (() => {});

        // Internal state for interactions
        this.isDragging = false;
        this.isPressed = false;
    }

    // Universal event handler to be called by the parent
    handleEvent(event) {
        switch (event.type) {
            case 'pointerdown':
                return this.onPointerDown(event.x, event.y, event.owner);
            case 'pointermove':
                return this.onPointerMove(event.x, event.y, event.owner);
            case 'pointerup':
                return this.onPointerUp(event.x, event.y, event.owner);
            case 'wheel':
                return this.onWheel(event.deltaY, event.owner);
        }
        return null;
    }

    // To be implemented by subclasses
    onPointerDown(x, y, owner) { return null; }
    onPointerMove(x, y, owner) { }
    onPointerUp(x, y, owner) { }
    onWheel(deltaY, owner) { }
    draw(isOverlay = false) { }
    isPointOnControl(x, y) { return false; }
    
    // Utility
    isPointInRect(x, y, rect) {
        return rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}

class SliderControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = config.width || 100;
        this.height = 24;
        this.min = config.min || 0;
        this.max = config.max || 127;
        this.value = config.initialValue;
    }

    getBounds() {
        const trackHeight = 6, handleWidth = 12;
        const trackX = this.x, trackY = this.y + this.height / 2 - trackHeight / 2;
        const handleX = trackX + ((this.value - this.min) / (this.max - this.min)) * (this.width - handleWidth);
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
        this.ctx.fillStyle = this.isDragging ? '#1d4ed8' : '#333';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.label, bounds.track.x, bounds.track.y - 10);
        this.ctx.fillStyle = '#a0a0a0';
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.track.x, bounds.track.y, bounds.track.width, bounds.track.height, 3);
        this.ctx.fill();
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.handle.x, bounds.handle.y, bounds.handle.width, bounds.handle.height, 4);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.textAlign = 'right';
        this.ctx.fillText(this.value, bounds.track.x + bounds.track.width, bounds.track.y - 10);
        this.ctx.restore();
    }

    updateValueFromPosition(x) {
        const bounds = this.getBounds();
        const handleWidth = bounds.handle.width;
        const relativeX = x - (bounds.track.x + handleWidth / 2);
        const ratio = Math.max(0, Math.min(1, relativeX / (bounds.track.width - handleWidth)));
        const newValue = Math.round(this.min + ratio * (this.max - this.min));
        if (newValue !== this.value) {
            this.value = newValue;
            this.onStateChange(this);
        }
    }
    
    onPointerDown(x, y) {
        if (this.isPointOnControl(x, y)) {
            this.isDragging = true;
            this.updateValueFromPosition(x);
            return { action: 'capture', control: this };
        }
        return null;
    }

    onPointerMove(x, y) {
        if (this.isDragging) {
            this.updateValueFromPosition(x);
        }
    }

    onPointerUp() {
        this.isDragging = false;
        return { action: 'release' };
    }

    isPointOnControl(x, y) {
        const bounds = this.getBounds();
        const interactiveArea = { x: bounds.track.x, y: bounds.handle.y, width: bounds.track.width, height: bounds.handle.height };
        return this.isPointInRect(x, y, interactiveArea);
    }
}

class KnobControl extends BaseControl {
    constructor(config) {
        super(config);
        this.radius = config.radius || 22;
        this.width = this.radius * 2;
        this.height = this.radius * 2 + 20; // space for label
        this.min = config.min || 0;
        this.max = config.max || 127;
        this.value = config.initialValue || 0;
        this.startAngle = -Math.PI * 0.8;
        this.endAngle = Math.PI * 0.8;
        this.totalAngleRange = this.endAngle - this.startAngle;
        this.lastAngle = 0;
    }

    getCenter() {
        return { x: this.x + this.radius, y: this.y + this.radius };
    }

    draw() {
        const center = this.getCenter();
        const ratio = (this.value - this.min) / (this.max - this.min);
        const currentAngle = this.startAngle + ratio * this.totalAngleRange;

        this.ctx.save();
        this.ctx.font = this.font;
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.label, center.x, this.y + this.height - 5);

        const grad = this.ctx.createRadialGradient(center.x - 5, center.y - 5, 1, center.x, center.y, this.radius);
        grad.addColorStop(0, '#777');
        grad.addColorStop(1, '#444');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, this.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = this.isDragging ? '#3b82f6' : '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(center.x, center.y);
        this.ctx.lineTo(center.x + Math.cos(currentAngle) * this.radius * 0.8, center.y + Math.sin(currentAngle) * this.radius * 0.8);
        this.ctx.stroke();

        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(this.value, center.x, center.y + 4);
        this.ctx.restore();
    }
    
    onPointerDown(x, y) {
        if (this.isPointOnControl(x, y)) {
            this.isDragging = true;
            const center = this.getCenter();
            this.lastAngle = Math.atan2(y - center.y, x - center.x);
            return { action: 'capture', control: this };
        }
        return null;
    }

    onPointerMove(x, y) {
        if (!this.isDragging) return;

        const center = this.getCenter();
        const currentAngle = Math.atan2(y - center.y, x - center.x);
        let deltaAngle = currentAngle - this.lastAngle;

        if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        
        const sensitivity = Math.PI * 2; // Radians for a full sweep
        const valueChange = (deltaAngle / sensitivity) * (this.max - this.min);
        
        const newValue = Math.round(this.value + valueChange);
        this.value = Math.max(this.min, Math.min(this.max, newValue));

        this.lastAngle = currentAngle;
        this.onStateChange(this);
    }

    onPointerUp() {
        if (this.isDragging) {
            this.isDragging = false; // Stop the dragging state
            return { action: 'release' }; // Signal to release the pointer capture
        }
        return null;
    }

    isPointOnControl(x, y) {
        const center = this.getCenter();
        const dx = x - center.x;
        const dy = y - center.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }
}

class ToggleSwitch extends BaseControl {
    constructor(config) {
        super(config);
        this.width = 40;
        this.height = 20;
        this.value = config.initialValue || false;
    }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    getFullWidth() {
        const labelWidth = this.ctx.measureText(this.label).width;
        return this.width + 15 + labelWidth;
    }

    draw() {
        const bounds = this.getBounds();
        this.ctx.save();
        this.ctx.font = this.font;
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.label, bounds.x + bounds.width + 10, bounds.y + bounds.height / 2);
        
        this.ctx.fillStyle = this.value ? '#3b82f6' : '#a0a0a0';
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, this.height / 2);
        this.ctx.fill();

        const handleRadius = this.height / 2 - 2;
        const handleX = this.value ? bounds.x + bounds.width - handleRadius - 2 : bounds.x + handleRadius + 2;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(handleX, bounds.y + this.height / 2, handleRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    onPointerDown(x, y) {
            if (this.isPointOnControl(x, y)) {
            this.value = !this.value;
            this.onStateChange(this);
            // No capture needed, it's a single-click action
            return { action: 'update' };
        }
        return null;
    }

    isPointOnControl(x, y) {
        const fullWidth = this.getFullWidth();
        const bounds = this.getBounds();
        return this.isPointInRect(x, y, {x: bounds.x, y: bounds.y, width: fullWidth, height: bounds.height});
    }
}

class ButtonControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = config.width || 80;
        this.height = config.height || 28;
        this.onClick = config.onClick || (() => {});
        this.isActive = config.isActive || (() => false);
        this.autoSize = config.autoSize || false;
        this.padding = config.padding || 20; // Horizontal padding (10px on each side)
    }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    draw(substituteText = null) {
        const bounds = this.getBounds();
        this.ctx.save();
        const active = this.isActive();

        if (this.isPressed) {
            this.ctx.fillStyle = '#555';
        } else {
            this.ctx.fillStyle = active ? '#3b82f6' : '#ccc';
        }
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 5);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.font = this.font;
        this.ctx.fillStyle = this.isPressed || active ? '#fff' : '#333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(substituteText ||this.label, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        this.ctx.restore();
    }

    onPointerDown(x, y) {
        if (this.isPointOnControl(x, y)) {
            this.isPressed = true;
            this.onClick();
            this.onStateChange(this);
            return { action: 'capture', control: this };
        }
        return null;
    }

    onPointerUp() {
        this.isPressed = false;
        return { action: 'release' };
    }

    isPointOnControl(x, y) {
        return this.isPointInRect(x, y, this.getBounds());
    }
    updateWidth() {
        if (this.autoSize) {
            this.ctx.save();
            this.ctx.font = this.font;
            const textMetrics = this.ctx.measureText(this.label);
            this.width = textMetrics.width + this.padding;
            this.ctx.restore();
        }
    }
}

class StaticTextControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = config.width || 80;
        this.height = config.height || 28;
        this.onClick = config.onClick || (() => {});
        this.autoSize = config.autoSize || false;
        this.padding = config.padding || 10; // Horizontal padding right only
    }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    draw(substituteText = null) {
        const bounds = this.getBounds();
        this.ctx.save();

        // fill style is transparent
        this.ctx.fillStyle = 'transparent';
        this.ctx.strokeStyle = '#999';

        this.ctx.font = this.font;
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(substituteText ||this.label, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        this.ctx.restore();
    }

    onPointerDown(x, y) {
        return null;
    }

    onPointerUp() {
        this.isPressed = false;
        return { action: 'release' };
    }

    isPointOnControl(x, y) {
        return false;  // static text does not respond to clicks
    }
    updateWidth() {
        if (this.autoSize) {
            this.ctx.save();
            this.ctx.font = this.font;
            const textMetrics = this.ctx.measureText(this.label);
            this.width = textMetrics.width + this.padding;
            this.ctx.restore();
        }
    }
}

class RowControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = 0;
        this.height = 0;
        this.controls = config.controls || [];
    }

    getBounds() {
        // the bounds of the row control are the minimum x and y of any controls 
        // and the maximum of x+height, y+height of all controls
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.controls.forEach(control => {  
            const bounds = control.getBounds();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    draw() {
        // to draw the row control, we need to draw each child control
        this.ctx.save();
        this.controls.forEach(control => {
            control.draw();
        });
        this.ctx.restore();
    }

    onPointerDown(x, y) {
        // Check if the pointer is on any of the child controls
        for (const control of this.controls) {
            if (control.isPointOnControl(x, y)) {
                // If a control is found to match, it handles its own pointer down
                const result = control.onPointerDown(x, y);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }

    isPointOnControl(x, y) {
        // Check if the point is within the bounds of any child control
        for (const control of this.controls) {
            if (control.isPointOnControl(x, y)) {
                return true;
            }
        }
        return false;
    }

}

// NOTE: Dropdown, InstrumentControl and PopupSlider are complex "Overlay" controls.
// They need to signal to the parent when they have an overlay to draw.
class DropdownControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = config.width || 120;
        this.height = config.height || 28;
        this.options = config.options; 
        this.onSelect = config.onSelect || (() => {});
        this.selectedValue = config.initialValue;
        this.isOpen = false;
        this.showLabel = config.showLabel !== false;
        this.highlightedIndex = -1;
        this.scrollOffset = 0;
        // Scrollbar dragging state
        this.isDraggingScrollbar = false;
        this.scrollbarDragStartY = 0;
    }
    
    // This control needs to be rendered on an overlay
    needsOverlay() { return this.isOpen; }

    getBounds(canvasHeight) {
        const optionHeight = 25;
        const scrollbarWidth = 18;
        const dropdownPadding = 10;
        const maxDropdownHeight = canvasHeight - (this.y + this.height) - dropdownPadding;
        const calculatedDropdownHeight = (this.options.length * optionHeight);
        const dropdownHeight = this.isOpen ? Math.min(maxDropdownHeight, calculatedDropdownHeight) : 0;
        const isScrollable = calculatedDropdownHeight > maxDropdownHeight;

        const bounds = {
            main: { x: this.x, y: this.y, width: this.width, height: this.height },
            dropdown: { x: this.x, y: this.y + this.height, width: this.width, height: dropdownHeight },
            options: this.options.map((opt, i) => ({
                x: this.x, y: this.y + this.height + (i * optionHeight),
                width: this.width, height: optionHeight
            })),
            isScrollable: isScrollable,
            scrollbar: null
        };

        if (this.isOpen && isScrollable) {
            const trackHeight = dropdownHeight;
            const contentHeight = calculatedDropdownHeight;
            const handleHeight = Math.max(20, (trackHeight / contentHeight) * trackHeight);
            const maxScroll = contentHeight - trackHeight;
            const handleY = bounds.dropdown.y + (this.scrollOffset / maxScroll) * (trackHeight - handleHeight);
            
            bounds.scrollbar = {
                track: { x: this.x + this.width - scrollbarWidth, y: this.y + this.height, width: scrollbarWidth, height: trackHeight },
                handle: { x: this.x + this.width - scrollbarWidth, y: handleY, width: scrollbarWidth, height: handleHeight }
            };
        }
        
        return bounds;
    }

    draw(isOverlay = false) {
        const bounds = this.getBounds(this.ctx.canvas.height);
        this.ctx.save();
        this.ctx.font = this.font;

        // Draw main button
        this.ctx.fillStyle = '#ccc';
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.main.x, bounds.main.y, bounds.main.width, bounds.main.height, 5);
        this.ctx.fill();
        this.ctx.stroke();

        const selectedOption = this.options.find(opt => opt.value === this.selectedValue);
        const displayText = this.showLabel ? `${this.label}: ${selectedOption ? selectedOption.text : ''}` : (selectedOption ? selectedOption.text : '');
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(displayText, bounds.main.x + 8, bounds.main.y + bounds.main.height / 2);
        
        const arrowX = bounds.main.x + bounds.main.width - 15;
        const arrowY = bounds.main.y + bounds.main.height / 2;
        this.ctx.strokeStyle = '#333';
        this.ctx.beginPath();
        if (this.isOpen) {
            this.ctx.moveTo(arrowX - 4, arrowY + 2); this.ctx.lineTo(arrowX, arrowY - 2); this.ctx.lineTo(arrowX + 4, arrowY + 2);
        } else {
            this.ctx.moveTo(arrowX - 4, arrowY - 2); this.ctx.lineTo(arrowX, arrowY + 2); this.ctx.lineTo(arrowX + 4, arrowY - 2);
        }
        this.ctx.stroke();

        // Draw dropdown list on overlay
        if (this.isOpen && isOverlay) {
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.strokeStyle = '#999';
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.dropdown.x, bounds.dropdown.y, bounds.dropdown.width, bounds.dropdown.height, 5);
            this.ctx.fill();
            this.ctx.stroke();

            if (bounds.scrollbar) {
                this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
                this.ctx.beginPath();
                this.ctx.roundRect(bounds.scrollbar.handle.x, bounds.scrollbar.handle.y, bounds.scrollbar.handle.width, bounds.scrollbar.handle.height, 4);
                this.ctx.fill();
            }

            this.ctx.save();
            this.ctx.rect(bounds.dropdown.x, bounds.dropdown.y, bounds.dropdown.width, bounds.dropdown.height);
            this.ctx.clip();
            this.ctx.translate(0, -this.scrollOffset);

            bounds.options.forEach((optBounds, i) => {
                if (i === this.highlightedIndex) {
                    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
                    this.ctx.fillRect(optBounds.x, optBounds.y, optBounds.width, optBounds.height);
                }
                this.ctx.fillStyle = '#333';
                this.ctx.fillText(this.options[i].text, optBounds.x + 8, optBounds.y + optBounds.height / 2);
            });
            this.ctx.restore();
        }
        this.ctx.restore();
    }

    onPointerDown(x, y, owner) {
        const bounds = this.getBounds(this.ctx.canvas.height);

        // If the dropdown is open and the click is NOT on the control, close it.
        if (this.isOpen && !this.isPointOnControl(x, y)) {
            this.isOpen = false;
            return { action: 'release' };
        }

        // Click on the main button
        if (this.isPointInRect(x, y, bounds.main)) {
            this.isOpen = !this.isOpen;
            this.scrollOffset = 0;
            return this.isOpen ? { action: 'capture', control: this } : { action: 'release' };
        }

        // Click within the open dropdown
        if (this.isOpen) {
            // Check for scrollbar drag first
            if (bounds.scrollbar && this.isPointInRect(x, y, bounds.scrollbar.handle)) {
                this.isDraggingScrollbar = true;
                this.scrollbarDragStartY = y - bounds.scrollbar.handle.y;
                return { action: 'persist' }; // Keep capture
            }
            
            // Then, check for an option selection.
            // We check if the click is below the main button and within its width,
            // which is more reliable than using bounds.dropdown, whose height can be miscalculated.
            if (x >= bounds.main.x && x <= bounds.main.x + bounds.main.width && y >= bounds.dropdown.y) {
                const contentRelativeY = y - bounds.dropdown.y + this.scrollOffset;
                const optionIndex = Math.floor(contentRelativeY / 25); // 25 is option height

                // Ensure the calculated index is valid before selecting
                if (optionIndex >= 0 && optionIndex < this.options.length) {
                    this.selectedValue = this.options[optionIndex].value;
                    this.onSelect(this.selectedValue);
                    this.onStateChange(this);
                    this.isOpen = false;
                    return { action: 'release' };
                }
            }
        }
        return null;
    }
    
    onPointerMove(x, y) {
        this.highlightedIndex = -1;
        if (!this.isOpen) return;
        
        const bounds = this.getBounds(this.ctx.canvas.height);

        if (this.isDraggingScrollbar) {
            const trackHeight = bounds.scrollbar.track.height;
            const handleHeight = bounds.scrollbar.handle.height;
            const contentHeight = bounds.options.length * 25;
            const maxScroll = contentHeight - bounds.dropdown.height;
            
            const newHandleY = y - this.scrollbarDragStartY;
            const ratio = (newHandleY - bounds.scrollbar.track.y) / (trackHeight - handleHeight);
            this.scrollOffset = ratio * maxScroll;
            this.clampScroll();
            return;
        }

        if (this.isPointInRect(x,y,bounds.dropdown)) {
            const contentRelativeY = y - bounds.dropdown.y + this.scrollOffset;
            this.highlightedIndex = Math.floor(contentRelativeY / 25);
        }
    }

    onPointerUp() {
        if (this.isDraggingScrollbar) {
            this.isDraggingScrollbar = false;
            return { action: 'persist' }; // Still open, so persist capture
        }
        return null; // Let the owner decide to release
    }

    onWheel(deltaY) {
        if (this.isOpen) {
            const bounds = this.getBounds(this.ctx.canvas.height);
            if (bounds.isScrollable) {
                this.scrollOffset += deltaY > 0 ? 20 : -20;
                this.clampScroll();
            }
        }
    }
    
    clampScroll() {
        const bounds = this.getBounds(this.ctx.canvas.height);
        if (!bounds.isScrollable) {
            this.scrollOffset = 0;
            return;
        }
        const maxScroll = (bounds.options.length * 25) - bounds.dropdown.height;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));
    }

    isPointOnControl(x, y) {
        const bounds = this.getBounds(this.ctx.canvas.height);
        if (this.isOpen) {
            return this.isPointInRect(x, y, bounds.main) || this.isPointInRect(x, y, bounds.dropdown);
        }
        return this.isPointInRect(x, y, bounds.main);
    }
}

/**
 * ===================================================================
 * REVISED: InstrumentControl
 * ===================================================================
 * A two-panel selector for choosing a MIDI instrument.
 * Changes:
 * 1. Popup height is now dynamic. It expands to show all items if space
 * is available, otherwise it becomes scrollable.
 * 2. The selection/hover highlight no longer draws over the scrollbar.
 * 3. Fixed a null reference error in onPointerDown when opening the control.
 */
class InstrumentControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = config.width || 200;
        this.height = config.height || 28;
        this.onSelect = config.onSelect || (() => {});
        this.selectedValue = config.initialValue || 0;
        this.isOpen = false;

        this.options = MIDI_INSTRUMENTS;
        this.selectedCategoryIndex = this.findCategoryIndexByValue(this.selectedValue);
        this.highlightedCategoryIndex = -1;
        this.highlightedInstrumentIndex = -1;

        // Scroll state
        this.catScroll = { offset: 0, isDragging: false, dragStartY: 0 };
        this.instScroll = { offset: 0, isDragging: false, dragStartY: 0 };
        
        // Constants for styling
        this.ITEM_HEIGHT = 25;
        this.SCROLLBAR_WIDTH = 18;
    }

    needsOverlay() { return this.isOpen; }

    findCategoryIndexByValue(value) {
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].instruments.some(inst => inst.value === value)) {
                return i;
            }
        }
        return 0; // Default to first category
    }
    
    getSelectedInstrument() {
        const category = this.options.find(cat => cat.instruments.some(inst => inst.value === this.selectedValue));
        return category ? category.instruments.find(inst => inst.value === this.selectedValue) : null;
    }

    getBounds(canvasHeight) {
        const popupPadding = 10;
        const popupY = this.y + this.height + 5;
        
        const bounds = {
            main: { x: this.x, y: this.y, width: this.width, height: this.height },
            popup: null, catPanel: null, instPanel: null,
        };

        if (this.isOpen) {
            // --- Dynamic Height Calculation ---
            const maxAvailableHeight = canvasHeight - popupY - popupPadding;
            const catContentHeight = this.options.length * this.ITEM_HEIGHT;
            const currentInstruments = this.options[this.selectedCategoryIndex].instruments;
            const instContentHeight = currentInstruments.length * this.ITEM_HEIGHT;
            const requiredHeight = Math.max(catContentHeight, instContentHeight);
            const popupHeight = Math.min(requiredHeight, maxAvailableHeight);
            // --- End Dynamic Height Calculation ---

            const catPanelWidth = 150;
            const instPanelWidth = 200;
            const totalWidth = catPanelWidth + instPanelWidth;

            bounds.popup = { x: this.x, y: popupY, width: totalWidth, height: popupHeight };
            bounds.catPanel = { x: this.x, y: popupY, width: catPanelWidth, height: popupHeight };
            bounds.instPanel = { x: this.x + catPanelWidth, y: popupY, width: instPanelWidth, height: popupHeight };
            
            // Category panel scrollbar
            bounds.catPanel.isScrollable = catContentHeight > popupHeight;
            if (bounds.catPanel.isScrollable) {
                const trackH = popupHeight;
                const handleH = Math.max(20, (trackH / catContentHeight) * trackH);
                const maxScroll = catContentHeight - trackH;
                const handleY = popupY + (this.catScroll.offset / maxScroll) * (trackH - handleH);
                bounds.catPanel.scrollbar = {
                    track: { x: bounds.catPanel.x + catPanelWidth - this.SCROLLBAR_WIDTH, y: popupY, width: this.SCROLLBAR_WIDTH, height: trackH },
                    handle: { x: bounds.catPanel.x + catPanelWidth - this.SCROLLBAR_WIDTH, y: handleY, width: this.SCROLLBAR_WIDTH, height: handleH }
                };
            }

            // Instrument panel scrollbar
            bounds.instPanel.isScrollable = instContentHeight > popupHeight;
            if (bounds.instPanel.isScrollable) {
                const trackH = popupHeight;
                const handleH = Math.max(20, (trackH / instContentHeight) * trackH);
                const maxScroll = instContentHeight - trackH;
                const handleY = popupY + (this.instScroll.offset / maxScroll) * (trackH - handleH);
                bounds.instPanel.scrollbar = {
                    track: { x: bounds.instPanel.x + instPanelWidth - this.SCROLLBAR_WIDTH, y: popupY, width: this.SCROLLBAR_WIDTH, height: trackH },
                    handle: { x: bounds.instPanel.x + instPanelWidth - this.SCROLLBAR_WIDTH, y: handleY, width: this.SCROLLBAR_WIDTH, height: handleH }
                };
            }
        }
        return bounds;
    }

    draw(isOverlay = false) {
        const bounds = this.getBounds(this.ctx.canvas.height);
        this.ctx.save();
        this.ctx.font = this.font;

        // Draw main button
        this.ctx.fillStyle = '#ccc';
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.main.x, bounds.main.y, bounds.main.width, bounds.main.height, 5);
        this.ctx.fill();
        this.ctx.stroke();

        const selectedInstrument = this.getSelectedInstrument();
        const displayText = selectedInstrument ? selectedInstrument.text : 'Select Instrument';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(displayText, bounds.main.x + 8, bounds.main.y + bounds.main.height / 2);
        
        const arrowX = bounds.main.x + bounds.main.width - 15;
        const arrowY = bounds.main.y + bounds.main.height / 2;
        this.ctx.strokeStyle = '#333';
        this.ctx.beginPath();
        if (this.isOpen) {
            this.ctx.moveTo(arrowX - 4, arrowY + 2); this.ctx.lineTo(arrowX, arrowY - 2); this.ctx.lineTo(arrowX + 4, arrowY + 2);
        } else {
            this.ctx.moveTo(arrowX - 4, arrowY - 2); this.ctx.lineTo(arrowX, arrowY + 2); this.ctx.lineTo(arrowX + 4, arrowY - 2);
        }
        this.ctx.stroke();
        
        // Draw popup on overlay
        if (this.isOpen && isOverlay && bounds.popup) {
            // Background
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.strokeStyle = '#999';
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.popup.x, bounds.popup.y, bounds.popup.width, bounds.popup.height, 5);
            this.ctx.fill();
            this.ctx.stroke();

            // Divider
            this.ctx.beginPath();
            this.ctx.moveTo(bounds.instPanel.x, bounds.popup.y);
            this.ctx.lineTo(bounds.instPanel.x, bounds.popup.y + bounds.popup.height);
            this.ctx.stroke();

            // Draw Category Panel
            this.drawListPanel(bounds.catPanel, this.options.map(c => c.name), this.selectedCategoryIndex, this.highlightedCategoryIndex, this.catScroll.offset);
            
            // Draw Instrument Panel
            const currentInstruments = this.options[this.selectedCategoryIndex].instruments;
            const selectedInstrumentIndex = currentInstruments.findIndex(i => i.value === this.selectedValue);
            this.drawListPanel(bounds.instPanel, currentInstruments.map(i => i.text), selectedInstrumentIndex, this.highlightedInstrumentIndex, this.instScroll.offset);
        }

        this.ctx.restore();
    }

    drawListPanel(panelBounds, items, selectedIndex, highlightedIndex, scrollOffset) {
        if (!panelBounds) return;
        
        // --- Highlight Fix ---
        // Calculate the width for drawing content, leaving space for the scrollbar if needed.
        const contentWidth = panelBounds.isScrollable ? panelBounds.width - this.SCROLLBAR_WIDTH : panelBounds.width;
        
        this.ctx.save();
        this.ctx.rect(panelBounds.x, panelBounds.y, panelBounds.width, panelBounds.height);
        this.ctx.clip();
        this.ctx.translate(0, -scrollOffset);

        items.forEach((itemText, i) => {
            const itemY = panelBounds.y + (i * this.ITEM_HEIGHT);
            // Highlight for hover
            if (i === highlightedIndex) {
                this.ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
                this.ctx.fillRect(panelBounds.x, itemY, contentWidth, this.ITEM_HEIGHT);
            }
            // Highlight for selected
            if (i === selectedIndex) {
                this.ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
                this.ctx.fillRect(panelBounds.x, itemY, contentWidth, this.ITEM_HEIGHT);
            }
            
            this.ctx.fillStyle = (i === selectedIndex) ? '#fff' : '#333';
            this.ctx.fillText(itemText, panelBounds.x + 8, itemY + this.ITEM_HEIGHT / 2);
        });
        this.ctx.restore();
        
        // Draw scrollbar
        if (panelBounds.scrollbar) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            this.ctx.beginPath();
            this.ctx.roundRect(panelBounds.scrollbar.handle.x, panelBounds.scrollbar.handle.y, panelBounds.scrollbar.handle.width, panelBounds.scrollbar.handle.height, 4);
            this.ctx.fill();
        }
    }

    onPointerDown(x, y, owner) {
        let bounds = this.getBounds(this.ctx.canvas.height);

        if (this.isOpen && !this.isPointOnControl(x, y)) {
            this.isOpen = false;
            return { action: 'release' };
        }

        if (this.isPointInRect(x, y, bounds.main)) {
            this.isOpen = !this.isOpen;
            
            // *** FIX: If we just opened the control, recalculate its bounds ***
            if (this.isOpen) {
                bounds = this.getBounds(this.ctx.canvas.height); // Recalculate to get popup bounds
                const catContentHeight = this.options.length * this.ITEM_HEIGHT;
                
                // Now bounds.catPanel is not null, but we add a safety check anyway.
                if (bounds.catPanel && bounds.catPanel.isScrollable) {
                    const maxScroll = catContentHeight - bounds.catPanel.height;
                    this.catScroll.offset = Math.min(maxScroll, this.selectedCategoryIndex * this.ITEM_HEIGHT);
                    this.clampScroll(this.catScroll, maxScroll);
                }
            }
            return this.isOpen ? { action: 'capture', control: this } : { action: 'release' };
        }

        if (this.isOpen) {
            // Category panel interaction
            if (this.isPointInRect(x, y, bounds.catPanel)) {
                if (bounds.catPanel.scrollbar && this.isPointInRect(x, y, bounds.catPanel.scrollbar.handle)) {
                    this.catScroll.isDragging = true;
                    this.catScroll.dragStartY = y - bounds.catPanel.scrollbar.handle.y;
                } else {
                    const contentRelativeY = y - bounds.catPanel.y + this.catScroll.offset;
                    const index = Math.floor(contentRelativeY / this.ITEM_HEIGHT);
                    if (index >= 0 && index < this.options.length) {
                        this.selectedCategoryIndex = index;
                        this.instScroll.offset = 0; // Reset instrument scroll
                    }
                }
                return { action: 'persist' };
            }
            // Instrument panel interaction
            if (this.isPointInRect(x, y, bounds.instPanel)) {
                if (bounds.instPanel.scrollbar && this.isPointInRect(x, y, bounds.instPanel.scrollbar.handle)) {
                    this.instScroll.isDragging = true;
                    this.instScroll.dragStartY = y - bounds.instPanel.scrollbar.handle.y;
                } else {
                    const contentRelativeY = y - bounds.instPanel.y + this.instScroll.offset;
                    const index = Math.floor(contentRelativeY / this.ITEM_HEIGHT);
                    const instruments = this.options[this.selectedCategoryIndex].instruments;
                    if (index >= 0 && index < instruments.length) {
                        this.selectedValue = instruments[index].value;
                        this.onSelect(this.selectedValue);
                        this.onStateChange(this);
                        this.isOpen = false;
                        return { action: 'release' };
                    }
                }
                return { action: 'persist' };
            }
        }
        return null;
    }

    onPointerMove(x, y) {
        this.highlightedCategoryIndex = -1;
        this.highlightedInstrumentIndex = -1;
        if (!this.isOpen) return;

        const bounds = this.getBounds(this.ctx.canvas.height);

        if (this.catScroll.isDragging) {
            this.handleScrollDrag(this.catScroll, y, bounds.catPanel, this.options.length);
            return;
        }
        if (this.instScroll.isDragging) {
            const instCount = this.options[this.selectedCategoryIndex].instruments.length;
            this.handleScrollDrag(this.instScroll, y, bounds.instPanel, instCount);
            return;
        }

        if (this.isPointInRect(x, y, bounds.catPanel)) {
            const contentRelativeY = y - bounds.catPanel.y + this.catScroll.offset;
            this.highlightedCategoryIndex = Math.floor(contentRelativeY / this.ITEM_HEIGHT);
        } else if (this.isPointInRect(x, y, bounds.instPanel)) {
            const contentRelativeY = y - bounds.instPanel.y + this.instScroll.offset;
            this.highlightedInstrumentIndex = Math.floor(contentRelativeY / this.ITEM_HEIGHT);
        }
    }
    
    handleScrollDrag(scrollState, y, panelBounds, itemCount) {
        if (!panelBounds || !panelBounds.isScrollable) return;
        const trackHeight = panelBounds.height;
        const handleHeight = panelBounds.scrollbar.handle.height;
        const contentHeight = itemCount * this.ITEM_HEIGHT;
        const maxScroll = contentHeight - trackHeight;
        
        const newHandleY = y - scrollState.dragStartY;
        const ratio = (newHandleY - panelBounds.y) / (trackHeight - handleHeight);
        scrollState.offset = ratio * maxScroll;
        this.clampScroll(scrollState, maxScroll);
    }

    onPointerUp() {
        let wasDragging = this.catScroll.isDragging || this.instScroll.isDragging;
        this.catScroll.isDragging = false;
        this.instScroll.isDragging = false;
        if (wasDragging) {
            return { action: 'persist' };
        }
        return null;
    }

    onWheel(deltaY, owner) {
        if (this.isOpen) {
            const bounds = this.getBounds(this.ctx.canvas.height);
            const x = owner.x; // The event coords are already in drawer space
            const y = owner.y;
            
            if (this.isPointInRect(x, y, bounds.catPanel)) {
                if (bounds.catPanel.isScrollable) {
                    this.catScroll.offset += deltaY > 0 ? 20 : -20;
                    const maxScroll = (this.options.length * this.ITEM_HEIGHT) - bounds.catPanel.height;
                    this.clampScroll(this.catScroll, maxScroll);
                }
            } else if (this.isPointInRect(x, y, bounds.instPanel)) {
                if (bounds.instPanel.isScrollable) {
                    this.instScroll.offset += deltaY > 0 ? 20 : -20;
                    const maxScroll = (this.options[this.selectedCategoryIndex].instruments.length * this.ITEM_HEIGHT) - bounds.instPanel.height;
                    this.clampScroll(this.instScroll, maxScroll);
                }
            }
        }
    }
    
    clampScroll(scrollState, maxScroll) {
        scrollState.offset = Math.max(0, Math.min(scrollState.offset, maxScroll));
    }

    isPointOnControl(x, y) {
        const bounds = this.getBounds(this.ctx.canvas.height);
        if (this.isOpen) {
            return this.isPointInRect(x, y, bounds.main) || this.isPointInRect(x, y, bounds.popup);
        }
        return this.isPointInRect(x, y, bounds.main);
    }
}

// This is a composite control. It contains another control.
class PopupSliderControl extends ButtonControl {
    constructor(config) {
        // Create a separate config for the button, removing the slider's height
        const buttonConfig = { ...config };
        delete buttonConfig.height; // This ensures the button uses its default height

        super(buttonConfig); // Pass the cleaned config to the parent ButtonControl

        this.isOpen = false;
        // The slider still gets the original config with the correct height
        this.slider = new VerticalSliderControl({
            ...config,
            x: 0, y: 0,
            onStateChange: () => this.onStateChange(this),
        });
    }
    
    needsOverlay() { return this.isOpen; }

    getPopupBounds() {
        if (!this.isOpen) return null;
        const popupWidth = 60;
        const popupHeight = this.slider.height + 40;
        const popupX = this.x;
        const popupY = this.y + this.height + 5;
        return { x: popupX, y: popupY, width: popupWidth, height: popupHeight };
    }

    draw(isOverlay = false) {
        super.draw(`${this.label}: ${this.slider.value}`); // Draw the button part

        if (this.isOpen && isOverlay) {
            const popupBounds = this.getPopupBounds();
            
            this.slider.x = popupBounds.x + (popupBounds.width - this.slider.width)/2;
            this.slider.y = popupBounds.y + 20;

            this.ctx.save();
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.strokeStyle = '#999';
            this.ctx.beginPath();
            this.ctx.roundRect(popupBounds.x, popupBounds.y, popupBounds.width, popupBounds.height, 5);
            this.ctx.fill();
            this.ctx.stroke();
            this.slider.draw(); // Draw the slider inside the popup
            this.ctx.restore();
        }
    }

    onPointerDown(x, y, owner) {
        const popupBounds = this.getPopupBounds();

        // Clicked outside the control while it was open
        if (this.isOpen && owner !== this) {
            this.isOpen = false;
            return { action: 'release' };
        }
        
        // Click on the main button
        if (this.isPointInRect(x, y, this.getBounds())) {
            this.isOpen = !this.isOpen;
            return this.isOpen ? { action: 'capture', control: this } : { action: 'release' };
        }

        // Click within the open popup
        if (this.isOpen && this.isPointInRect(x, y, popupBounds)) {
            // Delegate the event to the inner slider
            const result = this.slider.onPointerDown(x, y);
                if (result) {
                    return { action: 'persist', control: this }; // Persist capture
                }
        }
        return null;
    }
    
    onPointerMove(x, y) {
        if (this.isOpen && this.slider.isDragging) {
            this.slider.onPointerMove(x, y);
        }
    }

    onPointerUp() {
        if (this.slider.isDragging) {
            this.slider.onPointerUp();
            return { action: 'persist' }; // Still open, so persist capture
        }
        return null;
    }
    
    isPointOnControl(x, y) {
        const popupBounds = this.getPopupBounds();
        if (this.isOpen) {
                return this.isPointInRect(x, y, this.getBounds()) || this.isPointInRect(x, y, popupBounds);
        }
        return this.isPointInRect(x, y, this.getBounds());
    }
}

// A standard vertical slider, used by the PopupSliderControl
class VerticalSliderControl extends BaseControl {
    constructor(config) {
        super(config);
        this.width = 24;
        this.height = config.height || 100;
        this.min = config.min || 0;
        this.max = config.max || 127;
        this.value = config.initialValue;
    }

    getBounds() {
        const trackWidth = 6;
        const handleHeight = 28;
        const trackX = this.x + this.width / 2 - trackWidth / 2;
        const trackY = this.y;
        const handleY = trackY + (1 - ((this.value - this.min) / (this.max - this.min))) * (this.height - handleHeight);
        return {
            track: { x: trackX, y: trackY, width: trackWidth, height: this.height },
            handle: { x: this.x, y: handleY, width: this.width, height: handleHeight }
        };
    }

    draw() {
        const bounds = this.getBounds();
        this.ctx.save();
        this.ctx.font = this.font;
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#a0a0a0';
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.track.x, bounds.track.y, bounds.track.width, bounds.track.height, 3);
        this.ctx.fill();
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.handle.x, bounds.handle.y, bounds.handle.width, bounds.handle.height, 4);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fillText(this.value, this.x + this.width / 2, this.y + this.height + 15);
        this.ctx.restore();
    }

    updateValueFromPosition(y) {
        const bounds = this.getBounds();
        const handleHeight = bounds.handle.height;
        const relativeY = y - (bounds.track.y + handleHeight / 2);
        const ratio = 1 - Math.max(0, Math.min(1, relativeY / (bounds.track.height - handleHeight)));
        const newValue = Math.round(this.min + ratio * (this.max - this.min));
        if (newValue !== this.value) {
            this.value = newValue;
            this.onStateChange(this);
        }
    }
    
    onPointerDown(x, y) {
        if (this.isPointOnControl(x, y)) {
            this.isDragging = true;
            this.updateValueFromPosition(y);
            return { action: 'capture', control: this };
        }
        return null;
    }

    onPointerMove(x, y) {
        if (this.isDragging) {
            this.updateValueFromPosition(y);
        }
    }

    onPointerUp() {
        this.isDragging = false;
        return { action: 'release' };
    }

    isPointOnControl(x, y) {
        const bounds = this.getBounds();
        const interactiveArea = { x: bounds.handle.x, y: bounds.track.y, width: bounds.handle.width, height: bounds.track.height };
        return this.isPointInRect(x, y, interactiveArea);
    }
}


/**
 * ===================================================================
 * DRAWER COMPONENT (REFACTORED)
 * ===================================================================
 */
class Drawer {
    constructor(config) {
        this.ctx = config.ctx;
        this.tabs = config.tabs;
        this.onStateChange = config.onStateChange;
        this.canvas = this.ctx.canvas;
        this.eventBroker = config.eventBroker;

        this.isOpen = false;
        this.scrollOffsetX = 0;
        this.scrollOffsetY = 0;
        this.activeTab = Object.keys(this.tabs)[0] || '';
        this.calculatedHeight = config.handleHeight;
        this.targetHeight = config.handleHeight;
        this.activeInteraction = null; // e.g., { type: 'pan' | 'v-scroll' | 'h-scroll', ... }
        
        this.HANDLE_HEIGHT = config.handleHeight;
        this.TAB_HEIGHT = config.tabHeight;
        this.SCROLLBAR_SIZE = 18;
        this.CONTROL_PADDING = { x: 20, y: 20 };
        this.CONTROL_SPACING = { x: 20, y: 10 };
        this.handleEvent = this.handleEvent.bind(this);
        this.layoutControls = this.layoutControls.bind(this);
    }
    
    getHeight() { return this.calculatedHeight; }
    isAnimating() { return Math.abs(this.targetHeight - this.calculatedHeight) > 1; }
    isPointInBounds(x, y) { return y < this.calculatedHeight; }
    
    // This is the primary event handling method for the drawer
    handleEvent(event) {
        if (this.eventBroker.capturedControl && !this.isPointInBounds(event.x, event.y)) {
            // If a control is captured, we need to adjust the coordinates
            event.x += this.scrollOffsetX;
            event.y += this.scrollOffsetY;
        }
        const { x, y } = event;

        // --- PRIORITY 0: Handle "click outside" for captured controls ---
        if (this.eventBroker.capturedControl && !this.isPointInBounds(x, y)) {
            const globalClickEvent = { ...event, owner: null };
            this.eventBroker.dispatchEvent(globalClickEvent, this.eventBroker.capturedControl);
            return;
        }

        // --- PRIORITY 1: Handle events for a captured control (if click was inside) ---
        if (this.eventBroker.capturedControl) {
            const eventInDrawerSpace = {
                ...event,
                x: x + this.scrollOffsetX,
                y: y + this.scrollOffsetY,
            };
            if (event.type === 'wheel') {
                // Pass wheel events with original coordinates but add owner
                const wheelEvent = { ...event, owner: {x,y} };
                this.eventBroker.dispatchEvent(wheelEvent, this.eventBroker.capturedControl);
            } else {
                this.eventBroker.dispatchEvent(eventInDrawerSpace, this.eventBroker.capturedControl);
            }
            return;
        }

        // --- PRIORITY 2: Handle ONGOING drawer-level interactions (scroll/pan/drag) ---
        if (this.activeInteraction) {
            if (event.type === 'pointermove') {
                switch(this.activeInteraction.type) {
                    case 'drag-handle': {
                        const dy = y - this.activeInteraction.startY;
                        this.targetHeight = this.activeInteraction.startHeight + dy;
                        this.calculatedHeight = this.targetHeight;
                        this.clampHeight();
                        break;
                    }
                    case 'pan':
                        this.scrollOffsetX -= (x - this.activeInteraction.lastX);
                        this.scrollOffsetY -= (y - this.activeInteraction.lastY);
                        this.clampScroll();
                        this.activeInteraction.lastX = x; this.activeInteraction.lastY = y;
                        break;
                    case 'v-scroll': {
                        const { contentHeight, visibleHeight } = this.getContentDimensions();
                        const { track, handle } = this.getScrollbarBounds().v;
                        if (!track || !handle) break;
                        const scrollableDist = contentHeight - visibleHeight;
                        const draggableDist = track.height - handle.height;
                        if (draggableDist <= 0) break;
                        const ratio = scrollableDist / draggableDist;
                        const dy = y - this.activeInteraction.startY;
                        this.scrollOffsetY = this.activeInteraction.startScroll + dy * ratio;
                        this.clampScroll();
                        break;
                    }
                    case 'h-scroll': {
                        const { contentWidth, visibleWidth } = this.getContentDimensions();
                        const { track, handle } = this.getScrollbarBounds().h;
                        if (!track || !handle) break;
                        const scrollableDist = contentWidth - visibleWidth;
                        const draggableDist = track.width - handle.width;
                        if (draggableDist <= 0) break;
                        const ratio = scrollableDist / draggableDist;
                        const dx = x - this.activeInteraction.startX;
                        this.scrollOffsetX = this.activeInteraction.startScroll + dx * ratio;
                        this.clampScroll();
                        break;
                    }
                }
            } else if (event.type === 'pointerup') {
                if (this.activeInteraction.type === 'drag-handle') {
                    // Check if the interaction was a click or a drag.
                    const dragDistance = Math.abs(y - this.activeInteraction.startY);
                    if (dragDistance < 5) { // If moved less than 5 pixels, it's a click.
                        this.isOpen = !this.isOpen;
                    } else { // Otherwise, it was a drag.
                        this.isOpen = this.targetHeight > this.HANDLE_HEIGHT * 2;
                    }
                    this.updateHeight(); // Snap to final open/closed position.
                }
                this.activeInteraction = null;
            }
            return;
        }

        // --- PRIORITY 3: Certain drawer elements being started that are on top of the controls ---
        if (event.type === 'pointerdown') {
            if (this.isPointInRect(x, y, this.getHandleBounds())) {
                // Start a drag interaction, storing the start position.
                this.activeInteraction = {
                    type: 'drag-handle',
                    startY: y,
                    startHeight: this.calculatedHeight
                };
                return;
            }

            const scrollbarBounds = this.getScrollbarBounds();
            if (scrollbarBounds.v.handle && this.isPointInRect(x, y, scrollbarBounds.v.handle)) {
                this.activeInteraction = { type: 'v-scroll', startY: y, startScroll: this.scrollOffsetY };
                return;
            }
            if (scrollbarBounds.h.handle && this.isPointInRect(x, y, scrollbarBounds.h.handle)) {
                this.activeInteraction = { type: 'h-scroll', startX: x, startScroll: this.scrollOffsetX };
                return;
            }

            const { totalTabWidth, visibleWidth } = this.getContentDimensions();
            const tabsShouldScroll = totalTabWidth > visibleWidth;
            const pointerXForTabs = tabsShouldScroll ? pointerXInDrawer : x;
            const tabBounds = this.getTabBounds();

            for (const tabName in tabBounds) {
                if (this.isPointInRect(pointerXForTabs, y, tabBounds[tabName])) {
                    if (this.activeTab !== tabName) {
                        this.activeTab = tabName;
                        this.scrollOffsetX = 0;
                        this.scrollOffsetY = 0;
                        this.updateHeight();
                        this.onStateChange();
                    }
                    return;
                }
            }
        }

        // --- PRIORITY 4: Delegate to controls if no interaction is active ---
        const pointerXInDrawer = x + this.scrollOffsetX;
        const pointerYInDrawer = y + this.scrollOffsetY;
        const controls = this.tabs[this.activeTab];
        let controlUnderPointer = null;
        for (const control of controls) {
            if (control.isPointOnControl(pointerXInDrawer, pointerYInDrawer)) {
                controlUnderPointer = control;
                break;
            }
        }
        if (controlUnderPointer) {
                const controlEvent = { ...event, x: pointerXInDrawer, y: pointerYInDrawer, owner: controlUnderPointer };
                this.eventBroker.dispatchEvent(controlEvent, controlUnderPointer);
                return;
        }

        if (event.type === 'wheel') {
            this.scrollOffsetY += event.deltaY; // Adjust vertical scroll offset by wheel amount
            this.clampScroll();                // Ensure scroll position is valid
            return;                            // Event is handled, stop processing
        }

        // --- PRIORITY 5: Panningn the drawer ---
        if (event.type === 'pointerdown') {

            this.activeInteraction = { type: 'pan', lastX: x, lastY: y };
        }
    }
            
    clampHeight() {
        const maxDrawerHeight = this.canvas.height * 0.8; // Max 80% of screen
        this.targetHeight = Math.max(this.HANDLE_HEIGHT, Math.min(this.targetHeight, maxDrawerHeight));
        this.calculatedHeight = this.targetHeight;
    }
    
    draw() {
        // Animation logic for snapping back after drag/release
        if (this.activeInteraction?.type !== 'drag-handle') {
                const diff = this.targetHeight - this.calculatedHeight;
                if (Math.abs(diff) > 1) { this.calculatedHeight += diff * 0.2; }
                else { this.calculatedHeight = this.targetHeight; }
        }

        const drawerContentHeight = this.calculatedHeight - this.HANDLE_HEIGHT;
        const { totalTabWidth, visibleWidth } = this.getContentDimensions();
        const tabsShouldScroll = totalTabWidth > visibleWidth;

        // --- Main Background ---
        this.ctx.save(); // Initial save
        this.ctx.fillStyle = '#e0e0e0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.calculatedHeight);

        // --- Draw All Drawer Content (Tabs, Controls, Scrollbars) ---
        if (drawerContentHeight > 0) {
            this.ctx.save(); // Save before master clip

            // Create a master clipping region for ALL content inside the drawer.
            // This is the key fix: it clips everything to the area above the handle.
            this.ctx.beginPath();
            this.ctx.rect(0, 0, this.canvas.width, drawerContentHeight);
            this.ctx.clip();

            // --- Draw Tabs (conditionally scrolled) ---
            this.ctx.save();
            if (tabsShouldScroll) {
                this.ctx.translate(-this.scrollOffsetX, 0);
            }
            this.drawTabs();
            this.ctx.restore();

            // --- Draw Controls (always scrolled and clipped below tabs) ---
            this.ctx.save();
            // We still need to clip the controls to their own area to prevent
            // them from drawing over the tabs if scrolled up.
            this.ctx.beginPath();
            this.ctx.rect(0, this.TAB_HEIGHT, this.canvas.width, drawerContentHeight - this.TAB_HEIGHT);
            this.ctx.clip();
            this.ctx.translate(-this.scrollOffsetX, -this.scrollOffsetY);
            this.drawControls();
            this.ctx.restore();

            // --- Draw Scrollbars ---
            this.drawScrollbars();

            this.ctx.restore(); // Restore from the master clip
        }

        // --- Draw Handle (Always last and on top) ---
        this.drawHandle();

        this.ctx.restore(); // Restore from the initial save
    }

    // The event broker will tell us which control needs an overlay
    drawOverlay(control) {
            if (control) {
                this.ctx.save();
                // Overlay is drawn relative to the scrolled content
                this.ctx.translate(-this.scrollOffsetX, -this.scrollOffsetY);
                control.draw(true); // Pass true to signal overlay drawing
                this.ctx.restore();
            }
    }

    drawTabs() {
        this.ctx.save();
        this.ctx.font = '14px sans-serif';
        this.ctx.textBaseline = 'middle';
        const tabBounds = this.getTabBounds();

        for(const tabName in tabBounds) {
            const bounds = tabBounds[tabName];
            const isActive = tabName === this.activeTab;
            this.ctx.fillStyle = isActive ? '#d0d0d0' : '#e0e0e0';
            this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            this.ctx.fillStyle = isActive ? '#000' : '#555';
            this.ctx.fillText(tabName, bounds.x + 15, bounds.y + bounds.height / 2);
        }
        this.ctx.strokeStyle = '#b0b0b0';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.TAB_HEIGHT - 0.5);
        
        // Get both content and visible (canvas) width
        const { contentWidth, visibleWidth } = this.getContentDimensions();
        // Draw the line to whichever width is greater
        this.ctx.lineTo(Math.max(contentWidth, visibleWidth), this.TAB_HEIGHT - 0.5);

        this.ctx.stroke();
        this.ctx.restore();
    }

    drawControls() {
        const controls = this.tabs[this.activeTab];
        this.layoutControls(controls);
        controls.forEach(control => control.draw(false)); // Always draw base first
    }
    
    drawHandle() {
        const bounds = this.getHandleBounds();
        this.ctx.save();
        this.ctx.fillStyle = '#b0b0b0';
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, [0, 0, 10, 10]);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1.5;
        const handleCenterY = bounds.y + bounds.height / 2;
        const lineStartX = bounds.x + 20;
        const lineEndX = bounds.x + bounds.width - 20;
        this.ctx.beginPath();
        this.ctx.moveTo(lineStartX, handleCenterY - 3); this.ctx.lineTo(lineEndX, handleCenterY - 3);
        this.ctx.moveTo(lineStartX, handleCenterY + 3); this.ctx.lineTo(lineEndX, handleCenterY + 3);
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    drawScrollbars() {
        if (!this.isOpen) return;
        const { v, h } = this.getScrollbarBounds();
        this.ctx.save();
        if (v.handle) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)'; 
            this.ctx.beginPath();
            this.ctx.roundRect(v.handle.x, v.handle.y, v.handle.width, v.handle.height, 4);
            this.ctx.fill();
        }
        if (h.handle) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            this.ctx.beginPath();
            this.ctx.roundRect(h.handle.x, h.handle.y, h.handle.width, h.handle.height, 4);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    layoutControls(controls, isNested = false, nestedX = 0, nestedY = 0) {
        let xPos = this.CONTROL_PADDING.x;
        let yPos = this.TAB_HEIGHT + this.CONTROL_PADDING.y;
        if (isNested) {
            xPos = nestedX;
            yPos = nestedY;
        }
        
        let maxH = 0;
        for (const control of controls) {
            // see if we have increased the height of the drawer
            maxH = Math.max(maxH, control.y + control.height);
            // If the control is a row control, we should lay those out in a row, then return to the start of the next row.
            if (control instanceof RowControl) {
                const childMaxH = this.layoutControls(control.controls, true, xPos, yPos); // Recursive call to handle nested arrays
                xPos = this.CONTROL_PADDING.x; // Reset xPos for the next row   
                // when returning to the next row we have to add the height of the controls in this row, plus padding
                yPos = childMaxH + this.CONTROL_SPACING.y;
                continue;
            }
            // Before laying out, ask the control to update its width if it can.
            if (typeof control.updateWidth === 'function') {
                control.updateWidth();
            }
            let cWidth = (control instanceof ToggleSwitch) ? control.getFullWidth() : control.width;
            control.x = xPos; 
            control.y = yPos;
            xPos += cWidth + this.CONTROL_SPACING.x;
        }
        return maxH;
    }

    getTabBounds() {
        const bounds = {};
        this.ctx.save();
        this.ctx.font = '14px sans-serif';
        let xPos = 10;
        for(const tabName in this.tabs) {
            const tabWidth = this.ctx.measureText(tabName).width + 30;
            bounds[tabName] = { x: xPos, y: 0, width: tabWidth, height: this.TAB_HEIGHT };
            xPos += tabWidth;
        }
        this.ctx.restore();
        return bounds;
    }

    getHandleBounds() {
        const handleWidth = 100;
        const y = this.calculatedHeight - this.HANDLE_HEIGHT;
        return { x: this.canvas.width / 2 - handleWidth / 2, y, width: handleWidth, height: this.HANDLE_HEIGHT };
    }
    
    getContentDimensions() {
        const controls = this.tabs[this.activeTab];
        const visibleWidth = this.canvas.width;
        const visibleHeight = this.calculatedHeight - this.HANDLE_HEIGHT;

        // Calculate total tab width
        const tabBounds = this.getTabBounds();
        let totalTabWidth = 0;
        for (const tabName in tabBounds) {
            const bounds = tabBounds[tabName];
            totalTabWidth = Math.max(totalTabWidth, bounds.x + bounds.width);
        }

        if (controls.length === 0) {
            return { contentWidth: 0, contentHeight: 0, visibleWidth, visibleHeight, totalTabWidth };
        }
        
        this.layoutControls(controls);
        let maxW = 0, maxH = 0;
        controls.forEach(c => {
            if (c instanceof RowControl) {
                // If it's a nested array, we need to calculate the max width and height of the nested controls
                c.controls.forEach(nestedControl => {
                    let nestedWidth = (nestedControl instanceof ToggleSwitch) ? nestedControl.getFullWidth() : nestedControl.width;
                    maxW = Math.max(maxW, nestedControl.x + nestedWidth + this.CONTROL_PADDING.x);
                    maxH = Math.max(maxH, nestedControl.y + nestedControl.height);
                })
            } else {
                let cWidth = (c instanceof ToggleSwitch) ? c.getFullWidth() : c.width;
                maxW = Math.max(maxW, c.x + cWidth + this.CONTROL_PADDING.x);
                maxH = Math.max(maxH, c.y + c.height);
            }
        });
        
        return { contentWidth: maxW, contentHeight: maxH, visibleWidth, visibleHeight, totalTabWidth };
    }

    getScrollbarBounds() {
        const { contentWidth, contentHeight, visibleWidth, visibleHeight } = this.getContentDimensions();
        const bounds = { v: {}, h: {} };
        const hasVScroll = contentHeight > visibleHeight;
        const hasHScroll = contentWidth > visibleWidth;
        
        if (hasVScroll) {
            const trackHeight = visibleHeight - (hasHScroll ? this.SCROLLBAR_SIZE : 0);
            const handleHeight = Math.max(20, (visibleHeight / contentHeight) * trackHeight);
            const scrollableDist = contentHeight - visibleHeight;
            const handleY = (this.scrollOffsetY / scrollableDist) * (trackHeight - handleHeight);
            bounds.v.track = { x: visibleWidth - this.SCROLLBAR_SIZE, y: 0, width: this.SCROLLBAR_SIZE, height: trackHeight };
            bounds.v.handle = { x: visibleWidth - this.SCROLLBAR_SIZE, y: handleY, width: this.SCROLLBAR_SIZE, height: handleHeight };
        }

        if (hasHScroll) {
            const trackWidth = visibleWidth - (hasVScroll ? this.SCROLLBAR_SIZE : 0);
            const handleWidth = Math.max(20, (visibleWidth / contentWidth) * trackWidth);
            const scrollableDist = contentWidth - visibleWidth;
            const handleX = (this.scrollOffsetX / scrollableDist) * (trackWidth - handleWidth);
            bounds.h.track = { x: 0, y: visibleHeight - this.SCROLLBAR_SIZE, width: trackWidth, height: this.SCROLLBAR_SIZE };
            bounds.h.handle = { x: handleX, y: visibleHeight - this.SCROLLBAR_SIZE, width: handleWidth, height: this.SCROLLBAR_SIZE };
        }
        return bounds;
    }

    clampScroll() {
        const { contentWidth, contentHeight, visibleWidth, visibleHeight } = this.getContentDimensions();
        this.scrollOffsetY = Math.max(0, Math.min(this.scrollOffsetY, Math.max(0, contentHeight - visibleHeight)));
        this.scrollOffsetX = Math.max(0, Math.min(this.scrollOffsetX, Math.max(0, contentWidth - visibleWidth)));
    }

    updateHeight() {
        if (this.isOpen) {
            const { contentHeight } = this.getContentDimensions();
            const maxDrawerHeight = this.canvas.height * 0.5;
            this.targetHeight = Math.min(contentHeight + this.CONTROL_PADDING.y, maxDrawerHeight) + this.HANDLE_HEIGHT;
        } else {
            this.targetHeight = this.HANDLE_HEIGHT;
        }
        this.clampScroll();
    }

    isPointInRect(x, y, rect) {
        return rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}

/**
 * ===================================================================
 * EVENT BROKER
 * ===================================================================
 * Manages pointer capture and event delegation between components.
 * This replaces the 'globalPointerLock' concept.
 */
class EventBroker {
    constructor(drawer) {
        this.capturedControl = null;
        this.drawer = drawer;
    }

    // Main entry point for dispatching events from the application
    dispatchEvent(event, targetControl = null) {
        // If a control has captured the pointer, all events go to it
        if (this.capturedControl) {
            const controlEvent = { ...event, owner: this.capturedControl };
            const result = this.capturedControl.handleEvent(controlEvent);
            this.processResult(result);
            return;
        }

        // If no capture, dispatch to the target control under the pointer
        if (targetControl) {
            const controlEvent = { ...event, owner: targetControl };
            const result = targetControl.handleEvent(controlEvent);
            this.processResult(result, targetControl);
        }
    }
    
    // Handle the action returned by a control
    processResult(result, control) {
            if (!result) return;
            switch (result.action) {
                case 'capture':
                    this.capturedControl = result.control;
                    break;
                case 'release':
                if (this.capturedControl) {
                    this.capturedControl = null;
                }
                break;
                case 'persist':
                    // Do nothing, let the control keep its capture
                    break;
            }
    }

    // A global click outside all controls can release capture
    handleGlobalClick(event) {
        if (this.capturedControl) {
            const controlEvent = { ...event, type: 'pointerdown', owner: null }; // owner is null because it's an outside click
            const result = this.capturedControl.handleEvent(controlEvent);
            this.processResult(result);
        }
    }
    
    getOverlayControl() {
        if (this.capturedControl && typeof this.capturedControl.needsOverlay === 'function' && this.capturedControl.needsOverlay()) {
            return this.capturedControl;
        }
        return null;
    }
}



