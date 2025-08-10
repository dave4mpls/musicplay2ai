/**
 * PianoKeyboard Component
 * * This class renders an interactive piano keyboard on a canvas element. It handles
 * user input from mouse, touch, and computer keyboard, and outputs MIDI messages.
 * It now integrates with the external Drawer.js component to provide a settings UI.
 */
class PianoKeyboard {
    /**
     * @param {object} config - The configuration object for the piano keyboard.
     * @param {HTMLCanvasElement} config.canvas - The canvas element to render on.
     * @param {function} config.midiCallback - Callback function to send MIDI messages.
     * @param {function} [config.onSettingsChange] - Callback for when settings are saved.
     * @param {Array} [config.customKeyMappings] - Custom computer keyboard to MIDI note mappings.
     */
    constructor(config) {
        this.canvas = config.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.midiCallback = config.midiCallback;
        this.onSettingsChange = config.onSettingsChange || (() => {});
        this.customKeyMappings = config.customKeyMappings || [];
        this.canvasId = this.canvas.id || 'piano-keyboard-default';
        this.resizeTimer = null;

        // --- State ---
        this.keys = [];
        this.activeTouches = new Map();
        this.computerKeysDown = new Set();
        this.scrollOffset = 0;
        this.octaveOffset = 0;
        this.keyHeight = 0;
        
        // --- Settings ---
        this.settings = {
            volume: 100,
            minVelocity: 0,
            maxVelocity: 127,
            pitchBend: false,
            velocityByPos: false
        };
        
        // --- Constants ---
        this.TOTAL_KEYS = 88;
        this.WHITE_KEYS_COUNT = 52;
        this.LOWEST_NOTE = 21; // MIDI note A0
        this.SCROLLBAR_HEIGHT = 20;
        this.WHITE_KEY_ASPECT_RATIO = 5.5; 
        this.BLACK_KEY_WIDTH_RATIO = 0.6;
        this.BLACK_KEY_HEIGHT_RATIO = 0.6;
        this.MAX_WHITE_KEY_WIDTH = 40;

        // --- Component Initialization ---
        // The EventBroker manages interactions between controls.
        this.eventBroker = new EventBroker(this.drawer);

        // Initialize the drawer with tabs and controls using the new format from Drawer.js.
        this.drawer = new Drawer({
            ctx: this.ctx,
            tabs: this.initTabs(),
            onStateChange: this.onStateChangeHandler.bind(this),
            eventBroker: this.eventBroker,
            handleHeight: 20,
            tabHeight: 30,
        });
        // Assign the created drawer to the broker.
        this.eventBroker.drawer = this.drawer;

        this.initKeys();
        this.initEventListeners();
        this.loadSettings();
        this.resizeCanvas();
        this.animationLoop();
    }

    /**
     * Initializes the tab structure for the settings drawer.
     * @returns {object} The configuration for tabs and their controls.
     */
    initTabs() {
        const onStateChange = (control) => this.onStateChangeHandler(control);

        return {
            'Volume': [
                new SliderControl({ ctx: this.ctx, id: 'volume', label: 'Volume', min: 0, max: 127, initialValue: this.settings.volume, onStateChange }),
                new SliderControl({ ctx: this.ctx, id: 'minVelocity', label: 'Min Velocity', min: 0, max: 127, initialValue: this.settings.minVelocity, onStateChange }),
                new SliderControl({ ctx: this.ctx, id: 'maxVelocity', label: 'Max Velocity', min: 0, max: 127, initialValue: this.settings.maxVelocity, onStateChange }),
            ],
            'Keys': [
                new ToggleSwitch({ ctx: this.ctx, id: 'pitchBend', label: 'Drag for Pitch Bend', initialValue: this.settings.pitchBend, onStateChange }),
                new ToggleSwitch({ ctx: this.ctx, id: 'velocityByPos', label: 'Lower on Keys Is Louder', initialValue: this.settings.velocityByPos, onStateChange }),
            ],
            'Scales': [] // Placeholder for future scale features
        };
    }

    /**
     * Handles state changes from any control in the drawer.
     * @param {object} control - The control that changed.
     */
    onStateChangeHandler(control) {
        if (control && control.id && this.settings.hasOwnProperty(control.id)) {
            this.settings[control.id] = control.value;
            this.saveSettings();
        }
    }

    /**
     * Creates the internal representation of all 88 piano keys.
     */
    initKeys() {
        let whiteKeyIndex = 0;
        for (let i = 0; i < this.TOTAL_KEYS; i++) {
            const note = this.LOWEST_NOTE + i;
            const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
            this.keys.push({ note, isBlack, isPressed: false, x: 0, y: 0, width: 0, height: 0, whiteKeyIndex: isBlack ? -1 : whiteKeyIndex++ });
        }
    }

    /**
     * Sets up all necessary event listeners for the component.
     */
    initEventListeners() {
        new ResizeObserver(() => this.resizeCanvas()).observe(this.canvas);

        const getCanvasCoordinates = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        this.canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const event = { type: 'pointerdown', ...getCanvasCoordinates(e), id: e.pointerId ?? 'mouse' };

            if (this.eventBroker.capturedControl || this.drawer.isPointInBounds(event.x, event.y)) {
                this.drawer.handleEvent(event);
            } else {
                this.handleKeyboardPointerDown(event);
            }
        });

        window.addEventListener('pointermove', (e) => {
            const event = { type: 'pointermove', ...getCanvasCoordinates(e), id: e.pointerId ?? 'mouse' };

            if (this.eventBroker.capturedControl || this.drawer.activeInteraction) {
                e.preventDefault();
                this.drawer.handleEvent(event);
            } else if (this.activeTouches.size > 0) {
                this.handleKeyboardPointerMove(event);
            } else if (this.drawer.isPointInBounds(event.x, event.y)) {
                this.drawer.handleEvent(event);
            }
        });

        window.addEventListener('pointerup', (e) => {
            const event = { type: 'pointerup', ...getCanvasCoordinates(e), id: e.pointerId ?? 'mouse' };
            
            if (this.eventBroker.capturedControl || this.drawer.activeInteraction) {
                e.preventDefault();
                this.drawer.handleEvent(event);
            }
            this.handleKeyboardPointerUp(event);
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            const event = { type: 'wheel', deltaY: e.deltaY, ...getCanvasCoordinates(e) };
            if (this.eventBroker.capturedControl || this.drawer.isPointInBounds(event.x, event.y)) {
                e.preventDefault();
                this.drawer.handleEvent(event);
            }
        }, { passive: false });

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    /**
     * Resizes the canvas and recalculates layout-dependent properties.
     */
    resizeCanvas() {
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.performResize();
            this.resizeTimer = null;
        }, 25);
    }

    performResize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.drawer.updateHeight();
        this.draw();
    }


    /**
     * Handles pointer down events specifically for the keyboard area (not the drawer).
     * @param {object} event - The normalized pointer event.
     */
    handleKeyboardPointerDown(event) {
        const { x, y, id } = event;

        if (this.isPointInRect(x, y, this.getScrollbarHandleBounds())) {
            this.activeTouches.set(id, { type: 'scrollbar', startX: x - this.getScrollbarHandleBounds().x });
            return;
        }

        const drawerHeight = this.drawer.getHeight();
        const panAreaTop = drawerHeight + this.keyHeight;
        const panAreaBottom = this.canvas.height - this.SCROLLBAR_HEIGHT;
        if (y > panAreaTop && y < panAreaBottom) {
            this.activeTouches.set(id, { type: 'pan', lastX: x });
            return;
        }

        const key = this.getKeyAt(x, y);
        if (key) {
            const relativeY = y - drawerHeight;
            this.pressKey(key.note, relativeY);
            this.activeTouches.set(id, { type: 'key', note: key.note, startX: x, startY: y, keyWidth: key.width });
        }
    }

    /**
     * Handles pointer move events for active keyboard interactions.
     * @param {object} event - The normalized pointer event.
     */
    handleKeyboardPointerMove(event) {
        const { x, y, id } = event;
        const activeTouch = this.activeTouches.get(id);
        if (!activeTouch) return;

        switch (activeTouch.type) {
            case 'scrollbar': {
                const { totalWidth, handleWidth, trackWidth } = this.getScrollbarMetrics();
                if (totalWidth <= this.canvas.width) return;
                const newHandleX = x - activeTouch.startX;
                const travelDist = trackWidth - handleWidth;
                const scrollRatio = Math.max(0, Math.min(1, newHandleX / travelDist));
                this.scrollOffset = scrollRatio * (totalWidth - this.canvas.width);
                this.clampScrollOffset();
                break;
            }
            case 'pan': {
                const panDx = x - activeTouch.lastX;
                this.scrollOffset -= panDx;
                this.clampScrollOffset();
                activeTouch.lastX = x;
                break;
            }
            case 'key': {
                if (this.settings.pitchBend) {
                    const bendDX = x - activeTouch.startX;
                    const bendRatio = Math.max(-1, Math.min(1, bendDX / (activeTouch.keyWidth * 2))); // Wider bend range
                    const bendValue = Math.round(8192 + bendRatio * 8191);
                    this.midiCallback([0xE0, bendValue & 0x7F, (bendValue >> 7) & 0x7F], 'internal');
                } else {
                    const currentKey = this.getKeyAt(x, y);
                    if (currentKey && currentKey.note !== activeTouch.note) {
                        this.releaseKey(activeTouch.note);
                        const relativeY = y - this.drawer.getHeight();
                        this.pressKey(currentKey.note, relativeY);
                        this.activeTouches.set(id, { type: 'key', note: currentKey.note, startX: x, startY: y, keyWidth: currentKey.width });
                    } else if (!currentKey && y > this.drawer.getHeight()) {
                        this.releaseKey(activeTouch.note);
                        this.activeTouches.delete(id);
                    }
                }
                break;
            }
        }
    }

    /**
     * Handles pointer up events to release keys and end interactions.
     * @param {object} event - The normalized pointer event.
     */
    handleKeyboardPointerUp(event) {
        const { id } = event;
        const activeTouch = this.activeTouches.get(id);
        if (activeTouch) {
            if (activeTouch.type === 'key') {
                this.releaseKey(activeTouch.note);
                if (this.settings.pitchBend) this.midiCallback([0xE0, 0, 64], 'internal'); // Reset pitch bend
            }
            this.activeTouches.delete(id);
        }
    }
    
    /**
     * Handles computer keyboard keydown events for playing notes.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeyDown(e) {
        if (e.repeat || this.computerKeysDown.has(e.code)) return;
        const keyMapping = this.getComputerKeyMapping();
        const noteInfo = keyMapping[e.code];
        if (noteInfo) {
            this.computerKeysDown.add(e.code);
            this.pressKey(noteInfo.note + (this.octaveOffset * 12));
        } else if (e.code === 'Comma' || e.code === 'KeyZ') this.octaveOffset = Math.max(-4, this.octaveOffset - 1);
        else if (e.code === 'Period' || e.code === 'KeyX') this.octaveOffset = Math.min(4, this.octaveOffset + 1);
    }

    /**
     * Handles computer keyboard keyup events.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeyUp(e) {
        const keyMapping = this.getComputerKeyMapping();
        const noteInfo = keyMapping[e.code];
        if (noteInfo) {
            this.computerKeysDown.delete(e.code);
            this.releaseKey(noteInfo.note + (this.octaveOffset * 12));
        }
    }
    
    /**
     * Gets the mapping of computer keys to MIDI notes.
     * @returns {object} The key mapping.
     */
    getComputerKeyMapping() {
        const baseNote = 60; // Middle C
        const mapping = {
            'KeyA':{note:baseNote+0}, 'KeyW':{note:baseNote+1}, 'KeyS':{note:baseNote+2}, 'KeyE':{note:baseNote+3},
            'KeyD':{note:baseNote+4}, 'KeyF':{note:baseNote+5}, 'KeyT':{note:baseNote+6}, 'KeyG':{note:baseNote+7},
            'KeyY':{note:baseNote+8}, 'KeyH':{note:baseNote+9}, 'KeyU':{note:baseNote+10}, 'KeyJ':{note:baseNote+11},
            'KeyK':{note:baseNote+12},'KeyO':{note:baseNote+13},'KeyL':{note:baseNote+14},'KeyP':{note:baseNote+15},
            'Semicolon':{note:baseNote+16}
        };
        this.customKeyMappings.forEach(m => { mapping[m.code] = { note: m.note }; });
        return mapping;
    }

    /**
     * Triggers a 'note on' event for a specific key.
     * @param {number} note - The MIDI note number.
     * @param {number|null} [relativeY=null] - The vertical position on the key for velocity calculation.
     */
    pressKey(note, relativeY = null) {
        const key = this.keys.find(k => k.note === note);
        if (!key || key.isPressed) return;

        key.isPressed = true;
        let velocity = this.settings.volume;

        if (this.settings.velocityByPos && relativeY !== null) {
            let ratio = 0;
            if (key.isBlack) {
                ratio = Math.max(0, Math.min(1, relativeY / key.height));
            } else {
                const whiteKeyVelocityTopY = key.height * this.BLACK_KEY_HEIGHT_RATIO;
                ratio = relativeY > whiteKeyVelocityTopY 
                    ? Math.max(0, Math.min(1, (relativeY - whiteKeyVelocityTopY) / (key.height - whiteKeyVelocityTopY)))
                    : 0;
            }
            velocity = Math.round(ratio * 127);
        }
        
        velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, velocity));
        
        this.midiCallback([0x90, note, velocity], "internal");
    }

    /**
     * Triggers a 'note off' event for a specific key.
     * @param {number} note - The MIDI note number.
     */
    releaseKey(note) {
        const key = this.keys.find(k => k.note === note);
        if (key && key.isPressed) {
            key.isPressed = false;
            this.midiCallback([0x80, note, 0], "internal");
        }
    }

    /**
     * Handles incoming MIDI messages from external devices.
     * @param {Uint8Array} message - The MIDI message data.
     * @param {string} deviceName - The name of the source device.
     */
    handleExternalMidiMessage(message, deviceName) {
        const command = message[0] & 0xF0;
        if (command === 0x90 || command === 0x80) {
            const note = message[1];
            const velocity = (message.length > 2) ? message[2] : 0;
            const key = this.keys.find(k => k.note === note);
            if (key) {
                key.isPressed = (command === 0x90 && velocity > 0);
            }
        }
        this.midiCallback([...message], deviceName);
    }

    /**
     * Finds the key at a given canvas coordinate.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {object|null} The key object or null if none found.
     */
    getKeyAt(x, y) {
        const drawerHeight = this.drawer.getHeight();
        if (y < drawerHeight || y > drawerHeight + this.keyHeight) return null;
        
        const adjustedX = x + this.scrollOffset;
        const adjustedY = y - drawerHeight;

        for (const key of this.keys.filter(k => k.isBlack).reverse()) {
            if (adjustedX >= key.x && adjustedX <= key.x + key.width && adjustedY >= key.y && adjustedY <= key.y + key.height) return key;
        }
        for (const key of this.keys.filter(k => !k.isBlack).reverse()) {
            if (adjustedX >= key.x && adjustedX <= key.x + key.width && adjustedY >= key.y && adjustedY <= key.y + key.height) return key;
        }
        return null;
    }

    /**
     * The main animation loop for continuous rendering.
     */
    animationLoop() {
        this.draw();
        requestAnimationFrame(this.animationLoop.bind(this));
    }

    /**
     * The main drawing function, called on every frame.
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const drawerHeight = this.drawer.getHeight();
        this.calculateKeyDimensions(drawerHeight);
        
        const keyBottomY = drawerHeight + this.keyHeight;
        const scrollbarTopY = this.canvas.height - this.SCROLLBAR_HEIGHT;
        if (keyBottomY < scrollbarTopY) {
            this.ctx.fillStyle = '#f0f0f0';
            this.ctx.fillRect(0, keyBottomY, this.canvas.width, scrollbarTopY - keyBottomY);
        }

        if (this.keyHeight > 0) {
            this.ctx.save();
            this.ctx.translate(0, drawerHeight);
            this.ctx.beginPath();
            this.ctx.rect(0, 0, this.canvas.width, this.keyHeight);
            this.ctx.clip();
            this.ctx.translate(-this.scrollOffset, 0);
            this.keys.filter(k => !k.isBlack).forEach(key => this.drawWhiteKey(key));
            this.keys.filter(k => k.isBlack).forEach(key => this.drawBlackKey(key));
            this.ctx.restore();
        }
        
        this.drawScrollbar();
        this.drawer.draw();

        const overlayControl = this.eventBroker.getOverlayControl();
        if (overlayControl) {
            this.drawer.drawOverlay(overlayControl);
        }
    }
    
    /**
     * Calculates the dimensions and positions of all keys based on canvas size.
     * @param {number} drawerHeight - The current height of the settings drawer.
     */
    calculateKeyDimensions(drawerHeight) {
        const availableHeight = this.canvas.height - this.SCROLLBAR_HEIGHT - drawerHeight;
        if (availableHeight <= 0) {
            this.keyHeight = 0;
            return;
        }

        const widthFromHeight = availableHeight / this.WHITE_KEY_ASPECT_RATIO;
        const whiteKeyWidth = Math.min(widthFromHeight, this.MAX_WHITE_KEY_WIDTH);
        
        this.keyHeight = whiteKeyWidth * this.WHITE_KEY_ASPECT_RATIO;
        const blackKeyWidth = whiteKeyWidth * this.BLACK_KEY_WIDTH_RATIO;
        const blackKeyHeight = this.keyHeight * this.BLACK_KEY_HEIGHT_RATIO;

        this.keys.forEach(key => {
            if (!key.isBlack) {
                key.width = whiteKeyWidth;
                key.height = this.keyHeight;
                key.x = key.whiteKeyIndex * whiteKeyWidth;
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

    /**
     * Ensures the scroll offset does not go out of bounds.
     */
    clampScrollOffset() {
        const { totalWidth } = this.getScrollbarMetrics();
        const maxScroll = totalWidth - this.canvas.width;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll > 0 ? maxScroll : 0));
    }

    /**
     * Draws a single white key.
     * @param {object} key - The key object to draw.
     */
    drawWhiteKey(key) {
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

    /**
     * Draws a single black key.
     * @param {object} key - The key object to draw.
     */
    drawBlackKey(key) {
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
    
    /**
     * Checks if a point is within a given rectangle.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {object} rect - The rectangle object {x, y, width, height}.
     * @returns {boolean} True if the point is inside the rectangle.
     */
    isPointInRect(x, y, rect) {
        return rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    /**
     * Calculates metrics for the horizontal scrollbar.
     * @returns {object} The scrollbar metrics.
     */
    getScrollbarMetrics() {
        const firstWhiteKey = this.keys.find(k => !k.isBlack);
        if (!firstWhiteKey || !firstWhiteKey.width) return { totalWidth: 0, handleWidth: 0, trackWidth: 0 };
        const totalWidth = this.WHITE_KEYS_COUNT * firstWhiteKey.width;
        const trackWidth = this.canvas.width;
        const handleWidth = totalWidth > trackWidth ? Math.max(20, (trackWidth / totalWidth) * trackWidth) : 0;
        return { totalWidth, handleWidth, trackWidth };
    }

    /**
     * Calculates the bounds of the scrollbar handle.
     * @returns {object} The handle's rectangle {x, y, width, height}.
     */
    getScrollbarHandleBounds() {
        const { totalWidth, handleWidth, trackWidth } = this.getScrollbarMetrics();
        if (totalWidth <= trackWidth) return null;
        const maxScroll = totalWidth - trackWidth;
        const maxHandleTravel = trackWidth - handleWidth;
        const handleX = (this.scrollOffset / maxScroll) * maxHandleTravel;
        return { x: handleX, y: this.canvas.height - this.SCROLLBAR_HEIGHT, width: handleWidth, height: this.SCROLLBAR_HEIGHT };
    }

    /**
     * Draws the horizontal scrollbar at the bottom of the canvas.
     */
    drawScrollbar() {
        const y = this.canvas.height - this.SCROLLBAR_HEIGHT;
        const trackRadius = 8;
        this.ctx.save();
        this.ctx.fillStyle = '#cccccc';
        this.ctx.beginPath();
        this.ctx.roundRect(0, y, this.canvas.width, this.SCROLLBAR_HEIGHT, trackRadius);
        this.ctx.fill();
        
        const handleBounds = this.getScrollbarHandleBounds();
        if (handleBounds) {
            const handleRadius = 6;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.roundRect(handleBounds.x + 4, handleBounds.y + 4, handleBounds.width - 8, handleBounds.height - 8, handleRadius);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    // --- Settings Persistence ---
    saveSettings() {
        try {
            localStorage.setItem(`piano-settings-${this.canvasId}`, JSON.stringify(this.settings));
        } catch (e) { console.error("Could not save settings.", e); }
        this.onSettingsChange(this.settings);
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem(`piano-settings-${this.canvasId}`);
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                this.updateControlsFromSettings();
            }
        } catch (e) { console.error("Could not load settings.", e); }
    }

    updateControlsFromSettings() {
        // Find each control in the drawer's tab structure and update its value
        const allControls = Object.values(this.drawer.tabs).flat();
        allControls.forEach(control => {
            if (this.settings.hasOwnProperty(control.id)) {
                control.value = this.settings[control.id];
            }
        });
    }
}
