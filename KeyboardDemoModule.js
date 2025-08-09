// This script initializes the piano keyboard and handles MIDI input/output
// and settings changes.
// It listens for MIDI messages, updates the MIDI output selector,
// and handles the rendering of the piano keyboard on the canvas.
// This script is designed to work with the PianoKeyboard class defined in PianoKeyboard.js
// and is intended to be used in a web application that supports MIDI devices.

// The PianoKeyboard class provides methods for rendering the keyboard,
// handling MIDI messages, and managing settings changes.

import { PianoKeyboard } from './PianoKeyboard.js';

// --- DEMO APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('piano-keyboard-canvas');
    const midiOutputsSelect = document.getElementById('midi-outputs');
    let midiOutput = null;
    let midiAccess = null;

    function sendMidiMessage(message, deviceName = "internal") {
        const messageHex = Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        // console.log(`MIDI from ${deviceName}: [${messageHex}]`);
        if (midiOutput) {
            midiOutput.send(message);
        }
    }

    function onSettingsChange(settings) {
        console.log("Settings changed:", settings);
    }

    const piano = new PianoKeyboard({
        canvas: canvas,
        midiCallback: sendMidiMessage,
        onSettingsChange: onSettingsChange
    });

    function onMidiMessage(event) {
        piano.handleExternalMidiMessage(event.data, event.target.name);
    }

    function setupMidiListeners() {
        if (!midiAccess) return;
        midiAccess.inputs.forEach(input => {
            input.onmidimessage = onMidiMessage;
            console.log(`Listening for MIDI input on: ${input.name}`);
        });
    }

    function updateDeviceLists() {
        if (!midiAccess) return;
        const outputs = midiAccess.outputs.values();
        midiOutputsSelect.innerHTML = '';
        let firstOutput = true;
        for (const output of outputs) {
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name;
            midiOutputsSelect.appendChild(option);
            if (firstOutput) {
                midiOutput = output;
                firstOutput = false;
            }
        }
        if (midiOutputsSelect.options.length === 0) {
                midiOutputsSelect.innerHTML = '<option>No MIDI devices found</option>';
                midiOutput = null;
        } else {
                midiOutput = midiAccess.outputs.get(midiOutputsSelect.value);
        }
        setupMidiListeners();
    }

    function onMIDISuccess(ma) {
        midiAccess = ma;
        updateDeviceLists();
        midiAccess.onstatechange = (event) => {
            console.log(`MIDI device state changed: ${event.port.name}, ${event.port.state}`);
            updateDeviceLists();
        };
    }

    function onMIDIFailure(msg) {
        console.error(`Failed to get MIDI access - ${msg}`);
        midiOutputsSelect.innerHTML = '<option>MIDI Access Failed</option>';
    }

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
        console.warn('WebMIDI is not supported in this browser.');
    }
    
    midiOutputsSelect.addEventListener('change', () => {
        if (midiAccess) {
            midiOutput = midiAccess.outputs.get(midiOutputsSelect.value);
        }

        import('./PianoKeyboard.js').then((module) => {
            window.PianoKeyboard = module.PianoKeyboard;
        });
    });
});
