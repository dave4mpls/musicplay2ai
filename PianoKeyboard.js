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
            velocityByPos: false,
            keyWidthPercentage: 100,
            scaleSettings: { root: 0, scale: 'None', action: 'None' },
        };

        this.drumMachineState = {
            isPlaying: false,
            pattern: {},    // e.g., { 35: [true, false, ...], 38: [false, true, ...] }
            volumes: {},    // e.g., { 35: 127, 38: 100 }
            swing: 0,       // 0-100
            currentStep: 0,
            nextStepTime: 0
        };
        this.drumMachineTimer = null;
        this.scaleNoteMap = []; // A pre-calculated map for scale logic
        this.DRUM_CHANNEL = 9; // 0-based channel for drums        

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

        // --- DRUMS TAB ---
        const drumPads = [new RowControl({ ctx: this.ctx, controls: (window.synth.drummap || []).map((drum, index) => {
            const noteNumber = 35 + index;
            return new ButtonControl({
                ctx: this.ctx,
                id: `drum_${noteNumber}`,
                label: drum.name,
                autoSize: true,
                onClick: () => this._playDrumNote(noteNumber),
                onRelease: () => this._stopDrumNote(noteNumber)
            });
        }) }) ];
        // Add a spacer row for better layout        
        drumPads.push(new RowControl({ ctx: this.ctx, controls: [ new SpaceControl({ ctx: this.ctx, width: 20, height: 20 })] }));

        // --- CHORDS TAB ---
        const chords = [
            { name: 'C Major', notes: [60, 64, 67] }, { name: 'F Major', notes: [53, 57, 60] },
            { name: 'G Major', notes: [55, 59, 62] }, { name: 'A Minor', notes: [57, 60, 64] },
            { name: 'E Minor', notes: [52, 55, 59] }, { name: 'D Minor', notes: [50, 53, 58] },
            { name: 'C7', notes: [60, 64, 67, 70] },   { name: 'CMaj7', notes: [60, 64, 67, 71] },
        ];
        const chordPads = chords.map(chord => new ButtonControl({
            ctx: this.ctx,
            id: `chord_${chord.name.replace(' ','')}`,
            label: chord.name,
            autoSize: true,
            onClick: () => this._playChord(chord.notes),
            onRelease: () => this._stopChord(chord.notes)
        }));
        
        // --- DRUM MACHINE TAB ---
        const drumMachineControls = [
            new RowControl({ ctx: this.ctx, controls: [
                new ButtonControl({ ctx: this.ctx, id: 'dm_play', label: 'Play', onClick: () => this._startDrumMachine(), isActive: () => this.drumMachineState.isPlaying }),
                new ButtonControl({ ctx: this.ctx, id: 'dm_stop', label: 'Stop', onClick: () => this._stopDrumMachine() }),
                new SliderControl({ ctx: this.ctx, id: 'dm_swing', label: 'Swing', min: 0, max: 100, initialValue: 0, onStateChange: (c) => this.drumMachineState.swing = c.value }),
            ]})
        ];
        (window.synth.drummap || []).forEach((drum, index) => {
            const noteNumber = 35 + index;
            this.drumMachineState.pattern[noteNumber] = new Array(32).fill(false);
            this.drumMachineState.volumes[noteNumber] = 127;
            
            drumMachineControls.push(new RowControl({ ctx: this.ctx, controls: [
                new StaticTextControl({ ctx: this.ctx, label: drum.name, width: 150, font: '11px sans-serif'}),
                new PopupSliderControl({ ctx: this.ctx, id: `dm_vol_${noteNumber}`, label: 'Vol', min: 0, max: 127, initialValue: 127, width: 60, height: 100, onStateChange: (c) => this.drumMachineState.volumes[noteNumber] = c.slider.value }),
                new DrumbeatControl({ ctx: this.ctx, id: `dm_pattern_${noteNumber}`, width: 500, initialValue: this.drumMachineState.pattern[noteNumber], onStateChange: (c) => this.drumMachineState.pattern[noteNumber] = c.value })
            ]}));
        });

        // --- SCALES TAB ---
        const rootNoteOptions = Array.from({length: 12}, (_, i) => ({ text: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][i], value: i }));
        const scaleOptions = [
            { text: "None", value: "None" }, { text: "Major (Ionian)", value: "Major" },
            { text: "Dorian", value: "Dorian" }, { text: "Phrygian", value: "Phrygian" },
            { text: "Lydian", value: "Lydian" }, { text: "Mixolydian", value: "Mixolydian" },
            { text: "Minor (Aeolian)", value: "Minor" }, { text: "Locrian", value: "Locrian" },
            { text: "Pentatonic", value: "Pentatonic" }, { text: "Blues", value: "Blues" },
        ];
        const actionOptions = [
            { text: "None", value: "None" }, { text: "Highlight", value: "Highlight" },
            { text: "Round Closest", value: "Round Closest" },
            { text: "Mute Non-Scale", value: "Mute Non-Scale" },
            { text: "White Keys Only", value: "White Keys" },
        ];
        return {
            'Volume': [
                new SliderControl({ ctx: this.ctx, id: 'volume', label: 'Volume', min: 0, max: 127, initialValue: this.settings.volume, onStateChange }),
                new SliderControl({ ctx: this.ctx, id: 'minVelocity', label: 'Min Velocity', min: 0, max: 127, initialValue: this.settings.minVelocity, onStateChange }),
                new SliderControl({ ctx: this.ctx, id: 'maxVelocity', label: 'Max Velocity', min: 0, max: 127, initialValue: this.settings.maxVelocity, onStateChange }),
            ],
            'Keys': [
                new ToggleSwitch({ ctx: this.ctx, id: 'pitchBend', label: 'Drag for Pitch Bend', initialValue: this.settings.pitchBend, onStateChange }),
                new ToggleSwitch({ ctx: this.ctx, id: 'velocityByPos', label: 'Lower on Keys Is Louder', initialValue: this.settings.velocityByPos, onStateChange }),
                new SpaceControl({ ctx: this.ctx, width: 0 }), // Spacer
                new PopupSliderControl({
                    ctx: this.ctx,
                    id: 'keyWidthPercentage',
                    label: 'Key Width',
                    min: 0,
                    max: 300,
                    initialValue: this.settings.keyWidthPercentage,
                    width: 120, // Width of the button
                    height: 120, // Height of the vertical slider popup
                    onStateChange
                }),
            ],
            'Drums': drumPads,
            'Chords': chordPads,
            'Drum Machine': drumMachineControls,
            'Scales': [
                new DropdownControl({ ctx: this.ctx, id: 'scaleRoot', label: 'Root Note', options: rootNoteOptions, initialValue: 0, onSelect: (val) => { this.settings.scaleSettings.root = val; this._updateScaleMap(); }}),
                new DropdownControl({ ctx: this.ctx, id: 'scaleType', label: 'Scale Type', width: 100, options: scaleOptions, initialValue: 'None', onSelect: (val) => { this.settings.scaleSettings.scale = val; this._updateScaleMap(); }}),
                new DropdownControl({ ctx: this.ctx, id: 'scaleAction', label: 'Action', width: 100, options: actionOptions, initialValue: 'None', onSelect: (val) => { this.settings.scaleSettings.action = val; this._updateScaleMap(); }}),
            ]
        };
    }

    /**
     * Handles state changes from any control in the drawer.
     * @param {object} control - The control that changed.
     */
    onStateChangeHandler(control) {
        if (control && control.id && this.settings.hasOwnProperty(control.id)) {
            // Get the value correctly, checking if it's a composite PopupSliderControl.
            const value = (control instanceof PopupSliderControl) 
                ? control.slider.value 
                : control.value;

            // Update the setting only if the value has changed.
            if (this.settings[control.id] !== value) {
                this.settings[control.id] = value;
                this.saveSettings();
            }
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

    // --- DRUM & CHORD PAD HANDLERS ---
    _playDrumNote(noteNumber) {
        let velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, this.settings.volume));
        this.midiCallback([0x90 | this.DRUM_CHANNEL, noteNumber, velocity], "internal");
    }
    _stopDrumNote(noteNumber) {
        this.midiCallback([0x80 | this.DRUM_CHANNEL, noteNumber, 0], "internal");
    }
    _playChord(notes) {
        let velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, this.settings.volume));
        notes.forEach(note => this.midiCallback([0x90, note, velocity], "chord"));
    }
    _stopChord(notes) {
        notes.forEach(note => this.midiCallback([0x80, note, 0], "chord"));
    }

    // --- DRUM MACHINE LOGIC ---
    _startDrumMachine() {
        if (this.drumMachineState.isPlaying) return;
        this.drumMachineState.isPlaying = true;
        this.drumMachineState.currentStep = 0;
        // Set the time for the very first beat to happen now.
        this.drumMachineState.nextStepTime = this.ctx.canvas.ownerDocument.defaultView.performance.now();
        // Use a timeout-based loop instead of rAF
        this._drumMachineLoop();
    }

    _stopDrumMachine() {
        this.drumMachineState.isPlaying = false;
        // Use clearTimeout for the new timer
        clearTimeout(this.drumMachineTimer);
    }

    _drumMachineLoop() {
        if (!this.drumMachineState.isPlaying) return;

        const tempo = window.pianoRoll ? window.pianoRoll.bpm : 120;
        const secondsPerBeat = 60.0 / tempo;
        const secondsPer32ndNote = secondsPerBeat / 8.0;
        const noteDurationMs = (secondsPer32ndNote * 1000) * 0.9; // Note off just before next beat

        // Process the current step
        const step = this.drumMachineState.currentStep;
        for (const noteNumber in this.drumMachineState.pattern) {
            if (this.drumMachineState.pattern[noteNumber][step]) {
                const volume = this.drumMachineState.volumes[noteNumber];
                const velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, volume));
                
                this.midiCallback([0x90 | this.DRUM_CHANNEL, parseInt(noteNumber), velocity], "drum-machine");
                // Use a separate timeout for the note-off message
                setTimeout(() => {
                    this.midiCallback([0x80 | this.DRUM_CHANNEL, parseInt(noteNumber), 0], "drum-machine");
                }, noteDurationMs);
            }
        }

        // Advance to the next step
        this.drumMachineState.currentStep = (step + 1) % 32;

        // Calculate delay for the next step, incorporating swing
        const isOddStep = step % 2 !== 0;
        const swingDelay = isOddStep ? (secondsPer32ndNote * (this.drumMachineState.swing / 100)) : 0;
        this.drumMachineState.nextStepTime += (secondsPer32ndNote + swingDelay) * 1000;

        // Schedule the next loop iteration precisely
        const delay = this.drumMachineState.nextStepTime - this.ctx.canvas.ownerDocument.defaultView.performance.now();
        this.drumMachineTimer = setTimeout(this._drumMachineLoop.bind(this), Math.max(0, delay));
    }

    // --- SCALE LOGIC ---
    _getScaleNotes(root, scaleType) {
        const scales = {
            'None': [],
            'Major': [0, 2, 4, 5, 7, 9, 11],
            'Minor': [0, 2, 3, 5, 7, 8, 10],
            'Dorian': [0, 2, 3, 5, 7, 9, 10],
            'Phrygian': [0, 1, 3, 5, 7, 8, 10],
            'Lydian': [0, 2, 4, 6, 7, 9, 11],
            'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'Locrian': [0, 1, 3, 5, 6, 8, 10],
            'Pentatonic': [0, 2, 4, 7, 9],
            'Blues': [0, 3, 5, 6, 7, 10],
        };
        const intervals = scales[scaleType] || [];
        return intervals.map(i => (root + i) % 12);
    }

    _updateScaleMap() {
        const { root, scale } = this.settings.scaleSettings;
        const scaleNotes = this._getScaleNotes(root, scale);
        this.scaleNoteMap = [];
        if (scale === 'None') return;

        for (let i = 0; i < 128; i++) {
            const isScaleNote = scaleNotes.includes(i % 12);
            let closestNote = i;
            if (!isScaleNote) {
                let minDistance = 12;
                for (const scaleNotePitch of scaleNotes) {
                    for (let oct = -1; oct <= 1; oct++) {
                        const fullNote = (Math.floor(i / 12) + oct) * 12 + scaleNotePitch;
                        const distance = Math.abs(fullNote - i);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestNote = fullNote;
                        }
                    }
                }
            }
            this.scaleNoteMap[i] = { isScaleNote, closestNote };
        }
    }

    _getNoteAction(note, whiteKeyIndex = -1) {
        const { action, scale } = this.settings.scaleSettings;
        if (action === 'None' || scale === 'None') {
            return { shouldMute: false, finalNote: note };
        }

        if (action === 'White Keys') {
            if (whiteKeyIndex === -1) return { shouldMute: true, finalNote: note }; // It's a black key press
            
            const { root } = this.settings.scaleSettings;
            const scaleNotes = this._getScaleNotes(root, scale);
            const octave = Math.floor(whiteKeyIndex / scaleNotes.length);
            const scaleIndex = whiteKeyIndex % scaleNotes.length;
            const finalNote = (this.octaveOffset + octave + 4) * 12 + scaleNotes[scaleIndex];
            return { shouldMute: false, finalNote: finalNote };
        }

        const map = this.scaleNoteMap[note];
        if (!map) return { shouldMute: true, finalNote: note }; // Should not happen

        if (map.isScaleNote) {
            return { shouldMute: false, finalNote: note };
        }

        switch (action) {
            case 'Mute Non-Scale':
                return { shouldMute: true, finalNote: note };
            case 'Round Closest':
                return { shouldMute: false, finalNote: map.closestNote };
            default:
                return { shouldMute: false, finalNote: note }; // Highlight only
        }
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

        // --- SCALE LOGIC INTEGRATION ---
        const action = this._getNoteAction(note, key.whiteKeyIndex);
        if (action.shouldMute) return;
        const finalNote = action.finalNote;
        // --- END SCALE LOGIC ---

        key.isPressed = true;
        let velocity = this.settings.volume;

        // This block calculates velocity based on the vertical press position.
        if (this.settings.velocityByPos && relativeY !== null) {
            let ratio = 0;
            if (key.isBlack) {
                // For black keys, the velocity maps to the full height of the key.
                ratio = Math.max(0, Math.min(1, relativeY / key.height));
            } else {
                // For white keys, the velocity-sensitive area starts below the black keys.
                const whiteKeyVelocityTopY = key.height * this.BLACK_KEY_HEIGHT_RATIO;
                if (relativeY > whiteKeyVelocityTopY) {
                    const sensitiveAreaHeight = key.height - whiteKeyVelocityTopY;
                    const positionInArea = relativeY - whiteKeyVelocityTopY;
                    ratio = Math.max(0, Math.min(1, positionInArea / sensitiveAreaHeight));
                } else {
                    // If pressed above this line, velocity is at its minimum.
                    ratio = 0;
                }
            }
            // Convert the 0-1 ratio to a 0-127 MIDI velocity value.
            velocity = Math.round(ratio * 127);
        }
        
        // Clamp the final velocity between the min and max settings.
        velocity = Math.max(this.settings.minVelocity, Math.min(this.settings.maxVelocity, velocity));
        
        this.midiCallback([0x90, finalNote, velocity], "internal");
    }

    /**
     * Triggers a 'note off' event for a specific key.
     * @param {number} note - The MIDI note number.
     */
    releaseKey(note) {
        const key = this.keys.find(k => k.note === note);
        if (key && key.isPressed) {
            // --- SCALE LOGIC INTEGRATION ---
            const action = this._getNoteAction(note, key.whiteKeyIndex);
            if (action.shouldMute) return;
            const finalNote = action.finalNote;
            // --- END SCALE LOGIC ---
            key.isPressed = false;
            this.midiCallback([0x80, finalNote, 0], "internal");
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

        // 1. Calculate a base width to determine the proportional height, as before.
        const baseWhiteKeyWidth = Math.min(availableHeight / this.WHITE_KEY_ASPECT_RATIO, this.MAX_WHITE_KEY_WIDTH);

        // 2. Set the key height based on the original proportions. This now remains constant.
        this.keyHeight = baseWhiteKeyWidth * this.WHITE_KEY_ASPECT_RATIO;

        // 3. Calculate the final, modified width by applying the percentage from settings.
        const finalWhiteKeyWidth = baseWhiteKeyWidth * (this.settings.keyWidthPercentage / 100.0);
        const blackKeyWidth = finalWhiteKeyWidth * this.BLACK_KEY_WIDTH_RATIO;
        const blackKeyHeight = this.keyHeight * this.BLACK_KEY_HEIGHT_RATIO;

        // 4. Position all keys using the final width but the constant height.
        this.keys.forEach(key => {
            if (!key.isBlack) {
                key.width = finalWhiteKeyWidth;
                key.height = this.keyHeight;
                key.x = key.whiteKeyIndex * finalWhiteKeyWidth;
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

        const map = this.scaleNoteMap[key.note];
        const isScaleNote = map && map.isScaleNote && this.settings.scaleSettings.action !== 'None';
        const isWhiteKeysMode = this.settings.scaleSettings.action === 'White Keys';

        if (key.isPressed) {
            this.ctx.fillStyle = '#a0c4ff'; // Pressed color
        } else if (isScaleNote || isWhiteKeysMode) {
            this.ctx.fillStyle = '#c8e6c9'; // Solid light green for scale notes
        } else {
            this.ctx.fillStyle = '#ffffff'; // Default white
        }

        this.ctx.fill();
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawBlackKey(key) {
        this.ctx.save();
        const cornerRadius = Math.min(5, key.width / 4, key.height / 8);
        this.ctx.beginPath();
        this.ctx.roundRect(key.x, key.y, key.width, key.height, [0, 0, cornerRadius, cornerRadius]);

        const map = this.scaleNoteMap[key.note];
        const isScaleNote = map && map.isScaleNote && this.settings.scaleSettings.action !== 'None';

        if (key.isPressed) {
            this.ctx.fillStyle = '#7b1fa2'; // Pressed color
        } else if (isScaleNote) {
            this.ctx.fillStyle = '#4caf50'; // Solid dark green for scale notes
        } else {
            this.ctx.fillStyle = '#4a4a4a'; // Default black
        }

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
            // Create a comprehensive object to save all relevant state
            const settingsToSave = {
                settings: this.settings,
                drumMachineState: { // Only save serializable parts of the drum machine state
                    pattern: this.drumMachineState.pattern,
                    volumes: this.drumMachineState.volumes,
                    swing: this.drumMachineState.swing,
                }
            };
            localStorage.setItem(`piano-settings-${this.canvasId}`, JSON.stringify(settingsToSave));
        } catch (e) { 
            console.error("Could not save settings.", e); 
        }
        this.onSettingsChange(this.settings);
    }

    loadSettings() {
        try {
            const savedStateJSON = localStorage.getItem(`piano-settings-${this.canvasId}`);
            if (savedStateJSON) {
                const parsedState = JSON.parse(savedStateJSON);
                
                // Merge settings, prioritizing saved values over defaults
                this.settings = { ...this.settings, ...parsedState.settings };
                
                // Merge drum machine state carefully
                if (parsedState.drumMachineState) {
                    this.drumMachineState.swing = parsedState.drumMachineState.swing || 0;
                    Object.assign(this.drumMachineState.volumes, parsedState.drumMachineState.volumes);
                    Object.assign(this.drumMachineState.pattern, parsedState.drumMachineState.pattern);
                }
                
                this.updateControlsFromSettings(); // Apply loaded settings to the UI
                this._updateScaleMap();          // Recalculate scale map after loading
            }
        } catch (e) { 
            console.error("Could not load settings.", e); 
        }
    }

    updateControlsFromSettings() {
        const allTabs = this.drawer.tabs;
        
        // Update simple controls in 'Volume' and 'Keys' tabs
        [...allTabs['Volume'], ...allTabs['Keys']].forEach(control => {
            if (this.settings.hasOwnProperty(control.id)) {
                const value = this.settings[control.id];
                if (control instanceof PopupSliderControl) {
                    control.slider.value = value;
                } else {
                    control.value = value;
                }
            }
        });

        // Update scale controls
        allTabs['Scales'].forEach(control => {
            const settingKey = control.id.replace('scale', '').toLowerCase(); // e.g., 'root', 'type', 'action'
            if (this.settings.scaleSettings.hasOwnProperty(settingKey)) {
                control.selectedValue = this.settings.scaleSettings[settingKey];
            }
        });

        // Update drum machine controls
        allTabs['Drum Machine'].forEach(row => {
            row.controls.forEach(control => {
                if (!control.id) return; // Skip if control has no ID
                if (control.id.startsWith('dm_vol_')) {
                    const noteNum = control.id.split('_')[2];
                    control.slider.value = this.drumMachineState.volumes[noteNum];
                } else if (control.id.startsWith('dm_pattern_')) {
                    const noteNum = control.id.split('_')[2];
                    control.value = this.drumMachineState.pattern[noteNum];
                } else if (control.id === 'dm_swing') {
                    control.value = this.drumMachineState.swing;
                }
            });
        });
    }

}
