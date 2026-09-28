(function(){
  function $(sel){return document.querySelector(sel)}

  let token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const journalSection = $('#journal-section');
  const saveEntryBtn = $('#save-entry');
  const journalEntryEl = $('#journal-entry');
  const entriesList = $('#entries-list');
  const bgColorEl = $('#bg-color');
  const fontFamilyEl = $('#font-family');
  const fontSizeEl = $('#font-size');
  const fontColorEl = $('#font-color');
  const stickerSelectEl = $('#sticker-select');

  // Apply font settings to textarea
  function applyFontSettings() {
    journalEntryEl.style.fontFamily = fontFamilyEl.value;
    journalEntryEl.style.fontSize = fontSizeEl.value + 'px';
    journalEntryEl.style.color = fontColorEl.value;
  }

  fontFamilyEl.addEventListener('change', applyFontSettings);
  fontSizeEl.addEventListener('input', applyFontSettings);
  fontColorEl.addEventListener('input', applyFontSettings);

  applyFontSettings(); // initial

  saveEntryBtn.addEventListener('click', async () => {
    const entryText = journalEntryEl.value.trim();
    if (!entryText) {
      alert('Please write something before saving.');
      return;
    }
    const bgColor = bgColorEl.value;
    const fontFamily = fontFamilyEl.value;
    const fontSize = fontSizeEl.value;
    const fontColor = fontColorEl.value;
    const sticker = stickerSelectEl.value;
    const res = await fetch('/journal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ entryText, bgColor, sticker, fontFamily, fontSize, fontColor })
    });
    if (res.ok) {
      journalEntryEl.value = '';
      loadEntries();
    } else {
      alert('Failed to save entry');
    }
  });

  async function loadEntries() {
    const res = await fetch('/journal', {
      headers: { 'Authorization': token }
    });
    const entries = await res.json();
    entriesList.innerHTML = '';
    entries.forEach(entry => {
      const li = document.createElement('li');
      li.style.backgroundColor = entry.bgColor || '#f0f8ff';
      li.style.fontFamily = entry.fontFamily || 'Nunito';
      li.style.fontSize = (entry.fontSize || 16) + 'px';
      li.style.color = entry.fontColor || '#333';
      li.innerHTML = `${entry.sticker ? entry.sticker : ''} ${new Date(entry.createdAt).toLocaleDateString()}: ${entry.entryText}`;
      entriesList.appendChild(li);
    });
  }

  loadEntries();
})();