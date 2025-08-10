/**
 * PianoRoll Component
 * This class renders a piano roll interface on a canvas, allowing for the
 * visualization and editing of MIDI notes. It includes its own simple synthesizer
 * for audio playback and integrates with the Drawer.js component for its settings UI.
 */
class PianoRoll {
    /**
     * @param {object} config - The configuration object for the piano roll.
     * @param {HTMLCanvasElement} config.canvas - The canvas element to render on.
     */
    constructor(config) {
        this.canvas = config.canvas;
        this.ctx = this.canvas.getContext('2d');

        // --- Audio Synthesis ---
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.activeVoices = new Map();

        // --- State ---
        this.notes = [];
        this.scrollX = 0;
        this.scrollY = 0;
        this.zoomX = 1.0;
        this.zoomY = 1.0;
        this.activeTouches = new Map();
        
        // --- Settings ---
        this.settings = {
            bpm: 120,
            noteSize: 480, // PPQN for a quarter note
            mode: 'pan',
            currentChannel: 0,
            playOnClick: true,
        };

        // --- Constants ---
        this.LOWEST_NOTE = 0;
        this.HIGHEST_NOTE = 127;
        this.TOTAL_NOTES = this.HIGHEST_NOTE - this.LOWEST_NOTE + 1;
        this.HEADER_WIDTH = 60;
        this.ROW_HEIGHT = 20;
        this.PPQN = 480; // Pulses Per Quarter Note

        // --- Component Initialization ---
        this.eventBroker = new EventBroker(this.drawer);
        this.drawer = new Drawer({
            ctx: this.ctx,
            tabs: this.initTabs(),
            onStateChange: this.onStateChangeHandler.bind(this),
            eventBroker: this.eventBroker,
            handleHeight: 20,
            tabHeight: 30,
        });
        this.eventBroker.drawer = this.drawer;

        this.initEventListeners();
        this.resizeCanvas();
        this.animationLoop();
    }

    /**
     * Initializes the tab structure for the settings drawer.
     * @returns {object} The configuration for tabs and their controls.
     */
    initTabs() {
        const onStateChange = (control) => this.onStateChangeHandler(control);
        const sizeOptions = [
            { text: '𝅘𝅥𝅰 (1/32)', value: this.PPQN / 8 }, { text: '𝅘𝅥𝅯 (1/16)', value: this.PPQN / 4 },
            { text: '♪ (1/8)', value: this.PPQN / 2 }, { text: '♩ (1/4)', value: this.PPQN },
            { text: '♩. (1/4d)', value: this.PPQN * 1.5 }, { text: '𝅗𝅥 (1/2)', value: this.PPQN * 2 },
            { text: '𝅝 (1)', value: this.PPQN * 4 },
        ];
        const channelOptions = Array.from({length: 16}, (_, i) => ({ text: `Ch ${i + 1}`, value: i }));

        return {
            'Edit': [
                new ButtonControl({ ctx: this.ctx, id: 'modeAdd', label: 'Add', isActive: () => this.settings.mode === 'add', onClick: () => this.settings.mode = 'add', onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'modeSelect', label: 'Select', isActive: () => this.settings.mode === 'select', onClick: () => this.settings.mode = 'select', onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'modePan', label: 'Pan', isActive: () => this.settings.mode === 'pan', onClick: () => this.settings.mode = 'pan', onStateChange }),
                new DropdownControl({ ctx: this.ctx, id: 'currentChannel', label: 'Channel', options: channelOptions, initialValue: this.settings.currentChannel, onSelect: (val) => this.settings.currentChannel = val, onStateChange }),
                new DropdownControl({ ctx: this.ctx, id: 'noteSize', label: 'Size', options: sizeOptions, width: 100, showLabel: false, initialValue: this.settings.noteSize, onSelect: (val) => this.settings.noteSize = val, onStateChange }),
            ],
            'Playback': [
                 new PopupSliderControl({ ctx: this.ctx, id: 'bpm', label: `Tempo`, min: 40, max: 240, height: 120, initialValue: this.settings.bpm, width: 100, onStateChange }),
                 new ToggleSwitch({ ctx: this.ctx, id: 'playOnClick', label: 'Play Notes on Click', initialValue: this.settings.playOnClick, onStateChange }),
            ]
        };
    }

    /**
     * Handles state changes from drawer controls.
     * @param {object} control - The control that changed.
     */
    onStateChangeHandler(control) {
        if (control && control.id && this.settings.hasOwnProperty(control.id)) {
            this.settings[control.id] = control.value;
        }
    }

    /**
     * Sets up event listeners for the component.
     */
    initEventListeners() {
        new ResizeObserver(() => this.resizeCanvas()).observe(this.canvas);
        // Event listeners will be added here to handle pointer interactions
        // for panning, zooming, and note editing.
    }
    
    /**
     * Handles incoming MIDI messages to play notes.
     * @param {Uint8Array} message - The MIDI message data.
     */
    handleMidiMessage(message) {
        const command = message[0] & 0xF0;
        const note = message[1];
        const velocity = (message.length > 2) ? message[2] : 0;

        if (command === 0x90 && velocity > 0) {
            this.playNote(note, velocity);
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            this.stopNote(note);
        }
    }

    /**
     * Starts playing a note using the Web Audio API.
     * @param {number} midiNote - The MIDI note number.
     * @param {number} velocity - The note velocity (0-127).
     */
    playNote(midiNote, velocity) {
        if (this.activeVoices.has(midiNote)) {
            this.stopNote(midiNote, this.audioContext.currentTime);
        }

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.type = 'sawtooth'; // Simple sawtooth wave
        osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);

        const gain = (velocity / 127) * 0.5; // Map velocity to gain
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(gain, this.audioContext.currentTime + 0.02); // Quick attack

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        osc.start(this.audioContext.currentTime);

        this.activeVoices.set(midiNote, { osc, gainNode });
    }

    /**
     * Stops a currently playing note.
     * @param {number} midiNote - The MIDI note number.
     * @param {number} [time] - The audio context time to schedule the stop.
     */
    stopNote(midiNote, time = this.audioContext.currentTime) {
        const voice = this.activeVoices.get(midiNote);
        if (voice) {
            voice.gainNode.gain.cancelScheduledValues(time);
            voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, time);
            voice.gainNode.gain.linearRampToValueAtTime(0, time + 0.1); // Short release
            voice.osc.stop(time + 0.1);
            this.activeVoices.delete(midiNote);
        }
    }

    /**
     * Resizes the canvas to fit its container.
     */
    resizeCanvas() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.drawer.updateHeight(false);
    }

    /**
     * The main animation loop.
     */
    animationLoop() {
        this.draw();
        requestAnimationFrame(this.animationLoop.bind(this));
    }

    /**
     * The main drawing function.
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const drawerHeight = this.drawer.getHeight();

        this.drawGrid(drawerHeight);
        this.drawHeader();
        
        this.drawer.draw();
        const overlayControl = this.eventBroker.getOverlayControl();
        if (overlayControl) {
            this.drawer.drawOverlay(overlayControl);
        }
    }

    /**
     * Draws the piano roll grid.
     * @param {number} startY - The Y-coordinate to start drawing from.
     */
    drawGrid(startY) {
        this.ctx.save();
        this.ctx.fillStyle = "#333";
        this.ctx.fillRect(0, startY, this.canvas.width, this.canvas.height - startY);

        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;

        // Draw horizontal lines for each note
        for (let i = 0; i <= this.TOTAL_NOTES; i++) {
            const y = startY + i * this.ROW_HEIGHT * this.zoomY - this.scrollY;
            if (y > startY && y < this.canvas.height) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.HEADER_WIDTH, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
        }
        this.ctx.restore();
    }

    /**
     * Draws the piano key header on the left side.
     */
    drawHeader() {
        const drawerHeight = this.drawer.getHeight();
        this.ctx.save();
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, drawerHeight, this.HEADER_WIDTH, this.canvas.height - drawerHeight);
        
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'center';
        
        for (let i = 0; i <= this.TOTAL_NOTES; i++) {
            const note = this.HIGHEST_NOTE - i;
            const y = drawerHeight + (i * this.ROW_HEIGHT * this.zoomY) + (this.ROW_HEIGHT * this.zoomY / 2) - this.scrollY;

            if (y > drawerHeight && y < this.canvas.height) {
                const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
                this.ctx.fillStyle = isBlack ? '#666' : '#ccc';
                this.ctx.fillRect(0, y - (this.ROW_HEIGHT * this.zoomY / 2), this.HEADER_WIDTH, this.ROW_HEIGHT * this.zoomY);
                
                this.ctx.fillStyle = isBlack ? '#fff' : '#000';
                const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const octave = Math.floor(note / 12) - 1;
                const name = noteNames[note % 12] + octave;
                this.ctx.fillText(name, this.HEADER_WIDTH / 2, y + 3);
            }
        }
        this.ctx.restore();
    }
}
