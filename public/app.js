// Client-side logic for album submission form
// - dynamic track entries
// - validates cover size minimum 3000x3000
// - bundles metadata + files into FormData and POSTs to /submit
// - maps each track to selected audio file by file name

(function () {
  const el = (s) => document.querySelector(s);
  const elAll = (s) => Array.from(document.querySelectorAll(s));
  const tracksContainer = el('#tracks-container');
  const addTrackBtn = el('#add-track');
  const removeTrackBtn = el('#remove-track');
  const numSongsInput = el('#numSongs');
  const coverInput = el('#cover');
  const coverInfo = el('#cover-info');
  const form = el('#album-form');
  const msg = el('#form-message');

  let trackCount = parseInt(numSongsInput.value || '1', 10);

  function createTrack(index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.dataset.index = index;
    wrapper.innerHTML = `
      <label>Track ${index + 1}</label>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <input type="text" class="track-title" placeholder="Song Title" style="flex:2; min-width:160px" required>
        <input type="text" class="track-featured" placeholder="Featured Artists (optional)" style="flex:1; min-width:140px">
        <label style="display:inline-flex; align-items:center; gap:6px; margin-right:6px;">
          <input type="checkbox" class="track-explicit"> Explicit
        </label>
        <input type="file" accept="audio/*" class="track-file" style="min-width:200px">
      </div>
    `;
    return wrapper;
  }

  function renderTracks(count) {
    tracksContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
      tracksContainer.appendChild(createTrack(i));
    }
  }

  function showMessage(text, type = '') {
    msg.classList.remove('success', 'error');
    if (type) msg.classList.add(type);
    msg.textContent = text;
    if (!text) msg.className = 'message';
  }

  // Cover image dimension check
  coverInput.addEventListener('change', () => {
    const f = coverInput.files && coverInput.files[0];
    if (!f) {
      coverInfo.textContent = '';
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = function () {
      if (img.naturalWidth >= 3000 && img.naturalHeight >= 3000) {
        coverInfo.textContent = `OK — ${img.naturalWidth} x ${img.naturalHeight}`;
        coverInfo.classList.remove('error');
      } else {
        coverInfo.textContent = `Image too small: ${img.naturalWidth} x ${img.naturalHeight} — minimum 3000x3000`;
        coverInfo.classList.add('error');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  // Track buttons
  addTrackBtn.addEventListener('click', () => {
    trackCount++;
    numSongsInput.value = trackCount;
    renderTracks(trackCount);
  });
  removeTrackBtn.addEventListener('click', () => {
    if (trackCount <= 1) return;
    trackCount--;
    numSongsInput.value = trackCount;
    renderTracks(trackCount);
  });

  numSongsInput.addEventListener('change', () => {
    const v = parseInt(numSongsInput.value || '1', 10);
    if (isNaN(v) || v < 1) {
      numSongsInput.value = trackCount;
      return;
    }
    trackCount = v;
    renderTracks(trackCount);
  });

  // initial tracks
  renderTracks(trackCount);

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage('Submitting...', '');

    // validate cover
    const coverFile = coverInput.files && coverInput.files[0];
    if (!coverFile) {
      showMessage('Please select an album cover', 'error');
      return;
    }

    // Quick client-side dimension recheck
    const ok = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(coverFile);
      img.onload = function () {
        resolve(img.naturalWidth >= 3000 && img.naturalHeight >= 3000);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
    if (!ok) {
      showMessage('Cover image must be at least 3000x3000', 'error');
      return;
    }

    // collect platform selections from checkboxes
    const sel = Array.from(document.querySelectorAll('input[name="platforms"]:checked')).map(i => i.value.trim());

    // tracks
    const trackEls = Array.from(tracksContainer.querySelectorAll('.field'));
    const tracks = trackEls.map((f, idx) => {
      const title = f.querySelector('.track-title').value.trim();
      const featured = f.querySelector('.track-featured').value.trim();
      const explicit = !!f.querySelector('.track-explicit').checked; // boolean
      const fileInput = f.querySelector('.track-file');
      const file = fileInput.files && fileInput.files[0];
      return {
        index: idx + 1,
        title,
        featured,
        explicit,
        fileName: file ? file.name : null
      };
    });

    // ensure we have at least one title and matching audio files
    for (let i = 0; i < tracks.length; i++) {
      if (!tracks[i].title) {
        showMessage(`Please enter a title for track ${i + 1}`, 'error');
        return;
      }
    }

    const fd = new FormData();
    fd.append('albumName', el('#albumName').value.trim());
    fd.append('releaseDate', el('#releaseDate').value);
    fd.append('platforms', sel.join(','));
    fd.append('numSongs', String(trackCount));
    fd.append('tracks', JSON.stringify(tracks));

    // append cover
    fd.append('cover', coverFile, coverFile.name);

    // append each audio file (field name trackFiles)
    trackEls.forEach((f) => {
      const fileInput = f.querySelector('.track-file');
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        fd.append('trackFiles', file, file.name);
      }
    });

    // submit
    try {
      const resp = await fetch('/submit', {
        method: 'POST',
        body: fd
      });
      const body = await resp.json();
      if (!resp.ok) {
        showMessage(body.error || 'Submission failed', 'error');
        return;
      }
      showMessage('Submission successful — ID: ' + body.id, 'success');
      form.reset();
      renderTracks(1);
      trackCount = 1;
      numSongsInput.value = '1';
      coverInfo.textContent = '';
    } catch (err) {
      console.error(err);
      showMessage('Network error', 'error');
    }
  });

})();