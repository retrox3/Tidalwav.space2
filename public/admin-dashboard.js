// externalized admin dashboard script (moved from admin-dashboard.html)
async function fetchSubs() {
  const res = await fetch('/admin/api/submissions');
  return res.json();
}

function el(q) { return document.querySelector(q); }
function formatDate(d) { return new Date(d).toLocaleString(); }

async function init() {
  const listEl = el('#submissions-list');
  const detailContent = el('#detail-content');
  const detailEmpty = el('#detail-empty');
  const detailTitle = el('#detail-title');
  const detailMeta = el('#detail-meta');
  const detailFiles = el('#detail-files');
  const approveBtn = el('#approve-btn');
  const rejectBtn = el('#reject-btn');
  const downloadLink = el('#download-link');
  const adminNote = el('#admin-note');
  const detailMessage = el('#detail-message');

  let subs = await fetchSubs();
  function renderList() {
    listEl.innerHTML = '<h3 style="margin-top:0">Submissions</h3>';
    subs.forEach(s => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = '<strong>' + (s.albumName || s.id) + '</strong><div class="muted small">' + s.status + ' • ' + formatDate(s.createdAt) + '</div>';
      div.addEventListener('click', () => showDetail(s.id));
      listEl.appendChild(div);
    });
  }
  renderList();

  async function showDetail(id) {
    const res = await fetch('/admin/api/submissions/' + id);
    const s = await res.json();
    detailTitle.textContent = s.albumName || s.id;
    detailMeta.textContent = 'Released: ' + (s.releaseDate || '—') + ' • Platforms: ' + (s.platforms.join(', ') || '—') + ' • Status: ' + s.status;
    detailFiles.innerHTML = '';

    // cover preview
    if (s.cover) {
      const coverUrl = '/uploads/' + s.cover;
      const img = document.createElement('img');
      img.src = coverUrl;
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      img.style.marginBottom = '8px';
      detailFiles.appendChild(img);
    }

    // tracks list with audio elements (if available)
    s.tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.style.marginBottom = '8px';
      const explicitText = (t.explicit === true || t.explicit === 'true') ? 'Explicit' : 'Clean';
      const name = document.createElement('div');
      name.innerHTML = '<strong>' + (idx+1) + '. ' + (t.title || 'Untitled') + '</strong> <span class="muted small">(' + explicitText + ')</span>';
      row.appendChild(name);
      if (t.file) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = '/uploads/' + t.file;
        audio.style.width = '100%';
        row.appendChild(audio);
      } else {
        const missing = document.createElement('div');
        missing.className = 'muted small';
        missing.textContent = 'Audio file not found for this track';
        row.appendChild(missing);
      }
      detailFiles.appendChild(row);
    });

    // wire approve/download/reject
    approveBtn.onclick = async () => {
      detailMessage.textContent = 'Approving...';
      const r = await fetch('/admin/api/submissions/' + s.id + '/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: adminNote.value || null })
      });
      const b = await r.json();
      if (r.ok) {
        detailMessage.textContent = 'Approved';
        subs = await fetchSubs(); renderList();
        showDetail(s.id);
      } else {
        detailMessage.textContent = b.error || 'Error';
      }
    };
    rejectBtn.onclick = async () => {
      detailMessage.textContent = 'Rejecting...';
      const r = await fetch('/admin/api/submissions/' + s.id + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: adminNote.value || null })
      });
      const b = await r.json();
      if (r.ok) {
        detailMessage.textContent = 'Rejected';
        subs = await fetchSubs(); renderList();
        showDetail(s.id);
      } else {
        detailMessage.textContent = b.error || 'Error';
      }
    };
    downloadLink.href = '/admin/download/' + s.id;
    detailEmpty.style.display = 'none';
    detailContent.style.display = '';
  }
}

init().catch(e => console.error(e));