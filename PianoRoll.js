/**
 * PianoRoll Component
 * This class renders a piano roll interface on a canvas, allowing for the
 * visualization and editing of MIDI notes. It now uses WebAudioTinySynth for playback
 * and integrates with the Drawer.js component for its settings UI.
 */

class PianoRoll {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.synth = options.synth || window.synth;
        this.ctx = canvas.getContext('2d');
        this.onPlayNote = options.onPlayNote || (() => {});
        this.onStopNote = options.onStopNote || (() => {});
        this.onMidiMessage = options.onMidiMessage || (() => {});
        this.bpm = options.bpm || 120;
        this.MAX_HISTORY = 25;
        this.resizeTimer = null;

        this.config = {
            noteHeight: 16,
            beatWidth: 64,
            totalBeats: 128,
            totalPitches: 128,
            keysWidth: 100,
            scrollbarSize: 25,
            resizeHandleWidth: 15,
            timelineHeight: 30,
            keyWhiteColor: '#f0f0f0',
            keyBlackColor: '#333',
            gridBgDark: 'rgba(0,0,0,0.15)',
            gridBgLight: 'rgba(255,255,255,0.05)',
            gridLineLight: '#505355',
            gridLineDark: '#626567',
            noteStrokeColor: '#00000088',
            noteSelectedStrokeColor: '#fdd835',
            playheadColor: '#ff5252',
            scrollbarBg: '#21252b',
            scrollbarThumb: '#5c6370',
            timelineBg: '#323842',
            timelineFontColor: '#abb2bf',
            bgColor: '#282c34'
        };

        this.CHANNEL_COLORS = [
            '#E57373', '#F06292', '#BA68C8', '#9575CD', '#7986CB', '#64B5F6', 
            '#4FC3F7', '#4DD0E1', '#4DB6AC', '#81C784', '#AED581', '#DCE775', 
            '#FFF176', '#FFD54F', '#FFB74D', '#FF8A65'
        ];

        this.state = {
            notes: [],
            ppqn: 96,
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
            isDraggingVScroll: false,
            isDraggingHScroll: false,
            dragStartPos: { x: 0, y: 0 }, 
            dragStartScroll: { x: 0, y: 0 }, 
            isPanning: false,
            isDraggingPlayhead: false,
            potentialDeselect: false,
            dragOffsets: [],
            resizeStartTicks: 0,
            marquee: { x1: 0, y1: 0, x2: 0, y2: 0 },
            lastMousePos: { x: 0, y: 0 },
            undoHistory: [],
            redoHistory: [],
            soundOnAdd: null,
            playheadLastDraggedTime: 0,
            mutedChannels: new Set(),
            hiddenChannels: new Set(),
        };

        this.eventBroker = new EventBroker(); 
        this.drawer = new Drawer({
            ctx: this.ctx,
            tabs: this._initTabs(), // We will create this method next
            dialogs: this._initDialogs(),
            onStateChange: this._onDrawerStateChange.bind(this),
            eventBroker: this.eventBroker,
            handleHeight: 20,
            tabHeight: 30,
        });
        this.eventBroker.drawer = this.drawer; // Link the drawer to the broker
        this._boundOnInteractionMove = this._onInteractionMove.bind(this);
        this._boundOnInteractionEnd = this._onInteractionEnd.bind(this);

        this._init();
    }

    _initDialogs() {
        return {  }; // Only standard dialogs needed for now
    }

    _initTabs() {
        const ppqn = this.state.ppqn;
        const sizeOptions = [
            { text: '𝅘𝅥𝅰', value: ppqn / 8 }, { text: '𝅘𝅥𝅯', value: ppqn / 4 },
            { text: '♪', value: ppqn / 2 }, { text: '♩', value: ppqn },
            { text: '♩.', value: ppqn * 1.5 }, { text: '𝅗𝅥', value: ppqn * 2 },
            { text: '𝅝', value: ppqn * 4 },
        ];
        const channelOptions = Array.from({length: 16}, (_, i) => ({ text: `Ch ${i + 1}`, value: i }));
        
        const onStateChange = (control) => this._onDrawerStateChange(control);

        const trackMapper = [10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16];
        const tracks = Array.from({ length: 16 }, (_, i) => {
            const trackNumber = trackMapper[i];
            return new RowControl({
                ctx: this.ctx, id: `track${trackNumber}`, label: `Track ${trackNumber}`, controls: [
                    // Use the new ColorCircleControl
                    new ColorCircleControl({ 
                        ctx: this.ctx, 
                        id: `tracklabel${trackNumber}`, 
                        label: `${trackNumber}`, 
                        color: this.CHANNEL_COLORS[trackNumber - 1] 
                    }),
                    // Hook up the InstrumentControl
                    new InstrumentControl({ 
                        ctx: this.ctx, 
                        id: `instrument${trackNumber}`, 
                        label: 'Instrument', 
                        initialValue: trackNumber === 10 ? 128 : 0, 
                        onSelect: (val) => this._setTrackParameter(trackNumber, 'instrument', val), 
                        onStateChange 
                    }),
                    // Hook up the PopupSliderControl for volume
                    new PopupSliderControl({ 
                        ctx: this.ctx, 
                        id: `volume${trackNumber}`, 
                        label: 'Volume', 
                        min: 0, 
                        max: 127, 
                        initialValue: 100, 
                        width: 100, 
                        height: 120,
                        onStateChange: (c) => this._setTrackParameter(trackNumber, 'volume', c.slider.value)
                    }),
                    // Hook up the ToggleSwitch for mute
                    new ButtonControl({ 
                        ctx: this.ctx, 
                        id: `mute${trackNumber}`, 
                        label: 'Mute', 
                        isActive: () => this.state.mutedChannels.has(trackNumber - 1),
                        onClick: () => this.toggleMute(trackNumber - 1), 
                        onStateChange 
                    }),
                    new ButtonControl({
                        ctx: this.ctx,
                        id: `hide${trackNumber}`,
                        label: 'Hide',
                        isActive: () => this.state.hiddenChannels.has(trackNumber - 1),
                        onClick: () => this.toggleHide(trackNumber - 1),
                        onStateChange
                    }),
                    new ToggleSwitch({ ctx: this.ctx, id: `chordChange${trackNumber}`, label: 'Chord Change', onClick: () => this.toggleMute(trackNumber), onStateChange }),

                ]
            });
        });

        // return the structure for the drawer tabs
        return {
            'File': [
                new ButtonControl({ 
                    id: 'load',
                    ctx: this.ctx, 
                    autoSize: true, 
                    label: 'Load MIDI', 
                    onClick: () => this._loadMidiFile(), // This calls the method to open a file dialog
                    onStateChange 
                }),
                new ButtonControl({ 
                    id: 'save',
                    ctx: this.ctx, 
                    autoSize: true, 
                    label: 'Save MIDI', 
                    onClick: () => this._saveMidiFile(), // This calls the method to save the file
                    onStateChange 
                })
            ],
            'Edit': [
                new ButtonControl({ ctx: this.ctx, id: 'add', label: 'Add', isActive: () => this.state.mode === 'add', onClick: () => this.setMode('add'), onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'select',label: 'Select', isActive: () => this.state.mode === 'select', onClick: () => this.setMode('select'), onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'pan', label: 'Pan', isActive: () => this.state.mode === 'pan', onClick: () => this.setMode('pan'), onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'delete', label: 'Delete', onClick: () => this._deleteNotes(), onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'undo', label: '↶ Undo', isActive: () => this.state.undoHistory.length > 0, onClick: () => this.undo(), onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'redo', label: '↷ Redo', isActive: () => this.state.redoHistory.length > 0, onClick: () => this.redo(), onStateChange }),
                new DropdownControl({ ctx: this.ctx, id: 'channel', label: 'Channel', options: channelOptions, initialValue: this.state.currentChannel, onSelect: (val) => this.setCurrentChannel(val), onStateChange }),
                new DropdownControl({ ctx: this.ctx, id: 'size', label: 'Size', options: sizeOptions, width: 60, showLabel: false, initialValue: this.state.noteSize, onSelect: (val) => this.state.noteSize = val, onStateChange }),
            ],
            'Tracks': [
                ...tracks,
            ],
            'Playback': [
                new ButtonControl({ ctx: this.ctx, id: 'play', label: 'Play', isActive: () => this.state.isPlaying, onClick: () => this.state.isPlaying ? this.pause() : this.play(), onStateChange }),
                new ButtonControl({ ctx: this.ctx, id: 'stop', label: 'Stop', onClick: () => this.stop(), onStateChange }),
                new PopupSliderControl({ ctx: this.ctx, id: 'bpm', label: `Tempo`, min: 40, max: 240, height: 120, initialValue: this.bpm, width: 100, onStateChange }),
                new ToggleSwitch({ ctx: this.ctx, id: 'playOnClick', label: 'Play on Click', initialValue: this.state.playOnClick, onStateChange: (c) => this.setPlayOnClick(c.value) }),
            ]
        };
    }

    // ADD a new method to handle state changes from the drawer
    _onDrawerStateChange(control) {
        // Update BPM from the PopupSliderControl
        if (control instanceof PopupSliderControl) {
            this.bpm = control.slider.value;
        }
        // Redraw is handled by the animation loop, so this can often be empty
    }

    async _deleteNotes () { 
        if ((this?.state?.selectedNotes?.length ?? 0) === 0) {
            this.drawer.dialogs['Error'][0].controls[0].label = 'No notes selected to delete.';
            await this.drawer.openDialog('Error');
            return;
        }
        // Show a confirmation dialog before deleting notes
        this.drawer.dialogs['Confirm'][0].controls[0].label = 'Are you sure you want to delete the selected notes?';
        const confirm = await this.drawer.openDialog('Confirm');
        if (!confirm) return; // If the user cancels, do nothing
        this._saveStateForUndo(); 
        this.state.notes = this.state.notes.filter(n => !this.state.selectedNotes.includes(n)); 
        this.state.selectedNotes = []; 
        this.state.lookaheadEvents = []; 
        this._recalculateSongDuration(); 
        this.draw(); 
    };

    _saveMidiFile() {
        const arrayBuffer = this.saveToMidi();
        const blob = new Blob([arrayBuffer], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        
        // Create a new anchor element programmatically
        const a = document.createElement('a');
        a.href = url;
        a.download = 'composition.mid';
        
        // Append the element to the body, click it, and then remove it
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up by revoking the object URL
        URL.revokeObjectURL(url);
    }

    _loadMidiFile() {
        // Create an input element dynamically
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mid,.midi'; // Accept MIDI files

        // Define what happens when a file is selected
        input.onchange = (e) => {
            const file = e.target.files[0]; 
            if (file) { 
                const reader = new FileReader(); 
                reader.onload = (event) => {
                    const arrayBuffer = event.target.result;
                    
                    // Stop any current playback before loading new file
                    this.stop();

                    // Use tinysynth to parse the file
                    synth.loadMIDI(arrayBuffer);

                    if (synth.song) {
                        const { timebase, ev, tempo } = synth.song;
                        // TinySynth's timebase seems to be ppqn * 4
                        const ppqn = timebase / 4; 

                        const messages = ev.map(event => {
                            const status = event.m[0];
                            const command = status & 0xF0;
                            const channel = status & 0x0F;

                            if (command === 0x90 && event.m[2] > 0) { // Note On
                                return { type: 'noteOn', pitch: event.m[1], velocity: event.m[2], time: event.t, channel };
                            } else if (command === 0x80 || (command === 0x90 && event.m[2] === 0)) { // Note Off
                                return { type: 'noteOff', pitch: event.m[1], velocity: event.m[2], time: event.t, channel };
                            } else {
                                return { type: 'other', msg: event.m, time: event.t, channel: event.m[0] & 0x0F };
                            }
                            return null;
                        }).filter(Boolean);

                        this.loadFromJson(messages, ppqn);
                        this._updateTrackControlsFromMidi(ev);

                        let calculatedBpm = 120; // Default BPM
                        const tempoEvent = ev.find(e => e.m[0] === 0xff && e.m[1] === 0x51);
                        if (tempoEvent) {
                            // The tempo is stored in three bytes, representing microseconds per quarter note.
                            const microsecondsPerQuarterNote = (tempoEvent.m[2] << 16) | (tempoEvent.m[3] << 8) | tempoEvent.m[4];
                            
                            // Convert microseconds per quarter note to BPM.
                            calculatedBpm = 60000000 / microsecondsPerQuarterNote;

                            pianoRoll.bpm = calculatedBpm;
                        } else {
                            pianoRoll.bpm = 120; // Default BPM if no tempo event found per MIDI specs
                        }
                        // Find the tempo slider in the drawer to update it
                        const playbackTab = pianoRoll.drawer.tabs['Playback'];
                        if (playbackTab) {
                            const tempoSliderControl = playbackTab.find(c => c instanceof PopupSliderControl);
                            if (tempoSliderControl) {
                                tempoSliderControl.slider.value = Math.round(calculatedBpm);
                            }
                        }

                        this.state.undoHistory = [];
                        this.state.redoHistory = [];
                        
                    } else {
                        console.error("Failed to parse MIDI file with TinySynth.");
                        alert("Error: Could not parse MIDI file.");
                    }
                }; 
                reader.readAsArrayBuffer(file); 
            } 
            
            // Clean up the dynamically created element
            document.body.removeChild(input);
        }
        // Hide the element, add it to the DOM, trigger the click, and then it will be removed by the onchange handler
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    }

    _updateTrackControlsFromMidi(midiEvents) {
        const tracksTab = this.drawer.tabs['Tracks'];
        if (!tracksTab) return;

        // The trackMapper from _initTabs helps us find the right controls
        const trackMapper = [10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16];

        trackMapper.forEach(trackNumber => {
            const channel = trackNumber - 1;

            // Find the corresponding controls for this track
            const instrumentControl = tracksTab.flatMap(r => r.controls).find(c => c.id === `instrument${trackNumber}`);
            const volumeControl = tracksTab.flatMap(r => r.controls).find(c => c.id === `volume${trackNumber}`);

            if (!instrumentControl || !volumeControl) return;

            // --- Find First Program Change ---
            const programChangeEvent = midiEvents.find(e => {
                const status = e.m[0];
                return (status & 0xF0) === 0xC0 && (status & 0x0F) === channel;
            });

            if (programChangeEvent) {
                instrumentControl.selectedValue = programChangeEvent.m[1];
            } else {
                // Set default instrument if no program change is found
                instrumentControl.selectedValue = (channel === 9) ? 128 : 0; // Channel 10 (index 9) is Drums
            }
            // Immediately send the message to the synth to set its state
            this.onMidiMessage([0xC0 | channel, instrumentControl.selectedValue]);


            // --- Find First Channel Volume Change ---
            const volumeEvent = midiEvents.find(e => {
                const status = e.m[0];
                // CC7 is Channel Volume
                return (status & 0xF0) === 0xB0 && (status & 0x0F) === channel && e.m[1] === 7;
            });
            
            if (volumeEvent) {
                volumeControl.slider.value = volumeEvent.m[2];
            } else {
                // Set default volume if no event is found
                volumeControl.slider.value = 127;
            }
            // Immediately send the message to the synth to set its state
            this.onMidiMessage([0xB0 | channel, 7, volumeControl.slider.value]);
        });
    }    

    // --- PUBLIC API ---
    handleMidiMessage(message) {
        this.onMidiMessage(message);
    }

    loadFromJson(messages, ppqn = 96) { 
        this.state.ppqn = ppqn; 
        this.state.notes = this._messagesToNotes(messages); 
        this._recalculateSongDuration(); 
        this.draw(); 
    }
    getNotesAsJson() { return this._notesToMessages(this.state.notes); }
    
    saveToMidi() { 
        const messages = this.getNotesAsJson(); 
        const write = (messages, ppqn = 96, bpm = 120) => {
            const buffer = [
                0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 
                0x00, 0x01, (ppqn >> 8) & 0xFF, ppqn & 0xFF
            ]; 
            const track = []; 
            let lastTime = 0; 
            const writeVlq = value => { 
                const bytes = []; 
                bytes.push(value & 0x7F); 
                value >>= 7; 
                while (value > 0) { 
                    bytes.push((value & 0x7F) | 0x80); 
                    value >>= 7; 
                } 
                return bytes.reverse(); 
            }; 
            const microSecondsPerQuarterNote = Math.round(60000000 / bpm); 
            track.push(...writeVlq(0), 0xFF, 0x51, 0x03, 
                        (microSecondsPerQuarterNote >> 16) & 0xFF, 
                        (microSecondsPerQuarterNote >> 8) & 0xFF, 
                        microSecondsPerQuarterNote & 0xFF); 
            messages.forEach(msg => { 
                const deltaTime = msg.time - lastTime; 
                lastTime = msg.time; 
                track.push(...writeVlq(deltaTime)); 
                if (msg.type === 'other') {
                    track.push(...msg.msg);
                    return;
                }
                const statusByte = (msg.type === 'noteOn' ? 0x90 : 0x80) | (msg.channel || 0); 
                track.push(statusByte, msg.pitch, msg.velocity); 
            }); 
            track.push(...writeVlq(0)); 
            track.push(0xFF, 0x2F, 0x00); 
            buffer.push(0x4D, 0x54, 0x72, 0x6B); 
            const trackLength = track.length; 
            buffer.push((trackLength >> 24) & 0xFF, (trackLength >> 16) & 0xFF, 
                        (trackLength >> 8) & 0xFF, trackLength & 0xFF); 
            buffer.push(...track); 
            return new Uint8Array(buffer).buffer; 
        }
        return write(messages, this.state.ppqn, this.bpm); 
    }

    setMode(mode) { 
        this.state.mode = mode; 
        this.canvas.style.cursor = this._getCursorStyle({x:0, y:0}); 
    }
    setCurrentChannel(ch) { this.state.currentChannel = ch; }
    setPlayOnClick(enabled) { this.state.playOnClick = enabled; }
    play() { 
        if (this.state.isPlaying) return; 
        this.state.isPlaying = true; 
        this.state.lastFrameTime = performance.now(); 
        this._buildLookaheadEvents(); 
        requestAnimationFrame(this._playbackLoop.bind(this)); 
    }
    pause() { 
        this.state.isPlaying = false; 
        this.state.lookaheadEvents.forEach(e => { 
            if (e.isPlaying) this.onStopNote({ pitch: e.pitch, channel: e.channel }); 
        }); 
        this.draw(); 
    }
    stop() { this.pause(); this.state.playheadTick = 0; this.draw(); }
    resizeAndDraw() {
        // Clear any existing timer to reset the countdown
        if (this.resizeTimer) clearTimeout(this.resizeTimer);

        // Set a new timer
        this.resizeTimer = setTimeout(() => {
            this._performResize(); // Call the actual resize logic
            this.resizeTimer = null;
        }, 25); // 25ms delay is a good starting point
    }
    _performResize() {
        this._setupCanvas();
        this.drawer.updateHeight();
        this.draw();
    }

    undo() { 
        if (this.state.undoHistory.length === 0) return; 
        this.state.redoHistory.push(JSON.parse(JSON.stringify(this.state.notes))); 
        this.state.notes = this.state.undoHistory.pop(); 
        this.state.selectedNotes = []; 
        this._recalculateSongDuration(); 
        this.draw(); 
    }
    redo() { 
        if (this.state.redoHistory.length === 0) return; 
        this.state.undoHistory.push(JSON.parse(JSON.stringify(this.state.notes))); 
        this.state.notes = this.state.redoHistory.pop(); 
        this.state.selectedNotes = []; 
        this._recalculateSongDuration(); 
        this.draw(); 
    }

    // --- INITIALIZATION & SETUP ---
    _init() {
        this._setupCanvas();
        this._attachEventListeners();
        this.draw();
        this._animationLoop();
    }

    _setupCanvas() { 
        const dpr = /* window.devicePixelRatio doesn't work right || */ 1; 
        const rect = this.canvas.parentElement.getBoundingClientRect(); 
        this.canvas.width = rect.width * dpr; 
        this.canvas.height = rect.height * dpr; 
        this.ctx.scale(dpr, dpr); 
        this.canvas.style.width = `${rect.width}px`; 
        this.canvas.style.height = `${rect.height}px`; 
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

    // --- EVENT HANDLING ---
    _attachEventListeners() {
        new ResizeObserver(() => this.resizeAndDraw()).observe(this.canvas);

        const c = this.canvas;
        c.addEventListener('mousedown', this._onInteractionStart.bind(this));
        c.addEventListener('touchstart', this._onInteractionStart.bind(this), { passive: false });
        c.addEventListener('mousemove', this._onHoverMove.bind(this));
        c.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

        // ADD these persistent listeners to the window
        window.addEventListener('mousemove', this._boundOnInteractionMove);
        window.addEventListener('touchmove', this._boundOnInteractionMove, { passive: false });
        window.addEventListener('mouseup', this._boundOnInteractionEnd);
        window.addEventListener('touchend', this._boundOnInteractionEnd);
    }
    
    dispose() {
        // Remove listeners from the canvas
        this.canvas.removeEventListener('mousedown', this._onInteractionStart);
        this.canvas.removeEventListener('touchstart', this._onInteractionStart);
        // ...and so on for all canvas listeners

        // **Crucially, remove the listeners from the window**
        window.removeEventListener('mousemove', this._boundOnInteractionMove);
        window.removeEventListener('touchmove', this._boundOnInteractionMove);
        window.removeEventListener('mouseup', this._boundOnInteractionEnd);
        window.removeEventListener('touchend', this._boundOnInteractionEnd);

        // Also, cancel any running animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    _onInteractionStart(e) {
        const rawPos = this._getMousePos(e);
        const event = { type: 'pointerdown', ...rawPos };

        // Send drawer events to the drawer first
        if (this.eventBroker.capturedControl || this.drawer.isPointInBounds(event.x, event.y)) {
            this.drawer.handleEvent(event);
            return; 
        }

        // If it's not a drawer event, create an adjusted position for the piano roll
        const pos = {
            x: rawPos.x,
            y: rawPos.y - this.drawer.getHeight()
        };

        if (e.type === 'mousedown' && e.button !== 0) return;
        e.preventDefault();

        // The rest of the function now uses the correctly adjusted 'pos' object
        const isTimelineClick = pos.y < this.config.timelineHeight && 
                                pos.x > this.config.keysWidth;
        const canDragPlayhead = this.state.mode === 'add' || this.state.mode === 'select';

        if (isTimelineClick && canDragPlayhead) {
            this.state.isDraggingPlayhead = true;
            this._handlePlayheadDrag(pos);
            return;
        }

        if (this._handleScrollbarMouseDown(pos)) return;

        if (this.state.mode === 'pan') {
            this.state.isPanning = true;
            this.state.lastMousePos = pos;
            this.canvas.style.cursor = this._getCursorStyle(rawPos); // Cursor style uses raw position
            return;
        }

        const isGridClick = pos.x > this.config.keysWidth &&
                            pos.x < this.canvas.clientWidth - this.config.scrollbarSize;
        if (isGridClick) {
            // First, find the note at the adjusted position
            const note = this._getNoteAt(pos.x, pos.y);

            // Now, determine the cursor style at that exact position to see if it's a resize handle
            const cursorStyle = this._getCursorStyle(pos);

            if (note && cursorStyle === 'ew-resize') {
                // It's a resize action
                this._handleResizeMouseDown(note, pos);
            } else if (note) {
                // It's a drag action on an existing note
                this._handleNoteMouseDown(e, note, pos);
            } else {
                // No note was clicked, so it's a grid action (add or marquee select)
                this._handleGridMouseDown(e, pos);
            }
        }
        // The draw call is handled by the animation loop
    }
    
    _onInteractionMove(e) {
        const rawPos = this._getMousePos(e);
        const event = { type: 'pointermove', ...rawPos };

        // Prioritize drawer and captured control events
        if (this.eventBroker.capturedControl || this.drawer.activeInteraction) {
            e.preventDefault();
            this.drawer.handleEvent(event);
            return;
        }

        // Adjust position for piano roll logic
        const pos = {
            x: rawPos.x,
            y: rawPos.y - this.drawer.getHeight()
        };

        if (e.type === 'mousemove' && e.buttons === 0) {
            this._onInteractionEnd(e);
            return;
        }

        e.preventDefault();
        this.state.potentialDeselect = false;

        // ... (The rest of the method for handling wasAddingNote, dragging, resizing, etc., remains the same)
        // Just ensure all helper calls use the adjusted 'pos' object.

        if (this.state.isDraggingPlayhead) { this._handlePlayheadDrag(pos); }
        else if (this.state.isPanning) { this._handlePan(pos); }
        else if (this.state.isDraggingVScroll || this.state.isDraggingHScroll) { 
            this._handleScrollbarMouseMove(pos); 
        } 
        else if (this.state.isDragging) { this._handleNoteDrag(pos); } 
        else if (this.state.isResizing) { this._handleNoteResize(pos); } 
        else if (this.state.isMarqueeSelecting) { this._handleMarqueeSelect(pos); } 

        this.state.lastMousePos = pos;
    }

    _onInteractionEnd(rawE) {
    // Create the event object with raw, un-adjusted coordinates
        const event = { type: 'pointerup', ...this._getMousePos(rawE) };
        rawE.preventDefault();

        // Check if the drawer has an active interaction (like dragging its handle)
        // or if a control is captured, and let the drawer handle the event first.
        if (this.eventBroker.capturedControl || this.drawer.activeInteraction) {
            this.drawer.handleEvent(event);
        }
        const e = { ...rawE, y: rawE.y - this.drawer.getHeight() };
        if (this.state.soundOnAdd) {
            clearTimeout(this.state.soundOnAdd.timerId);
            this.onStopNote({ pitch: this.state.soundOnAdd.pitch });
            this.state.soundOnAdd = null;
        }

        if (this.state.potentialDeselect) this.state.selectedNotes = [];
        if (this.state.isDragging || this.state.isResizing || this.state.wasAddingNote) {
            this._recalculateSongDuration();
        }
        if (this.state.isMarqueeSelecting) this._selectNotesInMarquee();
        
        if (this.state.isDragging || this.state.isResizing) {
                this.state.selectedNotes = [];
        }
        
        if (this.state.isPanning) {
            this.state.isPanning = false;
            this.canvas.style.cursor = this._getCursorStyle(this.state.lastMousePos);
        }

        this.state.isDraggingPlayhead = false;
        this.state.isDragging = false;
        this.state.wasAddingNote = false;
        this.state.isResizing = false;
        this.state.isMarqueeSelecting = false;
        this.state.isDraggingVScroll = false;
        this.state.isDraggingHScroll = false;
        this.state.potentialDeselect = false;
        
        this.draw();
    }

    _onHoverMove(e) {
        const event = { type: 'pointermove', ...this._getMousePos(e) };
        if (this.eventBroker.capturedControl || this.drawer.isPointInBounds(event.x, event.y)) {
            this.drawer.handleEvent(event);
            this.canvas.style.cursor = 'default'; // Let the drawer handle cursor
            return;
        }
        const isInteracting = this.state.isPanning || this.state.isDragging || 
                                this.state.isResizing || this.state.isMarqueeSelecting || 
                                this.state.isDraggingPlayhead;
        if (isInteracting) return;
        const pos = this._getMousePosCorrectedForDrawer(e);
        this.canvas.style.cursor = this._getCursorStyle(pos);
    }

    _onWheel(e) { 
        e.preventDefault(); 
        const event = { type: 'wheel', ...this._getMousePos(e), deltaY: e.deltaY };
        if (this.eventBroker.capturedControl || this.drawer.isPointInBounds(event.x, event.y)) {
            e.preventDefault();
            this.drawer.handleEvent(event);
            return;
        }
        this.state.scrollX += e.deltaX; 
        this.state.scrollY += e.deltaY; 
        this._clampScroll(); 
        this.draw(); 
    }
    
    // --- DRAWING ---
    draw() { 
        const { ctx, canvas } = this; 
        const drawerHeight = this.drawer.getHeight();

        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight); 
        
        // Save context and move down to draw the piano roll below the drawer
        ctx.save();
        ctx.translate(0, drawerHeight);
        
        ctx.fillStyle = this.config.bgColor;
        const clientDimensions = this._getClientDimensions();
        ctx.fillRect(0, 0, clientDimensions.clientWidth, clientDimensions.clientHeight);

        this._drawTimeline(); 
        this._drawPianoKeys(); 
        this._drawGridAndNotes(); 
        this._drawPlayheadAndMarquee(); 
        this._drawScrollbars(); 
        
        ctx.restore(); // Restore context to the top-left
        
        // Now, draw the drawer on top
        this.drawer.draw();
        
        // Finally, draw any popups/overlays from the drawer
        const overlayControl = this.eventBroker.getOverlayControl();
        if (overlayControl) {
            this.drawer.drawOverlay(overlayControl);
        }
    }

    // You will also need a persistent animation loop
    _animationLoop() {
        this.draw();
        requestAnimationFrame(this._animationLoop.bind(this));
    }

    _drawTimeline() { 
        const { ctx, canvas, config, state } = this; 
        const { clientWidth } = canvas; 
        ctx.fillStyle = config.timelineBg; 
        ctx.fillRect(0, 0, clientWidth, config.timelineHeight); 
        ctx.save(); 
        ctx.translate(config.keysWidth - state.scrollX, 0); 
        ctx.font = "12px sans-serif"; 
        ctx.textAlign = "left"; 
        for (let i = 0; i <= config.totalBeats; i++) { 
            const x = i * config.beatWidth; 
            const isMeasureLine = i % 4 === 0; 
            ctx.strokeStyle = isMeasureLine ? config.gridLineDark : config.gridLineLight; 
            ctx.fillStyle = config.timelineFontColor; 
            ctx.beginPath(); 
            ctx.moveTo(x, isMeasureLine ? 15 : 20); 
            ctx.lineTo(x, config.timelineHeight); 
            ctx.stroke(); 
            if (isMeasureLine) { 
                const measureNumber = i / 4 + 1; 
                ctx.fillText(measureNumber, x + 4, 12); 
            } 
        } 
        ctx.restore(); 
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; 
        ctx.fillRect(0, config.timelineHeight - 1, clientWidth, 2); 
    }
    _drawPianoKeys() { 
        const { ctx, config, state } = this; 
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; 
        ctx.save(); 
        ctx.translate(0, config.timelineHeight - state.scrollY); 
        for (let i = 0; i < config.totalPitches; i++) { 
            const y = i * config.noteHeight; 
            const pitch = config.totalPitches - 1 - i; 
            const isBlackKey = noteNames[pitch % 12].includes("#"); 
            ctx.fillStyle = isBlackKey ? config.keyBlackColor : config.keyWhiteColor; 
            ctx.fillRect(0, y, config.keysWidth, config.noteHeight); 
            ctx.strokeStyle = config.gridLineDark; 
            ctx.strokeRect(0, y, config.keysWidth, config.noteHeight); 
            if (!isBlackKey) { 
                ctx.fillStyle = config.keyBlackColor; 
                ctx.font = "10px sans-serif"; 
                const octave = Math.floor(pitch / 12) - 1; 
                ctx.fillText(`${noteNames[pitch % 12]}${octave}`, 5, y + config.noteHeight - 4); 
            } 
        } 
        ctx.restore(); 
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; 
        ctx.fillRect(config.keysWidth - 1, config.timelineHeight, 2, 
                        this._getClientHeight() - config.timelineHeight); 
    }
    _drawGridAndNotes() { 
        const { ctx, canvas, config, state } = this; 
        const { clientWidth, clientHeight } = this._getClientDimensions(); 
        const gridWidth = config.beatWidth * config.totalBeats; 
        const gridHeight = config.noteHeight * config.totalPitches; 

        // Correctly calculate the available height for the piano roll
        const pianoRollHeight = this._getClientHeight();

        ctx.save(); 
        ctx.beginPath(); 
        // Use the calculated height for the clipping region
        ctx.rect(config.keysWidth, config.timelineHeight, 
                clientWidth - config.keysWidth, pianoRollHeight - config.timelineHeight); 
        ctx.clip(); 

        ctx.translate(config.keysWidth - state.scrollX, config.timelineHeight - state.scrollY); 

        // ... (the rest of the function is unchanged)
        for (let i = 0; i < config.totalPitches; i++) { 
            const pitch = config.totalPitches - 1 - i; 
            const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12); 
            ctx.fillStyle = isBlackKey ? config.gridBgDark : config.gridBgLight; 
            ctx.fillRect(0, i * config.noteHeight, gridWidth, config.noteHeight); 
        } 
        for (let i = 0; i <= config.totalBeats; i++) { 
            const x = i * config.beatWidth; 
            ctx.strokeStyle = (i % 4 === 0) ? config.gridLineDark : config.gridLineLight; 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x, gridHeight); 
            ctx.stroke(); 
        } 
        state.notes.filter(note => !this.state.hiddenChannels.has(note.channel)).forEach(note => {
            const rect = this._getNoteRect(note); 
            const isSelected = state.selectedNotes.includes(note); 
            ctx.fillStyle = this.CHANNEL_COLORS[note.channel || 0]; 
            ctx.strokeStyle = isSelected ? config.noteSelectedStrokeColor : config.noteStrokeColor; 
            ctx.lineWidth = isSelected ? 2.5 : 1.5; 
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h); 
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); 
        }); 
        ctx.restore(); 
    }
    _drawPlayheadAndMarquee() { 
        const { ctx, canvas, config, state } = this; 
        const x = config.keysWidth + this._tickToPixel(state.playheadTick) - state.scrollX; 
        if (x >= config.keysWidth && x < canvas.clientWidth) { 
            ctx.fillStyle = config.playheadColor; 
            ctx.fillRect(x, 0, 2, this._getClientHeight()); 
        } 
        if (state.isMarqueeSelecting) { 
            const marqueeX = Math.min(state.marquee.x1, state.marquee.x2);
            const marqueeY = Math.min(state.marquee.y1, state.marquee.y2);
            const w = Math.abs(state.marquee.x1 - state.marquee.x2);
            const h = Math.abs(state.marquee.y1 - state.marquee.y2); 
            ctx.strokeStyle = config.noteSelectedStrokeColor; 
            ctx.fillStyle = 'rgba(253, 216, 53, 0.2)'; 
            ctx.lineWidth = 1; 
            ctx.fillRect(marqueeX, marqueeY, w, h); 
            ctx.strokeRect(marqueeX, marqueeY, w, h); 
        } 
    }
    _drawScrollbars() {
        const { ctx, canvas, config, state } = this;
        const { clientWidth, clientHeight } = this._getClientDimensions();
        const { scrollX, scrollY } = state;
        const cornerRadius = 6;

        const contentWidth = config.beatWidth * config.totalBeats;
        const contentHeight = config.noteHeight * config.totalPitches;

        const viewWidth = clientWidth - config.keysWidth - config.scrollbarSize;
        const viewHeight = clientHeight - config.timelineHeight - config.scrollbarSize;

        // Draw Vertical Scrollbar
        if (contentHeight > viewHeight) {
            const trackHeight = clientHeight - config.timelineHeight;
            // Draw track background
            ctx.fillStyle = config.scrollbarBg;
            ctx.fillRect(clientWidth - config.scrollbarSize, config.timelineHeight, config.scrollbarSize, trackHeight);
            
            // Draw thumb
            const thumbHeight = Math.max(20, (viewHeight / contentHeight) * trackHeight);
            const thumbY = config.timelineHeight + (scrollY / (contentHeight - viewHeight)) * (trackHeight - thumbHeight);
            ctx.fillStyle = config.scrollbarThumb;
            ctx.beginPath();
            ctx.roundRect(clientWidth - config.scrollbarSize + 2, thumbY, config.scrollbarSize - 4, thumbHeight, cornerRadius);
            ctx.fill();
        }

        // Draw Horizontal Scrollbar
        if (contentWidth > viewWidth) {
            const trackWidth = clientWidth - config.keysWidth;
            // Draw track background
            ctx.fillStyle = config.scrollbarBg;
            ctx.fillRect(config.keysWidth, clientHeight - config.scrollbarSize, trackWidth, config.scrollbarSize);

            // Draw thumb
            const thumbWidth = Math.max(20, (viewWidth / contentWidth) * trackWidth);
            const thumbX = config.keysWidth + (scrollX / (contentWidth - viewWidth)) * (trackWidth - thumbWidth);
            ctx.fillStyle = config.scrollbarThumb;
            ctx.beginPath();
            ctx.roundRect(thumbX, clientHeight - config.scrollbarSize + 2, thumbWidth, config.scrollbarSize - 4, cornerRadius);
            ctx.fill();
        }
    }
    
    // --- PLAYBACK ---
    _buildLookaheadEvents() { 
        const s = this.state; 
        s.lookaheadEvents = []; 
        s.notes.forEach(n => { 
            if (n.type === 'other') {
                s.lookaheadEvents.push({ type: 'other', tick: n.time, msg: n.msg });
                return;
            }
            s.lookaheadEvents.push({ 
                type: 'noteOn', tick: n.start_tick, pitch: n.pitch, 
                velocity: n.velocity, channel: n.channel, isPlaying: false 
            }); 
            s.lookaheadEvents.push({ 
                type: 'noteOff', tick: n.start_tick + n.duration_ticks, pitch: n.pitch, channel: n.channel
            }); 
        }); 
        s.lookaheadEvents.sort((a,b) => a.tick - b.tick); 
    }
    _playbackLoop(timestamp) { 
        const s = this.state, c = this.config, canvas = this.canvas; 
        if (!s.isPlaying) return; 

        // This is the main playback loop driven by requestAnimationFrame for smooth animation
        const elapsedMs = timestamp - s.lastFrameTime; 
        s.lastFrameTime = timestamp; 
        const ticksPerSecond = (this.bpm / 60) * s.ppqn; 
        const elapsedTicks = (elapsedMs / 1000) * ticksPerSecond; 
        const newPlayheadTick = s.playheadTick + elapsedTicks; 

        // Find and process all events between the last frame and this one
        s.lookaheadEvents.forEach(e => { 
            if (e.tick >= s.playheadTick && e.tick < newPlayheadTick) { 
                if (this.state.mutedChannels.has(e.channel)) {
                    return; // Skip sending MIDI messages for this muted channel
                }
                if (e.type === 'noteOn') { 
                    this.onPlayNote(e); 
                    // Mark the event as currently playing to handle note-offs correctly
                    const onEvent = s.lookaheadEvents.find(ev => 
                        ev.type === 'noteOn' && ev.tick === e.tick && ev.pitch === e.pitch && ev.channel === e.channel); 
                    if(onEvent) onEvent.isPlaying = true; 
                } else if (e.type === 'noteOff') { // noteOff
                    this.onStopNote(e); 
                    // Find the corresponding noteOn event and mark it as no longer playing
                    const onEvent = s.lookaheadEvents.find(ev => 
                        ev.type === 'noteOn' && ev.tick < e.tick && 
                        ev.pitch === e.pitch && ev.channel === e.channel && ev.isPlaying); 
                    if(onEvent) onEvent.isPlaying = false; 
                } else {
                    // Handle other MIDI events if necessary
                    this.onMidiMessage(e.msg);
                }
            } 
        }); 

        s.playheadTick = newPlayheadTick; 

        // Auto-scroll logic
        const playheadX = this._tickToPixel(s.playheadTick); 
        const viewWidth = canvas.clientWidth - c.keysWidth - c.scrollbarSize; 
        if (playheadX > s.scrollX + viewWidth * 0.8 || playheadX < s.scrollX) {
            s.scrollX = playheadX - viewWidth * 0.2; 
        }
        this._clampScroll(); 

        // Stop playback if the end is reached
        if (s.playheadTick > s.songDurationTicks) this.stop(); 
        
        this.draw(); 
        requestAnimationFrame(this._playbackLoop.bind(this)); 
    }

    // --- MOUSE INTERACTION LOGIC ---
    _handleNoteMouseDown(e, note, pos) { 
        this._saveStateForUndo(); 
        const s = this.state; 
        if (s.playOnClick) { 
            const originalPitch = note.pitch; 
            const ticksPerSecond = (this.bpm / 60) * s.ppqn; 
            const msPerTick = 1000 / ticksPerSecond; 
            const durationMs = note.duration_ticks * msPerTick; 
            this.onPlayNote({ 
                pitch: originalPitch, velocity: note.velocity, channel: note.channel 
            }); 
            setTimeout(() => { this.onStopNote({ pitch: originalPitch, channel: note.channel }); }, durationMs); 
        } 
        const isSelected = s.selectedNotes.includes(note); 
        if (e.shiftKey || e.ctrlKey) { 
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

            if (s.playOnClick) {
                const ticksPerSecond = (this.bpm / 60) * s.ppqn;
                const durationMs = (s.noteSize / ticksPerSecond) * 1000;
                this.onPlayNote({ 
                    pitch: newNote.pitch, velocity: newNote.velocity, channel: newNote.channel 
                });
                const timerId = setTimeout(() => {
                    this.onStopNote({ pitch: newNote.pitch, channel: newNote.channel });
                    if (this.state.soundOnAdd && this.state.soundOnAdd.timerId === timerId) {
                        this.state.soundOnAdd = null;
                    }
                }, durationMs);
                this.state.soundOnAdd = { pitch: newNote.pitch, timerId };
            }

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
        this.draw(); 
    }
    _handleResizeMouseDown(note, pos) {
        this._saveStateForUndo();
        const s = this.state;
        s.isResizing = true;
        if (!s.selectedNotes.includes(note)) s.selectedNotes = [note];
        // Use the new precise function to get the exact starting tick
        s.resizeStartTicks = this._pixelToTick(this._getGridPos(pos).x);
        s.selectedNotes.forEach(n => { n.originalDuration = n.duration_ticks; });
    }
    _handleNoteResize(pos) {
        const s = this.state;
        // Use the precise function for the current mouse position
        const currentTick = this._pixelToTick(this._getGridPos(pos).x);
        const deltaTicks = currentTick - s.resizeStartTicks;

        s.selectedNotes.forEach(n => {
            const newDuration = n.originalDuration + deltaTicks;
            // Ensure duration doesn't become negative or smaller than a 64th note
            n.duration_ticks = Math.max(s.ppqn / 16, newDuration);
        });
    }
    _handleMarqueeSelect(pos) { 
        this.state.marquee.x2 = pos.x; 
        this.state.marquee.y2 = pos.y; 
        this.draw(); 
    }
    _handleScrollbarMouseDown(pos) {
        const c = this.config, s = this.state;
        const { clientWidth, clientHeight } = this._getClientDimensions();
        
        // For vertical scrollbar
        if (pos.x > clientWidth - c.scrollbarSize && pos.y > c.timelineHeight) {
            s.isDraggingVScroll = true;
            s.dragStartPos = { ...pos }; // Record starting mouse position
            s.dragStartScroll.y = s.scrollY; // Record starting scroll position
            return true;
        }
        
        // For horizontal scrollbar
        if (pos.y > clientHeight - c.scrollbarSize && pos.x > c.keysWidth) {
            s.isDraggingHScroll = true;
            s.dragStartPos = { ...pos }; // Record starting mouse position
            s.dragStartScroll.x = s.scrollX; // Record starting scroll position
            return true;
        }
        
        return false;
    }
    _handleScrollbarMouseMove(pos) {
        const c = this.config, s = this.state;
        const { clientWidth, clientHeight } = this._getClientDimensions();
        const contentWidth = c.beatWidth * c.totalBeats;
        const contentHeight = c.noteHeight * c.totalPitches;

        if (s.isDraggingVScroll) {
            const dy = pos.y - s.dragStartPos.y; // Total mouse Y delta
            const viewHeight = clientHeight - c.timelineHeight - c.scrollbarSize;
            const ratio = contentHeight / viewHeight;
            s.scrollY = s.dragStartScroll.y + dy * ratio; // Calculate new position
        }

        if (s.isDraggingHScroll) {
            const dx = pos.x - s.dragStartPos.x; // Total mouse X delta
            const viewWidth = clientWidth - c.keysWidth - c.scrollbarSize;
            const ratio = contentWidth / viewWidth;
            s.scrollX = s.dragStartScroll.x + dx * ratio; // Calculate new position
        }

        this._clampScroll();
    }
    _handlePan(pos) { 
        const dx = pos.x - this.state.lastMousePos.x; 
        const dy = pos.y - this.state.lastMousePos.y; 
        this.state.scrollX -= dx; 
        this.state.scrollY -= dy; 
        this._clampScroll(); 
        this.draw(); 
    }
    _handlePlayheadDrag(pos) { 
        const gridX = pos.x - this.config.keysWidth + this.state.scrollX; 
        const tick = (gridX / this.config.beatWidth) * this.state.ppqn; 
        this.state.playheadTick = Math.max(0, tick); 
        // If playing, update the lookahead events to avoid re-triggering past notes
        if (this.state.isPlaying) {
            this._buildLookaheadEvents();
        }
        this.draw(); 
        this.state.playheadLastDraggedTime = performance.now();
    }

    // --- INSTRUMENT / VOLUME CHANGE / MUTE ---
    toggleMute(channel) {
        if (this.state.mutedChannels.has(channel)) {
            this.state.mutedChannels.delete(channel);
        } else {
            this.state.mutedChannels.add(channel);
        }
        // No need to redraw immediately, the playback loop will use this state.
    }

    toggleHide(channel) {
        if (this.state.hiddenChannels.has(channel)) {
            this.state.hiddenChannels.delete(channel);
        } else {
            this.state.hiddenChannels.add(channel);
        }
        this.draw(); // A redraw is needed to show or hide the notes visually.
    }

    _setTrackParameter(channel, type, value) {
        const TEN_SECONDS = 10000;
        let message;
        let eventType;

        // 1. Prepare the MIDI message and event type
        if (type === 'instrument') {
            message = [0xC0 | (channel - 1), value];
            eventType = 'programChange'; // Custom identifier
        } else if (type === 'volume') {
            message = [0xB0 | (channel - 1), 7, value]; // CC7 is Channel Volume
            eventType = 'volumeChange'; // Custom identifier
        } else {
            return; // Unknown type
        }

        // 2. Send the message immediately for real-time feedback
        this.onMidiMessage(message);

        // 3. Determine the timestamp for the new event
        const wasDraggedRecently = (performance.now() - this.state.playheadLastDraggedTime) < TEN_SECONDS;
        const tick = wasDraggedRecently ? this.state.playheadTick : 0;
        
        // 4. Create the new event object
        const newEvent = {
            type: 'other', // Use 'other' to store non-note MIDI messages
            time: tick,
            msg: message,
            eventType: eventType, // Store our custom type for easy identification
            channel: channel - 1
        };

        // 5. Insert the event, replacing any previous one of the same type at the same tick
        this._saveStateForUndo();
        
        // Find if an event of the same type and channel exists at this exact tick
        const existingEventIndex = this.state.notes.findIndex(e => 
            e.time === tick && e.eventType === eventType && e.channel === (channel - 1)
        );

        if (existingEventIndex > -1) {
            // If it exists, replace it
            this.state.notes[existingEventIndex] = newEvent;
        } else {
            // Otherwise, add it and re-sort
            this.state.notes.push(newEvent);
            this.state.notes.sort((a, b) => a.time - b.time || a.start_tick - b.start_tick);
        }

        this._buildLookaheadEvents();
        this.draw();
    }

    // --- UNDO/REDO ---
    _saveStateForUndo() { 
        this.state.redoHistory = []; 
        this.state.undoHistory.push(JSON.parse(JSON.stringify(this.state.notes))); 
        if (this.state.undoHistory.length > this.MAX_HISTORY) { 
            this.state.undoHistory.shift(); 
        } 
    }

    // --- UTILITY ---
    _getMousePos(e, relativeToPage = false) {
        const rect = this.canvas.getBoundingClientRect();
        let point = e; // Assume it's a mouse/pointer event by default

        // For touch end events, the coordinate data is in `changedTouches`.
        if (e.changedTouches && e.changedTouches.length > 0) {
            point = e.changedTouches[0];
        }
        // For other touch events (start, move), it's in `touches`.
        else if (e.touches && e.touches.length > 0) {
            point = e.touches[0];
        }

        // `point` will now be either the original event (for mouse/pointer)
        // or the specific touch point, both of which have clientX/clientY.
        const clientX = point.clientX;
        const clientY = point.clientY;

        // A final check to prevent errors.
        if (clientX === undefined || clientY === undefined) {
            return { x: NaN, y: NaN };
        }

        if (relativeToPage) {
            return { x: clientX, y: clientY };
        }

        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    _getMousePosCorrectedForDrawer(e, relativeToPage = false) {
        const pos = this._getMousePos(e, relativeToPage);
        return { 
            x: pos.x, 
            y: pos.y - this.drawer.getHeight() 
        }; // Adjust for drawer height
    }
    _getGridPos(pos) { 
        return { 
            x: pos.x - this.config.keysWidth + this.state.scrollX, 
            y: pos.y - this.config.timelineHeight + this.state.scrollY 
        }; 
    }
    _getClientDimensions() {
        return { 
            clientWidth: this.canvas.clientWidth, 
            clientHeight: this.canvas.clientHeight - this.drawer.getHeight() 
        };
    }
    _getClientWidth() {
        return this.canvas.clientWidth;
    }
    _getClientHeight() {
        return this.canvas.clientHeight - this.drawer.getHeight();
    }
    _tickToPixel(tick) { return (tick / this.state.ppqn) * this.config.beatWidth; }
    _pixelToTick(pixel) {
        return (pixel / this.config.beatWidth) * this.state.ppqn;
    }
    _pitchToPixel(pitch) { return (this.config.totalPitches - 1 - pitch) * this.config.noteHeight; }
    _getNoteRect(note) { 
        const x = this._tickToPixel(note.start_tick); 
        const y = this._pitchToPixel(note.pitch); 
        const w = this._tickToPixel(note.duration_ticks); 
        const h = this.config.noteHeight; 
        return { x, y, w, h }; 
    }
    _getNoteAt(x, y) { 
        if (y < this.config.timelineHeight) return null; 
        const gridPos = this._getGridPos({x, y}); 
        return this.state.notes.filter(n => !this.state.hiddenChannels.has(n.channel)).slice().reverse().find(n => {
            const r = this._getNoteRect(n); 
            return gridPos.x >= r.x && gridPos.x <= r.x + r.w && 
                    gridPos.y >= r.y && gridPos.y <= r.y + r.h; 
        }); 
    }
    _pixelToGrid(pos) { 
        const s = this.state, c = this.config; 
        const q = s.ppqn / 4; 
        const tick = Math.round(pos.x / this._tickToPixel(q)) * q; 
        const pitch = c.totalPitches - 1 - Math.floor(pos.y / c.noteHeight); 
        return { 
            tick: Math.max(0, tick), 
            pitch: Math.max(0, Math.min(127, pitch)) 
        }; 
    }
    _getCursorStyle(pos) { 
        const canDragPlayhead = this.state.mode === 'add' || this.state.mode === 'select';
        if (pos.y < this.config.timelineHeight && pos.x > this.config.keysWidth && canDragPlayhead) { 
            return 'ew-resize'; 
        } 
        if (this.state.mode === 'pan') { 
            return this.state.isPanning ? 'grabbing' : 'grab'; 
        } 
        const c = this.config, dim = this._getClientDimensions(); 
        const isOverScrollbar = pos.x > dim.clientWidth-c.scrollbarSize || 
                                (pos.y > dim.clientHeight-c.scrollbarSize && 
                                pos.x > c.keysWidth);
        if (isOverScrollbar) return 'default'; 
        if (pos.x < c.keysWidth) return 'default'; 
        const note = this._getNoteAt(pos.x, pos.y); 
        if(note) { 
            const noteGridPos = this._getGridPos(pos); 
            const noteRect = this._getNoteRect(note); 
            if (noteGridPos.x > noteRect.x + noteRect.w - c.resizeHandleWidth) {
                return 'ew-resize'; 
            }
            return 'move'; 
        } 
        return 'cell'; 
    }
    _selectNotesInMarquee() { 
        const s = this.state; 
        const m = { 
            x: Math.min(s.marquee.x1, s.marquee.x2), 
            y: Math.min(s.marquee.y1, s.marquee.y2), 
            w: Math.abs(s.marquee.x1-s.marquee.x2), 
            h: Math.abs(s.marquee.y1-s.marquee.y2) 
        }; 
        const marqueeGrid = { 
            x: m.x - this.config.keysWidth + s.scrollX, 
            y: m.y - this.config.timelineHeight + s.scrollY, 
            w: m.w, 
            h: m.h
        }; 
        s.selectedNotes = s.notes.filter(note => { 
            const noteRect = this._getNoteRect(note); 
            return !(noteRect.x > marqueeGrid.x + marqueeGrid.w || 
                        noteRect.x + noteRect.w < marqueeGrid.x || 
                        noteRect.y > marqueeGrid.y + marqueeGrid.h || 
                        noteRect.y + noteRect.h < marqueeGrid.y); 
        });
    }
    _clampScroll() { 
        const s = this.state, c = this.config, canvas = this.canvas; 
        const maxScrollX = Math.max(0, (c.beatWidth * c.totalBeats) - 
                            (this._getClientWidth() - c.keysWidth - c.scrollbarSize)); 
        const maxScrollY = Math.max(0, (c.noteHeight * c.totalPitches) - 
                            (this._getClientHeight() - c.timelineHeight - c.scrollbarSize)); 
        s.scrollX = Math.max(0, Math.min(s.scrollX, maxScrollX)); 
        s.scrollY = Math.max(0, Math.min(s.scrollY, maxScrollY)); 
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
                    notes.push({ 
                        pitch: nOn.pitch, velocity: nOn.velocity, channel: nOn.channel, 
                        start_tick: nOn.time, duration_ticks: msg.time - nOn.time, type: 'note'
                    }); 
                    delete openNotes[key]; 
                } 
            } else if (msg.type === 'other') {
                notes.push({ time: msg.time, msg: msg.msg, type: 'other'})
            } 
        }); 
        return notes; 
    }
    _notesToMessages(notes) { 
        const messages = []; 
        notes.forEach(n => { 
            if (n.type === 'other') {
                messages.push({ type: 'other', time: n.time, msg: n.msg });
                return;
            }
            messages.push({ 
                type: 'noteOn', pitch: n.pitch, velocity: n.velocity, 
                time: n.start_tick, channel: n.channel || 0, 
            }); 
            messages.push({ 
                type: 'noteOff', pitch: n.pitch, velocity: 0, 
                time: n.start_tick + n.duration_ticks, channel: n.channel || 0, 
            }); 
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

