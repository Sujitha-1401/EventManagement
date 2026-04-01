class Calendar {
    constructor(elementId, events = []) {
        this.element = document.getElementById(elementId);
        this.events = events;
        this.today = new Date();
        this.currentMonth = this.today.getMonth();
        this.currentYear = this.today.getFullYear();
        this.months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        this.init();
    }

    init() {
        this.render();
    }

    render() {
        const firstDay = new Date(this.currentYear, this.currentMonth).getDay();
        const daysInMonth = 32 - new Date(this.currentYear, this.currentMonth, 32).getDate();

        let table = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0">${this.months[this.currentMonth]} ${this.currentYear}</h3>
                <div>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem" onclick="calendar.prev()">&lt;</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem" onclick="calendar.next()">&gt;</button>
                </div>
            </div>
            <table style="width:100%; text-align:center; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>S</th><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
        `;

        let date = 1;
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay) {
                    table += '<td style="padding:10px;"></td>';
                } else if (date > daysInMonth) {
                    break;
                } else {
                    const fullDate = new Date(this.currentYear, this.currentMonth, date);
                    let className = '';
                    let dot = '';

                    // Check for events
                    const hasEvent = this.events.some(e => {
                        const eDate = new Date(e.date);
                        return eDate.getDate() === date &&
                            eDate.getMonth() === this.currentMonth &&
                            eDate.getFullYear() === this.currentYear;
                    });

                    if (hasEvent) {
                        dot = '<div style="width:6px; height:6px; background:#e17055; border-radius:50%; margin: 2px auto 0;"></div>';
                    }

                    if (date === this.today.getDate() && this.currentMonth === this.today.getMonth() && this.currentYear === this.today.getFullYear()) {
                        className = 'style="font-weight:bold; color:var(--primary-color);"';
                    }

                    table += `<td style="padding:10px; cursor:pointer;" ${className}>${date}${dot}</td>`;
                    date++;
                }
            }
            if (date > daysInMonth) {
                break;
            }
            table += '</tr><tr>';
        }
        table += '</tr></tbody></table>';

        this.element.innerHTML = table;
    }

    next() {
        this.currentYear = (this.currentMonth === 11) ? this.currentYear + 1 : this.currentYear;
        this.currentMonth = (this.currentMonth + 1) % 12;
        this.render();
    }

    prev() {
        this.currentYear = (this.currentMonth === 0) ? this.currentYear - 1 : this.currentYear;
        this.currentMonth = (this.currentMonth === 0) ? 11 : this.currentMonth - 1;
        this.render();
    }
}
