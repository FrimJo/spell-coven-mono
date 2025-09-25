import { loadEmbeddingsAndMeta, loadModel, embedFromImageElement, embedFromCanvas, topK } from './search.js';
import { setupWebcam } from './webcam.js';

function renderResults(results) {
  const resDiv = document.getElementById('results');
  resDiv.innerHTML = '';
  results.forEach(r => {
    const cardUrl = (r.card_url) || (r.image_url ? r.image_url.replace('/art_crop/', '/normal/') : null);
    const scry = r.scryfall_uri || null;
    const card = document.createElement('div');
    card.innerHTML = `
      <b>${r.name}</b> [${r.set}] (score ${r.score.toFixed(3)})
      ${scry ? ` — <a href="${scry}" target="_blank" rel="noopener">Scryfall</a>` : ""}
      <br>
      ${cardUrl ? `<img src="${cardUrl}" width="240" loading="lazy" decoding="async">` : ""}
    `;
    resDiv.appendChild(card);
  });
}

function setSpinner(text, show=true) {
  const spinner = document.getElementById('spinner');
  spinner.style.display = show ? 'block' : 'none';
  if (text) spinner.textContent = text;
}

function setCamStatus(text) {
  const el = document.getElementById('camStatus');
  if (el) el.textContent = text || '';
}

async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const imgEl = document.getElementById('queryImg');
  imgEl.onload = async () => {
    try {
      setSpinner('Embedding image…', true);
      const q = await embedFromImageElement(imgEl);
      setSpinner('Searching…', true);
      const results = topK(q, 5);
      renderResults(results);
    } catch (err) {
      console.error('Embedding/search failed:', err);
      setSpinner('Failed to embed/search (see console).', true);
    } finally {
      setSpinner('', false);
    }
  };
  imgEl.src = URL.createObjectURL(file);
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadEmbeddingsAndMeta();
  await loadModel(document.getElementById('spinner'));
  document.getElementById('fileInput').disabled = false;
  document.getElementById('fileInput').addEventListener('change', onFileChange);

  // Webcam setup
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const cropped = document.getElementById('cropped');
  const fullRes = document.getElementById('fullRes');

  const webcam = await setupWebcam({
    video, overlay, cropped, fullRes,
    onCrop: () => {
      const btn = document.getElementById('searchCroppedBtn');
      if (btn) btn.disabled = false;
    }
  });

  setCamStatus('OpenCV ready');

  const cameraSelect = document.getElementById('cameraSelect');
  document.getElementById('startCamBtn').addEventListener('click', async () => {
    await webcam.startVideo(cameraSelect?.value || null);
    await webcam.populateCameraSelect(cameraSelect);
    setCamStatus('Webcam started');
  });
  cameraSelect.addEventListener('change', async (e) => {
    const id = e.target.value;
    await webcam.startVideo(id || null);
    setCamStatus('Webcam started');
  });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      await webcam.populateCameraSelect(cameraSelect);
    });
  }

  document.getElementById('searchCroppedBtn').addEventListener('click', async () => {
    try {
      setSpinner('Embedding cropped…', true);
      const q = await embedFromCanvas(cropped);
      setSpinner('Searching…', true);
      const results = topK(q, 5);
      renderResults(results);
    } catch (err) {
      console.error('Embedding/search failed:', err);
      setSpinner('Failed to embed/search (see console).', true);
    } finally {
      setSpinner('', false);
    }
  });
});
