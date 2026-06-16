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
  if (Array.isArray(e.tokens)) {
    const oldTokens = e.tokens
    e.tokens = {}
    state.envs.forEach(env => {
      e.tokens[env.name] = oldTokens.map(t => ({ ...t }))
    })
  }
  if (!e.tokens || typeof e.tokens !== 'object' || Array.isArray(e.tokens)) {
    e.tokens = {}
    state.envs.forEach(env => {
      e.tokens[env.name] = []
    })
  }
  state.envs.forEach(env => {
    if (!e.tokens[env.name]) e.tokens[env.name] = []
  })
  if (!e.createdAt) e.createdAt = Date.now()
  state.envs.forEach(env => {
    const arr = e.tokens[env.name]
    if (arr) {
      arr.forEach((t, i) => {
        if (!t.createdAt) t.createdAt = e.createdAt + i
      })
    }
  })
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

function nextClientName() {
  let max = 0
  state.entries.forEach(e => {
    const m = e.clientName?.match(/^client(\d+)$/)
    if (m) max = Math.max(max, +m[1])
  })
  return 'client' + (max + 1)
}

function nextPlayerName(entryId, envName) {
  const entry = state.entries.find(e => e.id === entryId)
  if (!entry) return 'player1'
  const tokens = entry.tokens[envName] || []
  let max = 0
  tokens.forEach(t => {
    const m = t.playerName?.match(/^player(\d+)$/)
    if (m) max = Math.max(max, +m[1])
  })
  return 'player' + (max + 1)
}

function makeEditable(container, initialValue, saveFn) {
  let value = initialValue

  function showDisplay() {
    container.style.display = 'inline-flex'
    container.style.alignItems = 'center'
    container.style.gap = '3px'
    const display = document.createElement('span')
    display.textContent = value
    const editBtn = document.createElement('button')
    editBtn.className = 'btn-icon btn-edit'
    editBtn.title = 'Edit'
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
    editBtn.onclick = (e) => {
      e.stopPropagation()
      enterEdit()
    }
    container.textContent = ''
    container.append(display, editBtn)
  }

  function enterEdit() {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = value
    input.style.width = Math.max(value.length * 9 + 20, 100) + 'px'
    input.style.padding = '2px 6px'
    input.style.fontSize = 'inherit'
    input.style.fontFamily = 'inherit'

    const done = () => {
      const val = input.value.trim()
      if (val && val !== value) {
        saveFn(val)
        value = val
      }
      showDisplay()
    }

    input.onblur = done
    input.onkeydown = (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur() }
      if (ev.key === 'Escape') { ev.preventDefault(); showDisplay() }
    }

    container.textContent = ''
    container.appendChild(input)
    input.focus()
    input.select()
  }

  showDisplay()
}

function truncateToken(t) {
  if (!t || t.length <= 15) return esc(t)
  const first = t.slice(0, 5)
  const last = t.slice(-5)
  const interior = t.length - 10
  const mid = t.slice(5 + Math.floor((interior - 5) / 2), 5 + Math.floor((interior - 5) / 2) + 5)
  return esc(first) + '...' + esc(mid) + '...' + esc(last)
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

function detectEnv(urlStr) {
  try {
    const url = new URL(urlStr)
    const host = url.hostname
    if (host === 'localhost' || host === '127.0.0.1') return null
    let matched = null
    state.envs.forEach(env => {
      if (env.suffix && host.includes(env.suffix + '.')) matched = env.name
    })
    if (!matched) {
      state.envs.forEach(env => {
        if (!env.suffix) matched = env.name
      })
    }
    return matched
  } catch {
    return null
  }
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
        state.entries = data
        saveState()
        render()
        showToast('Entries imported!')
      } else if (data.entries) {
        data.entries.forEach(migrateEntry)
        state.entries = data.entries
        saveState()
        render()
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
  document.querySelectorAll('[data-collapse-id]').forEach(el => {
    const header = el.querySelector('.collapsible-header')
    if (header) collapseState[el.dataset.collapseId] = header.classList.contains('collapsed')
  })
}

function persistCollapseState() {
  const s = {}
  for (const k in collapseState) s[k] = collapseState[k]
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

function getLayoutMode(entryId) {
  return collapseState[entryId + '-layout'] || 'env'
}

function setLayoutMode(entryId, mode) {
  collapseState[entryId + '-layout'] = mode
  persistCollapseState()
  render()
}

function render() {
  if (Object.keys(collapseState).length === 0) {
    try {
      const saved = localStorage.getItem('lobbyUrlCollapse')
      if (saved) collapseState = JSON.parse(saved)
    } catch {}
  }
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
      s.localUrl = def.localUrl
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
    if (wasEmpty !== !state.localUrl) {
      setState(() => {})
    } else {
      saveState()
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
        syncEnvSelects()
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
      const envName = detectEnv(text)
      if (envName && [...newEnvSelect.options].some(o => o.value === envName)) {
        newEnvSelect.value = envName
      }
      showToast('Fields extracted from URL!')
    } catch {
      // not a URL, let it paste normally
    }
  }

  clientGroup.append(clientLabel, newClientId)

  const envGroup = document.createElement('div')
  envGroup.style.flex = '1'
  envGroup.style.minWidth = '100px'
  const envLabel = document.createElement('div')
  envLabel.style.fontSize = '.8rem'
  envLabel.style.fontWeight = '600'
  envLabel.style.color = '#555'
  envLabel.style.marginBottom = '3px'
  envLabel.textContent = 'Environment'

  const newEnvSelect = document.createElement('select')
  newEnvSelect.className = 'env-select'
  newEnvSelect.style.width = '100%'
  newEnvSelect.style.padding = '6px 8px'
  newEnvSelect.style.border = '1px solid #ccc'
  newEnvSelect.style.borderRadius = '4px'
  newEnvSelect.style.fontSize = '.9rem'
  newEnvSelect.style.background = '#fff'
  state.envs.forEach(env => {
    const opt = document.createElement('option')
    opt.value = env.name
    opt.textContent = env.name
    newEnvSelect.appendChild(opt)
  })
  envGroup.append(envLabel, newEnvSelect)

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
    const clientName = newClientName.value.trim() || nextClientName()
    const clientId = newClientId.value.trim()
    const envName = newEnvSelect.value
    const playerName = newPlayerName.value.trim()
    const token = newToken.value.trim()
    const redirectUrl = newRedirect.value.trim()
    if (!clientId && !token) return
    setState(s => {
      const existing = s.entries.find(e => e.clientId === clientId)
      if (existing) {
        const tokens = existing.tokens[envName] = existing.tokens[envName] || []
        if (!tokens.some(t => t.token === token)) {
          tokens.push({ playerName: playerName || nextPlayerName(existing.id, envName), token, createdAt: Date.now() })
        }
      } else {
        const tokens = {}
        tokens[envName] = [{ playerName: playerName || 'player1', token, createdAt: Date.now() }]
        s.entries.push({
          id: uid(),
          clientName,
          clientId,
          tokens,
          redirectUrl,
          createdAt: Date.now(),
        })
      }
    })
    newClientName.value = ''
    newClientId.value = ''
    newPlayerName.value = ''
    newToken.value = ''
    newRedirect.value = ''
    newClientName.focus()
  }

  addForm.append(clientGroup, tokenGroup, envGroup, nameGroup, playerGroup, redirectGroup, addBtn)
  container.appendChild(addForm)

  if (state.entries.length === 0) {
    container.appendChild(emptyMsg('No entries yet. Add one above.'))
  } else {
    const sorted = [...state.entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    sorted.forEach(entry => {
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

  const caret = document.createElement('span')
  caret.className = 'caret'
  caret.textContent = '▼'
  header.appendChild(caret)

  const nameContainer = document.createElement('span')
  makeEditable(nameContainer, entry.clientName, (val) => {
    const e = state.entries.find(x => x.id === entry.id)
    if (e) { e.clientName = val; saveState() }
  })
  header.appendChild(nameContainer)

  header.appendChild(document.createTextNode(' '))

  const idSpan = document.createElement('span')
  idSpan.className = 'client-id-code'
  idSpan.textContent = entry.clientId || '(no clientId)'
  header.appendChild(idSpan)
  const delBtn = document.createElement('button')
  delBtn.className = 'btn-icon'
  delBtn.textContent = '✕'
  delBtn.title = 'Delete Entry'
  delBtn.style.marginLeft = 'auto'
  delBtn.onclick = (e) => {
    e.stopPropagation()
    if (!confirm('Delete this entry?')) return
    setState(s => { s.entries = s.entries.filter(e => e.id !== entry.id) })
  }
  header.appendChild(delBtn)
  wrapper.appendChild(header)

  const body = document.createElement('div')
  body.className = 'collapsible-body'

  // --- token add form ---
  const tokenAddForm = document.createElement('form')
  tokenAddForm.className = 'token-add-form'
  tokenAddForm.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;align-items:flex-end'

  const tokenEnvSelect = document.createElement('select')
  tokenEnvSelect.className = 'env-select'
  tokenEnvSelect.title = 'Environment'
  tokenEnvSelect.style.padding = '6px 8px'
  tokenEnvSelect.style.border = '1px solid #ccc'
  tokenEnvSelect.style.borderRadius = '4px'
  tokenEnvSelect.style.fontSize = '.9rem'
  tokenEnvSelect.style.background = '#fff'
  tokenEnvSelect.style.width = '110px'
  tokenEnvSelect.style.flexShrink = '0'
  state.envs.forEach(env => {
    const opt = document.createElement('option')
    opt.value = env.name
    opt.textContent = env.name
    tokenEnvSelect.appendChild(opt)
  })

  const tokenPlayerInp = document.createElement('input')
  tokenPlayerInp.placeholder = 'Player Name (optional)'
  tokenPlayerInp.style.flex = '1'

  const tokenTokenInp = document.createElement('input')
  tokenTokenInp.placeholder = 'Token or Lobby URL'
  tokenTokenInp.style.flex = '1'
  tokenTokenInp.onpaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text')
    if (!text) return
    try {
      new URL(text)
      e.preventDefault()
      const parsed = new URL(text)
      const token = parsed.searchParams.get('token') || ''
      tokenTokenInp.value = token
      const envName = detectEnv(text)
      if (envName && [...tokenEnvSelect.options].some(o => o.value === envName)) {
        tokenEnvSelect.value = envName
      }
      showToast('Token extracted from URL!')
    } catch { /* not a URL */ }
  }

  const tokenAddBtn = document.createElement('button')
  tokenAddBtn.className = 'btn btn-primary'
  tokenAddBtn.textContent = 'Add Token'
  tokenAddForm.onsubmit = (e) => {
    e.preventDefault()
    const envName = tokenEnvSelect.value
    const playerName = tokenPlayerInp.value.trim() || nextPlayerName(entry.id, envName)
    const token = tokenTokenInp.value.trim()
    if (!token) return
    setState(s => {
      const e2 = s.entries.find(x => x.id === entry.id)
      if (e2) {
        const tokens = e2.tokens[envName] = e2.tokens[envName] || []
        if (!tokens.some(t => t.token === token)) {
          tokens.push({ playerName, token, createdAt: Date.now() })
        }
      }
    })
  }

  tokenAddForm.append(tokenPlayerInp, tokenTokenInp, tokenEnvSelect, tokenAddBtn)
  body.appendChild(tokenAddForm)

  // --- layout switcher ---
  const layoutMode = getLayoutMode(entry.id)

  const layoutBar = document.createElement('div')
  layoutBar.className = 'layout-switcher'

  const groupLabel = document.createElement('span')
  groupLabel.className = 'layout-switcher-label'
  groupLabel.textContent = 'Group By:'
  layoutBar.appendChild(groupLabel)

  const envLayoutBtn = document.createElement('button')
  envLayoutBtn.className = 'btn btn-sm' + (layoutMode === 'env' ? ' btn-primary' : '')
  envLayoutBtn.textContent = 'Env'
  envLayoutBtn.onclick = () => setLayoutMode(entry.id, 'env')

  const playerLayoutBtn = document.createElement('button')
  playerLayoutBtn.className = 'btn btn-sm' + (layoutMode === 'player' ? ' btn-primary' : '')
  playerLayoutBtn.textContent = 'Player'
  playerLayoutBtn.onclick = () => setLayoutMode(entry.id, 'player')

  layoutBar.append(envLayoutBtn, playerLayoutBtn)
  body.appendChild(layoutBar)

  // --- token sections ---
  if (layoutMode === 'player') {
    renderTokensByPlayer(entry, body)
  } else {
    renderTokensByEnv(entry, body)
  }

  wrapper.appendChild(body)
  header.onclick = () => toggleCollapsed(header)
  return wrapper
}

function renderTokenGroup(entry, token, tokenIdx, envName, opts = {}) {
  const env = state.envs.find(e => e.name === envName)
  const wrapper = document.createElement('div')
  wrapper.className = 'collapsible token-group'
  wrapper.dataset.collapseId = entry.id + '-t-' + envName + '-' + tokenIdx

  const header = document.createElement('div')
  header.className = 'collapsible-header collapsed'

  const caret = document.createElement('span')
  caret.className = 'caret'
  caret.textContent = '▼'
  header.appendChild(caret)

  const nameContainer = document.createElement('span')
  nameContainer.style.display = 'inline-flex'
  nameContainer.style.alignItems = 'center'
  nameContainer.style.gap = '3px'
  if (opts.headerLabel) {
    nameContainer.textContent = opts.headerLabel
  } else {
    makeEditable(nameContainer, token.playerName, (val) => {
      const e = state.entries.find(x => x.id === entry.id)
      if (e && e.tokens[envName]?.[tokenIdx]) { e.tokens[envName][tokenIdx].playerName = val; saveState() }
    })
  }
  header.appendChild(nameContainer)

  header.appendChild(document.createTextNode(' '))

  const tokenSpan = document.createElement('span')
  tokenSpan.className = 'client-id-code'
  tokenSpan.textContent = token.token ? truncateToken(token.token) : '(no token)'
  tokenSpan.title = token.token || ''
  header.appendChild(tokenSpan)
  const delBtn = document.createElement('button')
  delBtn.className = 'btn-icon'
  delBtn.textContent = '✕'
  delBtn.title = 'Delete Token'
  delBtn.style.marginLeft = 'auto'
  delBtn.onclick = (e) => {
    e.stopPropagation()
    if (!confirm('Delete this token?')) return
    setState(s => {
      const e2 = s.entries.find(x => x.id === entry.id)
      if (e2 && e2.tokens[envName]) e2.tokens[envName].splice(tokenIdx, 1)
    })
  }
  header.appendChild(delBtn)
  wrapper.appendChild(header)

  const body = document.createElement('div')
  body.className = 'collapsible-body'

  if (state.games.length === 0) {
    body.appendChild(emptyMsg('No games configured.'))
  } else {
    const bar = document.createElement('div')
    bar.className = 'game-bar'

    state.games.forEach((game, gameIdx) => {
      if (!game.name && !game.gameId) return

      const col = document.createElement('div')
      col.className = 'game-col'

      const envUrl = env ? buildUrl(game, env, entry, token) : ''
      const localUrl = state.localUrl ? buildLocalUrl(game, entry, token) : ''

      const row = document.createElement('div')
      row.className = 'game-token-row'
      row.dataset.envUrl = envUrl
      row.dataset.localUrl = localUrl
      row.dataset.gameIdx = gameIdx
      row.dataset.entryId = entry.id
      row.dataset.tokenIdx = tokenIdx
      row.dataset.envName = envName

      const link = document.createElement('a')
      link.href = envUrl
      link.target = '_blank'
      link.className = 'env-link'
      link.textContent = game.name || '?'

      const copyEnvBtn = document.createElement('button')
      copyEnvBtn.className = 'btn-icon btn-copy'
      copyEnvBtn.title = 'Copy URL'
      copyEnvBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      copyEnvBtn.onclick = (e) => {
        e.stopPropagation()
        if (row.dataset.envUrl) copyUrl(row.dataset.envUrl)
      }

      row.append(link, copyEnvBtn)

      if (state.localUrl) {
        const copyLocalBtn = document.createElement('button')
        copyLocalBtn.className = 'btn-icon btn-copy btn-copy-local'
        copyLocalBtn.title = 'Copy Local URL'
        copyLocalBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
        copyLocalBtn.onclick = (e) => {
          e.stopPropagation()
          if (row.dataset.localUrl) copyUrl(row.dataset.localUrl)
        }
        row.appendChild(copyLocalBtn)
      }

      col.appendChild(row)
      bar.appendChild(col)
    })

    body.appendChild(bar)
  }

  wrapper.appendChild(body)
  header.onclick = () => toggleCollapsed(header)
  return wrapper
}

function renderTokensByEnv(entry, body) {
  let anyTokens = false
  state.envs.forEach(env => {
    const tokens = entry.tokens[env.name] || []
    if (tokens.length === 0) return
    anyTokens = true

    const envSection = document.createElement('div')
    envSection.className = 'collapsible env-section'
    envSection.dataset.collapseId = entry.id + '-env-' + env.name

    const envHeader = document.createElement('div')
    envHeader.className = 'collapsible-header collapsed'
    const caret = document.createElement('span')
    caret.className = 'caret'
    caret.textContent = '▼'
    envHeader.appendChild(caret)
    envHeader.appendChild(document.createTextNode(env.name))

    const envBody = document.createElement('div')
    envBody.className = 'collapsible-body'

    tokens.forEach((token, tokenIdx) => {
      envBody.appendChild(renderTokenGroup(entry, token, tokenIdx, env.name))
    })

    envSection.append(envHeader, envBody)
    envHeader.onclick = () => toggleCollapsed(envHeader)
    body.appendChild(envSection)
  })
  if (!anyTokens) {
    body.appendChild(emptyMsg('No tokens in any environment.'))
  }
}

function renderTokensByPlayer(entry, body) {
  const pairs = []
  state.envs.forEach(env => {
    const tokens = entry.tokens[env.name] || []
    tokens.forEach((token, tokenIdx) => {
      pairs.push({ token, tokenIdx, envName: env.name })
    })
  })

  if (pairs.length === 0) {
    body.appendChild(emptyMsg('No tokens in any environment.'))
    return
  }

  const groups = {}
  pairs.forEach(p => {
    const pn = p.token.playerName || '?'
    if (!groups[pn]) groups[pn] = []
    groups[pn].push(p)
  })

  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => {
    const aLatest = Math.max(...a.map(p => p.token.createdAt || 0))
    const bLatest = Math.max(...b.map(p => p.token.createdAt || 0))
    return bLatest - aLatest
  })

  sortedGroups.forEach(([playerName, playerPairs]) => {
    const playerSection = document.createElement('div')
    playerSection.className = 'collapsible player-group'
    const sectionId = entry.id + '-player-' + playerName
    playerSection.dataset.collapseId = sectionId

    const header = document.createElement('div')
    header.className = 'collapsible-header collapsed'
    const caret = document.createElement('span')
    caret.className = 'caret'
    caret.textContent = '▼'
    header.appendChild(caret)
    const nameContainer = document.createElement('span')
    makeEditable(nameContainer, playerName, (val) => {
      const e2 = state.entries.find(x => x.id === entry.id)
      if (!e2) return
      state.envs.forEach(env => {
        const arr = e2.tokens[env.name]
        if (arr) {
          arr.forEach(t => {
            if (t.playerName === playerName) t.playerName = val
          })
        }
      })
      saveState()
    })
    header.appendChild(nameContainer)

    const delBtn = document.createElement('button')
    delBtn.className = 'btn-icon'
    delBtn.textContent = '✕'
    delBtn.title = 'Delete all tokens for this player'
    delBtn.style.marginLeft = 'auto'
    delBtn.onclick = (e) => {
      e.stopPropagation()
      if (!confirm(`Delete all tokens for "${playerName}"?`)) return
      setState(s => {
        const e2 = s.entries.find(x => x.id === entry.id)
        if (!e2) return
        state.envs.forEach(env => {
          const arr = e2.tokens[env.name]
          if (arr) e2.tokens[env.name] = arr.filter(t => t.playerName !== playerName)
        })
      })
    }
    header.appendChild(delBtn)

    const sectionBody = document.createElement('div')
    sectionBody.className = 'collapsible-body'

    playerPairs.forEach(p => {
      sectionBody.appendChild(renderTokenGroup(entry, p.token, p.tokenIdx, p.envName, { headerLabel: p.envName }))
    })

    playerSection.append(header, sectionBody)
    header.onclick = () => toggleCollapsed(header)
    body.appendChild(playerSection)
  })
}


// --- sync urls (lightweight, no full re-render) ---

function syncUrls() {
  document.querySelectorAll('.game-token-row').forEach(row => {
    const gameIdx = +row.dataset.gameIdx
    const entryId = row.dataset.entryId
    const tokenIdx = +row.dataset.tokenIdx
    const envName = row.dataset.envName
    const entry = state.entries.find(e => e.id === entryId)
    const env = state.envs.find(e => e.name === envName)
    const token = entry?.tokens?.[envName]?.[tokenIdx]
    const game = state.games[gameIdx]
    if (!entry || !token || !game || !env) return

    const envUrl = buildUrl(game, env, entry, token)
    const localUrl = state.localUrl ? buildLocalUrl(game, entry, token) : ''

    row.dataset.envUrl = envUrl
    row.dataset.localUrl = localUrl
    const link = row.querySelector('.env-link')
    if (link) { link.href = envUrl; link.textContent = game.name || '?' }
  })
}

function syncPlaceholders() {
  document.querySelectorAll('input[data-type="env"][data-field="domain"]').forEach(inp => {
    inp.placeholder = state.globalDomain
  })
  const addRedir = document.getElementById('newRedirect')
  if (addRedir) addRedir.placeholder = state.globalRedirectUrl || 'Redirect URL'
  const envAdd = document.getElementById('envDomainAdd')
  if (envAdd) envAdd.placeholder = state.globalDomain || 'domain'
}

function syncEnvSelects() {
  document.querySelectorAll('.env-select').forEach(select => {
    const val = select.value
    select.innerHTML = ''
    state.envs.forEach(env => {
      const opt = document.createElement('option')
      opt.value = env.name
      opt.textContent = env.name
      select.appendChild(opt)
    })
    if ([...select.options].some(o => o.value === val)) {
      select.value = val
    }
  })
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
