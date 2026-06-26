var estoque = [];
var vendas  = [];
let carrinho = [];

function localDateStr(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-'
    + String(dt.getMonth() + 1).padStart(2, '0') + '-'
    + String(dt.getDate()).padStart(2, '0');
}

function localMonthStr(d) {
  return localDateStr(d || new Date()).slice(0, 7);
}

// ── Controle de acesso por perfil ─────────────────────────
// admin   → acesso total (home, dashboard, historico, etc.)
// vendedor → inicio, estoque, vendas, crediario

var _ABAS_ADMIN    = ['home', 'dashboard', 'historico', 'despesas'];
var _ABAS_VENDEDOR = ['inicio', 'estoque', 'vendas', 'crediario', 'configuracoes'];

function aplicarPermissoes(role) {
  // admin, gerente e owner têm acesso total; vendedor é restrito
  var isPrivilegiado = role === 'admin' || role === 'gerente' || role === 'owner';

  // Nav: botões exclusivos do admin/gerente ocultos para vendedor
  document.querySelectorAll('nav button[data-role="admin"]').forEach(function(btn) {
    btn.classList.toggle('role-bloqueado', !isPrivilegiado);
  });

  // Nav: botão início do vendedor oculto para admin/gerente
  document.querySelectorAll('nav button[data-role="vendedor"]').forEach(function(btn) {
    btn.classList.toggle('role-bloqueado', isPrivilegiado);
  });

  // Seções exclusivas do admin/gerente
  _ABAS_ADMIN.forEach(function(id) {
    var sec = document.getElementById(id);
    if (sec) sec.style.display = isPrivilegiado ? '' : 'none';
  });

  // Seção inicio oculta para admin/gerente
  var secInicio = document.getElementById('inicio');
  if (secInicio) secInicio.style.display = isPrivilegiado ? 'none' : '';

  // Oculta lucro/margem do carrinho para vendedor
  var rowLucro  = document.getElementById('pdvRowLucro');
  var rowMargem = document.getElementById('pdvRowMargem');
  if (rowLucro)  rowLucro.style.display  = isPrivilegiado ? '' : 'none';
  if (rowMargem) rowMargem.style.display = isPrivilegiado ? '' : 'none';

  // Navegação inicial por perfil
  if (isPrivilegiado) {
    setTimeout(function() { mostrarAba('home'); }, 0);
  } else {
    setTimeout(function() { mostrarAba('inicio'); }, 0);
  }
}

// Verificação de acesso antes de abrir aba
function _podeAcessar(abaId) {
  var role          = window.currentUserRole || 'vendedor';
  var isPrivilegiado = role === 'admin' || role === 'gerente' || role === 'owner';
  if (_ABAS_ADMIN.includes(abaId) && !isPrivilegiado) return false;
  if (abaId === 'inicio' && isPrivilegiado) return false;
  return true;
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================

function initConfiguracoes() {
  var emailEl = document.getElementById('cfgEmail');
  var cargoEl = document.getElementById('cfgCargo');
  if (emailEl && window.currentUser) emailEl.value = window.currentUser.email || '';
  if (cargoEl) {
    var labels = { admin: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor', owner: 'Owner' };
    cargoEl.value = labels[window.currentUserRole] || window.currentUserRole || '';
  }

  var docEl = document.getElementById('cfgDocFiscal');
  if (docEl) docEl.value = localStorage.getItem('docFiscal') || '';

  // Limpar campos de senha
  ['cfgSenhaAtual','cfgNovaSenha','cfgConfirmarSenha'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var erroEl = document.getElementById('cfgSenhaErro');
  if (erroEl) erroEl.style.display = 'none';
}

function salvarDocumentoFiscal() {
  var val = (document.getElementById('cfgDocFiscal')?.value || '').trim();
  localStorage.setItem('docFiscal', val);
  showAlert(val ? 'Documento fiscal salvo!' : 'Documento fiscal removido.', 'sucesso');
}

function cfgToggleSenha(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function cfgAlterarSenha() {
  var atual     = document.getElementById('cfgSenhaAtual')?.value || '';
  var nova      = document.getElementById('cfgNovaSenha')?.value || '';
  var confirmar = document.getElementById('cfgConfirmarSenha')?.value || '';
  var erroEl    = document.getElementById('cfgSenhaErro');

  function mostrarErro(msg) {
    if (erroEl) { erroEl.textContent = msg; erroEl.style.display = 'flex'; }
  }

  if (erroEl) erroEl.style.display = 'none';

  if (!atual || !nova || !confirmar) return mostrarErro('Preencha todos os campos.');
  if (nova.length < 6) return mostrarErro('A nova senha deve ter pelo menos 6 caracteres.');
  if (nova !== confirmar) return mostrarErro('As senhas não coincidem.');

  var btn = document.getElementById('cfgBtnAlterarSenha');
  if (btn) { btn.disabled = true; btn.textContent = 'Alterando…'; }

  if (typeof window.authAlterarSenha === 'function') {
    window.authAlterarSenha(atual, nova)
      .then(function() {
        showAlert('Senha alterada com sucesso!', 'sucesso');
        ['cfgSenhaAtual','cfgNovaSenha','cfgConfirmarSenha'].forEach(function(id) {
          var el = document.getElementById(id); if (el) el.value = '';
        });
      })
      .catch(function(msg) {
        mostrarErro(msg);
      })
      .finally(function() {
        if (btn) { btn.disabled = false; btn.textContent = 'Alterar Senha'; }
      });
  } else {
    mostrarErro('Função de autenticação não disponível.');
    if (btn) { btn.disabled = false; btn.textContent = 'Alterar Senha'; }
  }
}

// ── Limpar Estoque com countdown ──────────────────────────
var _cfgCountdownTimer = null;

function cfgLimparEstoque() {
  var qtd = (window.estoque || []).length;
  var qtdEl = document.getElementById('cfgLimparQtd');
  if (qtdEl) qtdEl.textContent = qtd;

  var okBtn = document.getElementById('cfgLimparOkBtn');
  if (okBtn) okBtn.disabled = true;

  var hintEl = document.getElementById('cfgLimparHint');
  var secEl  = document.getElementById('cfgHintSec');
  var numEl  = document.getElementById('cfgCountdownNum');
  var circle = document.getElementById('cfgCountdownCircle');

  var TOTAL = 10;
  var restante = TOTAL;
  var circum = 2 * Math.PI * 18; // r=18

  function tick() {
    if (numEl)  numEl.textContent  = restante;
    if (secEl)  secEl.textContent  = restante;
    if (circle) {
      var prog = restante / TOTAL;
      circle.style.strokeDashoffset = circum * (1 - prog);
    }
    if (hintEl && restante > 0) hintEl.style.display = '';
    if (restante <= 0) {
      if (okBtn)  { okBtn.disabled = false; }
      if (hintEl) { hintEl.style.display = 'none'; }
      return;
    }
    restante--;
    _cfgCountdownTimer = setTimeout(tick, 1000);
  }

  if (circle) {
    circle.style.strokeDasharray  = circum;
    circle.style.strokeDashoffset = 0;
  }

  document.getElementById('cfgLimparOverlay').classList.add('ativo');
  var modal = document.getElementById('cfgLimparModal');
  modal.style.display = 'block';
  requestAnimationFrame(function() { modal.classList.add('ativo'); });

  tick();
}

function cfgFecharLimparModal() {
  clearTimeout(_cfgCountdownTimer);
  document.getElementById('cfgLimparOverlay').classList.remove('ativo');
  var modal = document.getElementById('cfgLimparModal');
  modal.classList.remove('ativo');
  setTimeout(function() { modal.style.display = ''; }, 200);
}

function cfgExecutarLimparEstoque() {
  clearTimeout(_cfgCountdownTimer);
  window.estoque = [];
  salvarDados();
  if (typeof atualizarTabelaEstoque  === 'function') atualizarTabelaEstoque();
  if (typeof atualizarSelectProdutos === 'function') atualizarSelectProdutos();
  cfgFecharLimparModal();
  showAlert('Estoque limpo com sucesso.', 'sucesso');
}

// ── Excluir Histórico de Vendas com countdown ─────────────
var _cfgHistoricoTimer = null;

function cfgLimparHistorico() {
  var qtd = (window.vendas || JSON.parse(localStorage.getItem('vendas') || '[]')).length;
  var qtdEl = document.getElementById('cfgHistoricoQtd');
  if (qtdEl) qtdEl.textContent = qtd;

  var okBtn  = document.getElementById('cfgHistoricoOkBtn');
  if (okBtn) okBtn.disabled = true;

  var hintEl  = document.getElementById('cfgHistoricoHint');
  var secEl   = document.getElementById('cfgHistoricoSec');
  var numEl   = document.getElementById('cfgHistoricoNum');
  var circle  = document.getElementById('cfgHistoricoCircle');
  var TOTAL   = 10;
  var restante = TOTAL;
  var circum  = 2 * Math.PI * 18;

  function tick() {
    if (numEl)  numEl.textContent  = restante;
    if (secEl)  secEl.textContent  = restante;
    if (circle) circle.style.strokeDashoffset = circum * (1 - restante / TOTAL);
    if (hintEl && restante > 0) hintEl.style.display = '';
    if (restante <= 0) {
      if (okBtn)  okBtn.disabled = false;
      if (hintEl) hintEl.style.display = 'none';
      return;
    }
    restante--;
    _cfgHistoricoTimer = setTimeout(tick, 1000);
  }

  if (circle) {
    circle.style.strokeDasharray  = circum;
    circle.style.strokeDashoffset = 0;
  }

  document.getElementById('cfgHistoricoOverlay').classList.add('ativo');
  var modal = document.getElementById('cfgHistoricoModal');
  modal.style.display = 'block';
  requestAnimationFrame(function() { modal.classList.add('ativo'); });
  tick();
}

function cfgFecharHistoricoModal() {
  clearTimeout(_cfgHistoricoTimer);
  document.getElementById('cfgHistoricoOverlay').classList.remove('ativo');
  var modal = document.getElementById('cfgHistoricoModal');
  modal.classList.remove('ativo');
  setTimeout(function() { modal.style.display = ''; }, 200);
}

function cfgExecutarLimparHistorico() {
  clearTimeout(_cfgHistoricoTimer);
  window.vendas = [];
  salvarDados();
  if (typeof atualizarHistorico === 'function') atualizarHistorico();
  if (typeof atualizarHome      === 'function') atualizarHome();
  if (typeof atualizarDashboard === 'function') atualizarDashboard();
  cfgFecharHistoricoModal();
  showAlert('Histórico de vendas excluído com sucesso.', 'sucesso');
}

// ── Seção Início (vendedor/gerente) ──────────────────────
var _inicioClockInterval = null;

function initInicio() {
  atualizarInicio();
  if (_inicioClockInterval) clearInterval(_inicioClockInterval);
  _inicioClockInterval = setInterval(function() {
    var agora = new Date();
    var cl = document.getElementById('inicioClock');
    if (cl) cl.textContent = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    var rg = document.getElementById('inicioRelogioGrande');
    if (rg) rg.textContent = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }, 1000);
}

function atualizarInicio() {
  var agora = new Date();

  // Data
  var dateEl = document.getElementById('inicioDate');
  if (dateEl) dateEl.textContent = agora.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  // Relógio
  var clEl = document.getElementById('inicioClock');
  if (clEl) clEl.textContent = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  // Saudação
  var h = agora.getHours();
  var saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  var grEl = document.getElementById('inicioGreeting');
  if (grEl) grEl.textContent = saudacao + ',';
  var nomeEl = document.getElementById('inicioUserNome');
  if (nomeEl) nomeEl.textContent = window.currentUserNome || '';

  // Stats do dia
  var hoje   = localDateStr(agora);
  var vendas = JSON.parse(localStorage.getItem('vendas')) || [];
  var est    = JSON.parse(localStorage.getItem('estoque')) || [];

  var vendasHoje = vendas.filter(function(v) { return v.data === hoje; });
  var txsHoje    = new Set(vendasHoje.map(function(v) { return v.txId || v.data + v.hora; })).size;

  var vh = document.getElementById('inicioVendasHoje');
  if (vh) vh.textContent = txsHoje;

  // Relógio grande
  var rg = document.getElementById('inicioRelogioGrande');
  if (rg) rg.textContent = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  var rd = document.getElementById('inicioRelogioData');
  if (rd) rd.textContent = agora.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
}

function vendaSucessoConcluido() {
  fecharVendaSucesso();
  var role = window.currentUserRole || 'vendedor';
  var primeiraAba = (role === 'admin' || role === 'gerente' || role === 'owner') ? 'home' : 'inicio';
  mostrarAba(primeiraAba);
}

// Toggle visibilidade da senha no login
function authToggleSenha(btn) {
  var inp = document.getElementById('authSenha');
  if (!inp) return;
  var show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// --------------------------------
// Alert Global
// --------------------------------

function showAlert(msg, tipo) {
  // tipo: 'erro' | 'aviso' | 'sucesso' (padrão: 'aviso')
  const t = tipo || 'aviso';
  const icons = { erro: '✕', aviso: '!', sucesso: '✓' };
  const iconEl = document.getElementById('alertIconWrap');
  const msgEl  = document.getElementById('alertMsg');
  if (!iconEl || !msgEl) { window._nativeAlert(msg); return; }
  iconEl.className = 'alert-icon-wrap tipo-' + t;
  iconEl.textContent = icons[t] || '!';
  msgEl.textContent = msg;
  document.getElementById('alertOverlay').classList.add('ativo');
  // força reflow para a transição funcionar
  const modal = document.getElementById('alertModal');
  modal.style.display = 'block';
  requestAnimationFrame(() => modal.classList.add('ativo'));
  setTimeout(() => document.getElementById('alertModal').querySelector('button').focus(), 50);
}

function fecharAlert() {
  document.getElementById('alertOverlay').classList.remove('ativo');
  const modal = document.getElementById('alertModal');
  modal.classList.remove('ativo');
  setTimeout(() => { modal.style.display = ''; }, 200);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('alertModal').classList.contains('ativo')) {
    fecharAlert();
  }
});

// Preserva o alert nativo caso o modal não esteja disponível ainda
window._nativeAlert = window.alert.bind(window);

var _confirmCallback = null;

function showConfirm(msg, onConfirm, opts) {
  const o = opts || {};
  const msgEl    = document.getElementById('confirmMsg');
  const okBtn    = document.getElementById('confirmOkBtn');
  const iconEl   = document.getElementById('confirmIconWrap');
  if (!msgEl) { if (window.confirm(msg)) onConfirm(); return; }
  msgEl.textContent  = msg;
  okBtn.textContent  = o.okLabel  || 'Confirmar';
  okBtn.className    = 'confirm-ok-btn ' + (o.danger !== false ? 'btn-danger' : 'btn-primary');
  iconEl.textContent = o.icon || '⚠';
  iconEl.className   = 'alert-icon-wrap ' + (o.iconTipo || 'tipo-aviso');
  _confirmCallback   = onConfirm;
  document.getElementById('confirmOverlay').classList.add('ativo');
  const modal = document.getElementById('confirmModal');
  modal.style.display = 'block';
  requestAnimationFrame(() => modal.classList.add('ativo'));
  setTimeout(() => okBtn.focus(), 50);
}

function fecharConfirm(executar) {
  document.getElementById('confirmOverlay').classList.remove('ativo');
  const modal = document.getElementById('confirmModal');
  modal.classList.remove('ativo');
  setTimeout(() => { modal.style.display = ''; }, 200);
  if (executar && typeof _confirmCallback === 'function') {
    const cb = _confirmCallback;
    _confirmCallback = null;
    cb();
  } else {
    _confirmCallback = null;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('confirmModal').classList.contains('ativo')) {
    fecharConfirm(false);
  }
});

// --------------------------------
// Crediário — shims (replaced by new system)
// --------------------------------

function carregarCrediarios() {
  if (document.getElementById('tabelaCrediario')) initCrediario();
}
function adicionarCrediario()  {}
function limparFormulario()    {}
function carregarHistorico()   {}
function removerDoHistorico(_i) {}
function pagarParcela(_i)       {}
function removerCrediario(_i)   {}

// --------------------------------
// Calculadora de Troco
// --------------------------------

function calcularTroco() {
  const valorCompra = parseFloat(document.getElementById("valorCompraCalc").value);
  const valorPago = parseFloat(document.getElementById("valorPago").value);
  const resultadoDiv = document.getElementById("resultado");

  if (isNaN(valorCompra) || isNaN(valorPago)) {
    resultadoDiv.innerHTML = "<p>Preencha ambos os campos.</p>";
    return;
  }

  if (valorPago < valorCompra) {
    resultadoDiv.innerHTML = "<p>Valor pago insuficiente.</p>";
    return;
  }

  let trocoRestante = (valorPago - valorCompra).toFixed(2);
  const cedulas = [200, 100, 50, 20, 10, 5, 2];
  const moedas = [1, 0.5, 0.25, 0.1, 0.05, 0.01];

  let detalhes = "<h3>Troco: R$ " + trocoRestante + "</h3><ul>";

  [...cedulas, ...moedas].forEach(valor => {
    const qtd = Math.floor(trocoRestante / valor);
    if (qtd > 0) {
      detalhes += `<li>${qtd} x R$ ${valor.toFixed(2)}</li>`;
      trocoRestante = (trocoRestante - qtd * valor).toFixed(2);
    }
  });

  resultadoDiv.innerHTML = detalhes + "</ul>";
}

// --------------------------------
// Dados
// --------------------------------

function salvarDados() {
  localStorage.setItem('estoque', JSON.stringify(estoque));
  localStorage.setItem('vendas', JSON.stringify(vendas));
  if (typeof window.autoSalvarFirebase === 'function') window.autoSalvarFirebase();
}

// --------------------------------
// Navegação
// --------------------------------

function mostrarAba(abaId) {
  if (!window.currentUser) return;
  if (!_podeAcessar(abaId)) return; // silencioso — nav já oculta botões bloqueados
  abrirAba(abaId);
}

function abrirAba(abaId) {
  document.querySelectorAll('section').forEach(sec => sec.classList.remove('active'));
  const sec = document.getElementById(abaId);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('nav button').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', oc.includes(`'${abaId}'`));
  });

  if (abaId === 'inicio')        initInicio();
  if (abaId === 'home')          initHome();
  if (abaId === 'dashboard')     atualizarDashboard();
  if (abaId === 'estoque')       atualizarTudoEstoque();
  if (abaId === 'vendas')        initPDV();
  if (abaId === 'crediario')     initCrediario();
  if (abaId === 'historico')     { _periodoAtivo = 0; atualizarHistorico(); }
  if (abaId === 'despesas')      initDespesas();
  if (abaId === 'configuracoes') initConfiguracoes();
}

// ============================================================
// HOME — Página Inicial
// ============================================================

var _homeClockInterval = null;
var _homeAmountRaf = null;

function initHome() {
  _startHomeClock();
  atualizarHome();
}

var _homeValoresOcultos = false;
var _homeValoresReais   = {};

const _HOME_IDS_OCULTAR = ['homeAmount', 'homeLucro', 'homeTicket', 'homeProgressPct', 'homeProgressMeta', 'homeVendas'];

function homeToggleVisibilidade() {
  _homeValoresOcultos = !_homeValoresOcultos;
  const btn  = document.getElementById('homeToggleVis');
  const icon = document.getElementById('homeEyeIcon');
  const fill = document.getElementById('homeProgressFill');

  if (_homeValoresOcultos) {
    // Guarda valores reais e substitui por asteriscos
    _HOME_IDS_OCULTAR.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      _homeValoresReais[id] = el.textContent;
      el.textContent = '* * *';
    });
    if (fill) { _homeValoresReais._fillWidth = fill.style.width; fill.style.width = '0%'; }
    btn.classList.add('oculto');
    icon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    // Restaura valores reais
    _HOME_IDS_OCULTAR.forEach(id => {
      const el = document.getElementById(id);
      if (el && _homeValoresReais[id] !== undefined) el.textContent = _homeValoresReais[id];
    });
    if (fill && _homeValoresReais._fillWidth) fill.style.width = _homeValoresReais._fillWidth;
    _homeValoresReais = {};
    btn.classList.remove('oculto');
    icon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>`;
  }
}

function _startHomeClock() {
  function tick() {
    const now  = new Date();
    const dateEl  = document.getElementById('homeDate');
    const clockEl = document.getElementById('homeClock');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    }
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
  }
  clearInterval(_homeClockInterval);
  tick();
  _homeClockInterval = setInterval(tick, 1000);
}

function atualizarHome() {
  const vendas  = window.vendas  || [];
  const estoque = window.estoque || [];
  const hojeStr = localDateStr();

  const vendasHoje = vendas.filter(v => v.data === hojeStr);

  const fat = vendasHoje.reduce((s, v) => s + v.quantidade * (v.precoComDesconto || v.preco || 0), 0);

  const luc = vendasHoje.reduce((s, v) => {
    let pc;
    if (v.precoCompra !== undefined) {
      pc = v.precoCompra;
    } else {
      const prod = estoque.find(p => p.nome === v.nome);
      pc = prod ? (prod.precoCompra || 0) : 0;
    }
    const pv = (v.precoComDesconto || v.preco || 0);
    return s + (pv - pc) * v.quantidade;
  }, 0);

  // Hero: anima o número
  _homeAnimateAmount(fat);

  // Stats
  const set$ = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set$('homeVendas', vendasHoje.length);
  set$('homeLucro',  luc !== 0 ? fmtAbrev(luc) : 'R$ 0,00');

  // Formas de pagamento de hoje
  const mapaFormas = {};
  vendasHoje.forEach(v => {
    const f = v.formaPagamento || 'Outros';
    if (!mapaFormas[f]) mapaFormas[f] = 0;
    mapaFormas[f] += v.quantidade * (v.precoComDesconto || v.preco || 0);
  });
  const formasEl = document.getElementById('homeFormasHoje');
  if (formasEl) {
    const cores = { 'PIX': '#00C48C', 'Dinheiro': '#4CAF50', 'Cartão Crédito': '#2196F3', 'Cartão Débito': '#03A9F4', 'Crediário': '#FF9800' };
    if (Object.keys(mapaFormas).length === 0) {
      formasEl.innerHTML = '';
    } else {
      formasEl.innerHTML = Object.entries(mapaFormas).map(([forma, val]) => {
        const cor = cores[forma] || '#D4AF37';
        return `<div class="home-forma-pill">
          <span class="home-forma-dot" style="background:${cor}"></span>
          <span class="home-forma-nome">${forma}</span>
          <span class="home-forma-val">${fmtAbrev(val)}</span>
        </div>`;
      }).join('');
    }
  }

  // Progress da meta diária
  const metas      = JSON.parse(localStorage.getItem('dashMetas')) || { metaDiaria: 500 };
  const metaDiaria = metas.metaDiaria || 500;
  const pct        = Math.min((fat / Math.max(metaDiaria, 0.01)) * 100, 100);
  setTimeout(() => {
    const fill = document.getElementById('homeProgressFill');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
  }, 200);
  set$('homeProgressPct',  pct.toFixed(1) + '% da meta diária');
  set$('homeProgressMeta', 'Meta: ' + fmtAbrev(metaDiaria));

  // Alertas de estoque
  const zerados = estoque.filter(p => p.quantidade === 0);
  const baixos  = estoque.filter(p => p.quantidade > 0 && p.quantidade <= (p.estoqueMin || 3));
  const alertsEl = document.getElementById('homeAlerts');
  if (alertsEl) {
    let html = '';
    if (zerados.length) {
      const nomes = zerados.slice(0, 3).map(p => p.nome).join(', ');
      const extra = zerados.length > 3 ? ` +${zerados.length - 3}` : '';
      html += `<div class="home-alert home-alert-error">⚠ Sem estoque: <strong>${nomes}${extra}</strong></div>`;
    }
    if (baixos.length) {
      html += `<div class="home-alert home-alert-warning">↓ ${baixos.length} produto${baixos.length > 1 ? 's' : ''} com estoque baixo</div>`;
    }
    alertsEl.innerHTML = html;
  }
}

function _homeAnimateAmount(target) {
  const el = document.getElementById('homeAmount');
  if (!el) return;
  cancelAnimationFrame(_homeAmountRaf);
  const t0  = performance.now();
  const dur = 900;
  function step(now) {
    const p    = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val  = target * ease;
    const abs  = Math.abs(val);
    let txt;
    if      (abs >= 1e6) txt = (abs / 1e6).toFixed(1).replace('.', ',') + 'M';
    else if (abs >= 1e5) txt = Math.round(abs / 1e3) + 'k';
    else if (abs >= 1e3) txt = (abs / 1e3).toFixed(1).replace('.', ',') + 'k';
    else                 txt = abs.toFixed(2).replace('.', ',');
    el.textContent = txt;
    if (p < 1) _homeAmountRaf = requestAnimationFrame(step);
  }
  _homeAmountRaf = requestAnimationFrame(step);
}

// --------------------------------
// Estoque
// --------------------------------

function adicionarProduto() {
  const nome          = document.getElementById('nomeProduto').value.trim();
  const codigoInterno = document.getElementById('codigoInternoProduto')?.value.trim() || '';
  const sku           = document.getElementById('skuProduto')?.value.trim() || '';
  const codigoBarras  = document.getElementById('codigoBarrasProduto')?.value.trim() || '';
  const categoria     = document.getElementById('categoriaProduto')?.value.trim() || '';
  const marca         = document.getElementById('marcaProduto').value.trim();
  const fornecedor    = document.getElementById('fornecedorProduto').value.trim();
  const quantidade    = parseInt(document.getElementById('quantidadeProduto').value);
  const estoqueMin    = parseInt(document.getElementById('estoqueMinProduto')?.value) || 0;
  const localizacao   = document.getElementById('localizacaoProduto')?.value.trim() || '';
  const precoCompra   = parseFloat(document.getElementById('precoCompraProduto').value);
  const precoVenda    = parseFloat(document.getElementById('precoVendaProduto').value);

  if (!nome || isNaN(quantidade) || isNaN(precoVenda)) {
    return showAlert('Preencha pelo menos: Nome, Quantidade e Preço de Venda.', 'aviso');
  }

  if (typeof estEditIndex !== 'undefined' && estEditIndex !== null) {
    estoque[estEditIndex] = {
      ...estoque[estEditIndex],
      nome, codigoInterno, sku, codigoBarras, categoria, marca, fornecedor, quantidade,
      estoqueMin: isNaN(estoqueMin) ? 0 : estoqueMin,
      localizacao,
      precoCompra: isNaN(precoCompra) ? 0 : precoCompra,
      precoVenda, preco: precoVenda,
    };
    estEditIndex = null;
  } else {
    const existente = estoque.find(p => p.nome === nome);
    if (existente) {
      existente.quantidade    += quantidade;
      existente.codigoInterno  = codigoInterno || existente.codigoInterno;
      existente.sku            = sku           || existente.sku;
      existente.codigoBarras   = codigoBarras  || existente.codigoBarras;
      existente.categoria      = categoria     || existente.categoria;
      existente.marca          = marca         || existente.marca;
      existente.fornecedor     = fornecedor    || existente.fornecedor;
      existente.estoqueMin     = estoqueMin    || existente.estoqueMin;
      existente.localizacao    = localizacao   || existente.localizacao;
      existente.precoCompra    = isNaN(precoCompra) ? existente.precoCompra : precoCompra;
      existente.precoVenda     = precoVenda;
      existente.preco          = precoVenda;
    } else {
      estoque.push({ nome, codigoInterno, sku, codigoBarras, categoria, marca, fornecedor, quantidade, estoqueMin: isNaN(estoqueMin) ? 0 : estoqueMin, localizacao, precoCompra: isNaN(precoCompra) ? 0 : precoCompra, precoVenda, preco: precoVenda, dataCadastro: localDateStr() });
    }
  }

  salvarDados();
  fecharFormProduto();
  atualizarTudoEstoque();
}

function editarProduto(index) {
  abrirFormProduto(index);
}

function excluirProduto(index) {
  showConfirm('Tem certeza que deseja excluir este produto?', () => {
    estoque.splice(index, 1);
    salvarDados();
    atualizarTudoEstoque();
  });
}

function atualizarTabelaEstoque() {
  const tabela        = document.getElementById('tabelaEstoque');
  const busca         = (document.getElementById('buscaProduto')?.value || '').toLowerCase().trim();
  const filtroStatus  = document.getElementById('filtroEstStatus')?.value || '';
  const contador      = document.getElementById('buscaContador');
  const todas         = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje          = new Date();
  const { vendNomes30, produtosParados } = _calcSemGiro(estoque, todas, hoje);

  tabela.innerHTML = `<tr>
    <th>Produto</th><th>Status</th><th>Qtd</th>
    <th>Custo</th><th>Venda</th><th>Margem</th>
    <th>Lucro Unit.</th><th>Total</th><th></th>
  </tr>`;

  let visiveis = 0;
  const valorTotal = estoque.reduce((s, p) => s + p.quantidade * (p.precoVenda || p.preco || 0), 0);

  estoque.forEach((p, i) => {
    const pv     = p.precoVenda || p.preco || 0;
    const pc     = p.precoCompra || 0;
    const status = getEstStatus(p, vendNomes30);

    if (filtroStatus) {
      if (filtroStatus === 'parado' && !produtosParados.has(p.nome)) return;
      else if (filtroStatus !== 'parado' && status.key !== filtroStatus) return;
    }

    const termo = [p.nome, p.categoria || '', p.marca || '', p.fornecedor || ''].join(' ').toLowerCase();
    if (busca && !termo.includes(busca)) return;

    visiveis++;

    const margem    = pc > 0 ? ((pv - pc) / pc * 100) : null;
    const margemCor = margem === null ? 'var(--text-muted)' : margem >= 30 ? 'var(--green)' : margem >= 10 ? '#F59E0B' : 'var(--red)';
    const lucroU    = pv - pc;

    tabela.innerHTML += `<tr onclick="abrirDrawerProduto(${i})" style="cursor:pointer;">
      <td>
        <div class="est-prod-cell">
          <div class="est-prod-inicial">${p.nome.charAt(0).toUpperCase()}</div>
          <div>
            <div class="est-prod-nome">${p.nome}</div>
            <div class="est-prod-meta">${[p.categoria, p.marca].filter(Boolean).join(' · ') || p.fornecedor || '—'}</div>
          </div>
        </div>
      </td>
      <td><span class="est-badge ${status.cls}">${status.label}</span></td>
      <td><span class="est-qtd${p.quantidade === 0 ? ' est-qtd-zero' : ''}">${p.quantidade}</span></td>
      <td>${pc > 0 ? 'R$ ' + pc.toFixed(2) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><strong>R$ ${pv.toFixed(2)}</strong></td>
      <td><span style="color:${margemCor};font-weight:700;">${margem !== null ? margem.toFixed(1) + '%' : '—'}</span></td>
      <td>${lucroU > 0 ? '<span style="color:var(--green)">R$ ' + lucroU.toFixed(2) + '</span>' : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>R$ ${(p.quantidade * pv).toFixed(2)}</td>
      <td><div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
        <button onclick="editarProduto(${i})" style="padding:5px 10px;font-size:0.75rem;" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-danger" onclick="excluirProduto(${i})" style="padding:5px 10px;font-size:0.75rem;" title="Excluir">✕</button>
      </div></td>
    </tr>`;
  });

  if (visiveis === 0) {
    tabela.innerHTML += `<tr><td colspan="9" style="text-align:center;padding:48px 20px;color:var(--text-muted);">
      ${busca || filtroStatus
        ? `Nenhum produto encontrado para o filtro aplicado.`
        : `<div style="font-size:2rem;margin-bottom:8px;">📦</div><div>Nenhum produto cadastrado ainda.<br><small>Clique em "+ Novo Produto" para começar.</small></div>`}
    </td></tr>`;
  }

  if (contador) contador.textContent = `${visiveis} produto${visiveis !== 1 ? 's' : ''}`;

  const elTotal = document.getElementById('valorTotalEstoque');
  if (elTotal) elTotal.textContent = fmtAbrev(valorTotal);
}

// ---- Dropdown de produto ----

let produtoDropdownAberto = false;

function atualizarSelectProdutos() {
  // PDV no longer uses the old product select DOM — safe no-op
}

function renderDropdownProdutos(busca) {
  const dropdown = document.getElementById('produtoDropdown');
  if (!dropdown) return;

  const termo = busca.toLowerCase().trim();
  const disponiveis = estoque
    .map((p, i) => ({ ...p, _i: i }))
    .filter(p => p.quantidade > 0)
    .filter(p => {
      if (!termo) return true;
      return `${p.nome} ${p.marca || ''} ${p.fornecedor || ''}`.toLowerCase().includes(termo);
    });

  if (disponiveis.length === 0) {
    dropdown.innerHTML = `<div class="produto-dropdown-vazio">Nenhum produto encontrado</div>`;
    return;
  }

  dropdown.innerHTML = disponiveis.map(p => {
    const preco = p.precoVenda || p.preco || 0;
    const meta  = [p.marca, p.fornecedor].filter(Boolean).join(' · ');
    const estoqueClass = p.quantidade <= 3 ? 'baixo' : 'ok';
    const estoqueLabel = p.quantidade <= 3 ? `⚠ ${p.quantidade} restantes` : `${p.quantidade} em estoque`;

    return `
      <div class="produto-dropdown-item" onmousedown="selecionarProduto(${p._i})">
        <span class="produto-dropdown-nome">
          ${p.nome}
          <span class="produto-dropdown-estoque ${estoqueClass}">${estoqueLabel}</span>
        </span>
        <span class="produto-dropdown-preco">R$ ${preco.toFixed(2)}</span>
        <span class="produto-dropdown-meta">${meta || 'Sem marca/fornecedor'}</span>
      </div>`;
  }).join('');
}

function filtrarProdutosDropdown() {
  const busca = document.getElementById('produtoBusca').value;
  // limpa seleção ao digitar
  document.getElementById('produtoVenda').value = '';
  const info = document.getElementById('produtoSelecionadoInfo');
  if (info) info.style.display = 'none';
  const input = document.getElementById('produtoBusca');
  if (input) input.classList.remove('tem-selecao');

  renderDropdownProdutos(busca);
  abrirDropdownProdutos();
}

function abrirDropdownProdutos() {
  const dropdown = document.getElementById('produtoDropdown');
  const busca = document.getElementById('produtoBusca')?.value || '';
  renderDropdownProdutos(busca);
  if (dropdown) dropdown.style.display = 'block';
  produtoDropdownAberto = true;
}

function fecharDropdownProdutos() {
  const dropdown = document.getElementById('produtoDropdown');
  if (dropdown) dropdown.style.display = 'none';
  produtoDropdownAberto = false;
}

// Listener único — fecha o dropdown ao clicar fora
document.addEventListener('click', (e) => {
  if (!produtoDropdownAberto) return;
  const wrapper = document.querySelector('.produto-search-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    fecharDropdownProdutos();
  }
});

function selecionarProduto(index) {
  const p = estoque[index];
  if (!p) return;

  const preco = p.precoVenda || p.preco || 0;
  const meta  = [p.marca, p.fornecedor].filter(Boolean).join(' · ');

  document.getElementById('produtoVenda').value = index;
  document.getElementById('produtoBusca').value = p.nome;
  document.getElementById('produtoBusca').classList.add('tem-selecao');

  const info = document.getElementById('produtoSelecionadoInfo');
  if (info) {
    info.style.display = 'flex';
    info.innerHTML = `
      <span class="produto-selecionado-nome">${p.nome}</span>
      ${meta ? `<span class="produto-selecionado-marca">${meta}</span>` : ''}
      <span class="produto-selecionado-preco">R$ ${preco.toFixed(2)}</span>`;
  }

  fecharDropdownProdutos();
}

// --------------------------------
// Carrinho / Vendas
// --------------------------------

function adicionarAoCarrinho() {
  const index = document.getElementById('produtoVenda').value;
  const quantidade = parseInt(document.getElementById('quantidadeVenda').value);
  const desconto = parseFloat(document.getElementById('descontoVenda').value) || 0;
  const cliente = "Cliente Não Informado";

  if (index === '' || isNaN(quantidade)) return showAlert('Preencha corretamente todos os campos.', 'aviso');

  const produto = estoque[index];
  if (quantidade > produto.quantidade) return showAlert('Quantidade insuficiente no estoque.', 'erro');

  const precoBase = produto.precoVenda || produto.preco || 0;
  const precoComDesconto = precoBase - (precoBase * desconto / 100);
  const subtotal = precoComDesconto * quantidade;

  carrinho.push({ idProduto: index, nome: produto.nome, quantidade, preco: precoBase, desconto, precoComDesconto, subtotal, cliente });

  // limpa seleção de produto
  document.getElementById('produtoVenda').value = '';
  document.getElementById('produtoBusca').value = '';
  document.getElementById('produtoBusca').classList.remove('tem-selecao');
  const info = document.getElementById('produtoSelecionadoInfo');
  if (info) info.style.display = 'none';
  document.getElementById('quantidadeVenda').value = '';
  document.getElementById('descontoVenda').value = '';

  atualizarCarrinhoUI();
}

function atualizarCarrinhoUI() {
  const lista    = document.getElementById('carrinhoContainer');
  const footer   = document.getElementById('carrinhoFooter');
  const totalEl  = document.getElementById('carrinhoTotal');
  const contagem = document.getElementById('carrinhoContagem');
  let total = 0;

  lista.innerHTML = '';

  if (carrinho.length === 0) {
    lista.innerHTML = `
      <div class="carrinho-vazio">
        <span class="carrinho-vazio-icon">🛒</span>
        <p>Nenhum item adicionado</p>
      </div>`;
    if (footer)   footer.style.display   = 'none';
    if (contagem) contagem.textContent   = '0 itens';
    return;
  }

  carrinho.forEach((item, index) => {
    total += item.subtotal;
    const descontoInfo = item.desconto > 0 ? ` · ${item.desconto}% desc` : '';
    lista.innerHTML += `
      <div class="carrinho-item">
        <span class="carrinho-item-nome">${item.nome}</span>
        <span class="carrinho-item-subtotal">R$ ${item.subtotal.toFixed(2)}</span>
        <span class="carrinho-item-detalhe">${item.quantidade}x R$ ${item.preco.toFixed(2)}${descontoInfo}</span>
        <button class="btn-danger carrinho-item-remover" onclick="removerDoCarrinho(${index})">Remover</button>
      </div>`;
  });

  if (footer)   footer.style.display   = 'flex';
  if (totalEl)  totalEl.textContent    = `R$ ${total.toFixed(2)}`;
  if (contagem) contagem.textContent   = `${carrinho.length} ${carrinho.length === 1 ? 'item' : 'itens'}`;
}

function removerDoCarrinho(index) {
  carrinho.splice(index, 1);
  atualizarCarrinhoUI();
}

function finalizarVenda() {
  if (carrinho.length === 0) return showAlert('Carrinho está vazio.', 'aviso');

  const formaPagamento = document.getElementById('formaPagamento').value;
  if (!formaPagamento) return showAlert('Selecione a forma de pagamento.', 'aviso');

  const hoje = new Date();
  const data = localDateStr(hoje);
  const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  carrinho.forEach(item => {
    estoque[item.idProduto].quantidade -= item.quantidade;
    vendas.push({ nome: item.nome, quantidade: item.quantidade, preco: item.preco, desconto: item.desconto, precoComDesconto: item.precoComDesconto, formaPagamento, data, hora, cliente: item.cliente });
  });

  salvarDados();
  atualizarHistorico();
  carrinho = [];
  atualizarCarrinhoUI();
  showAlert('Venda finalizada com sucesso!', 'sucesso');
  atualizarSelectProdutos();
}

// --------------------------------
// Comprovante PDF
// --------------------------------

function gerarComprovanteDaVenda(index) {
  const vendas = JSON.parse(localStorage.getItem('vendas')) || [];
  gerarComprovante(vendas[index]);
}

function _buildComprovantePDF(venda) {
  const { jsPDF } = window.jspdf;

  // Agrupa itens da mesma transação
  const todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];
  const itens = venda.txId
    ? todasVendas.filter(v => v.txId === venda.txId)
    : [venda];

  const totalPago   = itens.reduce((s, v) => s + v.quantidade * (v.precoComDesconto !== undefined ? v.precoComDesconto : v.preco), 0);
  const totalItens  = itens.reduce((s, v) => s + v.quantidade, 0);
  const totalDesc   = itens.reduce((s, v) => { const pu = v.preco || 0; const pd = v.precoComDesconto !== undefined ? v.precoComDesconto : pu; return s + (pu - pd) * v.quantidade; }, 0);

  // Papel cupom: 80mm × dinâmico
  const W = 80;
  const alturaEst = 90 + itens.length * 18 + 50;
  const doc = new jsPDF({ unit: 'mm', format: [W, alturaEst] });
  const cx = W / 2; // centro

  // ── Paleta ────────────────────────────────────────────────
  const PRETO   = [15,  15,  15];
  const OURO    = [212, 175, 55];
  const OURO_D  = [180, 130, 0];
  const BRANCO  = [255, 255, 255];
  const CINZA   = [160, 160, 160];
  const CINZAC  = [100, 100, 100];
  const CINZAF  = [220, 220, 220];

  // ── Fundo preto total ─────────────────────────────────────
  doc.setFillColor(...PRETO);
  doc.rect(0, 0, W, alturaEst, 'F');

  let y = 0;

  // ── Cabeçalho dourado ─────────────────────────────────────
  doc.setFillColor(...OURO);
  doc.rect(0, 0, W, 28, 'F');

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...PRETO);
  doc.text('USE STYLO', cx, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(30, 20, 0);
  doc.text('MODA & ESTILO', cx, 17, { align: 'center' });

  doc.setFontSize(5.5);
  doc.text('Rua 7 de Setembro, 478 — Centro, São Pedro do Sul — RS', cx, 21.5, { align: 'center' });
  doc.text('Tel: (55) 99206-1704', cx, 25, { align: 'center' });

  y = 32;

  // ── Linha tracejada ───────────────────────────────────────
  function dashes(yy) {
    doc.setDrawColor(...CINZAC);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(4, yy, W - 4, yy);
    doc.setLineDashPattern([], 0);
  }

  // Data / hora / nº
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...CINZA);
  const dataFmt = venda.data ? venda.data.split('-').reverse().join('/') : 'N/A';
  doc.text('Data: ' + dataFmt, 5, y);
  doc.text('Hora: ' + (venda.hora || 'N/A'), cx + 2, y);
  y += 5;

  if (venda.txId) {
    doc.setFontSize(5.5);
    doc.setTextColor(...CINZAC);
    doc.text('Ref: ' + venda.txId.toUpperCase(), cx, y, { align: 'center' });
    y += 4;
  }

  dashes(y); y += 5;

  // ── Cabeçalho da tabela ───────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...OURO_D);
  doc.text('PRODUTO', 5, y);
  doc.text('QTD', 47, y, { align: 'center' });
  doc.text('UNIT.', 60, y, { align: 'center' });
  doc.text('TOTAL', W - 5, y, { align: 'right' });
  y += 3;

  dashes(y); y += 4;

  // ── Itens ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  itens.forEach(v => {
    const pv  = v.precoComDesconto !== undefined ? v.precoComDesconto : v.preco;
    const pu  = v.preco || pv;
    const sub = v.quantidade * pv;
    const nome = v.nome && v.nome.length > 22 ? v.nome.substring(0, 20) + '…' : (v.nome || '—');

    // Nome do produto
    doc.setFontSize(7);
    doc.setTextColor(...BRANCO);
    doc.setFont('helvetica', 'bold');
    doc.text(nome, 5, y);
    y += 4.5;

    // Linha de valores
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...CINZA);
    doc.text(String(v.quantidade) + 'x', 5, y);
    doc.text('R$ ' + pu.toFixed(2), 18, y);
    if (v.desconto > 0) {
      doc.setTextColor(255, 120, 80);
      doc.text('-' + v.desconto + '%', 44, y);
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...OURO);
    doc.text('R$ ' + sub.toFixed(2), W - 5, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 5;
  });

  dashes(y); y += 4;

  // ── Resumo ─────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setTextColor(...CINZA);

  doc.text(totalItens + ' item(s)', 5, y);
  if (totalDesc > 0) {
    doc.setTextColor(255, 120, 80);
    doc.text('Desconto: -R$ ' + totalDesc.toFixed(2), W - 5, y, { align: 'right' });
  }
  y += 5;

  // Forma de pagamento
  const formaLabel = { 'Dinheiro':'Dinheiro', 'Pix':'PIX', 'Cartao-Debito':'Cartão Débito', 'Cartao-Credito':'Cartão Crédito', 'Crediario':'Crediário' };
  const forma = formaLabel[venda.formaPagamento] || venda.formaPagamento || 'N/A';
  doc.setTextColor(...CINZA);
  doc.text('Pagamento: ' + forma, 5, y);
  y += 6;

  // ── Total ─────────────────────────────────────────────────
  doc.setFillColor(30, 25, 0);
  doc.roundedRect(4, y - 3, W - 8, 12, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...OURO_D);
  doc.text('TOTAL', 10, y + 3.5);

  doc.setFontSize(13);
  doc.setTextColor(...OURO);
  doc.text('R$ ' + totalPago.toFixed(2), W - 8, y + 4.5, { align: 'right' });
  y += 16;

  // ── Rodapé ────────────────────────────────────────────────
  dashes(y); y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...OURO);
  doc.text('Obrigado pela preferência!', cx, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...CINZAC);
  doc.text('Use Stylo — Moda & Estilo', cx, y, { align: 'center' });
  y += 3.5;
  var docFiscal = localStorage.getItem('docFiscal') || '00.000.000/0001-00';
  doc.text((docFiscal.length > 14 ? 'CNPJ: ' : 'CPF: ') + docFiscal, cx, y, { align: 'center' });

  return doc;
}

function gerarComprovante(venda) {
  const doc = _buildComprovantePDF(venda);
  doc.save('Comprovante_UseStylo_' + (venda.data || 'data').replace(/-/g,'') + '.pdf');
}

// --------------------------------
// Histórico de Vendas
// --------------------------------

function editarFormaPagamento(index, novaForma) {
  if (!novaForma) return;
  vendas[index].formaPagamento = novaForma;
  salvarDados();
  refreshPainel();
}

function editarDataVenda(index, novaData) {
  vendas[index].data = novaData;
  salvarDados();
  refreshPainel();
}

function removerVenda(index) {
  showConfirm('Remover esta venda do histórico?', () => {
    vendas.splice(index, 1);
    salvarDados();
    refreshPainel();
  });
}

function refreshPainel() {
  const temFiltro = document.getElementById('filtroData')?.value || document.getElementById('filtroForma')?.value;
  temFiltro ? filtrarVendas() : atualizarHistorico();
}

// --------------------------------
// Painel de Controle — helpers
// --------------------------------

const FORMA_CONFIG = {
  'Dinheiro':      { classe: 'dinheiro',  label: 'Dinheiro'       },
  'Pix':           { classe: 'pix',       label: 'PIX'            },
  'Cartao-Debito': { classe: 'debito',    label: 'Cartão Débito'  },
  'Cartao-Credito':{ classe: 'credito',   label: 'Cartão Crédito' },
  'Crediario':     { classe: 'crediario', label: 'Crediário'      },
};

function badgePagamento(forma) {
  const cfg = FORMA_CONFIG[forma] || { classe: 'outro', label: forma || 'Não informado' };
  return `<span class="badge-pagamento ${cfg.classe}">${cfg.label}</span>`;
}

function classeFormaBadge(forma) {
  return (FORMA_CONFIG[forma] || { classe: 'outro' }).classe;
}

function renderKPIs(lista) {
  let total = 0;
  lista.forEach(v => {
    total += v.quantidade * (v.precoComDesconto || v.preco);
  });
  const count  = lista.length;
  const media  = count > 0 ? total / count : 0;

  const el = (id) => document.getElementById(id);
  if (el('totalVendido')) el('totalVendido').textContent = fmtAbrev(total);
  if (el('totalVendas'))  el('totalVendas').textContent  = count;
  if (el('ticketMedio'))  el('ticketMedio').textContent  = fmtAbrev(media);

  // valorTotalEstoque é calculado em atualizarTabelaEstoque — só garantimos o prefix
  const elEst = el('valorTotalEstoque');
  if (elEst && !elEst.textContent.startsWith('R$')) {
    elEst.textContent = 'R$ 0,00';
  }
}

function renderTotaisPorForma(lista) {
  const mapa = {};
  lista.forEach(v => {
    const f = v.formaPagamento || 'Não informado';
    const sub = v.quantidade * (v.precoComDesconto || v.preco);
    mapa[f] = (mapa[f] || 0) + sub;
  });

  if (!Object.keys(mapa).length) {
    document.getElementById('totaisPorForma').innerHTML = '';
    return;
  }

  const itens = Object.entries(mapa).map(([forma, val]) => {
    const cls = classeFormaBadge(forma);
    const lbl = (FORMA_CONFIG[forma] || { label: forma }).label;
    return `<li class="forma-badge-${cls}">
      <span class="forma-badge-dot"></span>
      ${lbl}
      <span class="forma-badge-valor">R$ ${val.toFixed(2)}</span>
    </li>`;
  }).join('');

  document.getElementById('totaisPorForma').innerHTML = `<ul>${itens}</ul>`;
}

function renderTabelaVendas(lista, indicesOriginais) {
  const tabela = document.getElementById('tabelaVendas');

  tabela.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Produto</th>
      <th>Qtd</th>
      <th>Preço Unit.</th>
      <th>Desconto</th>
      <th>Total</th>
      <th>Pagamento</th>
      <th>Ações</th>
    </tr>`;

  if (lista.length === 0) {
    tabela.innerHTML += `
      <tr>
        <td colspan="8" style="text-align:center; padding:32px 0; color:var(--text-muted);">
          Nenhuma venda encontrada.
        </td>
      </tr>`;
    return;
  }

  lista.forEach((v, idx) => {
    const i = indicesOriginais[idx];
    const precoComDesconto = v.precoComDesconto || v.preco;
    const subtotal = v.quantidade * precoComDesconto;
    const dataFmt = v.data ? v.data.split('-').reverse().join('/') : '—';

    tabela.innerHTML += `
      <tr>
        <td>
          <span style="font-weight:500;">${dataFmt}</span>
          ${v.hora ? `<br><small>${v.hora}</small>` : ''}
        </td>
        <td><strong>${v.nome}</strong></td>
        <td>${v.quantidade}</td>
        <td>R$ ${(v.preco || 0).toFixed(2)}</td>
        <td>${v.desconto ? `<span style="color:var(--red)">${v.desconto}%</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td><strong style="color:var(--green)">R$ ${subtotal.toFixed(2)}</strong></td>
        <td>${badgePagamento(v.formaPagamento)}</td>
        <td>
          <div class="hist-acoes">
            <select class="hist-acoes-select" onchange="editarFormaPagamento(${i}, this.value)">
              <option value="">Alterar</option>
              <option value="Dinheiro"       ${v.formaPagamento==='Dinheiro'       ? 'selected':''}>Dinheiro</option>
              <option value="Pix"            ${v.formaPagamento==='Pix'            ? 'selected':''}>PIX</option>
              <option value="Cartao-Debito"  ${v.formaPagamento==='Cartao-Debito'  ? 'selected':''}>C. Débito</option>
              <option value="Cartao-Credito" ${v.formaPagamento==='Cartao-Credito' ? 'selected':''}>C. Crédito</option>
              <option value="Crediario"      ${v.formaPagamento==='Crediario'      ? 'selected':''}>Crediário</option>
            </select>
            <button class="hist-acoes-btn" onclick="gerarComprovanteDaVenda(${i})" title="Gerar comprovante">PDF</button>
            <button class="hist-acoes-btn btn-danger" onclick="removerVenda(${i})" title="Remover venda">✕</button>
          </div>
        </td>
      </tr>`;
  });
}

// --------------------------------
// Painel — funções principais
// --------------------------------

var _periodoAtivo = 0;

function atualizarHistorico() {
  filtrarPorPeriodo(_periodoAtivo);
}

function filtrarPorPeriodo(dias) {
  _periodoAtivo = dias;
  const todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];

  // Limpa filtros de data/forma e destaque do input
  const fd = document.getElementById('filtroData');
  const ff = document.getElementById('filtroForma');
  if (fd) { fd.value = ''; fd.classList.remove('filtro-data-ativo'); }
  if (ff) ff.value = '';

  // Marca botão ativo
  document.querySelectorAll('.hist-periodo-btn').forEach(b => b.classList.remove('ativo'));
  const labels = { 7:'7 dias', 15:'15 dias', 30:'30 dias', 90:'3 meses', 180:'6 meses', 365:'1 ano', 0:'Todo período' };
  document.querySelectorAll('.hist-periodo-btn').forEach(b => {
    if (b.textContent.trim() === (labels[dias] || '')) b.classList.add('ativo');
  });

  let filtradas, indices;
  if (dias === 0) {
    indices   = todasVendas.map((_, i) => i).reverse();
    filtradas = indices.map(i => todasVendas[i]);
  } else {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    const corteStr = localDateStr(corte);
    filtradas = [];
    indices   = [];
    todasVendas.forEach((v, i) => {
      if (v.data && v.data >= corteStr) { filtradas.push(v); indices.push(i); }
    });
    filtradas.reverse();
    indices.reverse();
  }

  renderKPIs(filtradas);
  renderTotaisPorForma(filtradas);
  renderTabelaVendas(filtradas, indices);
  setGrafico('semana');
}

function filtrarVendas() {
  const fd = document.getElementById('filtroData');
  const ff = document.getElementById('filtroForma');
  const dataFiltro  = fd?.value || '';
  const formaFiltro = ff?.value || '';
  const todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];

  // Desmarca botões de período e acende borda dourada no input de data
  document.querySelectorAll('.hist-periodo-btn').forEach(b => b.classList.remove('ativo'));
  if (fd) fd.classList.toggle('filtro-data-ativo', !!dataFiltro);

  const filtradas = [];
  const indices   = [];

  todasVendas.forEach((v, i) => {
    const passaData  = !dataFiltro  || v.data === dataFiltro;
    const passaForma = !formaFiltro || v.formaPagamento === formaFiltro;
    if (passaData && passaForma) { filtradas.push(v); indices.push(i); }
  });

  filtradas.reverse();
  indices.reverse();

  renderKPIs(filtradas);
  renderTotaisPorForma(filtradas);
  renderTabelaVendas(filtradas, indices);
}

function removerFiltro() {
  const fd = document.getElementById('filtroData');
  if (fd) { fd.value = ''; fd.classList.remove('filtro-data-ativo'); }
  const ff = document.getElementById('filtroForma');
  if (ff) ff.value = '';
  atualizarHistorico();
}

// --------------------------------
// Gráfico
// --------------------------------

let periodoGraficoAtivo = 'semana';

function setGrafico(tipo) {
  periodoGraficoAtivo = tipo;

  // Botões ativos
  ['semana', 'mes', 'ano'].forEach(t => {
    const btn = document.getElementById(`btn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('ativo', t === tipo);
  });

  atualizarGrafico(tipo);
}

function atualizarGrafico(tipo) {
  const canvas = document.getElementById('graficoVendas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];
  const mapa = {};

  todasVendas.forEach(v => {
    const d   = new Date(v.data);
    const sub = v.quantidade * (v.precoComDesconto || v.preco);
    let chave;
    if (tipo === 'semana')     chave = localDateStr(d);
    else if (tipo === 'mes')   chave = localMonthStr(d);
    else if (tipo === 'ano')   chave = String(d.getFullYear());
    if (chave) mapa[chave] = (mapa[chave] || 0) + sub;
  });

  let labels = Object.keys(mapa).sort();
  const dados = labels.map(k => mapa[k]);

  // Formata labels para exibição
  const labelsFormatados = labels.map(l => {
    if (tipo === 'mes') {
      const [y, m] = l.split('-');
      return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(m)-1] + ' ' + y;
    }
    if (tipo === 'semana') return l.split('-').reverse().join('/');
    return l;
  });

  if (window.graficoVendasObj) window.graficoVendasObj.destroy();

  window.graficoVendasObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labelsFormatados,
      datasets: [{
        label: 'Total Vendido (R$)',
        data: dados,
        backgroundColor: 'rgba(212, 175, 55, 0.85)',
        borderColor: 'rgba(212, 175, 55, 1)',
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` R$ ${ctx.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          grid:  { color: 'rgba(42,42,42,0.9)' },
          ticks: { color: '#6B6B6B', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid:  { color: 'rgba(42,42,42,0.9)' },
          ticks: {
            color: '#6B6B6B',
            font: { size: 11 },
            callback: v => 'R$ ' + v.toFixed(0)
          }
        }
      }
    }
  });
}

// --------------------------------
// Init
// --------------------------------

mostrarAba('home');

// ============================================
// DASHBOARD EXECUTIVO
// ============================================

var dashPeriodoGrafico = '12m';
var dashPeriodoFluxo = 'mes';
var dashPeriodoRanking = 'mes';

function atualizarDashboard() {
  dashRenderAlertas();
  dashRenderKpis();
  dashRenderMetas();
  dashRenderGraficoLine(dashPeriodoGrafico);
  dashRenderDonut(dashPeriodoGrafico);
  dashRenderFluxo(dashPeriodoFluxo);
  dashRenderEstoque();
  dashRenderRanking(dashPeriodoRanking);
  dashRenderComparativos();
  dashRenderPrevisoes();
}

function dashHojeStr() {
  return localDateStr();
}

function dashGetVendas(tipo) {
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje = new Date();
  const hojeStr = localDateStr(hoje);
  const mesStr = localMonthStr(hoje);
  const anoStr = String(hoje.getFullYear());

  return todas.filter(v => {
    if (!v.data) return false;
    const diff = (hoje - new Date(v.data + 'T12:00:00')) / 86400000;
    switch (tipo) {
      case 'hoje': return v.data === hojeStr;
      case 'ontem': { const d = new Date(hoje); d.setDate(d.getDate() - 1); return v.data === localDateStr(d); }
      case 'semana': return diff >= 0 && diff < 7;
      case 'semana_ant': return diff >= 7 && diff < 14;
      case 'mes': return v.data.startsWith(mesStr);
      case 'mes_ant': { const d = new Date(hoje); d.setMonth(d.getMonth() - 1); return v.data.startsWith(localMonthStr(d)); }
      case 'ano': return v.data.startsWith(anoStr);
      case 'ano_ant': return v.data.startsWith(String(hoje.getFullYear() - 1));
      default: return true;
    }
  });
}

function dashFat(lista) {
  return lista.reduce((s, v) => s + v.quantidade * (v.precoComDesconto || v.preco || 0), 0);
}

function dashLucroValor(lista) {
  const est = JSON.parse(localStorage.getItem('estoque')) || [];
  return lista.reduce((s, v) => {
    const p = est.find(e => e.nome === v.nome);
    const custo = p?.precoCompra || 0;
    const rec = v.precoComDesconto || v.preco || 0;
    return s + (rec - custo) * v.quantidade;
  }, 0);
}

function fmtAbrev(val) {
  const abs = Math.abs(val);
  const s = val < 0 ? '-' : '';
  if (abs >= 1e6) {
    const v = abs / 1e6;
    return s + 'R$ ' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',') + 'M';
  }
  if (abs >= 1e3) {
    const v = abs / 1e3;
    const dec = (v >= 100 || v % 1 === 0) ? 0 : 1;
    return s + 'R$ ' + v.toFixed(dec).replace('.', ',') + 'k';
  }
  return s + 'R$ ' + abs.toFixed(2).replace('.', ',');
}

function dashFmt(val) {
  return fmtAbrev(val);
}

function dashPct(atual, anterior) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return (atual - anterior) / anterior * 100;
}

function dashRenderAlertas() {
  const el = document.getElementById('dashAlertasBanner');
  if (!el) return;
  const est = JSON.parse(localStorage.getItem('estoque')) || [];
  const emFalta = est.filter(p => p.quantidade === 0);
  if (emFalta.length === 0) { el.innerHTML = ''; return; }
  const items = emFalta.slice(0, 4).map(p => `<span class="dash-banner-item">🚨 <strong>${p.nome}</strong> zerado</span>`).join('');
  el.innerHTML = `<div class="dash-alertas-banner">${items}${emFalta.length > 4 ? `<span class="dash-banner-item">+${emFalta.length - 4} produtos</span>` : ''}<span style="margin-left:auto;cursor:pointer;opacity:0.5;" onclick="this.parentElement.parentElement.style.display='none'">✕</span></div>`;
}

function dashRenderKpis() {
  const periodos = ['hoje', 'semana', 'mes', 'ano'];
  const labels = ['Hoje', 'Semana', 'Mês', 'Ano'];
  const cores = ['kpi-verde', 'kpi-azul', 'kpi-roxo', 'kpi-laranja'];

  const elFat = document.getElementById('dashKpiFaturamento');
  if (elFat) {
    elFat.innerHTML = periodos.map((p, i) => {
      const vl = dashGetVendas(p);
      const val = dashFat(vl);
      return `<div class="dash-kpi-card ${cores[i]}">
        <div class="dash-kpi-label">Faturamento ${labels[i]}</div>
        <div class="dash-kpi-val">${dashFmt(val)}</div>
        <div class="dash-kpi-sub">${vl.length} venda${vl.length !== 1 ? 's' : ''}</div>
      </div>`;
    }).join('');
  }

  const elLuc = document.getElementById('dashKpiLucro');
  if (elLuc) {
    elLuc.innerHTML = periodos.map((p, i) => {
      const vl = dashGetVendas(p);
      const val = dashLucroValor(vl);
      const fat = dashFat(vl);
      const margem = fat > 0 ? (val / fat * 100).toFixed(1) : '0.0';
      return `<div class="dash-kpi-card ${cores[i]}">
        <div class="dash-kpi-label">Lucro ${labels[i]}</div>
        <div class="dash-kpi-val ${val >= 0 ? 'positivo' : 'negativo'}">${dashFmt(val)}</div>
        <div class="dash-kpi-sub">Margem ${margem}%</div>
      </div>`;
    }).join('');
  }

  const elOp = document.getElementById('dashKpiOp');
  if (elOp) {
    const todas = JSON.parse(localStorage.getItem('vendas')) || [];
    const est = JSON.parse(localStorage.getItem('estoque')) || [];
    const hoje = dashGetVendas('hoje');
    const fatHoje = dashFat(hoje);
    const ticket = hoje.length > 0 ? fatHoje / hoje.length : 0;
    const totalProdutos = est.reduce((s, p) => s + p.quantidade, 0);
    elOp.innerHTML = `
      <div class="dash-kpi-card kpi-verde">
        <div class="dash-kpi-label">Vendas Hoje</div>
        <div class="dash-kpi-val">${hoje.length}</div>
        <div class="dash-kpi-sub">transações</div>
      </div>
      <div class="dash-kpi-card kpi-azul">
        <div class="dash-kpi-label">Ticket Médio Hoje</div>
        <div class="dash-kpi-val">${dashFmt(ticket)}</div>
        <div class="dash-kpi-sub">por venda</div>
      </div>
      <div class="dash-kpi-card kpi-roxo">
        <div class="dash-kpi-label">Itens em Estoque</div>
        <div class="dash-kpi-val">${totalProdutos}</div>
        <div class="dash-kpi-sub">${est.length} produto${est.length !== 1 ? 's' : ''} distintos</div>
      </div>
      <div class="dash-kpi-card kpi-laranja">
        <div class="dash-kpi-label">Total de Vendas</div>
        <div class="dash-kpi-val">${todas.length}</div>
        <div class="dash-kpi-sub">histórico completo</div>
      </div>`;
  }
}

function dashRenderMetas() {
  const metas = JSON.parse(localStorage.getItem('dashMetas')) || { faturamento: 10000, lucro: 4000, vendas: 100, metaDiaria: 500 };
  const mesVendas  = dashGetVendas('mes');
  const hojeStr    = localDateStr();
  const hojeVendas = (window.vendas || []).filter(v => v.data === hojeStr);
  const fatAtual   = dashFat(mesVendas);
  const lucroAtual = dashLucroValor(mesVendas);
  const vendasAtual = mesVendas.length;
  const fatHoje    = dashFat(hojeVendas);
  const metaDiaria = metas.metaDiaria || 500;
  const el = document.getElementById('dashMetas');
  if (!el) return;

  function metaBar(label, atual, meta, sublabel) {
    const pct = Math.min((atual / Math.max(meta, 0.01)) * 100, 100);
    const pctStr = pct.toFixed(1);
    const isVal = meta > 100;
    const atualFmt = isVal ? dashFmt(atual) : atual;
    const metaFmt = isVal ? dashFmt(meta) : meta;
    const cls = pct >= 100 ? 'meta-atingida' : pct >= 75 ? 'meta-ok' : pct >= 40 ? 'meta-alerta' : 'meta-critica';
    return `<div class="dash-meta-item">
      <div class="dash-meta-header">
        <span class="dash-meta-label">${label}${sublabel ? `<span class="dash-meta-sublabel">${sublabel}</span>` : ''}</span>
        <span class="dash-meta-pct ${cls}">${pctStr}%</span>
      </div>
      <div class="dash-meta-bar-bg"><div class="dash-meta-bar-fill ${cls}" style="width:${pctStr}%"></div></div>
      <div class="dash-meta-footer"><span>${atualFmt}</span><span>Meta: ${metaFmt}</span></div>
    </div>`;
  }

  el.innerHTML = `<div class="dash-metas-panel">
    <div class="dash-module-label-inner">Metas do Mês
      <button class="btn-ghost dash-meta-edit-btn" onclick="dashEditarMetas()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar Metas</button>
    </div>
    <div class="dash-metas-grid">
      ${metaBar('Faturamento', fatAtual, metas.faturamento, 'mensal')}
      ${metaBar('Lucro', lucroAtual, metas.lucro, 'mensal')}
      ${metaBar('Vendas', vendasAtual, metas.vendas, 'mensal')}
      ${metaBar('Faturamento Hoje', fatHoje, metaDiaria, 'diário')}
    </div>
  </div>`;
}

function dashEditarMetas() {
  const metas = JSON.parse(localStorage.getItem('dashMetas')) || { faturamento: 10000, lucro: 4000, vendas: 100, metaDiaria: 500 };
  document.getElementById('metaFaturamento').value = metas.faturamento;
  document.getElementById('metaLucro').value = metas.lucro;
  document.getElementById('metaVendas').value = metas.vendas;
  document.getElementById('metaDiaria').value = metas.metaDiaria || '';
  document.getElementById('metasOverlay').classList.add('ativo');
  document.getElementById('metasModal').classList.add('ativo');
  setTimeout(() => document.getElementById('metaFaturamento').focus(), 50);
}

function fecharModalMetas() {
  document.getElementById('metasOverlay').classList.remove('ativo');
  document.getElementById('metasModal').classList.remove('ativo');
}

function salvarModalMetas() {
  const metas = JSON.parse(localStorage.getItem('dashMetas')) || { faturamento: 10000, lucro: 4000, vendas: 100, metaDiaria: 500 };
  const f = parseFloat(document.getElementById('metaFaturamento').value);
  const l = parseFloat(document.getElementById('metaLucro').value);
  const v = parseInt(document.getElementById('metaVendas').value);
  const d = parseFloat(document.getElementById('metaDiaria').value);
  localStorage.setItem('dashMetas', JSON.stringify({
    faturamento: f > 0 ? f : metas.faturamento,
    lucro:       l > 0 ? l : metas.lucro,
    vendas:      v > 0 ? v : metas.vendas,
    metaDiaria:  d > 0 ? d : (metas.metaDiaria || 500)
  }));
  if (typeof window.autoSalvarFirebase === 'function') window.autoSalvarFirebase();
  fecharModalMetas();
  dashRenderMetas();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('metasModal').classList.contains('ativo')) {
    fecharModalMetas();
  }
});

function dashSetGrafico(tipo) {
  dashPeriodoGrafico = tipo;
  ['24h', '7d', '30d', '12m'].forEach(t => {
    const btn = document.getElementById('dbtn' + t);
    if (btn) btn.classList.toggle('ativo', t === tipo);
  });
  dashRenderGraficoLine(tipo);
  dashRenderDonut(tipo);
}

function dashRenderGraficoLine(tipo) {
  const canvas = document.getElementById('dashChartLine');
  if (!canvas) return;
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje = new Date();
  let labels = [], dados = [];

  if (tipo === '24h') {
    for (let h = 23; h >= 0; h--) {
      const d = new Date(hoje);
      d.setHours(hoje.getHours() - h, 0, 0, 0);
      const dtStr = localDateStr(d);
      const hr = d.getHours();
      labels.push(hr + 'h');
      const vs = todas.filter(v => v.data === dtStr && v.hora && parseInt(v.hora.split(':')[0]) === hr);
      dados.push(dashFat(vs));
    }
  } else if (tipo === '7d') {
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(hoje); dt.setDate(dt.getDate() - d);
      const dtStr = localDateStr(dt);
      labels.push(dtStr.slice(5).replace('-', '/'));
      dados.push(dashFat(todas.filter(v => v.data === dtStr)));
    }
  } else if (tipo === '30d') {
    for (let d = 29; d >= 0; d--) {
      const dt = new Date(hoje); dt.setDate(dt.getDate() - d);
      const dtStr = localDateStr(dt);
      labels.push((29 - d) % 5 === 0 ? dtStr.slice(5).replace('-', '/') : '');
      dados.push(dashFat(todas.filter(v => v.data === dtStr)));
    }
  } else {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    for (let m = 11; m >= 0; m--) {
      const dt = new Date(hoje); dt.setMonth(dt.getMonth() - m);
      const ms = localMonthStr(dt);
      labels.push(meses[dt.getMonth()]);
      dados.push(dashFat(todas.filter(v => v.data && v.data.startsWith(ms))));
    }
  }

  if (window.dashLineChartObj) window.dashLineChartObj.destroy();
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(212,175,55,0.28)');
  grad.addColorStop(1, 'rgba(212,175,55,0)');
  window.dashLineChartObj = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Faturamento', data: dados, borderColor: 'rgba(212,175,55,1)', backgroundColor: grad, borderWidth: 2, pointBackgroundColor: '#D4AF37', pointRadius: 3, tension: 0.4, fill: true }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + dashFmt(c.parsed.y) } } },
      scales: {
        x: { grid: { color: 'rgba(42,42,42,0.9)' }, ticks: { color: '#6B6B6B', font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(42,42,42,0.9)' }, ticks: { color: '#6B6B6B', font: { size: 10 }, callback: v => v >= 1000 ? 'R$' + (v/1000).toFixed(1)+'k' : 'R$'+v } }
      }
    }
  });
}

function dashRenderDonut(tipo) {
  tipo = tipo || dashPeriodoGrafico || '12m';
  const canvas = document.getElementById('dashChartDonut');
  if (!canvas) return;
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje = new Date();

  const filtradas = todas.filter(v => {
    if (!v.data) return false;
    if (tipo === '24h') {
      if (!v.hora) return v.data === localDateStr(hoje);
      const vd = new Date(v.data + 'T' + v.hora);
      return (hoje - vd) <= 24 * 60 * 60 * 1000;
    }
    const dias = tipo === '7d' ? 7 : tipo === '30d' ? 30 : 365;
    const corte = new Date(hoje); corte.setDate(corte.getDate() - dias);
    return new Date(v.data + 'T12:00:00') >= corte;
  });

  const mapa = {};
  filtradas.forEach(v => {
    const f = v.formaPagamento || 'Outro';
    mapa[f] = (mapa[f] || 0) + v.quantidade * (v.precoComDesconto || v.preco || 0);
  });
  const cfg = { 'Pix': { cor: '#3B82F6', label: 'PIX' }, 'Dinheiro': { cor: '#22C55E', label: 'Dinheiro' }, 'Cartao-Debito': { cor: '#D4AF37', label: 'Débito' }, 'Cartao-Credito': { cor: '#F59E0B', label: 'Crédito' }, 'Crediario': { cor: '#EF4444', label: 'Crediário' } };
  const entries = Object.entries(mapa);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (window.dashDonutObj) window.dashDonutObj.destroy();
  if (entries.length === 0) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); return; }
  const ctx = canvas.getContext('2d');
  window.dashDonutObj = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: entries.map(([k]) => (cfg[k] || { label: k }).label), datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([k]) => (cfg[k] || { cor: '#6B6B6B' }).cor), borderColor: '#121220', borderWidth: 2 }] },
    options: { responsive: true, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${dashFmt(c.parsed)} (${total > 0 ? (c.parsed/total*100).toFixed(1) : 0}%)` } } } }
  });
  const elLeg = document.getElementById('dashLegendaFormas');
  if (elLeg) {
    elLeg.innerHTML = `<div class="dash-donut-legenda">${entries.map(([k, v]) => {
      const c = cfg[k] || { cor: '#6B6B6B', label: k };
      const pct = total > 0 ? (v / total * 100).toFixed(1) : 0;
      return `<div class="dash-legenda-item"><span class="dash-legenda-dot" style="background:${c.cor}"></span><span>${c.label}</span><span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${dashFmt(v)}</span><span class="dash-legenda-val">${pct}%</span></div>`;
    }).join('')}</div>`;
  }
}

function dashSetFluxo(tipo) {
  dashPeriodoFluxo = tipo;
  ['mes', 'semana', 'dias'].forEach(t => {
    const btn = document.getElementById('dfbtn' + t);
    if (btn) btn.classList.toggle('ativo', t === tipo);
  });
  dashRenderFluxo(tipo);
}

function dashRenderFluxo(tipo) {
  const canvas = document.getElementById('dashChartFluxo');
  if (!canvas) return;
  const est = JSON.parse(localStorage.getItem('estoque')) || [];
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje = new Date();
  const mesesNome = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const diasNome = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let labels = [], receitas = [], custos = [], lucros = [];

  function custo(v) { const p = est.find(e => e.nome === v.nome); return (p?.precoCompra || 0) * v.quantidade; }

  if (tipo === 'mes') {
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(hoje); dt.setMonth(dt.getMonth() - m);
      const ms = localMonthStr(dt);
      labels.push(mesesNome[dt.getMonth()]);
      const vs = todas.filter(v => v.data && v.data.startsWith(ms));
      const r = dashFat(vs); const c = vs.reduce((s, v) => s + custo(v), 0);
      receitas.push(r); custos.push(c); lucros.push(r - c);
    }
  } else if (tipo === 'semana') {
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(hoje); dt.setDate(dt.getDate() - d);
      const dtStr = localDateStr(dt);
      labels.push(diasNome[dt.getDay()]);
      const vs = todas.filter(v => v.data === dtStr);
      const r = dashFat(vs); const c = vs.reduce((s, v) => s + custo(v), 0);
      receitas.push(r); custos.push(c); lucros.push(r - c);
    }
  } else {
    for (let d = 13; d >= 0; d--) {
      const dt = new Date(hoje); dt.setDate(dt.getDate() - d);
      const dtStr = localDateStr(dt);
      labels.push(dtStr.slice(5).replace('-', '/'));
      const vs = todas.filter(v => v.data === dtStr);
      const r = dashFat(vs); const c = vs.reduce((s, v) => s + custo(v), 0);
      receitas.push(r); custos.push(c); lucros.push(r - c);
    }
  }

  if (window.dashFluxoObj) window.dashFluxoObj.destroy();
  const ctx = canvas.getContext('2d');
  window.dashFluxoObj = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Receita', data: receitas, backgroundColor: 'rgba(34,197,94,0.75)',  borderRadius: 4 },
      { label: 'Custo',   data: custos,   backgroundColor: 'rgba(239,68,68,0.75)',  borderRadius: 4 },
      { label: 'Lucro',   data: lucros,   backgroundColor: 'rgba(212,175,55,0.85)', borderRadius: 4 },
    ]},
    options: {
      responsive: true,
      plugins: { legend: { display: true, labels: { color: '#B3B3B3', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${dashFmt(c.parsed.y)}` } } },
      scales: {
        x: { grid: { color: 'rgba(42,42,42,0.9)' }, ticks: { color: '#6B6B6B', font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(42,42,42,0.9)' }, ticks: { color: '#6B6B6B', font: { size: 10 }, callback: v => v >= 1000 ? 'R$' + (v/1000).toFixed(1)+'k' : 'R$'+v } }
      }
    }
  });
}

function dashRenderEstoque() {
  const est = JSON.parse(localStorage.getItem('estoque')) || [];
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje = new Date();

  const valorInvestido = est.reduce((s, p) => s + (p.precoCompra || 0) * p.quantidade, 0);
  const valorPotencial = est.reduce((s, p) => s + (p.precoVenda || p.preco || 0) * p.quantidade, 0);
  const lucroPotencial = valorPotencial - valorInvestido;

  const { produtosParados: _paradosSet } = _calcSemGiro(est, todas, hoje);
  const parados = est.filter(p => _paradosSet.has(p.nome));
  const capitalParado = parados.reduce((s, p) => s + (p.precoCompra || 0) * p.quantidade, 0);

  const emFalta = est.filter(p => p.quantidade === 0).length;
  const baixo = est.filter(p => p.quantidade > 0 && p.quantidade <= 3).length;

  const elKpi = document.getElementById('dashKpiEstoque');
  if (elKpi) {
    elKpi.innerHTML = `
      <div class="dash-kpi-card kpi-azul">
        <div class="dash-kpi-label">Valor Investido</div>
        <div class="dash-kpi-val">${dashFmt(valorInvestido)}</div>
        <div class="dash-kpi-sub">custo do estoque</div>
      </div>
      <div class="dash-kpi-card kpi-verde">
        <div class="dash-kpi-label">Potencial de Venda</div>
        <div class="dash-kpi-val">${dashFmt(valorPotencial)}</div>
        <div class="dash-kpi-sub">se vender tudo</div>
      </div>
      <div class="dash-kpi-card kpi-roxo">
        <div class="dash-kpi-label">Lucro Potencial</div>
        <div class="dash-kpi-val ${lucroPotencial >= 0 ? 'positivo' : 'negativo'}">${dashFmt(lucroPotencial)}</div>
        <div class="dash-kpi-sub">potencial − investido</div>
      </div>
      <div class="dash-kpi-card kpi-laranja">
        <div class="dash-kpi-label">Capital Parado</div>
        <div class="dash-kpi-val negativo">${dashFmt(capitalParado)}</div>
        <div class="dash-kpi-sub">${parados.length} produto(s) 30+ dias</div>
      </div>`;
  }

  const elInd = document.getElementById('dashEstoqueIndicadores');
  if (elInd) {
    elInd.innerHTML = `
      <div class="dash-indicator ${emFalta > 0 ? 'ind-critico' : 'ind-ok'}">
        <span class="ind-val">${emFalta}</span><span class="ind-label">Em Falta</span>
      </div>
      <div class="dash-indicator ${baixo > 0 ? 'ind-alerta' : 'ind-ok'}">
        <span class="ind-val">${baixo}</span><span class="ind-label">Estoque Baixo</span>
      </div>
      <div class="dash-indicator">
        <span class="ind-val">${est.length}</span><span class="ind-label">Total Produtos</span>
      </div>
      <div class="dash-indicator ${parados.length > 0 ? 'ind-alerta' : 'ind-ok'}">
        <span class="ind-val">${parados.length}</span><span class="ind-label">Sem Movimento 30d</span>
      </div>`;
  }

  const elAlt = document.getElementById('dashAlertasEstoque');
  if (elAlt) {
    const alertas = [];
    const d30 = new Date(hoje); d30.setDate(d30.getDate() - 30);

    est.filter(p => p.quantidade > 0 && p.quantidade <= 15).forEach(p => {
      const vs30 = todas.filter(v => v.nome === p.nome && v.data && new Date(v.data + 'T12:00:00') >= d30);
      const totalVendido = vs30.reduce((s, v) => s + v.quantidade, 0);
      const taxa = totalVendido / 30;
      if (taxa > 0) {
        const dias = Math.round(p.quantidade / taxa);
        if (dias <= 15) {
          const cls = dias <= 5 ? 'alerta-vermelho' : 'alerta-amarelo';
          alertas.push(`<div class="dash-alerta-item ${cls}">⚠ Estoque de <strong>${p.nome}</strong> acabará em aproximadamente <strong>${dias} dia${dias !== 1 ? 's' : ''}</strong> (${p.quantidade} restantes · ${taxa.toFixed(1)}/dia). <em>Sugestão: comprar ~${Math.ceil(taxa * 30)} un.</em></div>`);
        }
      }
    });

    if (parados.length > 0 && capitalParado > 0) {
      alertas.push(`<div class="dash-alerta-item alerta-laranja">📦 Você possui <strong>${dashFmt(capitalParado)}</strong> parados em <strong>${parados.length} produto(s)</strong> sem venda há mais de 30 dias.</div>`);
    }

    est.filter(p => p.precoCompra > 0 && (p.precoVenda || p.preco) > 0).forEach(p => {
      const pv = p.precoVenda || p.preco;
      const m = (pv - p.precoCompra) / p.precoCompra * 100;
      if (m >= 0 && m < 10) alertas.push(`<div class="dash-alerta-item alerta-vermelho">📉 <strong>${p.nome}</strong> possui margem de apenas <strong>${m.toFixed(1)}%</strong> — abaixo do esperado.</div>`);
    });

    elAlt.innerHTML = alertas.length > 0 ? `<div class="dash-alertas-box">${alertas.join('')}</div>` : '';
  }
}

function dashSetRanking(tipo) {
  dashPeriodoRanking = tipo;
  [['hoje','h'],['mes','m'],['ano','ans']].forEach(([t, id]) => {
    const btn = document.getElementById('drbtn' + id);
    if (btn) btn.classList.toggle('ativo', t === tipo);
  });
  dashRenderRanking(tipo);
}

function dashRenderRanking(tipo) {
  const vendas = dashGetVendas(tipo);
  const mapa = {};
  vendas.forEach(v => {
    if (!mapa[v.nome]) mapa[v.nome] = { qtd: 0, total: 0 };
    mapa[v.nome].qtd += v.quantidade;
    mapa[v.nome].total += v.quantidade * (v.precoComDesconto || v.preco || 0);
  });
  const ranking = Object.entries(mapa).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const elRank = document.getElementById('dashRankingList');
  if (elRank) {
    if (ranking.length === 0) { elRank.innerHTML = '<div class="dash-empty">Nenhuma venda no período</div>'; }
    else {
      const maxTotal = ranking[0][1].total || 1;
      elRank.innerHTML = ranking.map(([nome, d], i) => {
        const pct = (d.total / maxTotal * 100).toFixed(0);
        return `<div class="dash-rank-item">
          <span class="dash-rank-pos">${i + 1}</span>
          <div class="dash-rank-info">
            <span class="dash-rank-nome">${nome}</span>
            <div class="dash-rank-bar-bg"><div class="dash-rank-bar" style="width:${pct}%"></div></div>
          </div>
          <div class="dash-rank-stats">
            <span class="dash-rank-val">${dashFmt(d.total)}</span>
            <span class="dash-rank-qtd">${d.qtd} un.</span>
          </div>
        </div>`;
      }).join('');
    }
  }

  const mapaC = {};
  vendas.forEach(v => {
    if (!v.cliente || v.cliente === 'Cliente Não Informado') return;
    if (!mapaC[v.cliente]) mapaC[v.cliente] = { total: 0, freq: 0 };
    mapaC[v.cliente].total += v.quantidade * (v.precoComDesconto || v.preco || 0);
    mapaC[v.cliente].freq++;
  });
  const rankC = Object.entries(mapaC).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const elCli = document.getElementById('dashClientesList');
  if (elCli) {
    if (rankC.length === 0) { elCli.innerHTML = '<div class="dash-empty">Nomes de clientes não registrados nas vendas</div>'; }
    else {
      elCli.innerHTML = rankC.map(([nome, d], i) => `
        <div class="dash-rank-item">
          <span class="dash-rank-pos">${i + 1}</span>
          <div class="dash-rank-info">
            <span class="dash-rank-nome">${nome}</span>
            <span style="font-size:0.72rem;color:var(--text-muted)">${d.freq} compra${d.freq !== 1 ? 's' : ''}</span>
          </div>
          <span class="dash-rank-val">${dashFmt(d.total)}</span>
        </div>`).join('');
    }
  }
}

function dashRenderComparativos() {
  const el = document.getElementById('dashComparativos');
  if (!el) return;
  const pares = [
    { label: 'Hoje vs Ontem',        atual: 'hoje',    ant: 'ontem' },
    { label: 'Semana vs Anterior',   atual: 'semana',  ant: 'semana_ant' },
    { label: 'Mês vs Anterior',      atual: 'mes',     ant: 'mes_ant' },
    { label: 'Ano vs Anterior',      atual: 'ano',     ant: 'ano_ant' },
  ];

  el.innerHTML = pares.map(({ label, atual, ant }) => {
    const vA = dashGetVendas(atual), vB = dashGetVendas(ant);
    const fA = dashFat(vA), fB = dashFat(vB);
    const lA = dashLucroValor(vA), lB = dashLucroValor(vB);
    const pf = dashPct(fA, fB), pl = dashPct(lA, lB);

    function ind(pct, val) {
      const up = pct >= 0;
      return `<div class="dash-comp-metric ${up ? 'comp-up' : 'comp-down'}">
        <span class="comp-arrow">${up ? '↑' : '↓'}</span>
        <span class="comp-val">${dashFmt(val)}</span>
        <span class="comp-pct">${Math.abs(pct).toFixed(1)}%</span>
      </div>`;
    }

    return `<div class="dash-comp-card">
      <div class="dash-comp-label">${label}</div>
      <div class="dash-comp-row">
        <div><div class="dash-comp-sub">Faturamento</div>${ind(pf, fA)}</div>
        <div><div class="dash-comp-sub">Lucro</div>${ind(pl, lA)}</div>
      </div>
    </div>`;
  }).join('');
}

function dashRenderPrevisoes() {
  const el = document.getElementById('dashPrevisoes');
  if (!el) return;
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const est = JSON.parse(localStorage.getItem('estoque')) || [];
  const hoje = new Date();

  const dias30 = [];
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(hoje); dt.setDate(dt.getDate() - d);
    const dtStr = localDateStr(dt);
    dias30.push(dashFat(todas.filter(v => v.data === dtStr)));
  }
  const mediaDiaria = dias30.reduce((s, v) => s + v, 0) / 30;
  const prev7 = mediaDiaria * 7;
  const prev30 = mediaDiaria * 30;
  const prev90 = mediaDiaria * 90;

  const d30 = new Date(hoje); d30.setDate(d30.getDate() - 30);
  const rupturas = [];
  est.filter(p => p.quantidade > 0).forEach(p => {
    const vs = todas.filter(v => v.nome === p.nome && v.data && new Date(v.data + 'T12:00:00') >= d30);
    const totalV = vs.reduce((s, v) => s + v.quantidade, 0);
    const taxa = totalV / 30;
    if (taxa > 0) {
      const dias = Math.round(p.quantidade / taxa);
      if (dias <= 30) rupturas.push({ nome: p.nome, dias, qtd: p.quantidade, taxa, sugestao: Math.ceil(taxa * 30) });
    }
  });
  rupturas.sort((a, b) => a.dias - b.dias);

  const clsR = d => d <= 5 ? 'ruptura-critica' : d <= 14 ? 'ruptura-alerta' : 'ruptura-ok';

  el.innerHTML = `
    <div class="dash-prev-grid">
      <div class="dash-prev-card">
        <div class="dash-prev-icon">📈</div>
        <div class="dash-prev-label">Próximos 7 dias</div>
        <div class="dash-prev-val">${dashFmt(prev7)}</div>
        <div class="dash-prev-sub">Previsão de faturamento</div>
      </div>
      <div class="dash-prev-card">
        <div class="dash-prev-icon">📅</div>
        <div class="dash-prev-label">Próximos 30 dias</div>
        <div class="dash-prev-val">${dashFmt(prev30)}</div>
        <div class="dash-prev-sub">Previsão de faturamento</div>
      </div>
      <div class="dash-prev-card">
        <div class="dash-prev-icon">🎯</div>
        <div class="dash-prev-label">Próximos 90 dias</div>
        <div class="dash-prev-val">${dashFmt(prev90)}</div>
        <div class="dash-prev-sub">Previsão de faturamento</div>
      </div>
    </div>
    ${rupturas.length > 0 ? `
    <div class="dash-rupturas">
      <div class="dash-module-label-inner" style="margin-bottom:10px;">Previsão de Ruptura de Estoque</div>
      ${rupturas.slice(0, 6).map(r => `
        <div class="dash-ruptura-item ${clsR(r.dias)}">
          <span class="ruptura-nome">${r.nome}</span>
          <span class="ruptura-dias">${r.dias}d restantes</span>
          <span class="ruptura-info">${r.qtd} un · ${r.taxa.toFixed(1)}/dia</span>
          <span class="ruptura-sugestao">Comprar ~${r.sugestao} un.</span>
        </div>`).join('')}
    </div>` : `<div class="dash-empty" style="margin-top:12px;">Dados insuficientes para previsão de rupturas. Registre mais vendas para ativar este módulo.</div>`}
  `;
}

// ============================================
// GESTÃO DE ESTOQUE — PREMIUM
// ============================================

var estEditIndex = null;

// Retorna produtos "sem giro": em estoque há mais de 30 dias E sem venda nos últimos 30 dias
function _calcSemGiro(est, todasVendas, hoje) {
  var corte30 = new Date(hoje); corte30.setDate(corte30.getDate() - 30);
  var vendNomes30 = new Set(todasVendas.filter(function(v) {
    return v.data && new Date(v.data + 'T12:00:00') >= corte30;
  }).map(function(v) { return v.nome; }));

  var produtosParados = new Set(est.filter(function(p) {
    if (p.quantidade <= 0) return false;
    if (vendNomes30.has(p.nome)) return false;
    // Só conta como parado se foi cadastrado há mais de 30 dias
    if (p.dataCadastro) {
      var dc = new Date(p.dataCadastro + 'T12:00:00');
      if (dc > corte30) return false;
    }
    return true;
  }).map(function(p) { return p.nome; }));

  return { vendNomes30: vendNomes30, produtosParados: produtosParados };
}

function getEstStatus(p, vendNomes90Set) {
  if (p.quantidade === 0) return { key: 'falta',   label: 'Em Falta', cls: 'est-badge-falta' };
  const min = p.estoqueMin || 3;
  if (p.quantidade <= min)               return { key: 'critico', label: 'Crítico',  cls: 'est-badge-critico' };
  if (p.quantidade <= Math.max(min*2,10)) return { key: 'baixo',   label: 'Baixo',    cls: 'est-badge-baixo' };
  return { key: 'normal', label: 'Normal', cls: 'est-badge-normal' };
}

function atualizarTudoEstoque() {
  atualizarEstoqueKPIs();
  atualizarEstoqueStatusRow();
  atualizarEstoqueAlertas();
  atualizarTabelaEstoque();
}

function atualizarEstoqueKPIs() {
  const el = document.getElementById('estKpiRow');
  if (!el) return;
  const est = JSON.parse(localStorage.getItem('estoque')) || [];
  const totalQtd       = est.reduce((s, p) => s + p.quantidade, 0);
  const valorInvestido = est.reduce((s, p) => s + (p.precoCompra || 0) * p.quantidade, 0);
  const valorMercado   = est.reduce((s, p) => s + (p.precoVenda || p.preco || 0) * p.quantidade, 0);
  const lucroPot       = valorMercado - valorInvestido;
  const margemMedia    = valorInvestido > 0 ? ((valorMercado - valorInvestido) / valorInvestido * 100).toFixed(1) : '0.0';

  const isAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'owner';

  el.innerHTML = `
    <div class="dash-kpi-card kpi-roxo">
      <div class="dash-kpi-label">Total de Produtos</div>
      <div class="dash-kpi-val">${est.length}</div>
      <div class="dash-kpi-sub">${totalQtd} unidades em estoque</div>
    </div>
    ${isAdmin ? `
    <div class="dash-kpi-card kpi-azul">
      <div class="dash-kpi-label">Valor Investido</div>
      <div class="dash-kpi-val">${dashFmt(valorInvestido)}</div>
      <div class="dash-kpi-sub">custo total do estoque</div>
    </div>
    <div class="dash-kpi-card kpi-verde">
      <div class="dash-kpi-label">Valor de Mercado</div>
      <div class="dash-kpi-val">${dashFmt(valorMercado)}</div>
      <div class="dash-kpi-sub">potencial de faturamento</div>
    </div>
    <div class="dash-kpi-card kpi-laranja">
      <div class="dash-kpi-label">Lucro Potencial</div>
      <div class="dash-kpi-val ${lucroPot >= 0 ? 'positivo' : 'negativo'}">${dashFmt(lucroPot)}</div>
      <div class="dash-kpi-sub">Margem média ${margemMedia}%</div>
    </div>` : ''}`;
}

function atualizarEstoqueStatusRow() {
  const el = document.getElementById('estStatusRow');
  if (!el) return;
  const est   = JSON.parse(localStorage.getItem('estoque')) || [];
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje  = new Date();
  const { vendNomes30, produtosParados } = _calcSemGiro(est, todas, hoje);

  let normal=0, baixo=0, critico=0, falta=0, parado=0;
  est.forEach(p => {
    const s = getEstStatus(p, vendNomes30);
    if (s.key === 'normal')  normal++;
    else if (s.key === 'baixo')   baixo++;
    else if (s.key === 'critico') critico++;
    else if (s.key === 'falta')   falta++;
    if (produtosParados.has(p.nome)) parado++;
  });

  el.innerHTML = `
    <div class="est-status-item est-status-normal"  onclick="filtrarEstStatus('normal')"><span class="est-status-val">${normal}</span><span class="est-status-lbl">Normal</span></div>
    <div class="est-status-item est-status-baixo"   onclick="filtrarEstStatus('baixo')"><span class="est-status-val">${baixo}</span><span class="est-status-lbl">Baixo</span></div>
    <div class="est-status-item est-status-critico" onclick="filtrarEstStatus('critico')"><span class="est-status-val">${critico}</span><span class="est-status-lbl">Crítico</span></div>
    <div class="est-status-item est-status-falta"   onclick="filtrarEstStatus('falta')"><span class="est-status-val">${falta}</span><span class="est-status-lbl">Em Falta</span></div>
    <div class="est-status-item est-status-parado"  onclick="filtrarEstStatus('parado')"><span class="est-status-val">${parado}</span><span class="est-status-lbl">Sem Giro 30d</span></div>`;
}

function filtrarEstStatus(status) {
  const sel = document.getElementById('filtroEstStatus');
  if (sel) sel.value = (sel.value === status) ? '' : status;
  atualizarTabelaEstoque();
}

function atualizarEstoqueAlertas() {
  const el = document.getElementById('estAlertas');
  if (!el) return;
  const est   = JSON.parse(localStorage.getItem('estoque')) || [];
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const hoje  = new Date();
  const d30   = new Date(hoje); d30.setDate(d30.getDate() - 30);
  const alertas = [];

  est.filter(p => p.quantidade > 0 && p.quantidade <= 20).forEach(p => {
    const vs   = todas.filter(v => v.nome === p.nome && v.data && new Date(v.data + 'T12:00:00') >= d30);
    const taxa = vs.reduce((s, v) => s + v.quantidade, 0) / 30;
    if (taxa > 0) {
      const dias = Math.round(p.quantidade / taxa);
      if (dias <= 14) alertas.push({ tipo: dias <= 3 ? 'critico' : 'alerta', msg: `Estoque de <strong>${p.nome}</strong> acabará em ~<strong>${dias} dia${dias !== 1 ? 's' : ''}</strong> (${p.quantidade} un. · ${taxa.toFixed(1)}/dia). Sugestão: comprar ~${Math.ceil(taxa * 30)} un.` });
    }
  });

  const { produtosParados: _pSet } = _calcSemGiro(est, todas, hoje);
  const parados2   = est.filter(p => _pSet.has(p.nome));
  const capitalP   = parados2.reduce((s, p) => s + (p.precoCompra || 0) * p.quantidade, 0);
  if (parados2.length > 0) alertas.push({ tipo: 'aviso', msg: `<strong>${dashFmt(capitalP)}</strong> parados em <strong>${parados2.length} produto(s)</strong> sem vendas há mais de 30 dias.` });

  est.filter(p => p.precoCompra > 0 && (p.precoVenda || p.preco) > 0).forEach(p => {
    const pv = p.precoVenda || p.preco;
    const m  = (pv - p.precoCompra) / p.precoCompra * 100;
    if (m >= 0 && m < 10) alertas.push({ tipo: 'margem', msg: `<strong>${p.nome}</strong> tem margem de apenas <strong>${m.toFixed(1)}%</strong> — abaixo do recomendado.` });
  });

  if (alertas.length === 0) { el.innerHTML = ''; return; }

  const iconMap = { critico: '🔴', alerta: '🟡', aviso: '📦', margem: '📉' };
  el.innerHTML = `<div class="est-alertas-container">
    <div class="est-alertas-header"><span>Alertas Inteligentes</span><span class="est-alertas-count">${alertas.length}</span></div>
    <div class="est-alertas-list">${alertas.slice(0,6).map(a => `
      <div class="est-alerta-row est-alerta-${a.tipo}">
        <span class="est-alerta-icon">${iconMap[a.tipo]}</span><span>${a.msg}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

// Form drawer
function abrirFormProduto(editIndex) {
  estEditIndex = (editIndex !== undefined) ? editIndex : null;
  const ids = ['nomeProduto','codigoInternoProduto','skuProduto','codigoBarrasProduto',
               'categoriaProduto','marcaProduto','fornecedorProduto',
               'quantidadeProduto','estoqueMinProduto','localizacaoProduto',
               'precoCompraProduto','precoVendaProduto'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  document.getElementById('estFormTitulo').textContent = estEditIndex !== null ? 'Editar Produto' : 'Novo Produto';

  if (estEditIndex !== null) {
    const est = JSON.parse(localStorage.getItem('estoque')) || [];
    const p   = est[estEditIndex];
    if (!p) return;
    const map = { nomeProduto: p.nome, codigoInternoProduto: p.codigoInterno, skuProduto: p.sku,
                  codigoBarrasProduto: p.codigoBarras, categoriaProduto: p.categoria,
                  marcaProduto: p.marca, fornecedorProduto: p.fornecedor, quantidadeProduto: p.quantidade,
                  estoqueMinProduto: p.estoqueMin, localizacaoProduto: p.localizacao,
                  precoCompraProduto: p.precoCompra, precoVendaProduto: p.precoVenda || p.preco };
    Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; });
  }

  setEstTab(0);
  calcularMargemForm();

  // Atualiza botão wizard ao digitar em qualquer campo obrigatório
  ['nomeProduto', 'quantidadeProduto', 'precoVendaProduto'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.oninput = (el.oninput ? el.oninput : null), el.addEventListener('input', _prodWizardAtualizarBtn);
  });

  // Se está editando, habilita salvar direto
  if (estEditIndex !== null) {
    var btn = document.getElementById('prodWizardBtn');
    if (btn) { btn.textContent = 'Salvar Produto'; btn.classList.add('wizard-pronto'); }
  }

  document.getElementById('estFormOverlay').classList.add('ativo');
  document.getElementById('estFormDrawer').classList.add('ativo');
  document.body.style.overflow = 'hidden';
}

function fecharFormProduto() {
  document.getElementById('estFormOverlay')?.classList.remove('ativo');
  document.getElementById('estFormDrawer')?.classList.remove('ativo');
  document.body.style.overflow = '';
}

var _prodWizardAba = 0;

function setEstTab(n) {
  _prodWizardAba = n;
  [0,1,2].forEach(i => {
    document.getElementById('estTab' + i + 'btn')?.classList.toggle('ativo', i === n);
    document.getElementById('estTab' + i)?.classList.toggle('ativo', i === n);
  });
  _prodWizardAtualizarBtn();
}

// Campos obrigatórios por aba
var _prodWizardCampos = [
  [{ id: 'nomeProduto', label: 'Nome do Produto' }],
  [{ id: 'quantidadeProduto', label: 'Quantidade em Estoque' }],
  [{ id: 'precoVendaProduto', label: 'Preço de Venda' }],
];

function _prodWizardValidarAba(abaIdx) {
  var campos = _prodWizardCampos[abaIdx] || [];
  for (var i = 0; i < campos.length; i++) {
    var el = document.getElementById(campos[i].id);
    var val = el ? el.value.trim() : '';
    if (!val || val === '0') return { ok: false, label: campos[i].label };
  }
  return { ok: true };
}

function _prodWizardAtualizarBtn() {
  var btn = document.getElementById('prodWizardBtn');
  if (!btn) return;

  // Se está na última aba e todas passam → Salvar Produto
  var todasOk = [0, 1, 2].every(function(i) { return _prodWizardValidarAba(i).ok; });
  if (_prodWizardAba === 2 && todasOk) {
    btn.textContent = 'Salvar Produto';
    btn.classList.add('wizard-pronto');
    return;
  }
  btn.textContent = _prodWizardAba === 2 ? 'Salvar Produto' : 'Próxima aba →';
  btn.classList.remove('wizard-pronto');
}

function prodWizardIrAba(n) {
  // Permite clicar na aba livremente (UX melhor — validação só no botão)
  setEstTab(n);
}

function prodWizardAvancar() {
  var res = _prodWizardValidarAba(_prodWizardAba);
  if (!res.ok) {
    // Destaca o campo inválido
    var campos = _prodWizardCampos[_prodWizardAba];
    campos.forEach(function(c) {
      var el = document.getElementById(c.id);
      if (el && !el.value.trim()) {
        el.classList.add('input-erro-wizard');
        el.focus();
        setTimeout(function() { el.classList.remove('input-erro-wizard'); }, 1800);
      }
    });
    showAlert('Preencha: ' + res.label, 'aviso');
    return;
  }

  if (_prodWizardAba < 2) {
    setEstTab(_prodWizardAba + 1);
    return;
  }

  // Aba 2 e tudo preenchido — salva de verdade
  var todasOk = [0, 1, 2].every(function(i) { return _prodWizardValidarAba(i).ok; });
  if (!todasOk) {
    // Encontra a primeira aba com problema
    for (var i = 0; i < 3; i++) {
      var r = _prodWizardValidarAba(i);
      if (!r.ok) { setEstTab(i); showAlert('Preencha: ' + r.label, 'aviso'); return; }
    }
  }

  adicionarProduto();
}

function calcularMargemForm() {
  const pc  = parseFloat(document.getElementById('precoCompraProduto')?.value) || 0;
  const pv  = parseFloat(document.getElementById('precoVendaProduto')?.value)  || 0;
  const qtd = parseInt(document.getElementById('quantidadeProduto')?.value)    || 0;
  const el  = document.getElementById('margemPreview');
  if (!el) return;
  if (pv > 0 && pc > 0) {
    const m   = ((pv - pc) / pc * 100).toFixed(1);
    const cor = parseFloat(m) >= 30 ? 'var(--green)' : parseFloat(m) >= 10 ? '#F59E0B' : 'var(--red)';
    el.style.display = 'grid';
    el.innerHTML = `
      <div class="est-margem-item"><span>Margem</span><strong style="color:${cor}">${m}%</strong></div>
      <div class="est-margem-item"><span>Lucro Unitário</span><strong>R$ ${(pv-pc).toFixed(2)}</strong></div>
      <div class="est-margem-item"><span>Lucro Total Estoque</span><strong>R$ ${((pv-pc)*qtd).toFixed(2)}</strong></div>`;
  } else {
    el.style.display = 'none';
  }
}

// Product detail drawer
function abrirDrawerProduto(index) {
  const est   = JSON.parse(localStorage.getItem('estoque')) || [];
  const todas = JSON.parse(localStorage.getItem('vendas')) || [];
  const p     = est[index];
  if (!p) return;

  const pv        = p.precoVenda || p.preco || 0;
  const pc        = p.precoCompra || 0;
  const margem    = pc > 0 ? ((pv - pc) / pc * 100) : null;
  const lucroU    = pv - pc;
  const { vendNomes30: _vn30 } = _calcSemGiro(estoque, todas, new Date());
  const status    = getEstStatus(p, _vn30);
  const vendProd  = todas.filter(v => v.nome === p.nome || v.produtoId === p.id);
  const totalV    = vendProd.reduce((s, v) => s + v.quantidade, 0);
  const totalFat  = vendProd.reduce((s, v) => s + v.quantidade * (v.precoComDesconto || v.preco || 0), 0);
  const ultimas   = [...vendProd].sort((a,b) => (b.data||'').localeCompare(a.data||'')).slice(0, 8);
  const margemCor = margem !== null ? (margem >= 30 ? 'var(--green)' : margem >= 10 ? '#F59E0B' : 'var(--red)') : 'var(--text-muted)';
  const prodId    = p.id || ('#' + (index + 1));

  const row = (label, val, style='') => val
    ? `<div class="prod-drawer-info-row"><span>${label}</span><span ${style ? `style="${style}"` : ''}>${val}</span></div>`
    : '';

  document.getElementById('prodDrawerNome').textContent = p.nome;
  document.getElementById('prodDrawerSub').textContent  = [p.categoria, p.marca].filter(Boolean).join(' · ') || 'Sem categoria';

  document.getElementById('prodDrawerContent').innerHTML = `

    <!-- Códigos em destaque -->
    ${(p.sku || p.codigoInterno || p.codigoBarras) ? `
    <div class="prod-drawer-codigos-block">
      ${p.sku          ? `<div class="prod-drawer-codigo-row"><span class="prod-drawer-codigo-label">SKU</span><span class="prod-drawer-codigo-val">${p.sku}</span></div>` : ''}
      ${p.codigoInterno? `<div class="prod-drawer-codigo-row"><span class="prod-drawer-codigo-label">Código Interno</span><span class="prod-drawer-codigo-val">${p.codigoInterno}</span></div>` : ''}
      ${p.codigoBarras ? `<div class="prod-drawer-codigo-row"><span class="prod-drawer-codigo-label">Código de Barras</span><span class="prod-drawer-codigo-val">${p.codigoBarras}</span></div>` : ''}
    </div>` : ''}

    <!-- Preços / KPIs -->
    <div class="prod-drawer-kpis">
      <div class="prod-drawer-kpi">
        <span class="prod-drawer-kpi-label">Preço de Custo</span>
        <span class="prod-drawer-kpi-val">${pc > 0 ? 'R$ '+pc.toFixed(2) : '—'}</span>
      </div>
      <div class="prod-drawer-kpi">
        <span class="prod-drawer-kpi-label">Preço de Venda</span>
        <span class="prod-drawer-kpi-val" style="color:var(--gold)">R$ ${pv.toFixed(2)}</span>
      </div>
      <div class="prod-drawer-kpi">
        <span class="prod-drawer-kpi-label">Margem</span>
        <span class="prod-drawer-kpi-val" style="color:${margemCor}">${margem !== null ? margem.toFixed(1)+'%' : '—'}</span>
      </div>
      <div class="prod-drawer-kpi">
        <span class="prod-drawer-kpi-label">Lucro Unitário</span>
        <span class="prod-drawer-kpi-val" style="color:${lucroU > 0 ? 'var(--green)' : 'var(--red)'}">${lucroU !== 0 ? 'R$ '+lucroU.toFixed(2) : '—'}</span>
      </div>
    </div>

    <!-- Identificação -->
    <div class="prod-drawer-section">
      <div class="prod-drawer-sec-title">Identificação</div>
      ${row('Categoria',       p.categoria)}
      ${row('Marca',           p.marca)}
      ${row('Fornecedor',      p.fornecedor)}
      ${row('Código Interno',  p.codigoInterno, 'font-family:monospace;letter-spacing:1px')}
      ${row('SKU',             p.sku,           'font-family:monospace;letter-spacing:1px')}
      ${row('Código de Barras',p.codigoBarras,  'font-family:monospace;letter-spacing:1px')}
    </div>

    <!-- Estoque -->
    <div class="prod-drawer-section">
      <div class="prod-drawer-sec-title">Estoque</div>
      <div class="prod-drawer-info-row"><span>Status</span><span class="est-badge ${status.cls}">${status.label}</span></div>
      <div class="prod-drawer-info-row"><span>Quantidade Atual</span><span style="font-weight:700;">${p.quantidade} un.</span></div>
      ${row('Estoque Mínimo',  p.estoqueMin ? p.estoqueMin+' un.' : '')}
      ${row('Localização',     p.localizacao)}
      <div class="prod-drawer-info-row"><span>Valor em Estoque (custo)</span><span>${pc > 0 ? 'R$ '+(p.quantidade*pc).toFixed(2) : '—'}</span></div>
      <div class="prod-drawer-info-row"><span>Valor em Estoque (venda)</span><span style="font-weight:700;">R$ ${(p.quantidade*pv).toFixed(2)}</span></div>
    </div>

    <!-- Histórico de vendas -->
    <div class="prod-drawer-section">
      <div class="prod-drawer-sec-title">Histórico de Vendas</div>
      <div class="prod-drawer-kpis" style="margin-bottom:12px;">
        <div class="prod-drawer-kpi">
          <span class="prod-drawer-kpi-label">Total Vendido</span>
          <span class="prod-drawer-kpi-val">${totalV} un.</span>
        </div>
        <div class="prod-drawer-kpi">
          <span class="prod-drawer-kpi-label">Faturamento Total</span>
          <span class="prod-drawer-kpi-val" style="color:var(--gold)">R$ ${totalFat.toFixed(2)}</span>
        </div>
      </div>
      ${ultimas.length === 0
        ? `<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">Nenhuma venda registrada.</div>`
        : ultimas.map(v => {
            const vp = v.precoComDesconto || v.preco || 0;
            return `<div class="prod-drawer-venda-row">
              <span class="prod-drawer-venda-data">${v.data ? v.data.split('-').reverse().join('/') : '—'}</span>
              <span>${v.quantidade} un. × R$ ${vp.toFixed(2)}</span>
              <span style="font-weight:700;color:var(--green)">R$ ${(v.quantidade*vp).toFixed(2)}</span>
            </div>`;
          }).join('')}
    </div>

    <div class="est-drawer-footer" style="border-top:1px solid var(--border);padding-top:16px;">
      <button onclick="fecharDrawerProduto();abrirFormProduto(${index});" class="btn-primary" style="flex:1;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
      <button onclick="showConfirm('Excluir este produto?',()=>{excluirProduto(${index});fecharDrawerProduto();})" class="btn-danger">Excluir</button>
    </div>`;

  document.getElementById('estProdOverlay')?.classList.add('ativo');
  document.getElementById('estProdDrawer')?.classList.add('ativo');
  document.body.style.overflow = 'hidden';
}

function fecharDrawerProduto() {
  document.getElementById('estProdOverlay')?.classList.remove('ativo');
  document.getElementById('estProdDrawer')?.classList.remove('ativo');
  document.body.style.overflow = '';
}

// ============================================================
// PDV — PONTO DE VENDA
// ============================================================

var pdvFormaPagamento  = 'Dinheiro';
var pdvProdIdx         = null;
var pdvQuickTabAtivo   = 'recentes';
var pdvCarrinhoPDV     = [];
var _pdvBrowseAberto   = false;

function pdvToggleBrowse() {
  _pdvBrowseAberto = !_pdvBrowseAberto;
  var btn   = document.getElementById('pdvBrowseBtn');
  var panel = document.getElementById('pdvBrowsePanel');
  if (!panel) return;

  if (_pdvBrowseAberto) {
    btn.classList.add('ativo');
    panel.style.display = 'flex';
    pdvRenderBrowse('');
    setTimeout(function() {
      var si = panel.querySelector('.pdv-browse-search input');
      if (si) si.focus();
    }, 50);
  } else {
    btn.classList.remove('ativo');
    panel.style.display = 'none';
  }
}

function pdvFecharBrowse() {
  _pdvBrowseAberto = false;
  var btn   = document.getElementById('pdvBrowseBtn');
  var panel = document.getElementById('pdvBrowsePanel');
  if (btn)   btn.classList.remove('ativo');
  if (panel) panel.style.display = 'none';
}

function pdvRenderBrowse(filtro) {
  var panel = document.getElementById('pdvBrowsePanel');
  if (!panel) return;
  var est = JSON.parse(localStorage.getItem('estoque')) || [];
  var termo = (filtro || '').toLowerCase().trim();
  var lista = est.map(function(p, i) { return Object.assign({}, p, { _i: i }); })
    .filter(function(p) {
      if (!termo) return true;
      return [p.nome||'', p.marca||'', p.categoria||'', p.codigoBarras||'', p.sku||'', p.codigoInterno||'']
        .join(' ').toLowerCase().includes(termo);
    });

  var itens = lista.map(function(p) {
    var pv = p.precoVenda || p.preco || 0;
    var stockCls = p.quantidade === 0 ? 'zero' : p.quantidade <= 3 ? 'baixo' : 'ok';
    var stockLabel = p.quantidade === 0 ? 'Sem estoque' : p.quantidade + ' un.';
    var meta = [p.categoria, p.marca].filter(Boolean).join(' · ');
    return '<div class="pdv-browse-item" onclick="pdvBrowseSelecionar(' + p._i + ')">' +
      '<div style="flex:1;min-width:0;">' +
        '<div class="pdv-browse-item-nome">' + (p.nome || '—') + '</div>' +
        (meta ? '<div class="pdv-browse-item-meta">' + meta + '</div>' : '') +
      '</div>' +
      '<span class="pdv-browse-item-preco">R$ ' + pv.toFixed(2) + '</span>' +
      '<span class="pdv-browse-item-stock ' + stockCls + '">' + stockLabel + '</span>' +
    '</div>';
  }).join('');

  panel.innerHTML =
    '<div class="pdv-browse-list">' +
      (itens || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.82rem;">Nenhum produto encontrado.</div>') +
    '</div>';
}

function pdvBrowseSelecionar(idx) {
  pdvSelecionarProduto(idx);
  pdvFecharBrowse();
  // Limpa o campo de busca
  var inp = document.getElementById('pdvBusca');
  if (inp) inp.value = '';
}

function initPDV() {
  pdvRenderQuickGrid();
  pdvRenderCartPDV();
  setTimeout(function() {
    var inp = document.getElementById('pdvBusca');
    if (inp) inp.focus();
  }, 80);
}

function pdvRenderStatsBar() {
  var el = document.getElementById('pdvStatsBar');
  if (!el) return;
  var hoje = dashGetVendas('hoje');
  el.innerHTML =
    '<div class="dash-kpi-card kpi-verde" style="min-width:0;padding:10px 14px;">' +
      '<div class="dash-kpi-label" style="font-size:0.6rem;">Faturamento hoje</div>' +
      '<div class="dash-kpi-val" style="font-size:1rem;">' + dashFmt(dashFat(hoje)) + '</div>' +
    '</div>' +
    '<div class="dash-kpi-card kpi-roxo" style="min-width:0;padding:10px 14px;">' +
      '<div class="dash-kpi-label" style="font-size:0.6rem;">Vendas hoje</div>' +
      '<div class="dash-kpi-val" style="font-size:1rem;">' + hoje.length + '</div>' +
    '</div>';
}

function pdvOnInput() {
  var val = (document.getElementById('pdvBusca') ? document.getElementById('pdvBusca').value : '').trim();
  if (val) pdvFecharBrowse(); // fechar o browse ao digitar
  if (!val) { pdvFecharDropdown(); pdvLimparSelecao(); return; }
  pdvRenderDropdown(val);
}

function pdvKeyDown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var val = (document.getElementById('pdvBusca') ? document.getElementById('pdvBusca').value : '').trim();
    if (!val) return;
    var est = JSON.parse(localStorage.getItem('estoque')) || [];
    var exato = est.findIndex(function(p) {
      return p.codigoBarras === val || p.codigoInterno === val || p.sku === val;
    });
    if (exato !== -1) {
      pdvSelecionarProduto(exato);
      pdvAdicionarAoCarrinho();
      return;
    }
    var resultados = pdvFiltrar(val);
    if (resultados.length === 1) {
      pdvSelecionarProduto(resultados[0]._i);
      pdvAdicionarAoCarrinho();
    } else if (resultados.length > 1) {
      pdvRenderDropdown(val);
    } else {
      pdvShowFeedback('err', '&#10060; Produto não encontrado: "' + val + '"');
    }
  } else if (e.key === 'Escape') {
    pdvFecharDropdown();
    pdvLimparSelecao();
  }
}

function pdvFiltrar(busca) {
  var est = JSON.parse(localStorage.getItem('estoque')) || [];
  var b   = busca.toLowerCase();
  return est.map(function(p, i) { return Object.assign({}, p, {_i: i}); }).filter(function(p) {
    if (p.codigoBarras === busca || p.codigoInterno === busca || p.sku === busca) return true;
    var t = [p.nome||'', p.marca||'', p.categoria||'', p.codigoBarras||'', p.sku||'', p.codigoInterno||''].join(' ').toLowerCase();
    return t.indexOf(b) !== -1;
  });
}

function pdvRenderDropdown(busca) {
  var dropdown = document.getElementById('pdvDropdown');
  if (!dropdown) return;
  var results = pdvFiltrar(busca);
  if (results.length === 0) {
    dropdown.style.display = 'none';
    pdvShowFeedback('err', '&#10060; Produto não encontrado: "' + busca + '"');
    return;
  }
  pdvHideFeedback();
  dropdown.style.display = 'block';
  dropdown.innerHTML = results.slice(0, 8).map(function(p) {
    var pv = p.precoVenda || p.preco || 0;
    var stockCls = p.quantidade === 0 ? 'low' : p.quantidade <= 3 ? 'low' : 'ok';
    var stockTxt = p.quantidade === 0 ? 'Sem estoque' : p.quantidade + ' un.';
    var meta = [p.codigoInterno, p.sku].filter(Boolean).join(' · ');
    return '<div class="pdv-drop-item" onmousedown="pdvSelecionarProduto(' + p._i + ');pdvFecharDropdown();">' +
      '<div><span class="pdv-drop-nome">' + p.nome + '</span>' +
      '<span class="pdv-drop-stock ' + stockCls + '">' + stockTxt + '</span>' +
      '<div class="pdv-drop-meta">' + (meta || p.marca || '') + '</div></div>' +
      '<div class="pdv-drop-preco">R$ ' + pv.toFixed(2) + '</div>' +
    '</div>';
  }).join('');
}

function pdvFecharDropdown() {
  var el = document.getElementById('pdvDropdown');
  if (el) el.style.display = 'none';
}

function pdvSelecionarProduto(index) {
  var est = JSON.parse(localStorage.getItem('estoque')) || [];
  var p   = est[index];
  if (!p) return;
  pdvProdIdx = index;

  var pv     = p.precoVenda || p.preco || 0;
  var meta   = [p.categoria, p.marca].filter(Boolean).join(' · ');
  var codigo = [p.codigoInterno, p.sku, p.codigoBarras].filter(Boolean).join(' · ');
  var stLabel = p.quantidade === 0
    ? '<span style="color:var(--red)">Sem estoque</span>'
    : '<span style="color:var(--green)">' + p.quantidade + ' em estoque</span>';

  var el   = document.getElementById('pdvQuickAdd');
  var info = document.getElementById('pdvProdInfo');
  if (!el || !info) return;

  info.innerHTML =
    '<div class="pdv-prod-avatar">' + p.nome.charAt(0).toUpperCase() + '</div>' +
    '<div>' +
      '<div class="pdv-prod-nome">' + p.nome + '</div>' +
      '<div class="pdv-prod-sub">' + (meta || '—') + (codigo ? ' · ' + codigo : '') + ' · ' + stLabel + '</div>' +
    '</div>' +
    '<div class="pdv-prod-preco">R$ ' + pv.toFixed(2) + '</div>';

  el.style.display = 'block';

  var qtdEl = document.getElementById('pdvQtd');
  if (qtdEl) { qtdEl.value = 1; qtdEl.max = p.quantidade || 9999; }
  var descEl = document.getElementById('pdvDesconto');
  if (descEl) descEl.value = 0;

  document.getElementById('pdvBusca').value = p.nome;
  pdvFecharDropdown();
  pdvHideFeedback();

  if (p.quantidade === 0) {
    pdvShowFeedback('err', '&#10060; Estoque zerado para "' + p.nome + '".');
  }
}

function pdvLimparSelecao() {
  pdvProdIdx = null;
  var el = document.getElementById('pdvQuickAdd');
  if (el) el.style.display = 'none';
}

function pdvQtyAdj(delta) {
  var el = document.getElementById('pdvQtd');
  if (!el) return;
  el.value = Math.max(1, parseInt(el.value || 1) + delta);
}

function pdvValidarQtd() {
  var el = document.getElementById('pdvQtd');
  if (!el) return;
  var v = parseInt(el.value);
  if (isNaN(v) || v < 1) el.value = 1;
}

function pdvAdicionarAoCarrinho() {
  if (pdvProdIdx === null) {
    pdvShowFeedback('warn', '&#9888; Selecione um produto primeiro.');
    return;
  }
  var est  = JSON.parse(localStorage.getItem('estoque')) || [];
  var p    = est[pdvProdIdx];
  if (!p) return;

  var qtd  = parseInt(document.getElementById('pdvQtd') ? document.getElementById('pdvQtd').value : 1) || 1;
  var desc = parseFloat(document.getElementById('pdvDesconto') ? document.getElementById('pdvDesconto').value : 0) || 0;

  if (qtd > p.quantidade) {
    pdvShowFeedback('warn', '&#9888; Estoque insuficiente. Disponível: ' + p.quantidade + ' unidade' + (p.quantidade !== 1 ? 's' : '') + '.');
    return;
  }

  var pv    = p.precoVenda || p.preco || 0;
  var pc    = p.precoCompra || 0;
  var preco = pv * (1 - desc / 100);

  var existing = pdvCarrinhoPDV.findIndex(function(i) { return i.idxProduto === pdvProdIdx && i.desconto === desc; });
  if (existing !== -1) {
    pdvCarrinhoPDV[existing].qtd      += qtd;
    pdvCarrinhoPDV[existing].subtotal  = pdvCarrinhoPDV[existing].preco * pdvCarrinhoPDV[existing].qtd;
    pdvCarrinhoPDV[existing].lucro     = (pdvCarrinhoPDV[existing].preco - pc) * pdvCarrinhoPDV[existing].qtd;
  } else {
    pdvCarrinhoPDV.push({
      idxProduto: pdvProdIdx,
      nome: p.nome,
      precoOriginal: pv,
      precoCompra: pc,
      preco: preco,
      desconto: desc,
      qtd: qtd,
      subtotal: preco * qtd,
      lucro: (preco - pc) * qtd,
    });
  }

  pdvRenderCartPDV();
  pdvShowFeedback('ok', '&#10003; ' + p.nome + ' adicionado ao carrinho.');

  document.getElementById('pdvBusca').value = '';
  var qtdEl = document.getElementById('pdvQtd'); if (qtdEl) qtdEl.value = 1;
  var descEl = document.getElementById('pdvDesconto'); if (descEl) descEl.value = 0;
  pdvLimparSelecao();
  var inp = document.getElementById('pdvBusca'); if (inp) inp.focus();

  setTimeout(pdvHideFeedback, 2200);
}

function pdvRenderCartPDV() {
  var lista  = document.getElementById('pdvCartLista');
  var footer = document.getElementById('pdvCartFooter');
  var count  = document.getElementById('pdvCartCount');
  if (!lista) return;

  if (pdvCarrinhoPDV.length === 0) {
    lista.innerHTML =
      '<div class="pdv-cart-empty">' +
        '<div style="font-size:2.5rem;opacity:0.22;margin-bottom:8px;">&#128722;</div>' +
        '<p>Aguardando produtos</p>' +
        '<small>Escaneie um código ou use <kbd>F2</kbd></small>' +
      '</div>';
    if (footer) footer.style.display = 'none';
    if (count)  count.textContent = '0 itens';
    return;
  }

  lista.innerHTML = pdvCarrinhoPDV.map(function(item, idx) {
    var descInfo = item.desconto > 0 ? ' (' + item.desconto + '% desc)' : '';
    return '<div class="pdv-cart-item">' +
      '<div class="pdv-ci-nome">' + item.nome + '</div>' +
      '<div class="pdv-ci-total">R$ ' + item.subtotal.toFixed(2) + '</div>' +
      '<div class="pdv-ci-sub">' + item.qtd + '× R$ ' + item.precoOriginal.toFixed(2) + descInfo + '</div>' +
      '<div class="pdv-ci-rm"><button class="btn-ghost" onclick="pdvRemoverItem(' + idx + ')" style="color:var(--red);font-size:0.68rem;">✕ remover</button></div>' +
    '</div>';
  }).join('');

  var subtotalBruto = pdvCarrinhoPDV.reduce(function(s,i){ return s + i.precoOriginal * i.qtd; }, 0);
  var descontos     = pdvCarrinhoPDV.reduce(function(s,i){ return s + (i.precoOriginal - i.preco) * i.qtd; }, 0);
  var total         = pdvCarrinhoPDV.reduce(function(s,i){ return s + i.subtotal; }, 0);
  var lucro         = pdvCarrinhoPDV.reduce(function(s,i){ return s + i.lucro; }, 0);
  var margem        = total > 0 ? (lucro / total * 100).toFixed(1) : 0;
  var totalItens    = pdvCarrinhoPDV.reduce(function(s,i){ return s + i.qtd; }, 0);

  if (count) count.textContent = totalItens + ' item' + (totalItens !== 1 ? 's' : '');

  var ss = document.getElementById('pdvSumSubtotal'); if (ss) ss.textContent = dashFmt(subtotalBruto);
  var sd = document.getElementById('pdvSumDesconto'); if (sd) sd.textContent = '- ' + dashFmt(descontos);
  var sl = document.getElementById('pdvSumLucro');    if (sl) sl.textContent = dashFmt(lucro);
  var sm = document.getElementById('pdvSumMargem');   if (sm) sm.textContent = margem + '%';
  var tv = document.getElementById('pdvTotalVal');    if (tv) tv.textContent = dashFmt(total);

  if (footer) footer.style.display = 'flex';
}

function pdvRemoverItem(idx) {
  pdvCarrinhoPDV.splice(idx, 1);
  pdvRenderCartPDV();
}

function pdvLimpar() {
  function _limpar() {
    pdvCarrinhoPDV = [];
    pdvRenderCartPDV();
    pdvLimparSelecao();
    var inp = document.getElementById('pdvBusca');
    if (inp) { inp.value = ''; inp.focus(); }
  }
  if (pdvCarrinhoPDV.length === 0) { _limpar(); return; }
  showConfirm('Limpar o carrinho?', _limpar, { okLabel: 'Limpar', icon: '🗑', iconTipo: 'tipo-aviso' });
}

function pdvSetForma(forma) {
  pdvFormaPagamento = forma;
  var map = { 'Dinheiro': 'pdvfDinheiro', 'Pix': 'pdvfPix', 'Cartao-Debito': 'pdvfDebito', 'Cartao-Credito': 'pdvfCredito', 'Crediario': 'pdvfCrediario' };
  Object.values(map).forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.remove('ativo'); });
  if (map[forma]) { var el = document.getElementById(map[forma]); if (el) el.classList.add('ativo'); }
}

function pdvSetTab(tipo) {
  pdvQuickTabAtivo = tipo;
  var br = document.getElementById('pdvBtnRec');  if (br) br.classList.toggle('ativo', tipo === 'recentes');
  var bf = document.getElementById('pdvBtnFreq'); if (bf) bf.classList.toggle('ativo', tipo === 'frequentes');
  pdvRenderQuickGrid();
}

function pdvRenderQuickGrid() {
  var el = document.getElementById('pdvQuickGrid');
  if (!el) return;
  var est   = JSON.parse(localStorage.getItem('estoque')) || [];
  var todas = JSON.parse(localStorage.getItem('vendas'))  || [];
  var produtos = [];

  if (pdvQuickTabAtivo === 'recentes') {
    var nomes = [];
    todas.slice().reverse().forEach(function(v) { if (nomes.indexOf(v.nome) === -1) nomes.push(v.nome); });
    nomes.slice(0, 8).forEach(function(nome) {
      var idx = est.findIndex(function(p) { return p.nome === nome; });
      if (idx !== -1) produtos.push(Object.assign({}, est[idx], {_i: idx}));
    });
  } else {
    var mapa = {};
    todas.forEach(function(v) { mapa[v.nome] = (mapa[v.nome] || 0) + v.quantidade; });
    Object.entries(mapa).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8).forEach(function(entry) {
      var idx = est.findIndex(function(p) { return p.nome === entry[0]; });
      if (idx !== -1) produtos.push(Object.assign({}, est[idx], {_i: idx}));
    });
  }

  // Completa até 8 com outros produtos do estoque (que ainda não estão na lista)
  if (produtos.length < 8) {
    var idsUsados = new Set(produtos.map(function(p) { return p._i; }));
    est.forEach(function(p, idx) {
      if (produtos.length >= 8) return;
      if (!idsUsados.has(idx)) produtos.push(Object.assign({}, p, {_i: idx}));
    });
  }

  if (produtos.length === 0) {
    el.innerHTML = '<div class="dash-empty" style="grid-column:1/-1;padding:16px;text-align:center;color:var(--text-muted);font-size:0.78rem;">Nenhum produto cadastrado</div>';
    return;
  }

  el.innerHTML = produtos.map(function(p) {
    var pv = p.precoVenda || p.preco || 0;
    return '<div class="pdv-quick-card" onclick="pdvSelecionarProduto(' + p._i + ')">' +
      '<div class="pdv-quick-card-nome">' + p.nome + '</div>' +
      '<div class="pdv-quick-card-preco">R$ ' + pv.toFixed(2) + '</div>' +
      '<div class="pdv-quick-card-stock">' + (p.quantidade > 0 ? p.quantidade + ' un.' : 'Sem estoque') + '</div>' +
    '</div>';
  }).join('');
}

function finalizarVendaPDV() {
  if (pdvCarrinhoPDV.length === 0) {
    pdvShowFeedback('warn', '&#9888; Carrinho vazio.');
    return;
  }

  // Se for crediário, abre o formulário de crediário com o total pré-preenchido
  if (pdvFormaPagamento === 'Crediario') {
    var totalCrd = pdvCarrinhoPDV.reduce(function(s, i) { return s + i.subtotal; }, 0);
    var itensCrd = pdvCarrinhoPDV.slice(); // cópia do carrinho
    _pdvAbrirCrediarioForm(totalCrd, itensCrd);
    return;
  }

  var itensVenda = pdvCarrinhoPDV.slice();
  var total = itensVenda.reduce(function(s, i) { return s + i.subtotal; }, 0);

  _pdvRegistrarVendas(pdvFormaPagamento, itensVenda);

  pdvCarrinhoPDV = [];
  pdvRenderCartPDV();
  pdvLimparSelecao();
  pdvRenderQuickGrid();
  var inp = document.getElementById('pdvBusca'); if (inp) inp.value = '';

  _pdvMostrarSucesso(total, pdvFormaPagamento, itensVenda);
}

var _pdvUltimoTxId = null;

function _pdvMostrarSucesso(total, forma, itens) {
  var formaLabel = { 'Dinheiro':'Dinheiro', 'Pix':'PIX', 'Cartao-Debito':'Cartão de Débito', 'Cartao-Credito':'Cartão de Crédito', 'Crediario':'Crediário' };
  var el = document.getElementById('vendaSucessoOverlay');
  if (!el) return;

  document.getElementById('vendaSucessoValor').textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
  document.getElementById('vendaSucessoForma').textContent = formaLabel[forma] || forma;

  var itensEl = document.getElementById('vendaSucessoItens');
  itensEl.innerHTML = itens.map(function(i) {
    return '<div class="venda-sucesso-item-row">' +
      '<span class="venda-sucesso-item-nome">' + i.qtd + 'x ' + i.nome + '</span>' +
      '<span class="venda-sucesso-item-val">R$ ' + i.subtotal.toFixed(2).replace('.', ',') + '</span>' +
    '</div>';
  }).join('');

  // Guarda o txId para gerar comprovante
  var todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];
  var ultima = todasVendas[todasVendas.length - 1];
  _pdvUltimoTxId = ultima ? ultima.txId : null;

  el.style.display = 'flex';
  setTimeout(function() { el.style.animation = 'vsOverlayIn 0.25s ease'; }, 10);

  // Som de venda concluída
  try {
    var audio = new Audio('public/venda.mp3');
    audio.volume = 0.7;
    audio.play().catch(function() {});
  } catch (_) {}
}

function fecharVendaSucesso() {
  var el = document.getElementById('vendaSucessoOverlay');
  if (el) el.style.display = 'none';
  _pdvUltimoTxId = null;
  var inp = document.getElementById('pdvBusca'); if (inp) inp.focus();
}

function vendaSucessoComprovante() {
  if (!_pdvUltimoTxId) return;
  var todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];
  var venda = todasVendas.find(function(v) { return v.txId === _pdvUltimoTxId; });
  if (venda) abrirPreviewComprovante(venda);
}

// ── Preview do comprovante ────────────────────────────────
var _comprovanteVendaAtual = null;

function abrirPreviewComprovante(venda) {
  _comprovanteVendaAtual = venda;
  var todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];
  var itens = venda.txId ? todasVendas.filter(function(v) { return v.txId === venda.txId; }) : [venda];
  var totalPago  = itens.reduce(function(s,v){ var pv = v.precoComDesconto !== undefined ? v.precoComDesconto : v.preco; return s + v.quantidade * pv; }, 0);
  var totalDesc  = itens.reduce(function(s,v){ var pu = v.preco||0; var pd = v.precoComDesconto !== undefined ? v.precoComDesconto : pu; return s + (pu-pd)*v.quantidade; }, 0);
  var formaLabel = { 'Dinheiro':'Dinheiro','Pix':'PIX','Cartao-Debito':'Cartão Débito','Cartao-Credito':'Cartão Crédito','Crediario':'Crediário' };
  var dataFmt    = venda.data ? venda.data.split('-').reverse().join('/') : 'N/A';

  var itensHtml = itens.map(function(v) {
    var pv  = v.precoComDesconto !== undefined ? v.precoComDesconto : v.preco;
    var pu  = v.preco || pv;
    var sub = v.quantidade * pv;
    var desc = v.desconto > 0 ? '<span class="cp-desc-tag">-'+v.desconto+'%</span>' : '';
    return '<div class="cp-item">' +
      '<div class="cp-item-nome">' + (v.nome||'—') + '</div>' +
      '<div class="cp-item-vals">' +
        '<span class="cp-item-qtd">' + v.quantidade + 'x  R$ ' + pu.toFixed(2) + desc + '</span>' +
        '<span class="cp-item-sub">R$ ' + sub.toFixed(2) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  var html =
    '<div class="cp-cupom">' +
      '<div class="cp-header">' +
        '<div class="cp-logo">USE STYLO</div>' +
        '<div class="cp-sub">MODA & ESTILO</div>' +
        '<div class="cp-end">Rua 7 de Setembro, 478 — São Pedro do Sul — RS</div>' +
        '<div class="cp-end">Tel: (55) 99206-1704</div>' +
      '</div>' +
      '<div class="cp-dashes"></div>' +
      '<div class="cp-meta">' +
        '<span>Data: ' + dataFmt + '</span>' +
        '<span>Hora: ' + (venda.hora||'N/A') + '</span>' +
      '</div>' +
      (venda.txId ? '<div class="cp-ref">Ref: ' + venda.txId.toUpperCase() + '</div>' : '') +
      '<div class="cp-dashes"></div>' +
      '<div class="cp-col-head">' +
        '<span>PRODUTO</span><span>TOTAL</span>' +
      '</div>' +
      '<div class="cp-dashes"></div>' +
      itensHtml +
      '<div class="cp-dashes"></div>' +
      '<div class="cp-resumo">' +
        (totalDesc > 0 ? '<div class="cp-resumo-row"><span>Desconto</span><span class="cp-neg">-R$ ' + totalDesc.toFixed(2) + '</span></div>' : '') +
        '<div class="cp-resumo-row"><span>Pagamento</span><span>' + (formaLabel[venda.formaPagamento]||venda.formaPagamento||'N/A') + '</span></div>' +
      '</div>' +
      '<div class="cp-total-block">' +
        '<span class="cp-total-label">TOTAL</span>' +
        '<span class="cp-total-val">R$ ' + totalPago.toFixed(2).replace('.',',') + '</span>' +
      '</div>' +
      '<div class="cp-dashes"></div>' +
      '<div class="cp-footer">Obrigado pela preferência!</div>' +
      '<div class="cp-footer cp-footer-sub">Use o seu Stylo ✦</div>' +
    '</div>';

  document.getElementById('cpPreviewBody').innerHTML = html;
  document.getElementById('cpWhatsappStep').style.display = 'none';
  document.getElementById('cpMainStep').style.display    = 'flex';
  document.getElementById('cpPreviewOverlay').style.display = 'flex';
}

function fecharPreviewComprovante() {
  document.getElementById('cpPreviewOverlay').style.display = 'none';
  _comprovanteVendaAtual = null;
}

function cpBaixar() {
  if (!_comprovanteVendaAtual) return;
  gerarComprovante(_comprovanteVendaAtual);
  fecharPreviewComprovante();
  // volta para tela de sucesso (ela ainda está aberta atrás)
}

function cpAbrirWhatsapp() {
  document.getElementById('cpMainStep').style.display    = 'none';
  document.getElementById('cpWhatsappStep').style.display = 'flex';
  setTimeout(function() { document.getElementById('cpWhatsappNum').focus(); }, 100);
}

function cpVoltarMain() {
  document.getElementById('cpWhatsappStep').style.display = 'none';
  document.getElementById('cpMainStep').style.display    = 'flex';
}

function cpEnviarWhatsapp() {
  if (!_comprovanteVendaAtual) return;
  var raw = (document.getElementById('cpWhatsappNum').value || '').replace(/\D/g, '');
  if (raw.length < 10) {
    document.getElementById('cpWhatsappErro').style.display = 'block';
    return;
  }
  document.getElementById('cpWhatsappErro').style.display = 'none';

  var v = _comprovanteVendaAtual;
  var todasVendas = JSON.parse(localStorage.getItem('vendas')) || [];
  var itens = v.txId ? todasVendas.filter(function(x){ return x.txId === v.txId; }) : [v];
  var total = itens.reduce(function(s,x){ var pv = x.precoComDesconto !== undefined ? x.precoComDesconto : x.preco; return s + x.quantidade * pv; }, 0);
  var formaLabel = { 'Dinheiro':'Dinheiro','Pix':'PIX','Cartao-Debito':'Cartão Débito','Cartao-Credito':'Cartão Crédito','Crediario':'Crediário' };
  var dataFmt = v.data ? v.data.split('-').reverse().join('/') : 'N/A';

  var linhasItens = itens.map(function(x){
    var pv = x.precoComDesconto !== undefined ? x.precoComDesconto : x.preco;
    return '• ' + x.quantidade + 'x ' + (x.nome||'—') + ' — R$ ' + (x.quantidade*pv).toFixed(2);
  }).join('\n');

  var msg =
    'Obrigado pela sua compra na *Use Stylo*! 🛍️\n\n' +
    'Aqui está o seu comprovante:';

  var numero = raw.startsWith('55') ? raw : '55' + raw;
  var url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(msg);

  // Baixa o PDF simultaneamente
  gerarComprovante(v);

  window.open(url, '_blank');
  fecharPreviewComprovante();
}

function _pdvRegistrarVendas(formaPagamento, itens) {
  var hoje = new Date();
  var data = localDateStr(hoje);
  var hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  var txId = Date.now().toString(36);

  itens.forEach(function(item) {
    if (estoque[item.idxProduto]) estoque[item.idxProduto].quantidade -= item.qtd;
    vendas.push({
      nome: item.nome,
      quantidade: item.qtd,
      preco: item.precoOriginal,
      desconto: item.desconto,
      precoComDesconto: item.preco,
      precoCompra: item.precoCompra || 0,
      formaPagamento: formaPagamento,
      data: data, hora: hora,
      cliente: 'Cliente Não Informado',
      txId: txId,
    });
  });

  salvarDados();
  if (typeof window.autoSalvarFirebase === 'function') window.autoSalvarFirebase();
}

function _pdvAbrirCrediarioForm(total, itens) {
  // Navega para crediário e abre o formulário com total pré-preenchido
  mostrarAba('crediario');
  setTimeout(function() {
    abrirFormCrediario();
    // Preenche o valor total com o carrinho
    var elTotal = document.getElementById('crdValorTotal');
    if (elTotal) { elTotal.value = total.toFixed(2); crdCalcPreview(); }
    // Descrição com os itens
    var desc = itens.map(function(i) { return i.qtd + 'x ' + i.nome; }).join(', ');
    var elProds = document.getElementById('crdProdutos');
    if (elProds) elProds.value = desc;

    // Após salvar o crediário, registrar as vendas e limpar o carrinho
    window._pdvPendingCrediarioItens = itens;
  }, 300);
}

function pdvShowFeedback(tipo, msg) {
  var el = document.getElementById('pdvFeedback');
  if (!el) return;
  el.className = 'pdv-feedback ' + tipo;
  el.innerHTML = msg;
  el.style.display = 'block';
}

function pdvHideFeedback() {
  var el = document.getElementById('pdvFeedback');
  if (el) el.style.display = 'none';
}

// Global keyboard shortcuts for PDV
document.addEventListener('keydown', function(e) {
  // Bloqueia F5 globalmente para não recarregar a página
  if (e.key === 'F5') { e.preventDefault(); }

  var secVendas = document.getElementById('vendas');
  if (!secVendas || !secVendas.classList.contains('active')) return;
  if (e.key === 'F2') {
    e.preventDefault();
    var inp = document.getElementById('pdvBusca'); if (inp) inp.focus();
  } else if (e.key === 'F5') {
    e.preventDefault();
    finalizarVendaPDV();
  } else if (e.key === 'Escape') {
    if (document.activeElement && document.activeElement.id === 'pdvBusca') {
      document.getElementById('pdvBusca').value = '';
      pdvFecharDropdown();
      pdvLimparSelecao();
    } else {
      pdvLimpar();
    }
  }
});

// Close PDV dropdown on outside click
document.addEventListener('click', function(e) {
  var area = document.querySelector('.pdv-search-area');
  if (!area || area.contains(e.target)) return;
  pdvFecharDropdown();
  pdvFecharBrowse();
});

// ============================================================
// CREDIÁRIO — Sistema Profissional
// ============================================================

var crdFiltroAtivo   = 'todos';
var crdClienteIdx    = null;
var crdBarChartObj   = null;
var crdDonutChartObj = null;

// ---- Data layer ----

function crdMigrarAntigo(c, id) {
  var valorTotal   = parseFloat(c.valorCompra) || 0;
  var nParcelas    = c.parcelasTotais || 1;
  var pPagas       = c.parcelasPagas  || 0;
  var valorParcela = parseFloat((valorTotal / nParcelas).toFixed(2));
  var diaPag       = parseInt(c.diaPagamento) || 10;
  var baseDate     = c.dataCompra ? new Date(c.dataCompra + 'T00:00:00') : new Date();
  var today        = new Date(); today.setHours(0,0,0,0);
  var parcelas = [];
  for (var i = 0; i < nParcelas; i++) {
    var vencD = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1 + i, diaPag);
    var st = i < pPagas ? 'pago' : (vencD < today ? 'atrasado' : 'pendente');
    parcelas.push({
      numero: i + 1,
      valor: valorParcela,
      vencimento: localDateStr(vencD),
      status: st,
      dataPagamento: i < pPagas ? (c.dataCompra || '') : null,
      formaPagamento: i < pPagas ? 'Dinheiro' : null,
    });
  }
  var primVenc = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, diaPag);
  return {
    id: id || ('mig_' + Math.random().toString(36).substr(2,8)),
    nomeCliente: c.nomeCliente || '', cpfCliente: c.cpfCliente || '',
    numCliente: c.numCliente || '', produtosComprados: c.produtosComprados || '',
    valorTotal: valorTotal, valorEntrada: 0,
    dataCompra: c.dataCompra || '',
    primeiroVencimento: localDateStr(primVenc),
    observacoes: '', parcelas: parcelas, _migrated: true,
  };
}

function crdGetAll() {
  var raw      = JSON.parse(localStorage.getItem('crediarios')) || [];
  var historico = JSON.parse(localStorage.getItem('historicoCrediariosPagos')) || [];
  var ativos = raw.map(function(c, i) {
    if (c.parcelas) return c;
    return crdMigrarAntigo(c, 'mig_a_' + i);
  });
  var hist = historico.map(function(c, i) {
    var m = c.parcelas ? c : crdMigrarAntigo(c, 'mig_h_' + i);
    m.parcelas.forEach(function(p) { if (p.status !== 'cancelado') p.status = 'pago'; });
    return m;
  });
  return ativos.concat(hist);
}

function crdSaveAll(arr) {
  var ativos   = arr.filter(function(c) { return c.parcelas.some(function(p) { return p.status !== 'pago' && p.status !== 'cancelado'; }); });
  var quitados = arr.filter(function(c) { return c.parcelas.every(function(p) { return p.status === 'pago' || p.status === 'cancelado'; }); });
  localStorage.setItem('crediarios', JSON.stringify(ativos));
  localStorage.setItem('historicoCrediariosPagos', JSON.stringify(quitados));
  if (typeof window.autoSalvarFirebase === 'function') window.autoSalvarFirebase();
}

// ---- Helpers ----

function crdStatusCliente(cred) {
  var today = new Date(); today.setHours(0,0,0,0);
  var todayStr = localDateStr(today);
  var pendentes = cred.parcelas.filter(function(p) { return p.status !== 'pago' && p.status !== 'cancelado'; });
  if (pendentes.length === 0) return 'quitado';
  if (pendentes.some(function(p) { return new Date(p.vencimento + 'T00:00:00') < today; })) return 'atrasado';
  if (pendentes.some(function(p) { return p.vencimento === todayStr; })) return 'hoje';
  if (pendentes.some(function(p) {
    var diff = (new Date(p.vencimento + 'T00:00:00') - today) / 86400000;
    return diff > 0 && diff <= 7;
  })) return 'semana';
  return 'emdia';
}

function crdValorAberto(cred) {
  return cred.parcelas.filter(function(p) { return p.status !== 'pago' && p.status !== 'cancelado'; }).reduce(function(s,p) { return s+p.valor; }, 0);
}

function crdValorPago(cred) {
  return cred.parcelas.filter(function(p) { return p.status === 'pago'; }).reduce(function(s,p) { return s+p.valor; }, 0);
}

function crdValorAtrasado(cred) {
  var today = new Date(); today.setHours(0,0,0,0);
  return cred.parcelas.filter(function(p) {
    if (p.status === 'pago' || p.status === 'cancelado') return false;
    return new Date(p.vencimento + 'T00:00:00') < today;
  }).reduce(function(s,p) { return s+p.valor; }, 0);
}

function crdFmtData(dateStr) {
  if (!dateStr) return '—';
  var p = dateStr.split('-'); return p[2] + '/' + p[1] + '/' + p[0];
}

function crdDiasAtraso(vencimento) {
  var today = new Date(); today.setHours(0,0,0,0);
  return Math.round((today - new Date(vencimento + 'T00:00:00')) / 86400000);
}

// ---- Init ----

function initCrediario() {
  crdRenderKPIs();
  crdRenderFeed();
}

function crdRenderAlertas() {} // retired — urgency integrated into cards
function crdRenderCharts()  {} // retired — removed per design
function crdRenderTabela()  { crdRenderFeed(); }

// ---- 4 Big KPIs ----

function crdRenderKPIs() {
  var el = document.getElementById('crdKpiRow');
  if (!el) return;
  var all  = crdGetAll();
  var today = new Date(); today.setHours(0,0,0,0);
  var todayStr = localDateStr(today);
  var mes = today.getMonth(), ano = today.getFullYear();
  var totalReceber=0, emAtraso=0, hojeVal=0, recebidoMes=0;
  var ctAtras=0, ctHoje=0, ctSemana=0;
  all.forEach(function(c) {
    var st = crdStatusCliente(c);
    if (st !== 'quitado') totalReceber += crdValorAberto(c);
    emAtraso += crdValorAtrasado(c);
    if (st === 'atrasado') ctAtras++;
    if (st === 'hoje')     { ctHoje++;   ctSemana++; }
    if (st === 'semana')   ctSemana++;
    c.parcelas.forEach(function(p) {
      if (p.status !== 'pago' && p.vencimento === todayStr) hojeVal += p.valor;
      if (p.status === 'pago' && p.dataPagamento) {
        var pd = new Date(p.dataPagamento + 'T00:00:00');
        if (pd.getMonth() === mes && pd.getFullYear() === ano) recebidoMes += p.valor;
      }
    });
  });

  // Update tab badges
  var ta = document.getElementById('ctAtrasado'); if (ta) ta.textContent = ctAtras;
  var th = document.getElementById('ctHoje');     if (th) th.textContent = ctHoje;
  var ts = document.getElementById('ctSemana');   if (ts) ts.textContent = ctSemana;

  el.innerHTML =
    '<div class="crd-kpi-main-card crd-kmain-blue">' +
      '<div class="crd-kmain-label">Total a Receber</div>' +
      '<div class="crd-kmain-val">' + dashFmt(totalReceber) + '</div>' +
      '<div class="crd-kmain-sub">' + all.filter(function(c){return crdStatusCliente(c)!=='quitado';}).length + ' clientes ativos</div>' +
    '</div>' +
    '<div class="crd-kpi-main-card crd-kmain-red">' +
      '<div class="crd-kmain-label">Em Atraso</div>' +
      '<div class="crd-kmain-val">' + dashFmt(emAtraso) + '</div>' +
      '<div class="crd-kmain-sub">' + ctAtras + ' cliente' + (ctAtras !== 1 ? 's' : '') + ' inadimplente' + (ctAtras !== 1 ? 's' : '') + '</div>' +
    '</div>' +
    '<div class="crd-kpi-main-card crd-kmain-orange">' +
      '<div class="crd-kmain-label">Vence Hoje</div>' +
      '<div class="crd-kmain-val">' + dashFmt(hojeVal) + '</div>' +
      '<div class="crd-kmain-sub">' + ctHoje + ' parcela' + (ctHoje !== 1 ? 's' : '') + ' hoje</div>' +
    '</div>' +
    '<div class="crd-kpi-main-card crd-kmain-green">' +
      '<div class="crd-kmain-label">Recebido no Mês</div>' +
      '<div class="crd-kmain-val">' + dashFmt(recebidoMes) + '</div>' +
      '<div class="crd-kmain-sub">' + new Date().toLocaleDateString('pt-BR',{month:'long'}) + '</div>' +
    '</div>';
}

// ---- Filter tabs ----

function crdFiltrar(tipo) {
  crdFiltroAtivo = tipo;
  ['todos','emdia','atrasado','hoje','semana','quitado'].forEach(function(t) {
    var el = document.getElementById('crdB' + t);
    if (el) el.classList.toggle('ativo', t === tipo);
  });
  crdRenderFeed();
}

// ---- Client Feed (card-based) ----

function crdRenderFeed() {
  var el = document.getElementById('crdClientFeed');
  if (!el) return;
  var busca = (document.getElementById('crdBusca') ? document.getElementById('crdBusca').value : '').toLowerCase().trim();
  var today = new Date(); today.setHours(0,0,0,0);
  var all = crdGetAll();

  if (busca) all = all.filter(function(c) {
    return (c.nomeCliente + ' ' + (c.cpfCliente||'')).toLowerCase().indexOf(busca) !== -1;
  });

  if (crdFiltroAtivo !== 'todos') {
    all = all.filter(function(c) {
      var s = crdStatusCliente(c);
      if (crdFiltroAtivo === 'atrasado') return s === 'atrasado';
      if (crdFiltroAtivo === 'hoje')     return s === 'hoje';
      if (crdFiltroAtivo === 'semana')   return s === 'semana' || s === 'hoje';
      if (crdFiltroAtivo === 'emdia')    return s === 'emdia';
      if (crdFiltroAtivo === 'quitado')  return s === 'quitado';
      return true;
    });
  }

  var sortOrder = { atrasado:0, hoje:1, semana:2, emdia:3, quitado:4 };
  all.sort(function(a,b) {
    var sa = sortOrder[crdStatusCliente(a)] !== undefined ? sortOrder[crdStatusCliente(a)] : 5;
    var sb = sortOrder[crdStatusCliente(b)] !== undefined ? sortOrder[crdStatusCliente(b)] : 5;
    return sa - sb;
  });

  if (all.length === 0) {
    el.innerHTML = '<div class="crd-feed-empty"><div style="font-size:2rem;opacity:0.2;margin-bottom:8px;">&#128178;</div><p>Nenhum cliente encontrado</p></div>';
    return;
  }

  el.innerHTML = all.map(function(c, i) {
    var st       = crdStatusCliente(c);
    var valAb    = crdValorAberto(c);
    var pend     = c.parcelas.filter(function(p){ return p.status !== 'pago' && p.status !== 'cancelado'; });
    pend.sort(function(a,b){ return a.vencimento.localeCompare(b.vencimento); });
    var atrasadas = pend.filter(function(p){ return new Date(p.vencimento + 'T00:00:00') < today; });
    var proxP    = pend[0];
    var pPagas   = c.parcelas.filter(function(p){ return p.status === 'pago'; }).length;
    var pTotal   = c.parcelas.length;
    var inic     = c.nomeCliente.split(' ').slice(0,2).map(function(n){ return n[0]; }).join('').toUpperCase();
    var pct      = pTotal > 0 ? (pPagas / pTotal * 100).toFixed(0) : 0;

    // Urgency label + card class
    var urgLabel = '', urgClass = '';
    if (st === 'atrasado') {
      var maxD = atrasadas.length > 0 ? Math.max.apply(null, atrasadas.map(function(p){ return crdDiasAtraso(p.vencimento); })) : 0;
      urgLabel = 'EM ATRASO &bull; ' + maxD + ' dia' + (maxD !== 1 ? 's' : '');
      urgClass = 'urg-atrasado';
    } else if (st === 'hoje') {
      urgLabel = 'VENCE HOJE';
      urgClass = 'urg-hoje';
    } else if (st === 'semana') {
      var diffD = proxP ? Math.round((new Date(proxP.vencimento+'T00:00:00') - today) / 86400000) : 0;
      urgLabel = 'VENCE EM ' + diffD + ' DIA' + (diffD !== 1 ? 'S' : '');
      urgClass = 'urg-semana';
    } else if (st === 'emdia') {
      urgLabel = 'EM DIA';
      urgClass = 'urg-emdia';
    } else {
      urgLabel = 'QUITADO';
      urgClass = 'urg-quitado';
    }

    var proxInfo = proxP
      ? 'Parcela ' + proxP.numero + '/' + pTotal + ' &bull; ' + dashFmt(proxP.valor) + ' &bull; ' + (st === 'atrasado' ? 'Venceu' : 'Vence') + ' ' + crdFmtData(proxP.vencimento)
      : (st === 'quitado' ? 'Todas as parcelas quitadas' : pPagas + '/' + pTotal + ' pagas');

    var actBtns = '';
    if (c.numCliente) actBtns += '<button class="crd-btn-wpp" onclick="event.stopPropagation();crdEnviarWhatsApp(' + i + ')">&#128241; WhatsApp</button>';
    if (proxP)        actBtns += '<button class="crd-btn-receive" onclick="event.stopPropagation();abrirClienteDrawer(' + i + ')">Receber &rarr;</button>';
    actBtns += '<button class="crd-btn-detail" onclick="event.stopPropagation();abrirClienteDrawer(' + i + ')">Ver parcelas</button>';

    return '<div class="crd-client-card ' + urgClass + '" onclick="abrirClienteDrawer(' + i + ')">' +
      '<div class="crd-card-urgbar"></div>' +
      '<div class="crd-card-body">' +
        '<div class="crd-card-av">' + inic + '</div>' +
        '<div class="crd-card-main">' +
          '<div class="crd-card-name">' + c.nomeCliente + '</div>' +
          '<div class="crd-card-meta">' + (c.cpfCliente || '') + (c.numCliente ? (c.cpfCliente ? ' &middot; ' : '') + c.numCliente : '') + '</div>' +
          '<div class="crd-card-urg-row">' +
            '<span class="crd-urg-tag ' + urgClass + '">' + urgLabel + '</span>' +
            '<span class="crd-card-parcela-info">' + proxInfo + '</span>' +
          '</div>' +
          (c.produtosComprados ? '<div class="crd-card-prods">&#128230; ' + c.produtosComprados + '</div>' : '') +
        '</div>' +
        '<div class="crd-card-right">' +
          '<div class="crd-card-val-main ' + (st === 'atrasado' ? 'crd-val-red' : '') + '">' + dashFmt(valAb > 0 ? valAb : c.valorTotal) + '</div>' +
          '<div class="crd-card-val-sub">' + (valAb > 0 ? 'em aberto' : st === 'quitado' ? 'quitado' : 'total') + '</div>' +
          '<div class="crd-prog-wrap">' +
            '<div class="crd-prog-bar"><div class="crd-prog-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="crd-prog-txt">' + pPagas + '/' + pTotal + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="crd-card-actions">' + actBtns + '</div>' +
    '</div>';
  }).join('');
}

// ---- Form drawer ----

var crdEditId = null;

function abrirFormCrediario() {
  crdEditId = null;
  ['crdNome','crdCpf','crdTelefone','crdProdutos','crdObs'].forEach(function(fid) {
    var el = document.getElementById(fid); if (el) el.value = '';
  });
  var hoje = localDateStr();
  var proxMes = localDateStr(new Date(new Date().getFullYear(), new Date().getMonth()+1, 10));
  var dc = document.getElementById('crdDataCompra'); if (dc) dc.value = hoje;
  var pv = document.getElementById('crdPrimVenc');  if (pv) pv.value = proxMes;
  var ent = document.getElementById('crdEntrada');  if (ent) ent.value = '0';
  var vt = document.getElementById('crdValorTotal'); if (vt) vt.value = '';
  var np = document.getElementById('crdNParcelas');  if (np) np.value = '';
  var prev = document.getElementById('crdParcelasPreview'); if (prev) prev.style.display = 'none';
  document.getElementById('crdFormTitulo').textContent = 'Novo Crediário';
  document.getElementById('crdFormOverlay').classList.add('ativo');
  document.getElementById('crdFormDrawer').classList.add('ativo');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ var el = document.getElementById('crdNome'); if (el) el.focus(); }, 100);
}

function fecharFormCrediario() {
  document.getElementById('crdFormOverlay')?.classList.remove('ativo');
  document.getElementById('crdFormDrawer')?.classList.remove('ativo');
  document.body.style.overflow = '';
}

function crdCalcPreview() {
  var total   = parseFloat(document.getElementById('crdValorTotal')?.value) || 0;
  var entrada = parseFloat(document.getElementById('crdEntrada')?.value)    || 0;
  var nParc   = parseInt(document.getElementById('crdNParcelas')?.value)    || 0;
  var primV   = document.getElementById('crdPrimVenc')?.value;
  var el      = document.getElementById('crdParcelasPreview');
  if (!el) return;
  if (total <= 0 || nParc < 1 || !primV) { el.style.display = 'none'; return; }

  var valorFin  = Math.max(0, total - entrada);
  var valorParc = valorFin / nParc;
  var base      = new Date(primV + 'T00:00:00');
  var rows = '<div class="crd-preview-header"><span>' + nParc + ' parcela' + (nParc>1?'s':'') + ' de ' + dashFmt(valorParc) + '</span>' +
             '<span>Financiado: ' + dashFmt(valorFin) + '</span></div>';
  for (var i = 0; i < Math.min(nParc, 12); i++) {
    var vd = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
    rows += '<div class="crd-preview-row"><span style="color:var(--text-muted);font-size:0.72rem;">Parcela ' + (i+1) + '</span>' +
            '<span style="font-weight:600;">' + dashFmt(valorParc) + '</span>' +
            '<span style="color:var(--text-muted);font-size:0.72rem;">' + crdFmtData(localDateStr(vd)) + '</span></div>';
  }
  if (nParc > 12) rows += '<div style="text-align:center;font-size:0.72rem;color:var(--text-muted);padding:6px;">+' + (nParc-12) + ' parcelas...</div>';
  el.innerHTML = rows;
  el.style.display = 'block';
}

function salvarCrediario() {
  var nome    = document.getElementById('crdNome')?.value.trim();
  var cpf     = document.getElementById('crdCpf')?.value.trim() || '';
  var tel     = document.getElementById('crdTelefone')?.value.trim() || '';
  var dc      = document.getElementById('crdDataCompra')?.value;
  var prods   = document.getElementById('crdProdutos')?.value.trim() || '';
  var total   = parseFloat(document.getElementById('crdValorTotal')?.value);
  var entrada = parseFloat(document.getElementById('crdEntrada')?.value) || 0;
  var nParc   = parseInt(document.getElementById('crdNParcelas')?.value);
  var primV   = document.getElementById('crdPrimVenc')?.value;
  var obs     = document.getElementById('crdObs')?.value.trim() || '';

  if (!nome)                          return showAlert('Preencha o nome do cliente.', 'aviso');
  if (isNaN(total) || total <= 0)     return showAlert('Preencha o valor total.', 'aviso');
  if (isNaN(nParc) || nParc < 1)     return showAlert('Informe o número de parcelas.', 'aviso');
  if (!primV)                         return showAlert('Informe o primeiro vencimento.', 'aviso');

  var valorFin  = Math.max(0, total - entrada);
  var valorParc = parseFloat((valorFin / nParc).toFixed(2));
  var base      = new Date(primV + 'T00:00:00');
  var parcelas  = [];
  for (var i = 0; i < nParc; i++) {
    var vd = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
    parcelas.push({ numero:i+1, valor:valorParc, vencimento:localDateStr(vd), status:'pendente', dataPagamento:null, formaPagamento:null });
  }

  var all = crdGetAll();
  all.push({ id:'crd_'+Date.now(), nomeCliente:nome, cpfCliente:cpf, numCliente:tel, produtosComprados:prods, valorTotal:total, valorEntrada:entrada, dataCompra:dc||localDateStr(), primeiroVencimento:primV, observacoes:obs, parcelas:parcelas });
  crdSaveAll(all);

  // Se veio do PDV (crediário como forma de pagamento), registra as vendas e limpa o carrinho
  if (window._pdvPendingCrediarioItens && window._pdvPendingCrediarioItens.length > 0) {
    _pdvRegistrarVendas('Crediario', window._pdvPendingCrediarioItens);
    window._pdvPendingCrediarioItens = null;
    pdvCarrinhoPDV = [];
    showAlert('Crediário registrado e venda lançada com sucesso!', 'sucesso');
  }

  fecharFormCrediario();
  initCrediario();
}

// ---- Client detail drawer ----

function abrirClienteDrawer(idx) {
  crdClienteIdx = idx;
  var all = crdGetAll();
  var c   = all[idx];
  if (!c) return;

  var st      = crdStatusCliente(c);
  var valAb   = crdValorAberto(c);
  var valPg   = crdValorPago(c);
  var valAt   = crdValorAtrasado(c);
  var today   = new Date(); today.setHours(0,0,0,0);
  var todayStr = localDateStr(today);
  var inic    = c.nomeCliente.split(' ').slice(0,2).map(function(n){ return n[0]; }).join('').toUpperCase();

  var stCfg = {
    quitado:{cls:'est-badge est-badge-normal',label:'Quitado'},
    emdia:{cls:'est-badge est-badge-normal',label:'Em Dia'},
    atrasado:{cls:'est-badge est-badge-critico',label:'Em Atraso'},
    hoje:{cls:'est-badge est-badge-baixo',label:'Vence Hoje'},
    semana:{cls:'est-badge est-badge-baixo',label:'Em 7 dias'},
  };
  var cfg = stCfg[st] || stCfg.emdia;

  var parcelasHtml = c.parcelas.map(function(p, pi) {
    var vd     = new Date(p.vencimento + 'T00:00:00');
    var isPago = p.status === 'pago';
    var isCanc = p.status === 'cancelado';
    var dias   = crdDiasAtraso(p.vencimento);
    var stHtml;
    if (isPago)      stHtml = '<span class="est-badge est-badge-normal">&#10003; Pago' + (p.dataPagamento ? ' em '+crdFmtData(p.dataPagamento) : '') + '</span>';
    else if (isCanc) stHtml = '<span class="est-badge" style="background:rgba(100,100,120,0.15);color:var(--text-muted);">Cancelado</span>';
    else if (vd < today) stHtml = '<span class="est-badge est-badge-critico">&#9888; Atrasada ' + dias + 'd</span>';
    else if (p.vencimento === todayStr) stHtml = '<span class="est-badge est-badge-baixo">Vence Hoje</span>';
    else stHtml = '<span class="est-badge" style="background:rgba(34,197,94,0.08);color:var(--text-muted);">Vence '+crdFmtData(p.vencimento)+'</span>';

    var btnPay = (!isPago && !isCanc)
      ? '<div class="crd-parcela-pay">' +
          '<select class="crd-forma-sel" id="crdSel_'+pi+'">' +
            '<option value="Dinheiro">&#128181; Dinheiro</option>' +
            '<option value="Pix">&#9889; PIX</option>' +
            '<option value="Cartao-Debito">&#128179; D&eacute;bito</option>' +
            '<option value="Cartao-Credito">&#128179; Cr&eacute;dito</option>' +
          '</select>' +
          '<button class="btn-primary" onclick="crdReceberParcela('+idx+','+pi+')" style="padding:5px 12px;font-size:0.75rem;">Receber</button>' +
        '</div>'
      : '';

    return '<div class="crd-parcela-item' + (isPago ? ' crd-parcela-paga' : '') + '">' +
      '<div class="crd-parcela-num">Parcela ' + p.numero + '</div>' +
      '<div class="crd-parcela-val">' + dashFmt(p.valor) + '</div>' +
      '<div class="crd-parcela-status">' + stHtml + '</div>' +
      btnPay + '</div>';
  }).join('');

  document.getElementById('crdClienteTitulo').textContent = c.nomeCliente;
  document.getElementById('crdClienteBody').innerHTML =
    '<div class="crd-cliente-header">' +
      '<div class="prod-avatar" style="width:52px;height:52px;font-size:1.2rem;background:var(--gold-subtle);color:var(--gold);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;">' + inic + '</div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:1.05rem;font-weight:800;">' + c.nomeCliente + '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">' + (c.cpfCliente?'CPF: '+c.cpfCliente:'') + (c.numCliente?' &middot; Tel: '+c.numCliente:'') + '</div>' +
        '<div style="margin-top:6px;"><span class="'+cfg.cls+'">'+cfg.label+'</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="crd-kpi-mini-row">' +
      '<div class="crd-kpi-mini"><div>Total</div><strong>'+dashFmt(c.valorTotal)+'</strong></div>' +
      '<div class="crd-kpi-mini crd-kpi-mini-green"><div>Pago</div><strong>'+dashFmt(valPg)+'</strong></div>' +
      '<div class="crd-kpi-mini '+(valAb>0?'crd-kpi-mini-red':'')+'"><div>Em Aberto</div><strong>'+dashFmt(valAb)+'</strong></div>' +
      '<div class="crd-kpi-mini '+(valAt>0?'crd-kpi-mini-red':'')+'"><div>Vencido</div><strong>'+dashFmt(valAt)+'</strong></div>' +
    '</div>' +
    (c.produtosComprados ? '<div style="font-size:0.78rem;color:var(--text-muted);padding:8px 0;">&#128230; '+c.produtosComprados+'</div>' : '') +
    (c.observacoes ? '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">&#128172; '+c.observacoes+'</div>' : '') +
    '<div class="crd-parcelas-label">Parcelas</div>' +
    '<div class="crd-parcelas-list">' + parcelasHtml + '</div>';

  document.getElementById('crdClienteFooter').innerHTML =
    '<button class="btn-ghost" onclick="fecharClienteDrawer()">Fechar</button>' +
    '<button class="btn-ghost" onclick="crdEnviarWhatsApp('+idx+')" style="color:#25d366;">&#128241; WhatsApp</button>' +
    '<button class="btn-danger" onclick="crdExcluir('+idx+')" style="margin-left:auto;">Excluir</button>';

  document.getElementById('crdClienteOverlay').classList.add('ativo');
  document.getElementById('crdClienteDrawer').classList.add('ativo');
  document.body.style.overflow = 'hidden';
}

function fecharClienteDrawer() {
  document.getElementById('crdClienteOverlay')?.classList.remove('ativo');
  document.getElementById('crdClienteDrawer')?.classList.remove('ativo');
  document.body.style.overflow = '';
}

function crdReceberParcela(cIdx, pIdx) {
  var all  = crdGetAll();
  var c    = all[cIdx];
  if (!c) return;
  var selEl = document.getElementById('crdSel_' + pIdx);
  var forma = selEl ? selEl.value : 'Dinheiro';
  var today = new Date(); today.setHours(0,0,0,0);

  c.parcelas[pIdx].status         = 'pago';
  c.parcelas[pIdx].dataPagamento  = localDateStr(today);
  c.parcelas[pIdx].formaPagamento = forma;

  c.parcelas.forEach(function(p) {
    if (p.status !== 'pago' && p.status !== 'cancelado') {
      p.status = new Date(p.vencimento + 'T00:00:00') < today ? 'atrasado' : 'pendente';
    }
  });

  crdSaveAll(all);
  fecharClienteDrawer();
  initCrediario();
}

function crdExcluir(idx) {
  showConfirm('Excluir este crediário?', () => {
    var all = crdGetAll();
    all.splice(idx, 1);
    crdSaveAll(all);
    fecharClienteDrawer();
    initCrediario();
  });
}

function crdEnviarWhatsApp(idx) {
  var all = crdGetAll();
  var c   = all[idx];
  if (!c || !c.numCliente) return showAlert('Telefone não informado.', 'aviso');
  var num   = c.numCliente.replace(/\D/g,'');
  var final = num.startsWith('55') ? num : '55' + num;
  var pend  = c.parcelas.filter(function(p){ return p.status !== 'pago' && p.status !== 'cancelado'; });
  pend.sort(function(a,b){ return a.vencimento.localeCompare(b.vencimento); });
  var msg;
  if (pend.length > 0) {
    var prox = pend[0];
    msg = 'Olá ' + c.nomeCliente + '! Tudo bem?\n\nAqui é da *Use Stylo*. Passando para lembrar que sua parcela de *' + dashFmt(prox.valor) + '* vence em *' + crdFmtData(prox.vencimento) + '*.\n\nEvite atrasos para manter seu crédito em dia!\n\n_Atenciosamente, Use Stylo_ 💜';
  } else {
    msg = 'Olá ' + c.nomeCliente + '! Aqui é da *Use Stylo*. Entre em contato sobre seu crediário.';
  }
  window.open('https://wa.me/' + final + '?text=' + encodeURIComponent(msg), '_blank');
}

function abrirWhatsApp(numero) { crdEnviarWhatsApp(0); }

// ============================================================
// MÓDULO DESPESAS
// ============================================================

var _despFiltroAtivo = 'todas';

var _DESP_CAT_ICONE = {
  'Água':        '💧',
  'Luz':         '💡',
  'Internet':    '📡',
  'Aluguel':     '🏠',
  'Fornecedor':  '📦',
  'Funcionários':'👥',
  'Investimento':'📈',
  'Outros':      '📋',
};

var _DESP_CAT_COR = {
  'Água':        '#3B82F6',
  'Luz':         '#F59E0B',
  'Internet':    '#8B5CF6',
  'Aluguel':     '#EC4899',
  'Fornecedor':  '#10B981',
  'Funcionários':'#06B6D4',
  'Investimento':'#D4AF37',
  'Outros':      '#6B7280',
};

function despGetAll() {
  try { return JSON.parse(localStorage.getItem('despesas')) || []; } catch(e) { return []; }
}

function despSaveAll(arr) {
  localStorage.setItem('despesas', JSON.stringify(arr));
  if (typeof window.autoSalvarFirebase === 'function') window.autoSalvarFirebase();
}

function _despUUID() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _despStatus(d) {
  if (d.status === 'pago') return 'pago';
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var venc = new Date(d.vencimento + 'T00:00:00');
  if (venc < hoje) return 'atrasado';
  if (venc.toDateString() === hoje.toDateString()) return 'hoje';
  return 'pendente';
}

function initDespesas() {
  var todas = despGetAll();
  _despAtualizarStatus(todas);
  _despRenderKpis(todas);
  _despRenderAlerta(todas);
  _despAtualizarContadores(todas);
  despRenderFeed();
}

function _despAtualizarStatus(arr) {
  arr.forEach(function(d) {
    if (d.status !== 'pago') {
      d.status = _despStatus(d) === 'atrasado' ? 'atrasado' : 'pendente';
    }
  });
}

function _despRenderKpis(todas) {
  var agora = new Date();
  var mesAtual = agora.getMonth();
  var anoAtual = agora.getFullYear();

  var totalMes = 0, totalPago = 0, totalPendente = 0, totalAtrasado = 0;

  todas.forEach(function(d) {
    var venc = new Date(d.vencimento + 'T00:00:00');
    if (venc.getMonth() === mesAtual && venc.getFullYear() === anoAtual) {
      totalMes += d.valor || 0;
    }
    var st = _despStatus(d);
    if (d.status === 'pago') totalPago += d.valor || 0;
    else if (st === 'atrasado') totalAtrasado += d.valor || 0;
    else totalPendente += d.valor || 0;
  });

  var el = document.getElementById('despKpiRow');
  if (!el) return;
  el.innerHTML = [
    { label: 'Total do Mês', val: dashFmt(totalMes), cls: 'kpi-gold' },
    { label: 'Pendentes',    val: dashFmt(totalPendente), cls: 'kpi-warn' },
    { label: 'Atrasadas',    val: dashFmt(totalAtrasado), cls: 'kpi-red' },
    { label: 'Pagas',        val: dashFmt(totalPago), cls: 'kpi-green' },
  ].map(function(k) {
    return '<div class="desp-kpi-card ' + k.cls + '"><div class="desp-kpi-val">' + k.val + '</div><div class="desp-kpi-lbl">' + k.label + '</div></div>';
  }).join('');
}

function _despRenderAlerta(todas) {
  var el = document.getElementById('despAlertaVenc');
  if (!el) return;
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  var proximos = todas.filter(function(d) {
    if (d.status === 'pago') return false;
    var v = new Date(d.vencimento + 'T00:00:00');
    return v <= amanha;
  });
  if (proximos.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="desp-alerta-banner"><span class="desp-alerta-icon">⚠</span> <strong>' + proximos.length + ' despesa(s)</strong> vence(m) hoje ou estão atrasadas.</div>';
}

function _despAtualizarContadores(todas) {
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var ctPend = 0, ctAtras = 0, ctHoje = 0;
  todas.forEach(function(d) {
    if (d.status === 'pago') return;
    var v = new Date(d.vencimento + 'T00:00:00');
    if (v < hoje) ctAtras++;
    else if (v.toDateString() === hoje.toDateString()) { ctHoje++; ctPend++; }
    else ctPend++;
  });
  var elPend  = document.getElementById('ctDespPendente');
  var elAtras = document.getElementById('ctDespAtrasado');
  var elHoje  = document.getElementById('ctDespHoje');
  if (elPend)  elPend.textContent  = ctPend  || '';
  if (elAtras) elAtras.textContent = ctAtras || '';
  if (elHoje)  elHoje.textContent  = ctHoje  || '';
}

function despFiltrar(filtro) {
  _despFiltroAtivo = filtro;
  document.querySelectorAll('.desp-tab').forEach(function(b) { b.classList.remove('ativo'); });
  var mapa = { todas: 'despBtodas', pendente: 'despBpendente', atrasado: 'despBatrasado', hoje: 'despBhoje', pago: 'despBpago' };
  var btn = document.getElementById(mapa[filtro]);
  if (btn) btn.classList.add('ativo');
  despRenderFeed();
}

function despRenderFeed() {
  var todas   = despGetAll();
  var catFilt = (document.getElementById('despFiltroCategoria')?.value || '');
  var hoje    = new Date(); hoje.setHours(0,0,0,0);

  var lista = todas.filter(function(d) {
    if (catFilt && d.categoria !== catFilt) return false;
    var st = _despStatus(d);
    if (d.status === 'pago') st = 'pago';
    switch (_despFiltroAtivo) {
      case 'pendente':  return st === 'pendente' || st === 'hoje';
      case 'atrasado':  return st === 'atrasado';
      case 'hoje':      return st === 'hoje' || (st === 'atrasado' && new Date(d.vencimento + 'T00:00:00').toDateString() === hoje.toDateString());
      case 'pago':      return st === 'pago';
      default:          return true;
    }
  });

  lista.sort(function(a, b) {
    if (a.status === 'pago' && b.status !== 'pago') return 1;
    if (b.status === 'pago' && a.status !== 'pago') return -1;
    return a.vencimento.localeCompare(b.vencimento);
  });

  var el = document.getElementById('despFeed');
  if (!el) return;

  if (lista.length === 0) {
    el.innerHTML = '<div class="desp-empty"><div class="desp-empty-icon">💸</div><p>Nenhuma despesa encontrada</p><small>Clique em <strong>+ Nova Despesa</strong> para adicionar</small></div>';
    return;
  }

  el.innerHTML = lista.map(function(d) {
    var idx    = todas.indexOf(d);
    var st     = d.status === 'pago' ? 'pago' : _despStatus(d);
    var icone  = _DESP_CAT_ICONE[d.categoria] || '📋';
    var cor    = _DESP_CAT_COR[d.categoria]   || '#6B7280';
    var stLbl  = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado', hoje: 'Vence Hoje' }[st] || st;
    var stCls  = { pago: 'desp-st-pago', pendente: 'desp-st-pendente', atrasado: 'desp-st-atrasado', hoje: 'desp-st-hoje' }[st] || '';
    var vencFmt = _despFmtData(d.vencimento);
    var pgFmt   = d.dataPagamento ? ' · Pago em ' + _despFmtData(d.dataPagamento) : '';

    return '<div class="desp-card ' + (st === 'atrasado' ? 'desp-card-atrasado' : '') + '">' +
      '<div class="desp-card-icone" style="background:' + cor + '22;color:' + cor + ';">' + icone + '</div>' +
      '<div class="desp-card-body">' +
        '<div class="desp-card-top">' +
          '<span class="desp-card-nome">' + _escHTML(d.descricao) + '</span>' +
          '<span class="desp-card-valor">R$ ' + dashFmt(d.valor) + '</span>' +
        '</div>' +
        '<div class="desp-card-meta">' +
          '<span class="desp-cat-tag" style="border-color:' + cor + ';color:' + cor + ';">' + _escHTML(d.categoria) + '</span>' +
          '<span class="desp-card-venc">Vence ' + vencFmt + pgFmt + '</span>' +
          (d.recorrente ? '<span class="desp-rec-badge">↻ Recorrente</span>' : '') +
          (d.obs ? '<span class="desp-card-obs">' + _escHTML(d.obs) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="desp-card-actions">' +
        '<span class="desp-status-badge ' + stCls + '">' + stLbl + '</span>' +
        (st !== 'pago' ? '<button class="desp-btn-pagar" onclick="despMarcarPago(' + idx + ')" title="Marcar como pago">✓ Pagar</button>' : '') +
        '<button class="desp-btn-edit"   onclick="abrirFormDespesa(' + idx + ')" title="Editar">✎</button>' +
        '<button class="desp-btn-del"    onclick="despExcluir(' + idx + ')" title="Excluir">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _despFmtData(iso) {
  if (!iso) return '—';
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function _escHTML(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function abrirFormDespesa(idx) {
  var d = idx !== null ? (despGetAll()[idx] || null) : null;

  document.getElementById('despFormTitulo').textContent = d ? 'Editar Despesa' : 'Nova Despesa';
  document.getElementById('despDescricao').value  = d ? d.descricao  : '';
  document.getElementById('despCategoria').value  = d ? d.categoria  : '';
  document.getElementById('despValor').value       = d ? d.valor      : '';
  document.getElementById('despVencimento').value  = d ? d.vencimento : '';
  document.getElementById('despStatus').value      = d ? (d.status === 'atrasado' ? 'pendente' : d.status) : 'pendente';
  document.getElementById('despDataPagamento').value = d ? (d.dataPagamento || '') : '';
  document.getElementById('despRecorrente').checked  = d ? !!d.recorrente : false;
  document.getElementById('despObs').value         = d ? (d.obs || '') : '';

  var erroEl = document.getElementById('despFormErro');
  if (erroEl) erroEl.style.display = 'none';

  despToggleRecorrente();
  _despToggleDataPag();

  document.getElementById('despStatus').addEventListener('change', _despToggleDataPag);
  document.getElementById('despSalvarBtn').dataset.idx = idx !== null ? idx : '';

  document.getElementById('despFormOverlay').classList.add('ativo');
  var drawer = document.getElementById('despFormDrawer');
  drawer.style.display = 'flex';
  requestAnimationFrame(function() { drawer.classList.add('ativo'); });
}

function fecharFormDespesa() {
  var overlay = document.getElementById('despFormOverlay');
  var drawer  = document.getElementById('despFormDrawer');
  if (overlay) overlay.classList.remove('ativo');
  if (drawer) {
    drawer.classList.remove('ativo');
    setTimeout(function() { drawer.style.display = 'none'; }, 300);
  }
}

function despToggleRecorrente() {
  // visual only — no extra UI needed
}

function _despToggleDataPag() {
  var st   = document.getElementById('despStatus')?.value;
  var grp  = document.getElementById('despDataPagGrupo');
  if (grp) grp.style.display = st === 'pago' ? '' : 'none';
}

function salvarDespesa() {
  var btn   = document.getElementById('despSalvarBtn');
  var idxRaw = btn?.dataset.idx;
  var idx    = idxRaw !== '' && idxRaw !== undefined ? parseInt(idxRaw, 10) : null;

  var desc  = (document.getElementById('despDescricao')?.value || '').trim();
  var cat   = document.getElementById('despCategoria')?.value || '';
  var valor = parseFloat(document.getElementById('despValor')?.value || '0');
  var venc  = document.getElementById('despVencimento')?.value || '';
  var st    = document.getElementById('despStatus')?.value || 'pendente';
  var dtPag = document.getElementById('despDataPagamento')?.value || '';
  var rec   = document.getElementById('despRecorrente')?.checked || false;
  var obs   = (document.getElementById('despObs')?.value || '').trim();

  var erroEl = document.getElementById('despFormErro');
  function mostrarErro(msg) {
    if (erroEl) { erroEl.textContent = msg; erroEl.style.display = 'flex'; }
  }
  if (erroEl) erroEl.style.display = 'none';

  if (!desc)  return mostrarErro('Informe a descrição.');
  if (!cat)   return mostrarErro('Selecione uma categoria.');
  if (!valor || valor <= 0) return mostrarErro('Informe um valor válido.');
  if (!venc)  return mostrarErro('Informe a data de vencimento.');

  var todas = despGetAll();
  var obj = {
    id:             (idx !== null && todas[idx]) ? todas[idx].id : _despUUID(),
    descricao:      desc,
    categoria:      cat,
    valor:          valor,
    vencimento:     venc,
    status:         st,
    dataPagamento:  st === 'pago' ? (dtPag || localDateStr()) : null,
    recorrente:     rec,
    obs:            obs,
    criadoEm:       (idx !== null && todas[idx]) ? todas[idx].criadoEm : new Date().toISOString(),
  };

  if (st !== 'pago') {
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var v = new Date(venc + 'T00:00:00');
    obj.status = v < hoje ? 'atrasado' : 'pendente';
  }

  if (idx !== null && !isNaN(idx) && todas[idx]) {
    todas[idx] = obj;
  } else {
    todas.push(obj);
  }

  despSaveAll(todas);
  fecharFormDespesa();
  initDespesas();
  showAlert(idx !== null && !isNaN(idx) ? 'Despesa atualizada!' : 'Despesa cadastrada!', 'sucesso');
}

function despMarcarPago(idx) {
  showConfirm('Marcar esta despesa como paga?', function() {
    var todas = despGetAll();
    if (!todas[idx]) return;
    todas[idx].status = 'pago';
    todas[idx].dataPagamento = localDateStr();
    despSaveAll(todas);
    initDespesas();
    showAlert('Despesa marcada como paga!', 'sucesso');
  }, { okLabel: 'Marcar como Pago', icon: '✓', iconTipo: 'sucesso' });
}

function despExcluir(idx) {
  showConfirm('Excluir esta despesa permanentemente?', function() {
    var todas = despGetAll();
    todas.splice(idx, 1);
    despSaveAll(todas);
    initDespesas();
  }, { okLabel: 'Excluir', danger: true, icon: '⚠', iconTipo: 'aviso' });
}
