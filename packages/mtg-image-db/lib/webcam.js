let overlayCtx, fullResCtx, croppedCtx;
let videoEl, overlayEl, fullResCanvas, croppedCanvas;
let detectedCards = [];
const MIN_CARD_AREA = 4000;
let src, gray, blurred, edged, contours, hierarchy;
let animationStarted = false;
let currentStream = null;
let currentDeviceId = null;

function orderPoints(pts) {
  pts.sort((a, b) => a.x - b.x);
  let leftMost = pts.slice(0, 2);
  let rightMost = pts.slice(2, 4);
  leftMost.sort((a, b) => a.y - b.y);
  rightMost.sort((a, b) => a.y - b.y);
  return [leftMost[0], rightMost[0], rightMost[1], leftMost[1]];
}

function drawPolygon(ctx, points, color = 'lime', lineWidth = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
}

function initOpenCVMats() {
  src = new cv.Mat(overlayEl.height, overlayEl.width, cv.CV_8UC4);
  gray = new cv.Mat();
  blurred = new cv.Mat();
  edged = new cv.Mat();
  contours = new cv.MatVector();
  hierarchy = new cv.Mat();
}

function detectCards() {
  overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);
  detectedCards = [];
  overlayCtx.drawImage(videoEl, 0, 0, overlayEl.width, overlayEl.height);
  const imageData = overlayCtx.getImageData(0, 0, overlayEl.width, overlayEl.height);
  src.data.set(imageData.data);
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5,5), 0);
  cv.Canny(blurred, edged, 75, 200);
  cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, 0.02 * cv.arcLength(contour, true), true);
    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (area > MIN_CARD_AREA) {
        const pts = [];
        for (let j = 0; j < 4; j++) {
          const p = approx.intPtr(j);
          pts.push({ x: p[0], y: p[1] });
        }
        const ordered = orderPoints(pts);
        detectedCards.push(ordered);
        drawPolygon(overlayCtx, ordered);
      }
    }
    approx.delete();
    contour.delete();
  }
  requestAnimationFrame(detectCards);
}

function cropCardAt(x, y) {
  if (!detectedCards.length) return false;
  let closestIndex = -1, minDist = Infinity;
  for (let i = 0; i < detectedCards.length; i++) {
    const poly = detectedCards[i];
    let cx = 0, cy = 0;
    for (const p of poly) { cx += p.x; cy += p.y; }
    cx /= poly.length; cy /= poly.length;
    const d = Math.hypot(cx - x, cy - y);
    if (d < minDist) { minDist = d; closestIndex = i; }
  }
  if (closestIndex === -1) return false;
  const card = detectedCards[closestIndex];
  if (videoEl.videoWidth && videoEl.videoHeight) {
    fullResCanvas.width = videoEl.videoWidth;
    fullResCanvas.height = videoEl.videoHeight;
    fullResCtx.drawImage(videoEl, 0, 0, fullResCanvas.width, fullResCanvas.height);
  }
  const scaleX = fullResCanvas.width / overlayEl.width;
  const scaleY = fullResCanvas.height / overlayEl.height;
  const coords = [
    card[0].x * scaleX, card[0].y * scaleY,
    card[1].x * scaleX, card[1].y * scaleY,
    card[2].x * scaleX, card[2].y * scaleY,
    card[3].x * scaleX, card[3].y * scaleY,
  ];
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, coords);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    croppedCanvas.width, 0,
    croppedCanvas.width, croppedCanvas.height,
    0, croppedCanvas.height,
  ]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const frImage = fullResCtx.getImageData(0, 0, fullResCanvas.width, fullResCanvas.height);
  const frMat = cv.matFromImageData(frImage);
  const dst = new cv.Mat();
  cv.warpPerspective(frMat, dst, M, new cv.Size(croppedCanvas.width, croppedCanvas.height));
  const imgData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
  croppedCtx.putImageData(imgData, 0, 0);
  srcTri.delete(); dstTri.delete(); M.delete(); dst.delete(); frMat.delete();
  return true;
}

export async function setupWebcam({ video, overlay, cropped, fullRes, onCrop }) {
  videoEl = video;
  overlayEl = overlay;
  croppedCanvas = cropped;
  fullResCanvas = fullRes;
  overlayCtx = overlayEl.getContext('2d', { willReadFrequently: true });
  fullResCtx = fullResCanvas.getContext('2d', { willReadFrequently: true });
  croppedCtx = croppedCanvas.getContext('2d');

  await window.cvReadyPromise; // wait for OpenCV.js
  if (!src) initOpenCVMats();

  overlayEl.addEventListener('click', (evt) => {
    const rect = overlayEl.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const ok = cropCardAt(x, y);
    if (ok && typeof onCrop === 'function') onCrop();
  });

  return {
    async startVideo(deviceId = null) {
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
      }
      const constraints = {
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
                         : { width: { ideal: 1920 }, height: { ideal: 1080 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStream = stream;
      videoEl.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};
      currentDeviceId = settings.deviceId || deviceId;
      return new Promise((resolve) => {
        videoEl.onloadedmetadata = () => {
          videoEl.play();
          if (!animationStarted) { animationStarted = true; requestAnimationFrame(detectCards); }
          resolve();
        };
      });
    },
    async getCameras() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    },
    getCurrentDeviceId() { return currentDeviceId; },
    async populateCameraSelect(selectEl) {
      if (!selectEl) return;
      const cams = await this.getCameras();
      const prev = selectEl.value;
      selectEl.innerHTML = '';
      cams.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId; opt.text = cam.label || `Camera ${idx+1}`;
        selectEl.appendChild(opt);
      });
      if (prev && [...selectEl.options].some(o => o.value === prev)) selectEl.value = prev;
      else if (currentDeviceId && [...selectEl.options].some(o => o.value === currentDeviceId)) selectEl.value = currentDeviceId;
    },
    getCroppedCanvas() { return croppedCanvas; }
  };
}
