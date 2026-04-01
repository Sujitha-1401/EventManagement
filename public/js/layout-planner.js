class LayoutPlanner {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.items = [];
        this.draggingItem = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.canvas.width = 800;
        this.canvas.height = 600;

        this.initEvents();
        this.draw();
    }

    addItem(type) {
        const item = {
            id: Date.now(),
            type: type,
            x: 50,
            y: 50,
            w: type === 'stage' ? 200 : (type === 'table' ? 60 : 30),
            h: type === 'stage' ? 100 : (type === 'table' ? 60 : 30),
            color: type === 'stage' ? '#6c5ce7' : (type === 'table' ? '#00cec9' : '#a29bfe')
        };
        this.items.push(item);
        this.draw();
    }

    initEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        // Check items in reverse order
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (pos.x >= item.x && pos.x <= item.x + item.w &&
                pos.y >= item.y && pos.y <= item.y + item.h) {
                this.draggingItem = item;
                this.dragOffsetX = pos.x - item.x;
                this.dragOffsetY = pos.y - item.y;
                return;
            }
        }
    }

    handleMouseMove(e) {
        if (this.draggingItem) {
            const pos = this.getMousePos(e);
            this.draggingItem.x = pos.x - this.dragOffsetX;
            this.draggingItem.y = pos.y - this.dragOffsetY;
            this.draw();
        }
    }

    handleMouseUp() {
        this.draggingItem = null;
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#1e1e2f';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid
        this.ctx.strokeStyle = '#2d2d44';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.canvas.height; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Items
        this.items.forEach(item => {
            this.ctx.fillStyle = item.color;
            this.ctx.fillRect(item.x, item.y, item.w, item.h);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Inter';
            this.ctx.fillText(item.type, item.x + 5, item.y + 20);
        });
    }

    toJSON() {
        return JSON.stringify(this.items);
    }

    loadJSON(json) {
        if (json) {
            this.items = JSON.parse(json);
            this.draw();
        }
    }
}
