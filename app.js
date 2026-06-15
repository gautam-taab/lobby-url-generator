const STORAGE_KEY = 'lobbyUrlConfig'

const defaults = {
  globalDomain: 'taabplay.com',
  globalRedirectUrl: 'https://taabplay.com',
  localUrl: 'localhost:5173',
  games: [
    { name: 'wicketcrash', gameId: '726418392' },
    { name: 'dicemaster', gameId: '519372845' },
    { name: 'soccercrash', gameId: '604839217' },
    { name: 'zombiecrash', gameId: '710439218' },
    { name: 'dragondice', gameId: '710439217' },
    { name: 'horsecrash', gameId: '710439219' },
    { name: 'formulaone', gameId: '710439220' },
  ],
  envs: [
    { name: 'dev', suffix: '-dev', domain: '' },
    { name: 'staging', suffix: '-staging', domain: '' },
    { name: 'production', suffix: '', domain: '' },
  ],
  entries: [],
}

let state = null

function migrateEntry(e) {
  if (e.token !== undefined && !e.tokens) {
    e.tokens = [{ playerName: '', token: e.token }]
    delete e.token
  }
  if (!e.tokens) e.tokens = []
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      state = JSON.parse(raw)
      for (const k of Object.keys(defaults)) {
        if (!(k in state)) state[k] = JSON.parse(JSON.stringify(defaults[k]))
      }
      state.entries.forEach(migrateEntry)
      return
    }
  } catch {}
  state = JSON.parse(JSON.stringify(defaults))
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function setState(fn) {
  fn(state)
  saveState()
  render()
}

function uid() {
  return crypto.randomUUID()
}

function buildUrl(game, env, entry, token) {
  const domain = env.domain || state.globalDomain
  const host = env.suffix
    ? `${game.name}${env.suffix}.${domain}`
    : `${game.name}.${domain}`
  const params = new URLSearchParams({
    gameId: game.gameId,
    clientId: entry.clientId,
    token: token.token,
    redirectUrl: entry.redirectUrl || state.globalRedirectUrl,
  })
  return `https://${host}/?${params}`
}

function buildLocalUrl(game, entry, token) {
  const host = state.localUrl.replace(/^https?:\/\//, '')
  const params = new URLSearchParams({
    gameId: game.gameId,
    clientId: entry.clientId,
    token: token.token,
    redirectUrl: entry.redirectUrl || state.globalRedirectUrl,
  })
  return `http://${host}/?${params}`
}

function esc(s) {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

// --- copy toast ---

let toastTimer = null

function showToast(msg) {
  let toast = document.getElementById('toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'toast'
    toast.className = 'copy-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = msg
  toast.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 1500)
}

function copyUrl(url) {
  navigator.clipboard.writeText(url).then(() => showToast('Copied!')).catch(() => showToast('Failed to copy'))
}

// --- import / export ---

function exportSettings() {
  const payload = { globalDomain: state.globalDomain, globalRedirectUrl: state.globalRedirectUrl, localUrl: state.localUrl, games: state.games, envs: state.envs }
  downloadJson(payload, 'lobby-settings.json')
}

function importSettings(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result)
      if (data.games && data.envs) {
        setState(s => {
          s.globalDomain = data.globalDomain ?? defaults.globalDomain
          s.globalRedirectUrl = data.globalRedirectUrl ?? ''
          s.localUrl = data.localUrl ?? ''
          s.games = data.games
          s.envs = data.envs
        })
        showToast('Settings imported!')
      } else {
        showToast('Invalid settings file')
      }
    } catch {
      showToast('Invalid JSON file')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function exportEntries() {
  downloadJson(state.entries, 'lobby-entries.json')
}

function importEntries(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result)
      if (Array.isArray(data)) {
        data.forEach(migrateEntry)
        setState(s => { s.entries = data })
        showToast('Entries imported!')
      } else if (data.entries) {
        data.entries.forEach(migrateEntry)
        setState(s => { s.entries = data.entries })
        showToast('Entries imported!')
      } else {
        showToast('Invalid entries file')
      }
    } catch {
      showToast('Invalid JSON file')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function downloadJson(obj, filename) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace('.json', `-${ts}.json`)
  a.click()
  URL.revokeObjectURL(url)
}

// --- rendering ---

let collapseState = {}

function toggleCollapsed(header) {
  header.classList.toggle('collapsed')
  persistCollapseState()
}

function saveCollapseState() {
  collapseState = {}
  document.querySelectorAll('[data-collapse-id]').forEach(el => {
    const header = el.querySelector('.collapsible-header')
    if (header) collapseState[el.dataset.collapseId] = header.classList.contains('collapsed')
  })
}

function persistCollapseState() {
  const s = {}
  document.querySelectorAll('[data-collapse-id]').forEach(el => {
    const header = el.querySelector('.collapsible-header')
    if (header) s[el.dataset.collapseId] = header.classList.contains('collapsed')
  })
  try { localStorage.setItem('lobbyUrlCollapse', JSON.stringify(s)) } catch {}
}

function restoreCollapseState() {
  if (Object.keys(collapseState).length === 0) {
    try {
      const saved = localStorage.getItem('lobbyUrlCollapse')
      if (saved) collapseState = JSON.parse(saved)
    } catch {}
  }
  Object.entries(collapseState).forEach(([id, collapsed]) => {
    const el = document.querySelector(`[data-collapse-id="${CSS.escape(id)}"]`)
    if (el) {
      const header = el.querySelector('.collapsible-header')
      if (header) header.classList.toggle('collapsed', collapsed)
    }
  })
  persistCollapseState()
}

function render() {
  saveCollapseState()
  const app = document.getElementById('app')
  app.innerHTML = ''

  app.appendChild(renderBar())

  const layout = document.createElement('div')
  layout.className = 'layout'

  const sidebar = document.createElement('div')
  sidebar.className = 'sidebar'
  sidebar.appendChild(renderSidebarSection('Global Settings', renderSettingsContent(), false))
  sidebar.appendChild(renderSidebarSection('Games', renderGamesContent(), false))
  sidebar.appendChild(renderSidebarSection('Environments', renderEnvsContent(), false))

  const main = document.createElement('div')
  main.className = 'main'

  const entriesSection = document.createElement('div')
  entriesSection.className = 'section'
  const h2 = document.createElement('h2')
  h2.textContent = 'Entries'
  entriesSection.appendChild(h2)
  entriesSection.appendChild(renderEntriesContent())
  main.appendChild(entriesSection)

  layout.append(sidebar, main)
  app.appendChild(layout)
  setInputTitles()
  restoreCollapseState()
}

function setInputTitles() {
  document.querySelectorAll('input').forEach(inp => {
    if (inp.title) return
    if (inp.placeholder) { inp.title = inp.placeholder; return }
    const td = inp.closest('td')
    if (td) {
      const ths = td.closest('table')?.querySelectorAll('th')
      if (ths) {
        const idx = Array.from(td.parentElement.children).indexOf(td)
        const th = ths[idx]
        if (th) { inp.title = th.textContent.trim(); return }
      }
    }
    const label = inp.closest('.field')?.querySelector('label')
    if (label) { inp.title = label.textContent.trim(); return }
  })
}

function renderBar() {
  const bar = document.createElement('div')
  bar.className = 'bar'

  const expSet = document.createElement('button')
  expSet.className = 'btn'
  expSet.textContent = 'Export Settings'
  expSet.onclick = exportSettings

  const impSet = document.createElement('button')
  impSet.className = 'btn'
  impSet.textContent = 'Import Settings'
  const impSetInput = document.createElement('input')
  impSetInput.type = 'file'
  impSetInput.accept = '.json'
  impSetInput.style.display = 'none'
  impSetInput.onchange = importSettings
  impSet.onclick = () => impSetInput.click()

  const expEnt = document.createElement('button')
  expEnt.className = 'btn'
  expEnt.textContent = 'Export Entries'
  expEnt.onclick = exportEntries

  const impEnt = document.createElement('button')
  impEnt.className = 'btn'
  impEnt.textContent = 'Import Entries'
  const impEntInput = document.createElement('input')
  impEntInput.type = 'file'
  impEntInput.accept = '.json'
  impEntInput.style.display = 'none'
  impEntInput.onchange = importEntries
  impEnt.onclick = () => impEntInput.click()

  const resetBtn = document.createElement('button')
  resetBtn.className = 'btn'
  resetBtn.textContent = 'Reset Defaults'
  resetBtn.onclick = () => {
    if (!confirm('Reset settings (games, envs) to defaults? Entries will be kept.')) return
    const def = JSON.parse(JSON.stringify(defaults))
    setState(s => {
      s.globalDomain = def.globalDomain
      s.globalRedirectUrl = def.globalRedirectUrl
      s.games = def.games
      s.envs = def.envs
    })
  }

  const clearBtn = document.createElement('button')
  clearBtn.className = 'btn btn-danger'
  clearBtn.textContent = 'Clear All Data'
  clearBtn.onclick = () => {
    if (!confirm('Delete all data from local storage and reload?')) return
    localStorage.removeItem(STORAGE_KEY)
    location.reload()
  }

  bar.append(expSet, impSet, impSetInput, expEnt, impEnt, impEntInput, resetBtn, clearBtn)
  return bar
}

function renderSidebarSection(title, content, startCollapsed = true) {
  const wrapper = document.createElement('div')
  wrapper.className = 'sidebar-section'
  wrapper.dataset.collapseId = 'sidebar-' + title

  const header = document.createElement('div')
  header.className = `collapsible-header${startCollapsed ? ' collapsed' : ''}`
  header.innerHTML = `<span class="caret">▼</span> ${esc(title)}`

  const body = document.createElement('div')
  body.className = 'collapsible-body'
  body.appendChild(content)

  header.onclick = () => toggleCollapsed(header)

  wrapper.append(header, body)
  return wrapper
}

// --- settings ---

function renderSettingsContent() {
  const container = document.createElement('div')

  const fieldsDiv = document.createElement('div')
  fieldsDiv.className = 'entry-fields'

  const domField = document.createElement('div')
  domField.className = 'field'
  const domLabel = document.createElement('label')
  domLabel.textContent = 'Default Domain'
  const domInput = document.createElement('input')
  domInput.type = 'text'
  domInput.value = state.globalDomain
  domInput.title = 'Default Domain'
  domInput.oninput = () => {
    state.globalDomain = domInput.value
    saveState()
    syncUrls()
    syncPlaceholders()
  }
  domField.append(domLabel, domInput)

  const redirField = document.createElement('div')
  redirField.className = 'field'
  const redirLabel = document.createElement('label')
  redirLabel.textContent = 'Default Redirect URL'
  const redirInput = document.createElement('input')
  redirInput.type = 'text'
  redirInput.value = state.globalRedirectUrl
  redirInput.title = 'Default Redirect URL'
  redirInput.oninput = () => {
    state.globalRedirectUrl = redirInput.value
    saveState()
    syncUrls()
    syncPlaceholders()
  }
  redirField.append(redirLabel, redirInput)

  const localField = document.createElement('div')
  localField.className = 'field'
  const localLabel = document.createElement('label')
  localLabel.textContent = 'Local Dev URL'
  const localInput = document.createElement('input')
  localInput.type = 'text'
  localInput.value = state.localUrl
  localInput.title = 'Local Dev URL'
  localInput.placeholder = 'localhost:5173'
  localInput.oninput = () => {
    const wasEmpty = !state.localUrl
    state.localUrl = localInput.value
    saveState()
    if (wasEmpty !== !state.localUrl) {
      toggleLocalGroups()
    } else {
      syncUrls()
    }
  }
  localField.append(localLabel, localInput)

  fieldsDiv.append(domField, redirField, localField)
  container.appendChild(fieldsDiv)

  return container
}

// --- games ---

function renderGamesContent() {
  const container = document.createElement('div')

  const addForm = document.createElement('form')
  addForm.style.display = 'flex'
  addForm.style.gap = '8px'
  addForm.style.marginBottom = '12px'

  const nameInput = document.createElement('input')
  nameInput.placeholder = 'Game Name'
  nameInput.style.flex = '1'

  const gidInput = document.createElement('input')
  gidInput.placeholder = 'Game ID'
  gidInput.style.flex = '1'

  const addBtn = document.createElement('button')
  addBtn.className = 'btn btn-primary'
  addBtn.textContent = 'Add'
  addForm.onsubmit = (e) => {
    e.preventDefault()
    const name = nameInput.value.trim()
    const gameId = gidInput.value.trim()
    if (!name && !gameId) return
    setState(s => { s.games.push({ name, gameId }) })
    nameInput.value = ''
    gidInput.value = ''
    nameInput.focus()
  }

  addForm.append(nameInput, gidInput, addBtn)
  container.appendChild(addForm)

  if (state.games.length === 0) {
    container.appendChild(emptyMsg('No games configured.'))
  } else {
    const table = document.createElement('table')
    table.innerHTML = '<thead><tr><th>Game Name</th><th>Game ID</th><th></th></tr></thead>'
    const tbody = document.createElement('tbody')

    state.games.forEach((game, i) => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td><input type="text" value="${esc(game.name)}" data-idx="${i}" data-field="name" data-type="game"></td>
        <td><input type="text" value="${esc(game.gameId)}" data-idx="${i}" data-field="gameId" data-type="game"></td>
        <td><button class="btn-icon" title="Delete">✕</button></td>
      `
      tr.querySelectorAll('input').forEach(inp => {
        inp.oninput = () => {
          state.games[+inp.dataset.idx][inp.dataset.field] = inp.value
          saveState()
          syncUrls()
        }
      })
      tr.querySelector('.btn-icon').onclick = () => {
        setState(s => { s.games.splice(i, 1) })
      }
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    container.appendChild(table)
  }

  return container
}

// --- envs ---

function renderEnvsContent() {
  const container = document.createElement('div')

  const addForm = document.createElement('form')
  addForm.style.display = 'flex'
  addForm.style.gap = '8px'
  addForm.style.marginBottom = '12px'

  const nameInput = document.createElement('input')
  nameInput.placeholder = 'Name'
  nameInput.style.flex = '1'

  const prefixInput = document.createElement('input')
  prefixInput.placeholder = 'Suffix'
  prefixInput.style.flex = '1'

  const domainInput = document.createElement('input')
  domainInput.id = 'envDomainAdd'
  domainInput.placeholder = state.globalDomain || 'domain'
  domainInput.style.flex = '1'

  const addBtn = document.createElement('button')
  addBtn.className = 'btn btn-primary'
  addBtn.textContent = 'Add'
  addForm.onsubmit = (e) => {
    e.preventDefault()
    const name = nameInput.value.trim()
    const prefix = prefixInput.value.trim()
    const domain = domainInput.value.trim()
    if (!name) return
    setState(s => { s.envs.push({ name, suffix: prefix, domain }) })
    nameInput.value = ''
    prefixInput.value = ''
    domainInput.value = ''
    nameInput.focus()
  }

  addForm.append(nameInput, prefixInput, domainInput, addBtn)
  container.appendChild(addForm)

  const table = document.createElement('table')
  table.innerHTML = '<thead><tr><th>Name</th><th>Suffix</th><th>Domain</th><th></th></tr></thead>'
  const tbody = document.createElement('tbody')

  state.envs.forEach((env, i) => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><input type="text" value="${esc(env.name)}" data-idx="${i}" data-field="name" data-type="env"></td>
      <td><input type="text" value="${esc(env.suffix)}" data-idx="${i}" data-field="suffix" data-type="env"></td>
      <td><input type="text" value="${esc(env.domain)}" placeholder="${esc(state.globalDomain)}" data-idx="${i}" data-field="domain" data-type="env"></td>
      <td><button class="btn-icon" title="Delete">✕</button></td>
    `
    tr.querySelectorAll('input').forEach(inp => {
      inp.oninput = () => {
        state.envs[+inp.dataset.idx][inp.dataset.field] = inp.value
        saveState()
        syncUrls()
      }
    })
    tr.querySelector('.btn-icon').onclick = () => {
      setState(s => { s.envs.splice(i, 1) })
    }
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  container.appendChild(table)

  return container
}

// --- entries ---

function renderEntriesContent() {
  const container = document.createElement('div')

  // --- add form ---
  const addForm = document.createElement('form')
  addForm.style.display = 'flex'
  addForm.style.gap = '8px'
  addForm.style.marginBottom = '16px'
  addForm.style.flexWrap = 'wrap'
  addForm.style.alignItems = 'flex-end'

  const nameGroup = document.createElement('div')
  nameGroup.style.flex = '1'
  nameGroup.style.minWidth = '140px'
  const nameLabel = document.createElement('div')
  nameLabel.style.fontSize = '.8rem'
  nameLabel.style.fontWeight = '600'
  nameLabel.style.color = '#555'
  nameLabel.style.marginBottom = '3px'
  nameLabel.textContent = 'Client Name'

  const newClientName = document.createElement('input')
  newClientName.placeholder = 'Client Name (optional)'
  newClientName.style.width = '100%'
  nameGroup.append(nameLabel, newClientName)

  const clientGroup = document.createElement('div')
  clientGroup.style.flex = '1'
  clientGroup.style.minWidth = '140px'
  const clientLabel = document.createElement('div')
  clientLabel.style.fontSize = '.8rem'
  clientLabel.style.fontWeight = '600'
  clientLabel.style.color = '#555'
  clientLabel.style.marginBottom = '3px'
  clientLabel.innerHTML = 'Client ID <span class="info-tip">i<span class="info-tooltip">Paste a lobby URL here to auto-extract Client ID, Token, and Redirect URL</span></span>'

  const newClientId = document.createElement('input')
  newClientId.placeholder = 'Client ID'
  newClientId.style.width = '100%'
  newClientId.onpaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text')
    if (!text) return
    try {
      new URL(text)
      e.preventDefault()
      const parsed = new URL(text)
      const clientId = parsed.searchParams.get('clientId') || ''
      const token = parsed.searchParams.get('token') || ''
      const redirectUrl = parsed.searchParams.get('redirectUrl') || ''
      newClientId.value = clientId
      newToken.value = token
      newRedirect.value = redirectUrl
      showToast('Fields extracted from URL!')
    } catch {
      // not a URL, let it paste normally
    }
  }

  clientGroup.append(clientLabel, newClientId)

  const playerGroup = document.createElement('div')
  playerGroup.style.flex = '1'
  playerGroup.style.minWidth = '140px'
  const playerLabel = document.createElement('div')
  playerLabel.style.fontSize = '.8rem'
  playerLabel.style.fontWeight = '600'
  playerLabel.style.color = '#555'
  playerLabel.style.marginBottom = '3px'
  playerLabel.textContent = 'Player Name'

  const newPlayerName = document.createElement('input')
  newPlayerName.placeholder = 'Player Name (optional)'
  newPlayerName.style.width = '100%'
  playerGroup.append(playerLabel, newPlayerName)

  const tokenGroup = document.createElement('div')
  tokenGroup.style.flex = '1'
  tokenGroup.style.minWidth = '140px'
  const tokenLabel = document.createElement('div')
  tokenLabel.style.fontSize = '.8rem'
  tokenLabel.style.fontWeight = '600'
  tokenLabel.style.color = '#555'
  tokenLabel.style.marginBottom = '3px'
  tokenLabel.textContent = 'Token'

  const newToken = document.createElement('input')
  newToken.placeholder = 'Token'
  newToken.style.width = '100%'
  tokenGroup.append(tokenLabel, newToken)

  const redirectGroup = document.createElement('div')
  redirectGroup.style.flex = '1'
  redirectGroup.style.minWidth = '140px'
  const redirectLabel = document.createElement('div')
  redirectLabel.style.fontSize = '.8rem'
  redirectLabel.style.fontWeight = '600'
  redirectLabel.style.color = '#555'
  redirectLabel.style.marginBottom = '3px'
  redirectLabel.textContent = 'Redirect URL'

  const newRedirect = document.createElement('input')
  newRedirect.id = 'newRedirect'
  newRedirect.placeholder = state.globalRedirectUrl || 'Redirect URL'
  newRedirect.style.width = '100%'
  redirectGroup.append(redirectLabel, newRedirect)

  const addBtn = document.createElement('button')
  addBtn.className = 'btn btn-primary'
  addBtn.textContent = 'Add Entry'
  addForm.onsubmit = (e) => {
    e.preventDefault()
    const clientName = newClientName.value.trim()
    const clientId = newClientId.value.trim()
    const playerName = newPlayerName.value.trim()
    const token = newToken.value.trim()
    const redirectUrl = newRedirect.value.trim()
    if (!clientId && !token) return
    setState(s => {
      s.entries.push({
        id: uid(),
        clientName,
        clientId,
        tokens: [{ playerName, token }],
        redirectUrl,
      })
    })
    newClientName.value = ''
    newClientId.value = ''
    newPlayerName.value = ''
    newToken.value = ''
    newRedirect.value = ''
    newClientName.focus()
  }

  addForm.append(nameGroup, clientGroup, playerGroup, tokenGroup, redirectGroup, addBtn)
  container.appendChild(addForm)

  if (state.entries.length === 0) {
    container.appendChild(emptyMsg('No entries yet. Add one above.'))
  } else {
    state.entries.forEach(entry => {
      container.appendChild(renderEntry(entry))
    })
  }

  return container
}

function renderEntry(entry) {
  const wrapper = document.createElement('div')
  wrapper.className = 'collapsible'
  wrapper.dataset.collapseId = entry.id

  const header = document.createElement('div')
  header.className = 'collapsible-header collapsed'
  const displayName = entry.clientName ? esc(entry.clientName) + ' ' : ''
  const displayId = entry.clientId
    ? `<span class="client-id-code">${esc(entry.clientId)}</span>`
    : '<span class="client-id-code">(no clientId)</span>'
  header.innerHTML = `<span class="caret">▼</span> ${displayName}${displayId}`
  wrapper.appendChild(header)

  const body = document.createElement('div')
  body.className = 'collapsible-body'

  // entry-level editable fields
  const fieldsDiv = document.createElement('div')
  fieldsDiv.className = 'entry-fields'

  const fConfig = [
    { label: 'Client Name', value: entry.clientName || '', field: 'clientName', id: entry.id },
    { label: 'Client ID', value: entry.clientId, field: 'clientId', id: entry.id },
    { label: 'Redirect URL', value: entry.redirectUrl, field: 'redirectUrl', id: entry.id },
  ]

  fConfig.forEach(f => {
    const div = document.createElement('div')
    div.className = 'field'
    const label = document.createElement('label')
    label.innerHTML = f.field === 'clientId'
      ? 'Client ID <span class="info-tip">i<span class="info-tooltip">Paste a lobby URL here to auto-extract Client ID, Token, and Redirect URL</span></span>'
      : esc(f.label)
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.value = f.value
    inp.title = f.label
    if (f.field === 'redirectUrl') {
      inp.className = 'entry-redir-input'
      inp.placeholder = state.globalRedirectUrl || 'Redirect URL'
    }
    inp.oninput = () => {
      const e = state.entries.find(x => x.id === entry.id)
      if (e) e[f.field] = inp.value
      saveState()
      syncUrls()
    }
    if (f.field === 'clientId') {
      inp.onpaste = (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text')
        if (!text) return
        try {
          new URL(text)
          e.preventDefault()
          const parsed = new URL(text)
          inp.value = parsed.searchParams.get('clientId') || ''
          const e2 = state.entries.find(x => x.id === entry.id)
          if (e2) {
            e2.clientId = inp.value
            const extToken = parsed.searchParams.get('token') || ''
            const extRedirect = parsed.searchParams.get('redirectUrl') || ''
            e2.redirectUrl = extRedirect
            if (e2.tokens.length > 0) {
              e2.tokens[0].token = extToken
            } else {
              e2.tokens.push({ playerName: '', token: extToken })
            }
          }
          setState(() => {})
          showToast('Fields extracted from URL!')
        } catch { /* not a url */ }
      }
    }
    div.append(label, inp)
    fieldsDiv.appendChild(div)
  })

  const delBtn = document.createElement('button')
  delBtn.className = 'btn-icon'
  delBtn.textContent = '✕'
  delBtn.title = 'Delete Entry'
  delBtn.style.alignSelf = 'flex-end'
  delBtn.onclick = () => {
    if (!confirm('Delete this entry?')) return
    setState(s => { s.entries = s.entries.filter(e => e.id !== entry.id) })
  }
  fieldsDiv.appendChild(delBtn)
  body.appendChild(fieldsDiv)

  // --- token add form ---
  const tokenAddForm = document.createElement('form')
  tokenAddForm.className = 'token-add-form'
  tokenAddForm.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;align-items:flex-end'

  const tokenPlayerInp = document.createElement('input')
  tokenPlayerInp.placeholder = 'Player Name (optional)'
  tokenPlayerInp.style.flex = '1'

  const tokenTokenInp = document.createElement('input')
  tokenTokenInp.placeholder = 'Token'
  tokenTokenInp.style.flex = '1'

  const tokenAddBtn = document.createElement('button')
  tokenAddBtn.className = 'btn btn-primary'
  tokenAddBtn.textContent = 'Add Token'
  tokenAddForm.onsubmit = (e) => {
    e.preventDefault()
    const playerName = tokenPlayerInp.value.trim()
    const token = tokenTokenInp.value.trim()
    if (!token) return
    setState(s => {
      const e2 = s.entries.find(x => x.id === entry.id)
      if (e2) e2.tokens.push({ playerName, token })
    })
  }

  tokenAddForm.append(tokenPlayerInp, tokenTokenInp, tokenAddBtn)
  body.appendChild(tokenAddForm)

  // --- token collapsibles ---
  entry.tokens.forEach((token, tokenIdx) => {
    body.appendChild(renderTokenGroup(entry, token, tokenIdx))
  })

  wrapper.appendChild(body)
  header.onclick = () => toggleCollapsed(header)
  return wrapper
}

function renderTokenGroup(entry, token, tokenIdx) {
  const wrapper = document.createElement('div')
  wrapper.className = 'collapsible token-group'
  wrapper.dataset.collapseId = entry.id + '-t-' + tokenIdx

  const header = document.createElement('div')
  header.className = 'collapsible-header collapsed'
  const playerPart = token.playerName ? esc(token.playerName) + ' ' : ''
  const tokenPart = token.token
    ? `<span class="client-id-code">${esc(token.token)}</span>`
    : '<span class="client-id-code">(no token)</span>'
  header.innerHTML = `<span class="caret">▼</span> ${playerPart}${tokenPart}`
  wrapper.appendChild(header)

  const body = document.createElement('div')
  body.className = 'collapsible-body'

  // token inline fields
  const fieldsDiv = document.createElement('div')
  fieldsDiv.className = 'entry-fields'

  const fConfig = [
    { label: 'Player Name', value: token.playerName || '', field: 'playerName' },
    { label: 'Token', value: token.token, field: 'token' },
  ]

  fConfig.forEach(f => {
    const div = document.createElement('div')
    div.className = 'field'
    const label = document.createElement('label')
    label.textContent = f.label
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.value = f.value
    inp.title = f.label
    inp.oninput = () => {
      const e = state.entries.find(x => x.id === entry.id)
      if (e && e.tokens[tokenIdx]) {
        e.tokens[tokenIdx][f.field] = inp.value
        saveState()
        syncUrls()
      }
    }
    div.append(label, inp)
    fieldsDiv.appendChild(div)
  })

  const delBtn = document.createElement('button')
  delBtn.className = 'btn-icon'
  delBtn.textContent = '✕'
  delBtn.title = 'Delete Token'
  delBtn.style.alignSelf = 'flex-end'
  delBtn.onclick = () => {
    if (!confirm('Delete this token?')) return
    setState(s => {
      const e2 = s.entries.find(x => x.id === entry.id)
      if (e2) e2.tokens.splice(tokenIdx, 1)
    })
  }
  fieldsDiv.appendChild(delBtn)
  body.appendChild(fieldsDiv)

  // local url group (first, if configured)
  if (state.localUrl) {
    const localGroup = renderLocalUrlGroup(entry, token, tokenIdx)
    localGroup.classList.add('local-group')
    body.appendChild(localGroup)
  }

  // env sub-groups
  state.envs.forEach((env, envIdx) => {
    body.appendChild(renderEnvGroup(entry, token, tokenIdx, env, envIdx))
  })

  wrapper.appendChild(body)
  header.onclick = () => toggleCollapsed(header)
  return wrapper
}

function toggleLocalGroups() {
  document.querySelectorAll('.collapsible.token-group').forEach(el => {
    const body = el.querySelector('.collapsible-body')
    if (!body) return
    const existing = body.querySelector(':scope > .collapsible.local-group')
    if (state.localUrl) {
      if (existing) return
      const collapseId = el.dataset.collapseId
      const m = collapseId.match(/^(.+)-t-(\d+)$/)
      if (!m) return
      const entryId = m[1]
      const tokenIdx = +m[2]
      const entry = state.entries.find(e => e.id === entryId)
      if (!entry || !entry.tokens[tokenIdx]) return
      const group = renderLocalUrlGroup(entry, entry.tokens[tokenIdx], tokenIdx)
      group.classList.add('local-group')
      body.insertBefore(group, body.querySelector(':scope > .collapsible'))
    } else {
      if (existing) existing.remove()
    }
  })
}

function renderLocalUrlGroup(entry, token, tokenIdx) {
  const wrapper = document.createElement('div')
  wrapper.className = 'collapsible'
  wrapper.dataset.collapseId = entry.id + '-t-' + tokenIdx + '-local'

  const header = document.createElement('div')
  header.className = 'collapsible-header collapsed'
  header.innerHTML = `<span class="caret">▼</span> Local`
  wrapper.appendChild(header)

  const body = document.createElement('div')
  body.className = 'collapsible-body'

  let hasUrls = false
  state.games.forEach((game, gameIdx) => {
    if (!game.name && !game.gameId) return
    hasUrls = true

    const row = document.createElement('div')
    row.className = 'url-row'
    row.dataset.gameIdx = gameIdx
    row.dataset.envIdx = '-2'
    row.dataset.entryId = entry.id
    row.dataset.tokenIdx = tokenIdx

    const url = buildLocalUrl(game, entry, token)
    const link = document.createElement('a')
    link.href = url
    link.target = '_blank'
    link.textContent = url

    const copyBtn = document.createElement('button')
    copyBtn.className = 'btn btn-sm'
    copyBtn.textContent = 'Copy'
    copyBtn.onclick = (e) => { e.stopPropagation(); copyUrl(url) }

    row.append(link, copyBtn)
    body.appendChild(row)
  })

  if (!hasUrls) {
    body.appendChild(emptyMsg('No games configured.'))
  }

  wrapper.appendChild(body)
  header.onclick = () => toggleCollapsed(header)
  return wrapper
}

function renderEnvGroup(entry, token, tokenIdx, env, envIdx) {
  const wrapper = document.createElement('div')
  wrapper.className = 'collapsible'
  wrapper.dataset.collapseId = entry.id + '-t-' + tokenIdx + '-env-' + envIdx

  const header = document.createElement('div')
  header.className = 'collapsible-header collapsed'
  header.innerHTML = `<span class="caret">▼</span> ${esc(env.name)}`
  wrapper.appendChild(header)

  const body = document.createElement('div')
  body.className = 'collapsible-body'

  let hasUrls = false
  state.games.forEach((game, gameIdx) => {
    if (!game.name && !game.gameId) return
    hasUrls = true
    body.appendChild(renderUrlRow(game, gameIdx, entry, token, tokenIdx, env, envIdx))
  })

  if (!hasUrls) {
    body.appendChild(emptyMsg('No games configured.'))
  }

  wrapper.appendChild(body)
  header.onclick = () => toggleCollapsed(header)
  return wrapper
}

function renderUrlRow(game, gameIdx, entry, token, tokenIdx, env, envIdx) {
  const row = document.createElement('div')
  row.className = 'url-row'
  row.dataset.gameIdx = gameIdx
  row.dataset.envIdx = envIdx
  row.dataset.entryId = entry.id
  row.dataset.tokenIdx = tokenIdx

  const url = buildUrl(game, env, entry, token)

  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.textContent = url

  const copyBtn = document.createElement('button')
  copyBtn.className = 'btn btn-sm'
  copyBtn.textContent = 'Copy'
  copyBtn.onclick = (e) => { e.stopPropagation(); copyUrl(url) }

  row.append(link, copyBtn)
  return row
}

// --- sync urls (lightweight, no full re-render) ---

function syncUrls() {
  document.querySelectorAll('.url-row').forEach(row => {
    const gameIdx = +row.dataset.gameIdx
    const envIdx = +row.dataset.envIdx
    const entryId = row.dataset.entryId
    const tokenIdx = +row.dataset.tokenIdx
    const entry = state.entries.find(e => e.id === entryId)
    const token = entry?.tokens?.[tokenIdx]
    if (!entry || !token) return

    let url
    if (envIdx === -2) {
      const game = state.games[gameIdx]
      if (!game) return
      url = buildLocalUrl(game, entry, token)
    } else {
      const game = state.games[gameIdx]
      const env = state.envs[envIdx]
      if (!game || !env) return
      url = buildUrl(game, env, entry, token)
    }

    const link = row.querySelector('a')
    if (link) {
      link.href = url
      link.textContent = url
    }
  })

  // update entry headers (clientName / clientId may have changed)
  document.querySelectorAll('.collapsible[data-collapse-id]').forEach(el => {
    const entry = state.entries.find(e => e.id === el.dataset.collapseId)
    if (!entry) {
      // maybe a token header
      const m = el.dataset.collapseId.match(/^(.+)-t-(\d+)$/)
      if (!m) return
      const tokenEntry = state.entries.find(e => e.id === m[1])
      if (!tokenEntry) return
      const tokenIdx = +m[2]
      const token = tokenEntry.tokens?.[tokenIdx]
      if (!token) return
      const header = el.querySelector('.collapsible-header')
      if (!header) return
      const caret = header.querySelector('.caret')
      if (!caret) return
      const playerPart = token.playerName ? esc(token.playerName) + ' ' : ''
      const tokenPart = token.token
        ? `<span class="client-id-code">${esc(token.token)}</span>`
        : '<span class="client-id-code">(no token)</span>'
      header.innerHTML = ''
      header.appendChild(caret)
      header.insertAdjacentHTML('beforeend', ' ' + playerPart + tokenPart)
      return
    }
    const header = el.querySelector('.collapsible-header')
    if (!header) return
    const caret = header.querySelector('.caret')
    if (!caret) return
    const displayName = entry.clientName ? esc(entry.clientName) + ' ' : ''
    const displayId = entry.clientId
      ? `<span class="client-id-code">${esc(entry.clientId)}</span>`
      : '<span class="client-id-code">(no clientId)</span>'
    header.innerHTML = ''
    header.appendChild(caret)
    header.insertAdjacentHTML('beforeend', ' ' + displayName + displayId)
  })
}

function syncPlaceholders() {
  document.querySelectorAll('input[data-type="env"][data-field="domain"]').forEach(inp => {
    inp.placeholder = state.globalDomain
  })
  document.querySelectorAll('.entry-redir-input').forEach(inp => {
    inp.placeholder = state.globalRedirectUrl || 'Redirect URL'
  })
  const addRedir = document.getElementById('newRedirect')
  if (addRedir) addRedir.placeholder = state.globalRedirectUrl || 'Redirect URL'
  const envAdd = document.getElementById('envDomainAdd')
  if (envAdd) envAdd.placeholder = state.globalDomain || 'domain'
}

// --- helpers ---

function emptyMsg(text) {
  const div = document.createElement('div')
  div.className = 'empty-msg'
  div.textContent = text
  return div
}

// --- bootstrap ---

document.addEventListener('DOMContentLoaded', () => {
  loadState()
  render()
})
