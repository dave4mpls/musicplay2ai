        _initControls() {
            const ppqn = this.state.ppqn;
            const sizeOptions = [
                { text: '𝅘𝅥𝅰', value: ppqn / 8 },   // 32nd
                { text: '𝅘𝅥𝅯', value: ppqn / 4 },   // 16th
                { text: '♪', value: ppqn / 2 },    // Eighth
                { text: '♩', value: ppqn },        // Quarter
                { text: '♩.', value: ppqn * 1.5 }, // Dotted Quarter
                { text: '𝅗𝅥', value: ppqn * 2 },    // Half
                { text: '𝅗𝅥.', value: ppqn * 3 },   // Dotted Half
                { text: '𝅝', value: ppqn * 4 },    // Whole
            ];
            const channelOptions = Array.from({length: 16}, (_, i) => ({
                text: `Ch ${i + 1}`, value: i
            }));

            this.tabs = {
                'File': [
                    new ButtonControl({ ctx: this.ctx, id: 'load', label: 'Load MIDI', 
                        onClick: () => this.dom.fileInput.click() }),
                    new ButtonControl({ ctx: this.ctx, id: 'save', label: 'Save MIDI', 
                        onClick: () => {
                            const buffer = this.saveToMidi();
                            const blob = new Blob([buffer], { type: 'audio/midi' });
                            const url = URL.createObjectURL(blob);
                            this.dom.saveLink.href = url;
                            this.dom.saveLink.download = 'composition.mid';
                            this.dom.saveLink.click();
                            URL.revokeObjectURL(url);
                        }}),
                ],
                'Edit': [
                    new ButtonControl({ ctx: this.ctx, id: 'add', label: 'Add', 
                        isActive: () => this.state.mode === 'add', 
                        onClick: () => this.setMode('add') }),
                    new ButtonControl({ ctx: this.ctx, id: 'select', label: 'Select', 
                        isActive: () => this.state.mode === 'select', 
                        onClick: () => this.setMode('select') }),
                    new ButtonControl({ ctx: this.ctx, id: 'pan', label: 'Pan', 
                        isActive: () => this.state.mode === 'pan', 
                        onClick: () => this.setMode('pan') }),
                    new ButtonControl({ ctx: this.ctx, id: 'undo', label: '↶ Undo', 
                        onClick: () => this.undo() }),
                    new ButtonControl({ ctx: this.ctx, id: 'redo', label: '↷ Redo', 
                        onClick: () => this.redo() }),
                    new DropdownControl({ ctx: this.ctx, label: 'Channel', options: channelOptions,
                        width: 120, onSelect: (val) => this.setCurrentChannel(val),
                        getSelectedValue: () => this.state.currentChannel }),
                    new DropdownControl({ ctx: this.ctx, label: 'Size', options: sizeOptions,
                        width: 120, onSelect: (val) => this.state.noteSize = val,
                        getSelectedValue: () => this.state.noteSize }),
                    new VerticalSliderControl({ ctx: this.ctx, label: 'Tempo', min: 40, max: 240,
                        getValue: () => this.bpm, setValue: (val) => this.bpm = val }),
                ],
                'Sound': [
                    new ButtonControl({ ctx: this.ctx, id: 'play', label: '▶ Play', 
                        isActive: () => this.state.isPlaying, 
                        onClick: () => this.state.isPlaying ? this.pause() : this.play() }),
                    new ButtonControl({ ctx: this.ctx, id: 'stop', label: '⏹ Stop', 
                        onClick: () => this.stop() }),
                    new ToggleSwitch({ ctx: this.ctx, label: 'Play Notes When Clicked', 
                        getValue: () => this.state.playOnClick, 
                        toggle: () => this.setPlayOnClick(!this.state.playOnClick) }),
                ]
            };
        }
