/**
 * PianoRoll Component
 * This class renders a piano roll interface on a canvas, allowing for the
 * visualization and editing of MIDI notes. It now uses WebAudioTinySynth for playback
 * and integrates with the Drawer.js component for its settings UI.
 */
class PianoRoll {
    constructor(config) {
        this.canvas = config.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.synth = config.synth; // The WebAudioTinySynth instance
        this.MAX_HISTORY = 25;

        // --- Configuration & Constants ---
        this.config = {
            noteHeight: 16,
            beatWidth: 64,
            totalBeats: 128,
            totalPitches: 128,
            keysWidth: 80,
            scrollbarSize: 14,
            resizeHandleWidth: 10,
            timelineHeight: 30,
        };
        this.CHANNEL_COLORS = [
            '#E57373', '#F06292', '#BA68C8', '#9575CD', '#7986CB', '#64B5F6',
            '#4FC3F7', '#4DD0E1', '#4DB6AC', '#81C784', '#AED581', '#DCE775',
            '#FFF176', '#FFD54F', '#FFB74D', '#FF8A65'
        ];

        // --- State ---
        this.state = {
            notes: [],
            ppqn: 96,
            bpm: 120,
            noteSize: 96,
            selectedNotes: [],
            mode: 'add',
            currentChannel: 0,
            playOnClick: true,
            scrollX: 0,
            scrollY: 0,
            songDurationTicks: 0,
            isPlaying: false,
            playheadTick: 0,
            lastFrameTime: 0,
            lookaheadEvents: [],
            isDragging: false,
            wasAddingNote: false,
            isResizing: false,
            isMarqueeSelecting: false,
            isPanning: false,
            isDraggingPlayhead: false,
            isDraggingVScroll: false,
            isDraggingHScroll: false,
            potentialDeselect: false,
            dragOffsets: [],
            resizeStartTicks: 0,
            marquee: { x1: 0, y1: 0, x2: 0, y2: 0 },
            lastMousePos: { x: 0, y: 0 },
            undoHistory: [],
            redoHistory: [],
        };

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

        this._boundOnInteractionMove = this._onInteractionMove.bind(this);
        this._boundOnInteractionEnd = this._onInteractionEnd.bind(this);

        this.initEventListeners();
        this.resizeCanvas();
        this.animationLoop();
    }

    // --- PUBLIC API ---
    loadFromJson(messages, ppqn = 96) {
        this.state.ppqn = ppqn;
        this.state.notes = this._messagesToNotes(messages);
        this._recalculateSongDuration();
        this.draw();
    }
    getNotesAsJson() { return this._notesToMessages(this.state.notes); }
    togglePlayback() {
        this.state.isPlaying = !this.state.isPlaying;
        if (this.state.isPlaying) {
            this.state.lastFrameTime = performance.now();
            this._buildLookaheadEvents();
            requestAnimationFrame(this._playbackLoop.bind(this));
        }
    }
    stop() {
        this.state.isPlaying = false;
        this.state.playheadTick = 0;
        for (let i = 0; i < 16; i++) {
            this.synth.allSoundOff(i);
        }
    }
    undo() {
        if (this.state.undoHistory.length === 0) return;
        this.state.redoHistory.push(JSON.parse(JSON.stringify(this.state.notes)));
        this.state.notes = this.state.undoHistory.pop();
        this.state.selectedNotes = [];
        this._recalculateSongDuration();
    }
    redo() {
        if (this.state.redoHistory.length === 0) return;
        this.state.undoHistory.push(JSON.parse(JSON.stringify(this.state.notes)));
        this.state.notes = this.state.redoHistory.pop();
        this.state.selectedNotes = [];
        this._recalculateSongDuration();
    }

    // --- INITIALIZATION & SETUP ---
    initTabs() {
        const onStateChange = (control) => this.onStateChangeHandler(control);
        const ppqn = this.state.ppqn;
        const sizeOptions = [
            { text: '𝅘𝅥𝅰 (1/32)', value: ppqn / 8 }, { text: '𝅘𝅥𝅯 (1/16)', value: ppqn / 4 },
            { text: '♪ (1/8)', value: ppqn / 2 }, { text: '♩ (1/4)', value: ppqn },
            { text: '♩. (1/4d)', value: ppqn * 1.5 }, { text: '𝅗𝅥 (1/2)', value: ppqn * 2 },
            { text: '𝅝 (1)', value: ppqn * 4 },
        ];
        const channelOptions = Array.from({length: 16}, (_, i) => ({ text: `Ch ${i + 1}`, value: i }));

        return {
            'Edit': [
                new ButtonControl({ ctx: this.ctx, id: 'modeAdd', label: 'Add', isActive: () => this.state.mode === 'add', onClick: () => this.state.mode = 'add', onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'modeSelect', label: 'Select', isActive: () => this.state.mode === 'select', onClick: () => this.state.mode = 'select', onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'modePan', label: 'Pan', isActive: () => this.state.mode === 'pan', onClick: () => this.state.mode = 'pan', onStateChange }),
                new DropdownControl({ ctx: this.ctx, id: 'currentChannel', label: 'Channel', options: channelOptions, initialValue: this.state.currentChannel, onSelect: (val) => this.state.currentChannel = val, onStateChange }),
                new DropdownControl({ ctx: this.ctx, id: 'noteSize', label: 'Size', options: sizeOptions, width: 100, showLabel: false, initialValue: this.state.noteSize, onSelect: (val) => this.state.noteSize = val, onStateChange }),
            ],
            'Playback': [
                 new ButtonControl({ ctx: this.ctx, id: 'play', label: 'Play', isActive: () => this.state.isPlaying, onClick: () => this.togglePlayback(), onStateChange }),
                 new ButtonControl({ ctx: this.ctx, id: 'stop', label: 'Stop', onClick: () => this.stop(), onStateChange }),
                 new PopupSliderControl({ ctx: this.ctx, id: 'bpm', label: `Tempo`, min: 40, max: 240, height: 120, initialValue: this.state.bpm, width: 100, onStateChange }),
                 new ToggleSwitch({ ctx: this.ctx, id: 'playOnClick', label: 'Play Notes on Click', initialValue: this.state.playOnClick, onStateChange }),
            ],
            'File': [
                new ButtonControl({ ctx: this.ctx, label: 'Undo', onClick: () => this.undo(), onStateChange, autoSize: true }),
                new ButtonControl({ ctx: this.ctx, label: 'Redo', onClick: () => this.redo(), onStateChange, autoSize: true }),
            ]
        };
    }

    onStateChangeHandler(control) {
        if (control && control.id && this.state.hasOwnProperty(control.id)) {
            this.state[control.id] = control.value;
        } else if (control && (control.id === 'modeAdd' || control.id === 'modeSelect' || control.id === 'modePan')) {
            // This handles the mode change from the button's onClick
        }
    }

    initEventListeners() {
        new ResizeObserver(() => this.resizeCanvas()).observe(this.canvas);
        this.canvas.addEventListener('pointerdown', this._onInteractionStart.bind(this));
        this.canvas.addEventListener('mousemove', this._onHoverMove.bind(this));
        this.canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.drawer.updateHeight(false);
    }

    // --- EVENT HANDLING ---
    _onInteractionStart(e) {
        e.preventDefault();
        const event = { type: 'pointerdown', ...this._getMousePos(e), id: e.pointerId ?? 'mouse' };

        if (this.eventBroker.capturedControl || this.drawer.isPointInBounds(event.x, event.y)) {
            this.drawer.handleEvent(event);
            return;
        }
        
        window.addEventListener('pointermove', this._boundOnInteractionMove);
        window.addEventListener('pointerup', this._boundOnInteractionEnd);

        const pos = {x: event.x, y: event.y};
        const isTimelineClick = pos.y < this.config.timelineHeight && pos.x > this.config.keysWidth;
        if (isTimelineClick) {
            this.state.isDraggingPlayhead = true;
            this._handlePlayheadDrag(pos);
            return;
        }

        if (this.state.mode === 'pan') {
            this.state.isPanning = true;
            this.state.lastMousePos = pos;
            return;
        }

        if (this._handleScrollbarMouseDown(pos)) return;

        const isGridClick = pos.x > this.config.keysWidth && pos.x < this.canvas.width - this.config.scrollbarSize;
        if (isGridClick) {
            const note = this._getNoteAt(pos.x, pos.y);
            const isResizeHandle = this._getCursorStyle(pos) === 'ew-resize';
            
            if (isResizeHandle && note) this._handleResizeMouseDown(note, pos);
            else if (note) this._handleNoteMouseDown(e, note, pos);
            else this._handleGridMouseDown(e, pos);
        }
    }

    _onInteractionMove(e) {
        e.preventDefault();
        const pos = this._getMousePos(e);

        if (this.state.wasAddingNote) {
            this.state.isResizing = true;
            this.state.wasAddingNote = false;
            const note = this.state.selectedNotes[0];
            if (note) {
                this.state.resizeStartTicks = note.start_tick;
                note.originalDuration = note.duration_ticks;
            }
        }

        if (this.state.isDraggingPlayhead) this._handlePlayheadDrag(pos);
        else if (this.state.isPanning) this._handlePan(pos);
        else if (this.state.isDraggingVScroll || this.state.isDraggingHScroll) this._handleScrollbarMouseMove(pos);
        else if (this.state.isDragging) this._handleNoteDrag(pos);
        else if (this.state.isResizing) this._handleNoteResize(pos);
        else if (this.state.isMarqueeSelecting) this._handleMarqueeSelect(pos);
        
        this.state.lastMousePos = pos;
    }

    _onInteractionEnd(e) {
        if (this.state.potentialDeselect) this.state.selectedNotes = [];
        if (this.state.isDragging || this.state.isResizing || this.state.wasAddingNote) {
            this._recalculateSongDuration();
        }
        if (this.state.isMarqueeSelecting) this._selectNotesInMarquee();
        
        this.state.isDraggingPlayhead = false;
        this.state.isDragging = false;
        this.state.wasAddingNote = false;
        this.state.isResizing = false;
        this.state.isMarqueeSelecting = false;
        this.state.isDraggingVScroll = false;
        this.state.isDraggingHScroll = false;
        this.state.isPanning = false;
        this.state.potentialDeselect = false;
        
        window.removeEventListener('pointermove', this._boundOnInteractionMove);
        window.removeEventListener('pointerup', this._boundOnInteractionEnd);
    }

    _onHoverMove(e) {
        const isInteracting = this.state.isPanning || this.state.isDragging || this.state.isResizing || this.state.isMarqueeSelecting || this.state.isDraggingPlayhead;
        if (isInteracting || this.drawer.activeInteraction) return;
        const pos = this._getMousePos(e);
        this.canvas.style.cursor = this._getCursorStyle(pos);
    }

    _onWheel(e) {
        e.preventDefault();
        const event = { type: 'wheel', deltaY: e.deltaY, ...this._getMousePos(e) };
        if (this.drawer.isPointInBounds(event.x, event.y)) {
            this.drawer.handleEvent(event);
        } else {
            this.state.scrollX += e.deltaX;
            this.state.scrollY += e.deltaY;
            this._clampScroll();
        }
    }

    // --- MOUSE INTERACTION LOGIC ---
    _handleNoteMouseDown(e, note, pos) {
        this._saveStateForUndo();
        const s = this.state;
        if (s.playOnClick) this.playNote(note.pitch, note.velocity, note.channel);
        
        const isSelected = s.selectedNotes.includes(note);
        if (e.shiftKey) {
            if (isSelected) s.selectedNotes = s.selectedNotes.filter(n => n !== note);
            else s.selectedNotes.push(note);
        } else if (isSelected) {
            s.potentialDeselect = true;
        } else {
            s.selectedNotes = [note];
        }
        s.isDragging = true;
        s.dragOffsets = s.selectedNotes.map(n => ({
            note: n,
            pixelOffsetX: this._getGridPos(pos).x - this._tickToPixel(n.start_tick),
            pixelOffsetY: this._getGridPos(pos).y - this._pitchToPixel(n.pitch)
        }));
    }

    _handleGridMouseDown(e, pos) {
        const s = this.state;
        s.selectedNotes = [];
        if (s.mode === 'add') {
            this._saveStateForUndo();
            const gridPos = this._pixelToGrid(this._getGridPos(pos));
            const newNote = {
                pitch: gridPos.pitch,
                start_tick: gridPos.tick,
                duration_ticks: s.noteSize,
                velocity: 100,
                channel: s.currentChannel
            };
            s.notes.push(newNote);
            s.selectedNotes = [newNote];
            s.wasAddingNote = true;
            if (s.playOnClick) this.playNote(newNote.pitch, newNote.velocity, newNote.channel);
        } else if (s.mode === 'select') {
            s.isMarqueeSelecting = true;
            s.marquee = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
        }
    }

    _handleNoteDrag(pos) {
        this.state.dragOffsets.forEach(offset => {
            const newGridPixelX = this._getGridPos(pos).x - offset.pixelOffsetX;
            const newGridPixelY = this._getGridPos(pos).y - offset.pixelOffsetY;
            const newPos = this._pixelToGrid({ x: newGridPixelX, y: newGridPixelY });
            offset.note.start_tick = newPos.tick;
            offset.note.pitch = newPos.pitch;
        });
    }

    _handleResizeMouseDown(note, pos) {
        this._saveStateForUndo();
        const s = this.state;
        s.isResizing = true;
        if (!s.selectedNotes.includes(note)) s.selectedNotes = [note];
        s.resizeStartTicks = this._pixelToGrid(this._getGridPos(pos)).tick;
        s.selectedNotes.forEach(n => { n.originalDuration = n.duration_ticks; });
    }

    _handleNoteResize(pos) {
        const s = this.state;
        const currentTick = this._pixelToGrid(this._getGridPos(pos)).tick;
        const deltaTicks = currentTick - s.resizeStartTicks;
        s.selectedNotes.forEach(n => {
            const newDuration = n.originalDuration + deltaTicks;
            n.duration_ticks = Math.max(s.ppqn / 16, newDuration);
        });
    }

    _handleMarqueeSelect(pos) {
        this.state.marquee.x2 = pos.x;
        this.state.marquee.y2 = pos.y;
    }

    _handleScrollbarMouseDown(pos) {
        const c = this.config, s = this.state;
        if (pos.x > this.canvas.width - c.scrollbarSize && pos.y > c.timelineHeight) {
            s.isDraggingVScroll = true; return true;
        }
        if (pos.y > this.canvas.height - c.scrollbarSize && pos.x > c.keysWidth) {
            s.isDraggingHScroll = true; return true;
        }
        return false;
    }

    _handleScrollbarMouseMove(pos) {
        const c = this.config, s = this.state;
        const contentWidth = c.beatWidth * c.totalBeats;
        const contentHeight = c.noteHeight * c.totalPitches;
        const viewWidth = this.canvas.width - c.keysWidth - c.scrollbarSize;
        const viewHeight = this.canvas.height - c.timelineHeight - c.scrollbarSize - this.drawer.getHeight();
        if (s.isDraggingVScroll) {
            const dy = pos.y - s.lastMousePos.y;
            s.scrollY += dy * (contentHeight / viewHeight);
        }
        if (s.isDraggingHScroll) {
            const dx = pos.x - s.lastMousePos.x;
            s.scrollX += dx * (contentWidth / viewWidth);
        }
        this._clampScroll();
    }

    _handlePan(pos) {
        const dx = pos.x - this.state.lastMousePos.x;
        const dy = pos.y - this.state.lastMousePos.y;
        this.state.scrollX -= dx;
        this.state.scrollY -= dy;
        this._clampScroll();
    }

    _handlePlayheadDrag(pos) {
        const gridX = pos.x - this.config.keysWidth + this.state.scrollX;
        const tick = (gridX / this.config.beatWidth) * this.state.ppqn;
        this.state.playheadTick = Math.max(0, tick);
        if (this.state.isPlaying) this._buildLookaheadEvents();
    }

    // --- AUDIO & MIDI ---
    handleMidiMessage(message) {
        const command = message[0] & 0xF0;
        const channel = message[0] & 0x0F;
        const note = message[1];
        const velocity = (message.length > 2) ? message[2] : 0;
        if (command === 0x90 && velocity > 0) this.playNote(note, velocity, channel);
        else if (command === 0x80 || (command === 0x90 && velocity === 0)) this.stopNote(note, channel);
    }

    playNote(midiNote, velocity, channel = 0) {
        this.synth.noteOn(channel, midiNote, velocity);
    }

    stopNote(midiNote, channel = 0) {
        this.synth.noteOff(channel, midiNote);
    }

    // --- PLAYBACK ---
    _buildLookaheadEvents() {
        const s = this.state;
        s.lookaheadEvents = [];
        s.notes.forEach(n => {
            s.lookaheadEvents.push({ type: 'noteOn', tick: n.start_tick, pitch: n.pitch, velocity: n.velocity, channel: n.channel, isPlaying: false });
            s.lookaheadEvents.push({ type: 'noteOff', tick: n.start_tick + n.duration_ticks, pitch: n.pitch, channel: n.channel });
        });
        s.lookaheadEvents.sort((a,b) => a.tick - b.tick);
    }

    _playbackLoop(timestamp) {
        if (!this.state.isPlaying) return;
        const s = this.state;
        const elapsedMs = timestamp - s.lastFrameTime;
        s.lastFrameTime = timestamp;
        const ticksPerSecond = (s.bpm / 60) * s.ppqn;
        const elapsedTicks = (elapsedMs / 1000) * ticksPerSecond;
        const newPlayheadTick = s.playheadTick + elapsedTicks;

        s.lookaheadEvents.forEach(e => {
            if (e.tick >= s.playheadTick && e.tick < newPlayheadTick) {
                if (e.type === 'noteOn') {
                    this.playNote(e.pitch, e.velocity, e.channel);
                } else {
                    this.stopNote(e.pitch, e.channel);
                }
            }
        });

        s.playheadTick = newPlayheadTick;
        if (s.playheadTick > s.songDurationTicks) this.stop();
        requestAnimationFrame(this._playbackLoop.bind(this));
    }

    // --- DRAWING ---
    animationLoop() {
        this.draw();
        requestAnimationFrame(this.animationLoop.bind(this));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const drawerHeight = this.drawer.getHeight();
        this.drawGridAndNotes(drawerHeight);
        this.drawTimeline(drawerHeight);
        this.drawHeader(drawerHeight);
        this.drawPlayheadAndMarquee(drawerHeight);
        this.drawScrollbars(drawerHeight);
        this.drawer.draw();
        const overlayControl = this.eventBroker.getOverlayControl();
        if (overlayControl) this.drawer.drawOverlay(overlayControl);
    }

    drawTimeline(startY) {
        const { ctx, config, state } = this;
        ctx.fillStyle = "#222";
        ctx.fillRect(config.keysWidth, startY, this.canvas.width - config.keysWidth, config.timelineHeight);
        ctx.save();
        ctx.translate(config.keysWidth - state.scrollX, startY);
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillStyle = "#ccc";
        for (let i = 0; i <= config.totalBeats; i++) {
            const x = i * config.beatWidth;
            const isMeasureLine = i % 4 === 0;
            ctx.strokeStyle = isMeasureLine ? "#888" : "#555";
            ctx.beginPath();
            ctx.moveTo(x, isMeasureLine ? config.timelineHeight - 15 : config.timelineHeight - 10);
            ctx.lineTo(x, config.timelineHeight);
            ctx.stroke();
            if (isMeasureLine) ctx.fillText(i / 4 + 1, x + 4, config.timelineHeight - 18);
        }
        ctx.restore();
    }

    drawHeader(startY) {
        const { ctx, config, state } = this;
        ctx.save();
        ctx.translate(0, startY + config.timelineHeight - state.scrollY);
        for (let i = 0; i < config.totalPitches; i++) {
            const y = i * config.noteHeight;
            const pitch = config.totalPitches - 1 - i;
            const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);
            ctx.fillStyle = isBlackKey ? "#333" : "#666";
            ctx.fillRect(0, y, config.keysWidth, config.noteHeight);
            ctx.strokeStyle = "#222";
            ctx.strokeRect(0, y, config.keysWidth, config.noteHeight);
            if (!isBlackKey) {
                ctx.fillStyle = "#ccc";
                ctx.font = "10px sans-serif";
                const octave = Math.floor(pitch / 12) - 1;
                const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
                ctx.fillText(`${noteNames[pitch % 12]}${octave}`, 5, y + config.noteHeight - 4);
            }
        }
        ctx.restore();
    }

    drawGridAndNotes(startY) {
        const { ctx, config, state } = this;
        ctx.save();
        ctx.beginPath();
        ctx.rect(config.keysWidth, startY + config.timelineHeight, this.canvas.width - config.keysWidth, this.canvas.height - startY - config.timelineHeight);
        ctx.clip();
        ctx.translate(config.keysWidth - state.scrollX, startY + config.timelineHeight - state.scrollY);
        for (let i = 0; i < config.totalPitches; i++) {
            const pitch = config.totalPitches - 1 - i;
            const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);
            ctx.fillStyle = isBlackKey ? "#2c2c2c" : "#333";
            ctx.fillRect(0, i * config.noteHeight, config.beatWidth * config.totalBeats, config.noteHeight);
        }
        for (let i = 0; i <= config.totalBeats; i++) {
            const x = i * config.beatWidth;
            ctx.strokeStyle = (i % 4 === 0) ? "#555" : "#444";
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, config.noteHeight * config.totalPitches); ctx.stroke();
        }
        state.notes.forEach(note => {
            const rect = this._getNoteRect(note);
            const isSelected = state.selectedNotes.includes(note);
            ctx.fillStyle = this.CHANNEL_COLORS[note.channel || 0];
            ctx.strokeStyle = isSelected ? "#FFEB3B" : "#111";
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        });
        ctx.restore();
    }

    drawPlayheadAndMarquee(startY) {
        const { ctx, config, state } = this;
        const x = config.keysWidth + this._tickToPixel(state.playheadTick) - state.scrollX;
        if (x >= config.keysWidth && x < this.canvas.width) {
            ctx.fillStyle = "#f00";
            ctx.fillRect(x, startY, 2, this.canvas.height - startY);
        }
        if (state.isMarqueeSelecting) {
            const m = state.marquee;
            const rect = { x: Math.min(m.x1, m.x2), y: Math.min(m.y1, m.y2), w: Math.abs(m.x1 - m.x2), h: Math.abs(m.y1 - m.y2) };
            ctx.strokeStyle = "#FFEB3B";
            ctx.fillStyle = 'rgba(255, 235, 59, 0.2)';
            ctx.lineWidth = 1;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        }
    }

    drawScrollbars(startY) {
        const { ctx, config, state } = this;
        const contentWidth = config.beatWidth * config.totalBeats;
        const contentHeight = config.noteHeight * config.totalPitches;
        const viewWidth = this.canvas.width - config.keysWidth;
        const viewHeight = this.canvas.height - startY - config.timelineHeight;
        
        if (contentHeight > viewHeight) {
            const trackHeight = viewHeight - config.scrollbarSize;
            const thumbHeight = Math.max(20, trackHeight * (viewHeight / contentHeight));
            const thumbY = startY + config.timelineHeight + (state.scrollY / (contentHeight - viewHeight)) * (trackHeight - thumbHeight);
            ctx.fillStyle = "#222";
            ctx.fillRect(this.canvas.width - config.scrollbarSize, startY + config.timelineHeight, config.scrollbarSize, trackHeight);
            ctx.fillStyle = "#555";
            ctx.fillRect(this.canvas.width - config.scrollbarSize, thumbY, config.scrollbarSize, thumbHeight);
        }
        if (contentWidth > viewWidth) {
            const trackWidth = viewWidth - config.scrollbarSize;
            const thumbWidth = Math.max(20, trackWidth * (viewWidth / contentWidth));
            const thumbX = config.keysWidth + (state.scrollX / (contentWidth - viewWidth)) * (trackWidth - thumbWidth);
            ctx.fillStyle = "#222";
            ctx.fillRect(config.keysWidth, this.canvas.height - config.scrollbarSize, trackWidth, config.scrollbarSize);
            ctx.fillStyle = "#555";
            ctx.fillRect(thumbX, this.canvas.height - config.scrollbarSize, thumbWidth, config.scrollbarSize);
        }
    }
    
    // --- UTILITY ---
    _getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    _getGridPos(pos) {
        return {
            x: pos.x - this.config.keysWidth + this.state.scrollX,
            y: pos.y - this.config.timelineHeight - this.drawer.getHeight() + this.state.scrollY
        };
    }
    _tickToPixel(tick) { return (tick / this.state.ppqn) * this.config.beatWidth; }
    _pitchToPixel(pitch) { return (this.config.totalPitches - 1 - pitch) * this.config.noteHeight; }
    _getNoteRect(note) {
        return { x: this._tickToPixel(note.start_tick), y: this._pitchToPixel(note.pitch), w: this._tickToPixel(note.duration_ticks), h: this.config.noteHeight };
    }
    _getNoteAt(x, y) {
        const drawerHeight = this.drawer.getHeight();
        if (y < drawerHeight + this.config.timelineHeight) return null;
        const gridPos = this._getGridPos({x, y: y - drawerHeight});
        return this.state.notes.slice().reverse().find(n => {
            const r = this._getNoteRect(n);
            return gridPos.x >= r.x && gridPos.x <= r.x + r.w && gridPos.y >= r.y && gridPos.y <= r.y + r.h;
        });
    }
    _pixelToGrid(pos) {
        const s = this.state, c = this.config;
        const q = s.ppqn / 4; // 16th note quantization
        const tick = Math.round(pos.x / this._tickToPixel(q)) * q;
        const pitch = c.totalPitches - 1 - Math.floor(pos.y / c.noteHeight);
        return { tick: Math.max(0, tick), pitch: Math.max(0, Math.min(127, pitch)) };
    }
    _getCursorStyle(pos) {
        if (this.state.mode === 'pan') return this.state.isPanning ? 'grabbing' : 'grab';
        if (pos.y < this.drawer.getHeight() + this.config.timelineHeight) return 'default';
        const note = this._getNoteAt(pos.x, pos.y);
        if(note) {
            const noteGridPos = this._getGridPos({x: pos.x, y: pos.y - this.drawer.getHeight()});
            const noteRect = this._getNoteRect(note);
            if (noteGridPos.x > noteRect.x + noteRect.w - this.config.resizeHandleWidth) return 'ew-resize';
            return 'move';
        }
        return 'cell';
    }
    _selectNotesInMarquee() {
        const s = this.state, c = this.config, dH = this.drawer.getHeight();
        const m = { x: Math.min(s.marquee.x1, s.marquee.x2), y: Math.min(s.marquee.y1, s.marquee.y2), w: Math.abs(s.marquee.x1-s.marquee.x2), h: Math.abs(s.marquee.y1-s.marquee.y2) };
        const marqueeGrid = { x: m.x - c.keysWidth + s.scrollX, y: m.y - c.timelineHeight - dH + s.scrollY, w: m.w, h: m.h };
        s.selectedNotes = s.notes.filter(note => {
            const noteRect = this._getNoteRect(note);
            return !(noteRect.x > marqueeGrid.x + marqueeGrid.w || noteRect.x + noteRect.w < marqueeGrid.x || noteRect.y > marqueeGrid.y + marqueeGrid.h || noteRect.y + noteRect.h < marqueeGrid.y);
        });
    }
    _clampScroll() {
        const s = this.state, c = this.config, dH = this.drawer.getHeight();
        const maxScrollX = Math.max(0, (c.beatWidth * c.totalBeats) - (this.canvas.width - c.keysWidth));
        const maxScrollY = Math.max(0, (c.noteHeight * c.totalPitches) - (this.canvas.height - dH - c.timelineHeight));
        s.scrollX = Math.max(0, Math.min(s.scrollX, maxScrollX));
        s.scrollY = Math.max(0, Math.min(s.scrollY, maxScrollY));
    }
    _saveStateForUndo() {
        this.state.redoHistory = [];
        this.state.undoHistory.push(JSON.parse(JSON.stringify(this.state.notes)));
        if (this.state.undoHistory.length > this.MAX_HISTORY) this.state.undoHistory.shift();
    }
    _recalculateSongDuration() {
        let lastTick = 0;
        this.state.notes.forEach(n => {
            const endTick = n.start_tick + n.duration_ticks;
            if (endTick > lastTick) lastTick = endTick;
        });
        this.state.songDurationTicks = lastTick;
        this.config.totalBeats = Math.ceil(lastTick / (this.state.ppqn * 4)) * 4 + 32;
    }
    _messagesToNotes(messages) {
        const notes = [];
        const openNotes = {};
        messages.sort((a, b) => a.time - b.time);
        messages.forEach(msg => {
            if (msg.type === 'noteOn' && msg.velocity > 0) {
                openNotes[`${msg.pitch}_${msg.channel}`] = msg;
            } else if (msg.type === 'noteOff' || (msg.type === 'noteOn' && msg.velocity === 0)) {
                const key = `${msg.pitch}_${msg.channel}`;
                if (openNotes[key]) {
                    const nOn = openNotes[key];
                    notes.push({ pitch: nOn.pitch, velocity: nOn.velocity, channel: nOn.channel, start_tick: nOn.time, duration_ticks: msg.time - nOn.time });
                    delete openNotes[key];
                }
            }
        });
        return notes;
    }
    _notesToMessages(notes) {
        const messages = [];
        notes.forEach(n => {
            messages.push({ type: 'noteOn', pitch: n.pitch, velocity: n.velocity, time: n.start_tick, channel: n.channel || 0 });
            messages.push({ type: 'noteOff', pitch: n.pitch, velocity: 0, time: n.start_tick + n.duration_ticks, channel: n.channel || 0 });
        });
        messages.sort((a, b) => {
            if (a.time < b.time) return -1;
            if (a.time > b.time) return 1;
            if (a.type === 'noteOff' && b.type === 'noteOn') return -1;
            if (a.type === 'noteOn' && b.type === 'noteOff') return 1;
            return 0;
        });
        return messages;
    }
}
