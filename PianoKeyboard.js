import { SliderControl } from './SliderControl.js';
import { TabControl } from './TabControl.js';

/**
 * PianoKeyboard Component
 * A piano keyboard rendered on an HTML canvas with MIDI support.
 * Supports touch and mouse interactions, MIDI input/output, and customizable settings.
 * @param {Object} config - Configuration object for the piano keyboard.
 * @param {HTMLCanvasElement} config.canvas - The canvas element to render the keyboard on.
 * @param {Function} config.midiCallback - Callback function to send MIDI messages.
 * @param {Array} [config.customKeyMappings] - Custom key mappings for computer keyboard keys to MIDI notes.
 * @param {Function} [config.onSettingsChange] - Callback function to handle settings changes.
 * 
 * Expectations: 
 * - The canvas should fill the available space in the container.
 * - All controls and keys in the control should be drawn directly on the canvas by this code or sub-components, not by using HTML elements.
 * - The keyboard should support touch and mouse interactions.  
 * - The keyboard should handle MIDI input and output.
 * - The keyboard should allow customization of key mappings and settings.  
 * - The keyboard should persist settings across page reloads using localStorage.
 * - The keyboard should have a responsive design that adapts to different screen sizes.
 * - The keyboard should have a drawer for settings controls that can be opened and closed.
 * - The keyboard should have a scrollbar for navigating keys when the canvas width is smaller than the total key width.
 * - The drawer should pan when touched or dragged, allowing users to scroll through settings controls both horizontally and vertically.
 * - The drawer should have a handle that indicates it can be opened or closed.
 */
class PianoKeyboard {
    constructor(config) {
        this.canvas = config.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.midiCallback = config.midiCallback;
        this.customKeyMappings = config.customKeyMappings || [];
        this.onSettingsChange = config.onSettingsChange || (() => {});
        this.canvasId = this.canvas.id || 'piano-keyboard-default';

        // --- State Variables ---
        this.keys = [];
        this.activeTouches = new Map();
        this.computerKeysDown = new Set();
        this.scrollOffset = 0;
        this.octaveOffset = 0;
        this.calculatedKeyHeight = 0; 
        
        // Drawer State
        this.isDrawerOpen = false;
        this.drawerScrollOffsetY = 0;
        this.calculatedDrawerContentHeight = 0;
        
        // --- Settings & Controls ---
        this.settings = { volume: 100, minVelocity: 0, maxVelocity: 127 };
        this.volumeSlider = new SliderControl({ ctx: this.ctx, label: 'Volume', initialValue: this.settings.volume, width: 100 });
        this.tabControl = new TabControl({ctx: this.ctx, tabs: [{ label: 'Volume', id: 'volume' }, { label: 'Keypress', id: 'Keypress'}], x: 20, y: 20 });

        this.minVelocitySlider = new SliderControl({ ctx: this.ctx, label: 'Min', initialValue: this.settings.minVelocity, width: 100 });
        this.maxVelocitySlider = new SliderControl({ ctx: this.ctx, label: 'Max', initialValue: this.settings.maxVelocity, width: 100 });
        this.controls = [this.volumeSlider, this.minVelocitySlider, this.maxVelocitySlider];

        // --- Constants ---
        this.TOTAL_KEYS = 88;
        this.WHITE_KEYS_COUNT = 52;
        this.LOWEST_NOTE = 21;
        this.SCROLLBAR_HEIGHT = 20;
        this.WHITE_KEY_ASPECT_RATIO = 5.5; 
        this.BLACK_KEY_WIDTH_RATIO = 0.6;
        this.BLACK_KEY_HEIGHT_RATIO = 0.6;
        this.MAX_WHITE_KEY_WIDTH = 40;
        this.DRAWER_OPEN_HEIGHT_RATIO = 0.35;
        this.DRAWER_HANDLE_HEIGHT = 20;

        this.initKeys();
        this.initEventListeners();
        this.loadSettings(); // Load settings after init
        this.resizeCanvas();
    }

    initKeys() {
        let whiteKeyIndex = 0;
        for (let i = 0; i < this.TOTAL_KEYS; i++) {
            const note = this.LOWEST_NOTE + i;
            const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
            this.keys.push({ note, isBlack, isPressed: false, x: 0, y: 0, width: 0, height: 0, whiteKeyIndex: isBlack ? -1 : whiteKeyIndex++ });
        }
    }

    initEventListeners() {
        new ResizeObserver(() => this.resizeCanvas()).observe(this.canvas);
        this.canvas.addEventListener('mousedown', this.handlePointerDown.bind(this));
        window.addEventListener('mousemove', this.handlePointerMove.bind(this));
        window.addEventListener('mouseup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('touchstart', this.handlePointerDown.bind(this), { passive: false });
        window.addEventListener('touchmove', this.handlePointerMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.handlePointerUp.bind(this));
        window.addEventListener('touchcancel', this.handlePointerUp.bind(this));
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    resizeCanvas() {
        if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            this.draw();
        }
    }

    handlePointerDown(e) {
        e.preventDefault();
        const pointers = e.changedTouches ? e.changedTouches : [e];
        const rect = this.canvas.getBoundingClientRect();

        for (const pointer of pointers) {
            const x = pointer.clientX - rect.left;
            const y = pointer.clientY - rect.top;
            const id = pointer.identifier ?? 'mouse';
            
            if (this.isPointInRect(x, y, this.getDrawerHandleBounds())) {
                this.isDrawerOpen = !this.isDrawerOpen;
                this.draw();
                return;
            }

            if (this.isDrawerOpen) {
                const drawerContentY = this.DRAWER_HANDLE_HEIGHT;
                    // Check if a tab is clicked
                    const tab = this.tabControl.getTabAt(x, y);
                    if (tab) {
                        this.tabControl.setActiveTab(tab.id);
                        this.draw();
                        return;
                }
                if (y > drawerContentY && y < drawerContentY + this.calculatedDrawerContentHeight) {
                    const controlX = x;
                    const controlY = y - drawerContentY + this.drawerScrollOffsetY;
                    
                    let controlInteracted = false;
                    for (const control of this.controls) {
                        if (control.isPointOnControl(controlX, controlY)) {
                            this.activeTouches.set(id, { type: 'control', control: control });
                            control.updateValueFromPosition(controlX);
                            this.updateSettingsFromControls();
                            controlInteracted = true;
                            break;
                        }
                    }
                    if (controlInteracted) { this.draw(); continue; }

                    this.activeTouches.set(id, { type: 'drawerPan', lastY: y });
                    this.draw();
                    continue;
                }
            }

            if (this.isPointInRect(x, y, this.getScrollbarHandleBounds())) {
                this.activeTouches.set(id, { type: 'scrollbar', startX: x - this.getScrollbarHandleBounds().x });
                this.draw();
                continue; 
            }

            const totalDrawerHeight = this.DRAWER_HANDLE_HEIGHT + this.calculatedDrawerContentHeight;
            const panAreaTop = totalDrawerHeight + this.calculatedKeyHeight;
            const panAreaBottom = this.canvas.height - this.SCROLLBAR_HEIGHT;
            if (y > panAreaTop && y < panAreaBottom) {
                this.activeTouches.set(id, { type: 'pan', lastX: x });
                this.draw();
                continue;
            }

            const key = this.getKeyAt(x, y);
            if (key) {
                this.pressKey(key.note);
                this.activeTouches.set(id, { type: 'key', note: key.note });
            }
        }
        this.draw();
    }

    handlePointerMove(e) {
        if (this.activeTouches.size === 0) return;
        e.preventDefault();
        const pointers = e.changedTouches ? e.changedTouches : [e];
        const rect = this.canvas.getBoundingClientRect();

        for (const pointer of pointers) {
            const x = pointer.clientX - rect.left;
            const y = pointer.clientY - rect.top;
            const id = pointer.identifier ?? 'mouse';
            const activeTouch = this.activeTouches.get(id);

            if (!activeTouch) continue;

            switch(activeTouch.type) {
                case 'control':
                    activeTouch.control.updateValueFromPosition(x);
                    this.updateSettingsFromControls();
                    break;
                case 'drawerPan':
                    const dy = y - activeTouch.lastY;
                    this.drawerScrollOffsetY -= dy;
                    this.clampDrawerScroll();
                    activeTouch.lastY = y;
                    break;
                case 'scrollbar':
                    const { totalWidth, handleWidth, trackWidth } = this.getScrollbarMetrics();
                    if (totalWidth <= this.canvas.width) return;
                    const newHandleX = x - activeTouch.startX;
                    const travelDist = trackWidth - handleWidth;
                    const scrollRatio = Math.max(0, Math.min(1, newHandleX / travelDist));
                    this.scrollOffset = scrollRatio * (totalWidth - this.canvas.width);
                    this.clampScrollOffset();
                    break;
                case 'pan':
                    const dx = x - activeTouch.lastX;
                    this.scrollOffset -= dx;
                    this.clampScrollOffset();
                    activeTouch.lastX = x;
                    break;
                case 'key':
                    const currentKey = this.getKeyAt(x, y);
                    const totalDrawerHeight = this.DRAWER_HANDLE_HEIGHT + this.calculatedDrawerContentHeight;
                    if (currentKey && currentKey.note !== activeTouch.note) {
                        this.releaseKey(activeTouch.note);
                        this.pressKey(currentKey.note);
                        this.activeTouches.set(id, { type: 'key', note: currentKey.note });
                    } else if (!currentKey && y > totalDrawerHeight) {
                        this.releaseKey(activeTouch.note);
                        this.activeTouches.delete(id);
                    }
                    break;
            }
        }
        this.draw();
    }

    handlePointerUp(e) {
        e.preventDefault();
        const pointers = e.changedTouches ? e.changedTouches : [e];
        for (const pointer of pointers) {
            const id = pointer.identifier ?? 'mouse';
            const activeTouch = this.activeTouches.get(id);
            if (activeTouch) {
                if (activeTouch.type === 'key') this.releaseKey(activeTouch.note);
                if (activeTouch.type === 'control') this.saveSettings();
                this.activeTouches.delete(id);
            }
        }
        this.draw();
    }
    
    handleKeyDown(e) {
        if (e.repeat || this.computerKeysDown.has(e.code)) return;
        const keyMapping = this.getComputerKeyMapping();
        const noteInfo = keyMapping[e.code];
        if (noteInfo) {
            this.computerKeysDown.add(e.code);
            this.pressKey(noteInfo.note + (this.octaveOffset * 12));
        } else if (e.code === 'Comma') {
            this.octaveOffset = Math.max(-4, this.octaveOffset - 1);
        } else if (e.code === 'Period') {
            this.octaveOffset = Math.min(4, this.octaveOffset + 1);
        }
        this.draw();
    }

    handleKeyUp(e) {
        const keyMapping = this.getComputerKeyMapping();
        const noteInfo = keyMapping[e.code];
        if (noteInfo) {
            this.computerKeysDown.delete(e.code);
            this.releaseKey(noteInfo.note + (this.octaveOffset * 12));
        }
        this.draw();
    }
    
    getComputerKeyMapping() {
        const baseNote = 60;
        const mapping = {'KeyQ':{note:baseNote+0},'KeyW':{note:baseNote+2},'KeyE':{note:baseNote+4},'KeyR':{note:baseNote+5},'KeyT':{note:baseNote+7},'KeyY':{note:baseNote+9},'KeyU':{note:baseNote+11},'KeyI':{note:baseNote+12},'KeyO':{note:baseNote+14},'KeyP':{note:baseNote+16},'Digit2':{note:baseNote+1},'Digit3':{note:baseNote+3},'Digit5':{note:baseNote+6},'Digit6':{note:baseNote+8},'Digit7':{note:baseNote+10},'Digit9':{note:baseNote+13},'Digit0':{note:baseNote+15}};
        this.customKeyMappings.forEach(m => { mapping[m.code] = { note: m.note }; });
        return mapping;
    }

    pressKey(note) {
        const key = this.keys.find(k => k.note === note);
        if (key) {
            key.isPressed = true;
            const velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, this.settings.volume));
            this.midiCallback([0x90, note, velocity], "internal");
        }
    }

    releaseKey(note) {
        const key = this.keys.find(k => k.note === note);
        if (key) {
            key.isPressed = false;
            this.midiCallback([0x80, note, 0], "internal");
        }
    }

    handleExternalMidiMessage(message, deviceName) {
        const status = message[0], command = status & 0xF0, originalChannel = status & 0x0F;
        const newMessage = [...message];

        if (command === 0x90 || command === 0x80) {
            const note = message[1];
            let velocity = (message.length > 2) ? message[2] : 0;
            const key = this.keys.find(k => k.note === note);
            
            if (command === 0x90 && velocity > 0) {
                if (key) key.isPressed = true;
                velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, velocity));
                newMessage[2] = velocity;
            } else {
                if (key) key.isPressed = false;
            }
            this.draw();
        }
        
        const newChannel = (originalChannel === 9) ? 9 : 0;
        newMessage[0] = command | newChannel;
        this.midiCallback(newMessage, deviceName);
    }

    getKeyAt(x, y) {
        const totalDrawerHeight = this.DRAWER_HANDLE_HEIGHT + this.calculatedDrawerContentHeight;
        if (y < totalDrawerHeight || y > totalDrawerHeight + this.calculatedKeyHeight) return null;
        const adjustedY = y - totalDrawerHeight;
        for (const key of this.keys.filter(k => k.isBlack).reverse()) {
            if (x >= key.x && x <= key.x + key.width && adjustedY >= key.y && adjustedY <= key.y + key.height) return key;
        }
        for (const key of this.keys.filter(k => !k.isBlack).reverse()) {
            if (x >= key.x && x <= key.x + key.width && adjustedY >= key.y && adjustedY <= key.y + key.height) return key;
        }
        return null;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.calculateDimensions();
        this.clampScrollOffset();
        this.drawDrawer();
        const totalDrawerHeight = this.DRAWER_HANDLE_HEIGHT + this.calculatedDrawerContentHeight;
        const keyBottomY = totalDrawerHeight + this.calculatedKeyHeight;
        const scrollbarTopY = this.canvas.height - this.SCROLLBAR_HEIGHT;
        if (keyBottomY < scrollbarTopY) {
            this.ctx.fillStyle = '#f0f0f0';
            this.ctx.fillRect(0, keyBottomY, this.canvas.width, scrollbarTopY - keyBottomY);
        }
        if (this.calculatedKeyHeight > 0) {
            this.ctx.save();
            this.ctx.translate(0, totalDrawerHeight);
            this.keys.filter(k => !k.isBlack).forEach(key => this.drawWhiteKey(key));
            this.keys.filter(k => k.isBlack).forEach(key => this.drawBlackKey(key));
            this.ctx.restore();
        }
        this.drawScrollbar();
    }

    calculateDimensions() {
        this.calculatedDrawerContentHeight = this.isDrawerOpen ? (this.canvas.height * this.DRAWER_OPEN_HEIGHT_RATIO) - this.DRAWER_HANDLE_HEIGHT : 0;
        if (this.calculatedDrawerContentHeight < 0) this.calculatedDrawerContentHeight = 0;
        const totalDrawerHeight = this.DRAWER_HANDLE_HEIGHT + this.calculatedDrawerContentHeight;
        const availableHeight = this.canvas.height - this.SCROLLBAR_HEIGHT - totalDrawerHeight;
        if (availableHeight <= 0) {
            this.calculatedKeyHeight = 0;
            this.keys.forEach(k => { k.width = k.height = 0; });
            return;
        }
        const widthFromHeight = availableHeight / this.WHITE_KEY_ASPECT_RATIO;
        const whiteKeyWidth = Math.min(widthFromHeight, this.MAX_WHITE_KEY_WIDTH);
        this.calculatedKeyHeight = whiteKeyWidth * this.WHITE_KEY_ASPECT_RATIO;
        const blackKeyWidth = whiteKeyWidth * this.BLACK_KEY_WIDTH_RATIO;
        const blackKeyHeight = this.calculatedKeyHeight * this.BLACK_KEY_HEIGHT_RATIO;
        this.keys.forEach(key => {
            if (!key.isBlack) {
                key.width = whiteKeyWidth;
                key.height = this.calculatedKeyHeight;
                key.x = key.whiteKeyIndex * whiteKeyWidth - this.scrollOffset;
                key.y = 0;
            }
        });
        this.keys.forEach(key => {
            if (key.isBlack) {
                const prevKey = this.keys[key.note - this.LOWEST_NOTE - 1];
                key.width = blackKeyWidth;
                key.height = blackKeyHeight;
                key.x = prevKey.x + prevKey.width - (blackKeyWidth / 2);
                key.y = 0;
            }
        });
    }

    clampScrollOffset() {
        const { totalWidth } = this.getScrollbarMetrics();
        const maxScroll = totalWidth - this.canvas.width;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll > 0 ? maxScroll : 0));
    }

    drawWhiteKey(key) {
        if (key.x > this.canvas.width || key.x + key.width < 0) return;
        this.ctx.save();
        const cornerRadius = Math.min(6, key.width / 4, key.height / 8);
        this.ctx.beginPath();
        this.ctx.roundRect(key.x, key.y, key.width, key.height, [0, 0, cornerRadius, cornerRadius]);
        const grad = this.ctx.createLinearGradient(key.x, key.y, key.x + key.width, key.y);
        if (key.isPressed) { grad.addColorStop(0, '#a0c4ff'); grad.addColorStop(1, '#c0d8ff'); } 
        else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.8, '#f8f8f8'); grad.addColorStop(1, '#e8e8e8'); }
        this.ctx.fillStyle = grad;
        this.ctx.fill();
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawBlackKey(key) {
        if (key.x > this.canvas.width || key.x + key.width < 0) return;
        this.ctx.save();
        const cornerRadius = Math.min(5, key.width / 4, key.height / 8);
        this.ctx.beginPath();
        this.ctx.roundRect(key.x, key.y, key.width, key.height, [0, 0, cornerRadius, cornerRadius]);
        const grad = this.ctx.createLinearGradient(key.x, key.y, key.x + key.width, key.y);
        if (key.isPressed) { grad.addColorStop(0, '#7b1fa2'); grad.addColorStop(1, '#5a0f82'); } 
        else { grad.addColorStop(0, '#4a4a4a'); grad.addColorStop(1, '#2a2a2a'); }
        this.ctx.fillStyle = grad;
        this.ctx.fill();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(key.x + 2, key.y + 2, key.width - 4, 2);
        this.ctx.restore();
    }

    drawDrawer() {
        this.drawDrawerHandle();
        if (!this.isDrawerOpen) return;
        this.ctx.save();
        const drawerContentY = this.DRAWER_HANDLE_HEIGHT;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, drawerContentY, this.canvas.width, this.calculatedDrawerContentHeight);
        this.ctx.strokeStyle = '#b0b0b0';
        this.ctx.beginPath();
        this.ctx.moveTo(0, drawerContentY + this.calculatedDrawerContentHeight);
        this.ctx.lineTo(this.canvas.width, drawerContentY + this.calculatedDrawerContentHeight);
        this.ctx.stroke();
        
        // Clip the drawing area for the drawer content
        this.ctx.beginPath();
        this.ctx.rect(0, drawerContentY, this.canvas.width, this.calculatedDrawerContentHeight);
        this.ctx.clip();

        this.ctx.translate(0, drawerContentY - this.drawerScrollOffsetY);
        
        this.tabControl.x = 20;
        this.tabControl.y = 0;
        this.tabControl.draw();
        let yPos = 40; // Start drawing controls below the tab bar
        for (const control of this.controls) {
            control.x = 20;
            control.ctx = this.ctx;
            control.y = yPos;
            control.draw();
            yPos += 40;
        }
        
        this.ctx.restore();
        this.drawDrawerScrollbar();
    }
    
    drawDrawerHandle() {
        const bounds = this.getDrawerHandleBounds();
        this.ctx.save();
        this.ctx.fillStyle = '#b0b0b0';
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, [0, 0, 10, 10]);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1.5;
        for(let i = 0; i < 3; i++) {
            const lineY = bounds.y + bounds.height/2 - 4 + i*4;
            this.ctx.beginPath();
            this.ctx.moveTo(bounds.x + 20, lineY);
            this.ctx.lineTo(bounds.x + bounds.width - 20, lineY);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
    
    isPointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    getDrawerHandleBounds() {
        const handleWidth = 100;
        return { x: this.canvas.width / 2 - handleWidth / 2, y: 0, width: handleWidth, height: this.DRAWER_HANDLE_HEIGHT };
    }

    getScrollbarMetrics() {
        const firstWhiteKey = this.keys.find(k => !k.isBlack);
        if (!firstWhiteKey || !firstWhiteKey.width) return { totalWidth: 0, handleWidth: 0, trackWidth: 0 };
        const totalWidth = this.WHITE_KEYS_COUNT * firstWhiteKey.width;
        const trackWidth = this.canvas.width;
        const handleWidth = Math.max(20, (trackWidth / totalWidth) * trackWidth);
        return { totalWidth, handleWidth, trackWidth };
    }

    getScrollbarHandleBounds() {
        const { totalWidth, handleWidth, trackWidth } = this.getScrollbarMetrics();
        if (totalWidth <= trackWidth) return { x: 0, y: this.canvas.height - this.SCROLLBAR_HEIGHT, width: 0, height: 0 };
        const maxScroll = totalWidth - trackWidth;
        const maxHandleTravel = trackWidth - handleWidth;
        const handleX = (this.scrollOffset / maxScroll) * maxHandleTravel;
        return { x: handleX, y: this.canvas.height - this.SCROLLBAR_HEIGHT, width: handleWidth, height: this.SCROLLBAR_HEIGHT };
    }

    drawScrollbar() {
        const y = this.canvas.height - this.SCROLLBAR_HEIGHT;
        const trackRadius = 8;
        this.ctx.save();
        this.ctx.fillStyle = '#cccccc';
        this.ctx.beginPath();
        this.ctx.roundRect(0, y, this.canvas.width, this.SCROLLBAR_HEIGHT, trackRadius);
        this.ctx.fill();
        const { totalWidth, handleWidth } = this.getScrollbarMetrics();
        if (totalWidth > this.canvas.width) {
            const handleBounds = this.getScrollbarHandleBounds();
            const handleRadius = 6;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.roundRect(handleBounds.x + 4, handleBounds.y + 4, handleBounds.width - 8, handleBounds.height - 8, handleRadius);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawDrawerScrollbar() {
        // To be implemented
    }

    clampDrawerScroll() {
        // To be implemented
    }

    // --- Settings Persistence ---
    saveSettings() {
        try {
            localStorage.setItem(`piano-settings-${this.canvasId}`, JSON.stringify(this.settings));
        } catch (e) {
            console.error("Could not save settings to localStorage.", e);
        }
        this.onSettingsChange(this.settings);
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem(`piano-settings-${this.canvasId}`);
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
                this.updateControlsFromSettings();
            }
        } catch (e) {
            console.error("Could not load settings from localStorage.", e);
        }
    }

    updateControlsFromSettings() {
        this.volumeSlider.value = this.settings.volume;
        this.minVelocitySlider.value = this.settings.minVelocity;
        this.maxVelocitySlider.value = this.settings.maxVelocity;
    }

    updateSettingsFromControls() {
        this.settings.volume = this.volumeSlider.value;
        this.settings.minVelocity = this.minVelocitySlider.value;
        this.settings.maxVelocity = this.maxVelocitySlider.value;
    }
}

export { PianoKeyboard };
