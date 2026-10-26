// DOMの参照と職種マスター
const getElement = id => document.getElementById(id);
// 各行は「職種名・認定資格の呼称・表示アイコン」。順番は保存データと対応する。
const LICENSE_ADDRESS = '福井県丹生郡越前町西田中13-5-1\n越前町役場';
const jobs = [
  ['漁師', 'フィッシャー', '⚓'],
  ['エンジニア', 'エンジニア', '▣'],
  ['鉄工', 'アイアンワーカー', '⚒'],
  ['陶芸', 'ポッター', '◈'],
  ['美容', 'スタイリスト', '✂'],
  ['運送', 'ドライバー', '▰'],
  ['農家', 'ファーマー', '♧'],
  ['警察', 'ポリス', '★'],
  ['消防士', 'ファイアファイター', '♨'],
  ['建設', 'ビルダー', '⌂']
];

// 編集中の状態（保存データの形式は変更しない）
let records = [];
let current = null; // 選択中の参加者ID。新規受付ではnull。
let photo = ''; // 編集中の写真のData URL。
let stream = null; // 撮影中のカメラストリーム。
let db;
let dirty = false; // 入力に未保存の変更があるか。

// IndexedDBへの読み書き
const waitForRequest = r => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error)
});
async function initializeDatabase() {
  try {
    const r = indexedDB.open('oshigoto-license-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    db = await waitForRequest(r);
    records = await waitForRequest(db.transaction('state').objectStore('state').get('participants')) || [];
    renderParticipantList()
  } catch (e) {
    showNotice('保存機能を利用できません。ブラウザの設定を確認してください。');
    getElement('save').disabled = true;
    getElement('print').disabled = true
  }
}
function saveParticipantsToDatabase() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(records, 'participants');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error)
  })
}

// 通知と画面描画
function showNotice(s) {
  getElement('notice').textContent = s;
  getElement('notice').style.display = 'block';
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => getElement('notice').style.display = 'none', 4000)
}
jobs.forEach((j, i) => {
  const l = document.createElement('label');
  l.className = 'job';
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.value = i;
  c.addEventListener('change', handleFormChange);
  l.append(c, document.createTextNode(j[2] + ' ' + j[0]));
  getElement('jobs').append(l)
});
const getSelectedJobIndexes = () => [...getElement('jobs').querySelectorAll('input:checked')].map(x => Number(x.value));
function handleFormChange() {
  dirty = true;
  renderLicense();
  getElement('save-state').textContent = '変更内容は未保存です。「受付内容を保存」で保存できます。'
}
function japaneseDate(value, era = false) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return (era && year >= 2019 ? '令和 ' + (year - 2018) : year) + '年 ' + month + '月 ' + day + '日';
}
function renderLicense() {
  getElement('lic-name').textContent = getElement('nickname').value.trim() || 'なまえ';
  getElement('lic-name').classList.toggle('long-name', getElement('lic-name').textContent.length > 8);
  getElement('lic-id').textContent = current ? 'ECH ' + getElement('date').value.replaceAll('-', '') + String(current).padStart(3, '0') : '受付前';
  const date = getElement('date').value;
  getElement('lic-date').textContent = japaneseDate(date);
  getElement('lic-issued-date').textContent = japaneseDate(date, true);
  getElement('lic-address').textContent = LICENSE_ADDRESS;
  getElement('lic-birthday').textContent = japaneseDate(getElement('birthday').value, true) + (getElement('birthday').value ? ' 生' : '年　月　日 生');
  const expiry = getElement('lic-expiry');
  expiry.replaceChildren();
  if (date) {
    const [year, month, day] = date.split('-').map(Number);
    const lastDay = new Date(year + 1, month, 0).getDate();
    const yearLabel = document.createElement('strong');
    yearLabel.textContent = year + 1;
    const era = year + 1 >= 2019 ? '（令和' + (year + 1 - 2018) + '年）' : '';
    expiry.append(yearLabel, document.createTextNode(' 年 ' + era + ' ' + month + '月 ' + Math.min(day, lastDay) + '日まで有効'));
  }
  getElement('photo').replaceChildren();
  if (photo) {
    const img = new Image();
    img.src = photo;
    img.style.objectPosition = '50% ' + getElement('pos').value + '%';
    img.style.transform = 'scale(' + getElement('zoom').value + ')';
    getElement('photo').append(img)
  } else getElement('photo').textContent = '顔写真';
  const s = getSelectedJobIndexes();
  getElement('qualifications').replaceChildren();
  // 保存済みの職種インデックスは維持し、台紙の表示順だけを合わせる。
  const qualificationRows = [[0], [1], [4], [5], [9], [2], [3], [6], [7, 8]];
  qualificationRows.forEach(indexes => {
    const earned = indexes.filter(i => s.includes(i));
    const d = document.createElement('div');
    d.className = 'qual' + (earned.length ? ' earned' : '');
    const icon = document.createElement('span');
    icon.className = 'qual-icon';
    icon.setAttribute('aria-label', 'イラスト欄');
    const label = document.createElement('span');
    label.className = 'qual-text';
    label.textContent = 'ジュニア・' + (indexes.length > 1 ? 'セーフティヒーロー' : jobs[indexes[0]][1]) + '認定';
    if (indexes.length > 1) label.title = '警察・消防は個別に認定：' + (earned.map(i => jobs[i][0]).join('・') || '未認定');
    const mark = document.createElement('b');
    mark.className = 'stamp-circle';
    mark.textContent = earned.length ? (indexes.length > 1 ? earned.map(i => jobs[i][0] === '消防士' ? '消防' : jobs[i][0]).join('・') : '認定') : '';
    mark.setAttribute('aria-label', earned.length ? label.title || '認定済み' : '未認定');
    d.append(icon, label, mark);
    getElement('qualifications').append(d);
  });
  getElement('achievement').textContent = '体験したお仕事 ' + s.length + ' / 10';
  getElement('issued').disabled = !current;
}
function renderParticipantList() {
  getElement('count').textContent = '受付 ' + records.length + ' / 50名';
  getElement('people').replaceChildren();
  const query = getElement('search').value.trim();
  records.filter(r => (String(r.id).padStart(3, '0') + ' ' + r.name).includes(query)).forEach(r => {
    const b = document.createElement('button');
    b.className = 'person' + (r.id === current ? ' active' : '');
    b.textContent = String(r.id).padStart(3, '0') + '　' + r.name + '　' + (r.issued ? '✓ 渡し済' : '未発行');
    b.onclick = () => loadParticipant(r);
    getElement('people').append(b)
  });
  getElement('new').disabled = records.length >= 50
}

// 参加者の切り替えと保存
function confirmDiscardChanges() {
  return!dirty || confirm('未保存の変更を破棄して移動しますか？')
}
function loadParticipant(r) {
  if (!confirmDiscardChanges()) return;
  current = r?.id || null;
  photo = r?.photo || '';
  getElement('nickname').value = r?.name || '';
  getElement('birthday').value = r?.birthday || '';
  getElement('date').value = r?.date || '2027-03-07';
  getElement('zoom').value = r?.zoom || 1;
  getElement('pos').value = r?.pos ?? 50;
  [...getElement('jobs').querySelectorAll('input')].forEach(c => c.checked = (r?.jobs || []).includes(Number(c.value)));
  dirty = false;
  getElement('save-state').textContent = r ? '保存済み：参加者 ' + String(r.id).padStart(3, '0') : '新規受付：写真とニックネームを登録してください。';
  renderLicense();
  renderParticipantList()
}
async function saveParticipant() {
  const name = getElement('nickname').value.trim();
  if (!name) {
    showNotice('ニックネームを入力してください');
    getElement('nickname').focus();
    return false
  }
  if (!photo) {
    showNotice('写真を登録してください');
    return false
  }
  if (!getElement('date').value) {
    showNotice('発行日を入力してください');
    return false
  }
  if (!current && records.length >= 50) {
    showNotice('先着50名に達しています');
    return false
  }
  const before = records.slice(), old = current;
  const id = current || Math.max(0, ...records.map(r => r.id)) + 1;
  const prior = records.find(r => r.id === id);
  const r = {
    id, name, photo, address: LICENSE_ADDRESS, birthday: getElement('birthday').value, date: getElement('date').value, zoom: Number(getElement('zoom').value), pos: Number(getElement('pos').value), jobs: getSelectedJobIndexes(), issued: prior?.issued || false
  };
  records = records.filter(x => x.id !== id).concat(r).sort((a, b) => a.id - b.id);
  try {
    await saveParticipantsToDatabase();
    current = id;
    dirty = false;
    renderParticipantList();
    renderLicense();
    getElement('save-state').textContent = '保存済み：参加者 ' + String(id).padStart(3, '0');
    return true
  } catch (e) {
    records = before;
    current = old;
    showNotice('保存に失敗しました。空き容量やブラウザの設定を確認してください');
    return false
  }
}

// 写真の読み込みとカメラ操作
async function setParticipantPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return showNotice('画像ファイルを選んでください');
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      photo = c.toDataURL('image/jpeg', .85)
    } finally {
      URL.revokeObjectURL(url)
    }
    getElement('zoom').value = 1;
    getElement('pos').value = 50;
    handleFormChange()
  } catch {
    showNotice('画像を読み込めません。JPEG・PNGなどでお試しください')
  }
}
function stopCamera() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  getElement('camera-dialog').close()
}
getElement('camera').onclick = async() => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user'
      }, audio: false
    });
    getElement('video').srcObject = stream;
    getElement('camera-dialog').showModal()
  } catch {
    showNotice('カメラが使えません。「写真を選ぶ」から登録してください')
  }
};
getElement('capture').onclick = () => {
  const v = getElement('video');
  if (!v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  c.toBlob(blob => setParticipantPhoto(blob), 'image/jpeg', .85);
  stopCamera()
};
getElement('close-camera').onclick = stopCamera;
getElement('camera-dialog').addEventListener('cancel', stopCamera);

// 入力・印刷・受け渡しのイベント
getElement('file').onchange = e => setParticipantPhoto(e.target.files[0]);
['nickname', 'birthday', 'date', 'zoom', 'pos'].forEach(id => getElement(id).addEventListener('input', handleFormChange));
getElement('search').oninput = renderParticipantList;
getElement('new').onclick = () => loadParticipant(null);
getElement('save').onclick = async() => {
  if (await saveParticipant())showNotice('保存しました')
};
getElement('size').onchange = () => document.body.dataset.size = getElement('size').value;
getElement('print').onclick = async() => {
  if (await saveParticipant()) {
    await Promise.all([...getElement('photo').querySelectorAll('img')].map(i => i.decode()));
    window.print()
  }
};
getElement('issued').onclick = async() => {
  if (!await saveParticipant()) return;
  const r = records.find(x => x.id === current), old = r.issued;
  r.issued = true;
  try {
    await saveParticipantsToDatabase();
    renderParticipantList();
    showNotice('受け渡し済みにしました')
  } catch {
    r.issued = old;
    showNotice('保存に失敗しました')
  }
};

// 見本データ
getElement('demo').onclick = () => {
  if (!confirmDiscardChanges()) return;
  current = null;
  getElement('nickname').value = '越前　太郎';
  getElement('birthday').value = '';
  getElement('date').value = '2027-03-07';
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 400;
  const x = c.getContext('2d');
  x.fillStyle = '#e5eef9';
  x.fillRect(0, 0, 300, 400);
  x.fillStyle = '#6388b5';
  x.beginPath();
  x.arc(150, 135, 62, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.ellipse(150, 360, 115, 140, 0, 0, Math.PI * 2);
  x.fill();
  photo = c.toDataURL();
  getElement('zoom').value = 1;
  getElement('pos').value = 50;
  [...getElement('jobs').querySelectorAll('input')].forEach((c, i) => c.checked = [0, 1, 4, 7].includes(i));
  handleFormChange();
  renderParticipantList();
  showNotice('見本を表示しました。まだ受付数には含まれません')
};

// 削除・バックアップ・復元
getElement('delete').onclick = async() => {
  if (!current) return showNotice('削除する参加者を選択してください');
  if (!confirm('この参加者の写真と情報を削除しますか？')) return;
  const old = records;
  records = records.filter(r => r.id !== current);
  try {
    await saveParticipantsToDatabase();
    dirty = false;
    loadParticipant(null);
    showNotice('削除しました')
  } catch {
    records = old;
    showNotice('削除できませんでした')
  }
};
getElement('backup').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({
    version: 1, records
  })], {
    type: 'application/json'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oshigoto-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showNotice('保存済みの参加者データを書き出しました')
};
function isValidParticipant(r) {
  return r
    && Number.isInteger(r.id) && r.id > 0
    && typeof r.name === 'string' && r.name.trim().length > 0 && r.name.length <= 16
    && (r.address === undefined || (typeof r.address === 'string' && r.address.length <= 60))
    && (r.birthday === undefined || r.birthday === '' || (typeof r.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.birthday)))
    && typeof r.photo === 'string'
    && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(r.photo)
    && r.photo.length < 2000000
    && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    && Number.isFinite(r.zoom) && r.zoom >= 1 && r.zoom <= 2.5
    && Number.isFinite(r.pos) && r.pos >= 0 && r.pos <= 100
    && Array.isArray(r.jobs)
    && r.jobs.every(i => Number.isInteger(i) && i >= 0 && i < 10)
    && typeof r.issued === 'boolean';
}
getElement('restore').onchange = async e => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100000000) throw Error();
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !Array.isArray(data.records) || data.records.length > 50 || !data.records.every(isValidParticipant) || new Set(data.records.map(r => r.id)).size !== data.records.length) throw Error();
    if (!confirm('現在の登録内容をバックアップの内容で置き換えますか？')) return;
    const old = records;
    records = data.records;
    try {
      await saveParticipantsToDatabase()
    } catch (err) {
      records = old;
      throw err
    }
    dirty = false;
    loadParticipant(null);
    showNotice('バックアップを読み込みました')
  } catch {
    showNotice('読み込みに失敗しました。バックアップ形式・保存容量を確認してください')
  } finally {
    e.target.value = ''
  }
};

// 終了時の未保存チェックと初期表示
window.addEventListener('beforeunload', e => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = ''
  }
});
renderLicense();
initializeDatabase();
