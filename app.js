const dragger = document.getElementById('dragger');
const topRow = document.getElementById('topRow');
const bottomRow = document.getElementById('bottomRow');
const contentWrapper = document.querySelector('.content-wrapper');

let isDragging = false;
let midiOutput = null; 

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

    const clientY = e.clientY || e.touches[0].clientY;
    const contentWrapperRect = contentWrapper.getBoundingClientRect();
    const newTopHeight = clientY - contentWrapperRect.top;

    if (newTopHeight > 20 && newTopHeight < contentWrapper.clientHeight - 10) {
        const newTopFlexBasis = (newTopHeight / contentWrapper.clientHeight) * 100;
        topRow.style.flexBasis = `${newTopFlexBasis}%`;
    }
};

function sendMidiMessage(message, deviceName = "internal") {
    const messageHex = Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
    console.log(`MIDI from ${deviceName}: [${messageHex}]`);
    if (midiOutput) {
        midiOutput.send(message);
    }
}

dragger.addEventListener('mousedown', startDragging);
document.addEventListener('mouseup', stopDragging);
document.addEventListener('mousemove', onDrag);

dragger.addEventListener('touchstart', startDragging);
document.addEventListener('touchend', stopDragging);
document.addEventListener('touchmove', onDrag);

// Initialize keyboard
const keyboardCanvas = document.getElementById('keyboardCanvas');
const keyboard = new PianoKeyboard({ canvas: keyboardCanvas, midiCallback: sendMidiMessage });
keyboard.draw();
