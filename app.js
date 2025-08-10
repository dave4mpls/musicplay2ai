document.addEventListener('DOMContentLoaded', () => {
    const dragger = document.getElementById('dragger');
    const topRow = document.getElementById('topRow');
    const bottomRow = document.getElementById('bottomRow');
    const contentWrapper = document.querySelector('.content-wrapper');

    let isDragging = false;
    let midiOutput = null; 

    // --- Dragger Logic ---
    const startDragging = (e) => {
        isDragging = true;
        document.body.style.cursor = 'ns-resize';
    };

    const stopDragging = () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    };

    const onDrag = (e) => {
        if (!isDragging) return;

        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientY === undefined) return;

        const contentWrapperRect = contentWrapper.getBoundingClientRect();
        const newTopHeight = clientY - contentWrapperRect.top;

        if (newTopHeight > 20 && newTopHeight < contentWrapper.clientHeight - 20) {
            const newTopFlexBasis = (newTopHeight / contentWrapper.clientHeight) * 100;
            topRow.style.flexBasis = `${newTopFlexBasis}%`;
        }
    };

    dragger.addEventListener('mousedown', startDragging);
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('mousemove', onDrag);
    dragger.addEventListener('touchstart', startDragging, { passive: false });
    document.addEventListener('touchend', stopDragging);
    document.addEventListener('touchmove', onDrag, { passive: false });


    // --- Component Initialization ---
    const keyboardCanvas = document.getElementById('keyboardCanvas');
    const pianoRollCanvas = document.getElementById('pianoRollCanvas');

    // Initialize the WebAudioTinySynth
    const synth = new WebAudioTinySynth({quality:1, useReverb:1});
    window.synth = synth;

    const unlockAudio = () => {
        if (synth.audioContext && synth.audioContext.state === 'suspended') {
            synth.audioContext.resume();
        }
        document.body.removeEventListener('click', unlockAudio);
        document.body.removeEventListener('touchstart', unlockAudio);
        document.body.removeEventListener('keydown', unlockAudio);
    };
    document.body.addEventListener('click', unlockAudio);
    document.body.addEventListener('touchstart', unlockAudio);
    document.body.addEventListener('keydown', unlockAudio);

    const noteOn = (note) => {
        synth.noteOn(note.channel || 0, note.pitch, note.velocity);
    };
    const noteOff = (note) => {
        synth.noteOff(note.channel || 0, note.pitch);
    };
    const sendMidiMessage = (msg) => {
        synth.send(msg);
    }
    window.onPlayNote = noteOn;
    window.onStopNote = noteOff;
    window.onMidiMessage = sendMidiMessage;
    
    // Initialize Piano Roll
    const pianoRoll = new PianoRoll(pianoRollCanvas,{ 
        synth: synth,
        onPlayNote: noteOn,
        onStopNote: noteOff,
        onMidiMessage: sendMidiMessage,
        bpm: 120
    });


    // This function will now be the central point for MIDI routing.
    function handleMidiMessage(message, deviceName = "internal") {
        const messageHex = Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.log(`MIDI from ${deviceName}: [${messageHex}]`);
        
        // Send to the Piano Roll's synthesizer
        pianoRoll.handleMidiMessage(message);

        // If an external MIDI output is selected, send the message there too.
        if (midiOutput) {
            midiOutput.send(message);
        }
    }

    // Initialize Keyboard, passing the central MIDI handler as its callback.
    const keyboard = new PianoKeyboard({ 
        canvas: keyboardCanvas, 
        midiCallback: handleMidiMessage 
    });

    // Add some default notes to the piano roll for demonstration
    const defaultNotes = [ 
        { type: 'noteOn', pitch: 60, velocity: 100, time: 0, channel: 0 }, 
        { type: 'noteOff', pitch: 60, time: 96, channel: 0 }, 
        { type: 'noteOn', pitch: 62, velocity: 100, time: 96, channel: 1 }, 
        { type: 'noteOff', pitch: 62, time: 192, channel: 1 }, 
        { type: 'noteOn', pitch: 64, velocity: 100, time: 192, channel: 2 }, 
        { type: 'noteOff', pitch: 64, time: 288, channel: 2 }, 
    ];
    pianoRoll.loadFromJson(defaultNotes, 96);
});
