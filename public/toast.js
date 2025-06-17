// toast.js
class Toast {
    constructor() {
        if (!Toast.instance) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container';
            document.body.appendChild(this.toastContainer);
            Toast.instance = this;
        }
        return Toast.instance;
    }

    show(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = document.createElement('span');
        icon.className = `toast-icon toast-icon-${type}`;
        icon.innerHTML = this.getIcon(type);

        const text = document.createElement('span');
        text.className = 'toast-text';
        text.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(text);
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    getIcon(type) {
        const icons = {
            success: '☑️', // ✅Checkmark
            error: '❌',   // Cross
            warning: '⚠️', // Warning
            info: 'ℹ️'     // Info
        };
        return icons[type] || 'ℹ️';
    }

    success(message, duration = 5000) {
        this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        this.show(message, 'info', duration);
    }
}

const toast = new Toast();
export default toast;
