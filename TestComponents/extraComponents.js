    class ButtonControl {
        constructor(config) {
            this.ctx = config.ctx;
            this.id = config.id;
            this.label = config.label;
            this.x = config.x;
            this.y = config.y;
            this.width = config.width || 80;
            this.height = config.height || 28;
            this.onClick = config.onClick || (() => {});
            this.isActive = config.isActive || (() => false);
            this.font = config.font || '13px sans-serif';
        }

        getBounds() {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        }

        draw(substituteText = null) {
            const bounds = this.getBounds();
            this.ctx.save();
            const active = this.isActive();
            this.ctx.fillStyle = active ? '#61afef' : '#4b5263';
            this.ctx.strokeStyle = active ? '#282c34' : '#21252b';
            this.ctx.lineWidth = 1;
            
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 5);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.font = this.font;
            this.ctx.fillStyle = active ? '#282c34' : '#abb2bf';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(substituteText || this.label, bounds.x + bounds.width / 2, 
                              bounds.y + bounds.height / 2);
            this.ctx.restore();
        }

        isPointOnControl(x, y) {
            const bounds = this.getBounds();
            return x >= bounds.x && x <= bounds.x + bounds.width && 
                   y >= bounds.y && y <= bounds.y + bounds.height;
        }
    }

    class DropdownControl {
        constructor(config) {
            this.ctx = config.ctx;
            this.label = config.label;
            this.x = config.x;
            this.y = config.y;
            this.width = config.width || 100;
            this.height = config.height || 28;
            this.options = config.options; // [{text, value}]
            this.onSelect = config.onSelect || (() => {});
            this.getSelectedValue = config.getSelectedValue || (() => this.options[0].value);
            this.font = config.font || '13px sans-serif';
            this.isOpen = false;
        }

        getBounds() {
            const optionHeight = 25;
            const dropdownHeight = this.isOpen ? (this.options.length * optionHeight) + 5 : 0;
            return {
                main: { x: this.x, y: this.y, width: this.width, height: this.height },
                dropdown: { 
                    x: this.x, y: this.y + this.height, 
                    width: this.width, height: dropdownHeight 
                },
                options: this.options.map((opt, i) => ({
                    x: this.x, y: this.y + this.height + (i * optionHeight),
                    width: this.width, height: optionHeight
                }))
            };
        }

        draw() {
            const bounds = this.getBounds();
            this.ctx.save();
            this.ctx.font = this.font;

            // Draw main box
            this.ctx.fillStyle = '#4b5263';
            this.ctx.strokeStyle = '#21252b';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.main.x, bounds.main.y, 
                               bounds.main.width, bounds.main.height, 5);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw label and selected value
            const selectedValue = this.getSelectedValue();
            const selectedOption = this.options.find(opt => opt.value === selectedValue);
            const displayText = `${this.label}: ${selectedOption ? selectedOption.text : ''}`;
            this.ctx.fillStyle = '#abb2bf';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(displayText, bounds.main.x + 8, 
                              bounds.main.y + bounds.main.height / 2);
            
            // Draw arrow
            this.ctx.beginPath();
            this.ctx.moveTo(bounds.main.x + bounds.main.width - 15, bounds.main.y + 11);
            this.ctx.lineTo(bounds.main.x + bounds.main.width - 10, bounds.main.y + 16);
            this.ctx.lineTo(bounds.main.x + bounds.main.width - 5, bounds.main.y + 11);
            this.ctx.stroke();

            // Draw dropdown if open
            if (this.isOpen) {
                this.ctx.fillStyle = '#21252b';
                this.ctx.beginPath();
                this.ctx.roundRect(bounds.dropdown.x, bounds.dropdown.y, 
                                   bounds.dropdown.width, bounds.dropdown.height, 5);
                this.ctx.fill();

                bounds.options.forEach((optBounds, i) => {
                    this.ctx.fillStyle = '#abb2bf';
                    this.ctx.fillText(this.options[i].text, optBounds.x + 8, 
                                      optBounds.y + optBounds.height / 2);
                });
            }
            this.ctx.restore();
        }

        isPointOnControl(x, y) {
            const bounds = this.getBounds();
            if (x >= bounds.main.x && x <= bounds.main.x + bounds.main.width &&
                y >= bounds.main.y && y <= bounds.main.y + bounds.main.height) {
                return { type: 'main' };
            }
            if (this.isOpen) {
                for (let i = 0; i < bounds.options.length; i++) {
                    const optBounds = bounds.options[i];
                    if (x >= optBounds.x && x <= optBounds.x + optBounds.width &&
                        y >= optBounds.y && y <= optBounds.y + optBounds.height) {
                        return { type: 'option', value: this.options[i].value };
                    }
                }
            }
            return null;
        }
    }

    class VerticalSliderControl {
        constructor(config) {
            this.ctx = config.ctx;
            this.label = config.label;
            this.x = config.x;
            this.y = config.y;
            this.width = 24;
            this.height = config.height || 100;
            this.min = config.min || 0;
            this.max = config.max || 127;
            this.getValue = config.getValue;
            this.setValue = config.setValue;
            this.font = config.font || '12px sans-serif';
        }

        getBounds() {
            const trackWidth = 6, handleHeight = 12;
            const trackX = this.x + this.width / 2 - trackWidth / 2;
            const trackY = this.y;
            const value = this.getValue();
            const handleY = trackY + 
                (1 - ((value - this.min) / (this.max - this.min))) * this.height - 
                (handleHeight / 2);
            return {
                track: { x: trackX, y: trackY, width: trackWidth, height: this.height },
                handle: { x: this.x, y: handleY, width: this.width, height: handleHeight }
            };
        }

        draw() {
            const bounds = this.getBounds();
            const value = this.getValue();
            this.ctx.save();
            this.ctx.font = this.font;
            this.ctx.fillStyle = '#abb2bf';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.label, this.x + this.width / 2, this.y - 10);
            
            this.ctx.fillStyle = '#4b5263';
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.track.x, bounds.track.y, 
                               bounds.track.width, bounds.track.height, 3);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#61afef';
            this.ctx.strokeStyle = '#282c34';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.handle.x, bounds.handle.y, 
                               bounds.handle.width, bounds.handle.height, 4);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillText(value, this.x + this.width / 2, this.y + this.height + 15);
            this.ctx.restore();
        }

        updateValueFromPosition(y) {
            const bounds = this.getBounds();
            const relativeY = y - bounds.track.y;
            const ratio = 1 - Math.max(0, Math.min(1, relativeY / bounds.track.height));
            const newValue = Math.round(this.min + ratio * (this.max - this.min));
            this.setValue(newValue);
        }

        isPointOnControl(x, y) {
            const bounds = this.getBounds();
            const interactiveArea = { 
                x: bounds.handle.x, y: bounds.track.y, 
                width: bounds.handle.width, height: bounds.track.height 
            };
            return x >= interactiveArea.x && x <= interactiveArea.x + interactiveArea.width && 
                   y >= interactiveArea.y && y <= interactiveArea.y + interactiveArea.height;
        }
    }

    class ToggleSwitch {
        constructor(config) {
            this.ctx = config.ctx;
            this.label = config.label;
            this.x = config.x;
            this.y = config.y;
            this.width = 40;
            this.height = 20;
            this.getValue = config.getValue;
            this.toggle = config.toggle;
            this.font = config.font || '13px sans-serif';
        }

        getBounds() {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        }

        draw() {
            const bounds = this.getBounds();
            const value = this.getValue();
            this.ctx.save();
            this.ctx.font = this.font;
            this.ctx.fillStyle = '#abb2bf';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.label, bounds.x + bounds.width + 10, 
                              bounds.y + bounds.height / 2);
            
            this.ctx.fillStyle = value ? '#61afef' : '#4b5263';
            this.ctx.beginPath();
            this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, this.height / 2);
            this.ctx.fill();

            const handleRadius = this.height / 2 - 2;
            const handleX = value ? bounds.x + bounds.width - handleRadius - 2 : 
                                    bounds.x + handleRadius + 2;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(handleX, bounds.y + this.height / 2, handleRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        isPointOnControl(x, y) {
            const bounds = this.getBounds();
            return x >= bounds.x && x <= bounds.x + bounds.width && 
                   y >= bounds.y && y <= bounds.y + bounds.height;
        }
    }
