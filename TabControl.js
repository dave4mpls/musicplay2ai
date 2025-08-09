/**
 * TabControl Component
 * A horizontal tab control to organize settings in the piano keyboard drawer.
 * Expectations:
 *  - The active tab should be the same color as the drawer, and the inactive tabs should be darker.
 *  - The background of the control that does not involve a tab should be white.
 */
class TabControl {
    constructor(config) {
        this.ctx = config.ctx;
        this.tabs = config.tabs; // Array of { label: string, id: string }
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.height = config.height || 24;
        this.font = config.font || '10px sans-serif';
        this.activeTabId = config.activeTabId || this.tabs[0].id;
    }

    draw() {
        this.ctx.save();
        this.ctx.font = this.font;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 1;
        const radius = 5;

        // --- 1. Calculate tab dimensions and find the active tab ---
        let currentX = this.x;
        let activeTab = null;
        for (const tab of this.tabs) {
            const tabWidth = this.ctx.measureText(tab.label).width + 20;
            tab.x = currentX;
            tab.width = tabWidth;
            currentX += tabWidth;
            if (tab.id === this.activeTabId) {
                activeTab = tab;
            }
        }

        // --- 2. Draw unselected tabs ---
        for (const tab of this.tabs) {
            if (tab.id === this.activeTabId) continue;

            this.ctx.beginPath();
            this.ctx.moveTo(tab.x, tab.y + this.height);
            this.ctx.lineTo(tab.x, tab.y + radius);
            this.ctx.arcTo(tab.x, tab.y, tab.x + radius, tab.y, radius);
            this.ctx.lineTo(tab.x + tab.width - radius, tab.y);
            this.ctx.arcTo(tab.x + tab.width, tab.y, tab.x + tab.width, tab.y + radius, radius);
            this.ctx.lineTo(tab.x + tab.width, tab.y + this.height);
            this.ctx.closePath(); // Close path for a full border

            this.ctx.fillStyle = '#dddddd';
            this.ctx.fill();
            this.ctx.strokeStyle = '#bbbbbb';
            this.ctx.stroke();
        }

        // --- 3. Draw the main horizontal line, leaving a gap for the active tab ---
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#bbbbbb';
        this.ctx.moveTo(0, this.y + this.height);
        if (activeTab) {
            this.ctx.lineTo(activeTab.x, this.y + this.height);
            this.ctx.moveTo(activeTab.x + activeTab.width, this.y + this.height);
        }
        this.ctx.lineTo(this.ctx.canvas.width, this.y + this.height);
        this.ctx.stroke();

        // --- 4. Draw the active tab so it appears on top and open ---
        if (activeTab) {
            this.ctx.beginPath();
            this.ctx.moveTo(activeTab.x, activeTab.y + this.height);
            this.ctx.lineTo(activeTab.x, activeTab.y + radius);
            this.ctx.arcTo(activeTab.x, activeTab.y, activeTab.x + radius, activeTab.y, radius);
            this.ctx.lineTo(activeTab.x + activeTab.width - radius, activeTab.y);
            this.ctx.arcTo(activeTab.x + activeTab.width, activeTab.y, activeTab.x + activeTab.width, activeTab.y + radius, radius);
            this.ctx.lineTo(activeTab.x + activeTab.width, activeTab.y + this.height);

            this.ctx.fillStyle = '#ffffff'; // White background
            this.ctx.fill();
            this.ctx.strokeStyle = '#bbbbbb';
            this.ctx.stroke();
        }

        // --- 5. Draw all tab labels on top ---
        for (const tab of this.tabs) {
            this.ctx.fillStyle = '#333';
            this.ctx.fillText(tab.label, tab.x + tab.width / 2, this.y + this.height / 2);
        }
        this.ctx.restore();
    }

    setActiveTab(tabId) {
        this.activeTabId = tabId;
    }

    getTabAt(x, y) {
        for (const tab of this.tabs) {
            if (x >= tab.x && x <= tab.x + tab.width && y >= this.y && y <= this.y + this.height) {
                return tab;
            }
        }
        return null;
    }
}
export { TabControl };