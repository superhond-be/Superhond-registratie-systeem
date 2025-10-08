// public/js/toast.js — Universele toastmeldingen voor Superhond 💬
export function showToast(msg, type = 'info', ms = 3000) {
  let box = document.querySelector('.toast-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast-box';
    document.body.appendChild(box);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  box.appendChild(toast);

  // Animatie + automatische verwijdering
  setTimeout(() => toast.classList.add('hide'), ms - 500);
  setTimeout(() => toast.remove(), ms);
}

// Handige alias (korter)
window.SuperhondToast = showToast;
