(function () {
  const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }

  const recognizedText = document.getElementById('recognizedText');
  const speakBtn = document.getElementById('speakBtn');
  const vibrateBtn = document.getElementById('vibrateBtn');
  const gpsBtn = document.getElementById('gpsBtn');
  const cameraEl = document.getElementById('camera');
  const demoButtons = document.querySelectorAll('.camera-demo-btn');
  const permissionModal = document.getElementById('cameraPermissionModal');
  const permissionBtn = document.getElementById('cameraPermissionBtn');
  const modalCloseBtn = document.getElementById('cameraModalCloseBtn');
  let currentText = 'Waiting...';

  function setRecognized(text) {
    currentText = text || 'Waiting...';
    if (recognizedText) {
      recognizedText.textContent = currentText;
    }
  }

  function closeModal() {
    permissionModal?.classList.remove('is-visible');
  }

  function openModal() {
    permissionModal?.classList.add('is-visible');
  }

  demoButtons.forEach((btn) => btn.addEventListener('click', () => setRecognized(btn.dataset.text)));

  speakBtn?.addEventListener('click', () => {
    const utterance = new SpeechSynthesisUtterance(currentText);
    speechSynthesis.speak(utterance);
  });

  vibrateBtn?.addEventListener('click', () => {
    if (navigator.vibrate) {
      navigator.vibrate([120, 40, 120]);
    }
  });

  gpsBtn?.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      setRecognized('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const payload = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setRecognized(`SOS queued for ${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`);
    }, () => {
      setRecognized('Location permission denied');
    });
  });

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      if (cameraEl) {
        cameraEl.srcObject = stream;
      }

      closeModal();
      setRecognized('Camera live. Recognition is ready.');
    } catch (error) {
      setRecognized('Camera access denied. Use gesture buttons for demo.');
      openModal();
    }
  }

  permissionBtn?.addEventListener('click', () => {
    startCamera();
  });

  modalCloseBtn?.addEventListener('click', () => {
    closeModal();
    setRecognized('Demo mode active. Use gesture buttons below.');
  });

  openModal();
})();
