/**
 * firebase.js — VERSÃO MULTIEMPRESA
 *
 * Diferenças em relação à versão original:
 *   - carregarPerfil() agora lê e armazena lojaId em window.currentLojaId
 *   - carregarDadosFirebase() usa lojas/${lojaId} em vez de "backup"
 *   - autoSalvarFirebase() usa lojas/${lojaId} em vez de "backup"
 *   - Função auxiliar getLojaRef() centraliza a montagem do caminho
 *
 * Nenhuma outra lógica de negócio foi alterada.
 * Nenhuma tela foi alterada.
 * Nenhum fluxo de autenticação foi alterado.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCprBTe8SI2yzWrCbiDqPo_quY6gtepSZ0",
  authDomain: "vendas-loja-use-stylo.firebaseapp.com",
  databaseURL: "https://vendas-loja-use-stylo-default-rtdb.firebaseio.com",
  projectId: "vendas-loja-use-stylo",
  storageBucket: "vendas-loja-use-stylo.appspot.com",
  messagingSenderId: "752808111854",
  appId: "1:752808111854:web:319ce58624153fb5818dff",
  measurementId: "G-SD289DZZVK"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getDatabase(app);
const auth      = getAuth(app);

// ── Camada de abstração: caminho da loja atual ────────────────────────────────
// Toda leitura e gravação passa por aqui — nunca use "backup" diretamente.
function getLojaRef(caminho) {
  const lojaId = window.currentLojaId;
  if (!lojaId) throw new Error("[Firebase] currentLojaId não definido. Usuário ainda não autenticado?");
  return caminho
    ? ref(db, `lojas/${lojaId}/${caminho}`)
    : ref(db, `lojas/${lojaId}`);
}

// ── Utilitários de status ─────────────────────────────────────────────────────
function mostrarStatus(msg, tipo) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sync-status sync-' + (tipo || 'info');
  if (tipo === 'success') {
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.className = 'sync-status'; }, 3000);
  }
}

// ── Tela de login ─────────────────────────────────────────────────────────────
function mostrarTelaLogin(erro) {
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.classList.remove('auth-saindo');
    overlay.style.display = 'flex';
  }
  const errEl = document.getElementById('authErro');
  if (errEl) {
    errEl.textContent = erro || '';
    errEl.style.display = erro ? 'flex' : 'none';
  }
  const btnEl = document.getElementById('authBtnEntrar');
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
  setTimeout(() => {
    const inp = document.getElementById('authEmail');
    if (inp) inp.focus();
  }, 100);
}

function ocultarTelaLogin() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.classList.add('auth-saindo');
    setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('auth-saindo'); }, 500);
  }
}

// ── Carregamento de dados (só executa autenticado) ────────────────────────────
async function carregarDadosFirebase() {
  mostrarStatus('Conectando à nuvem...', 'saving');
  try {
    // ALTERAÇÃO: usa getLojaRef() em vez de "backup"
    const snapshot = await get(getLojaRef());
    if (snapshot.exists()) {
      const dados = snapshot.val();

      window.estoque = dados.estoque || [];
      window.vendas  = dados.vendas  || [];

      localStorage.setItem('crediarios',                JSON.stringify(dados.crediarios || []));
      localStorage.setItem('historicoCrediariosPagos',  JSON.stringify(dados.historicoCrediariosPagos || []));
      localStorage.setItem('despesas',                  JSON.stringify(dados.despesas || []));
      localStorage.setItem('estoque',                   JSON.stringify(window.estoque));
      localStorage.setItem('vendas',                    JSON.stringify(window.vendas));
      if (dados.dashMetas) localStorage.setItem('dashMetas', JSON.stringify(dados.dashMetas));

      if (typeof atualizarTabelaEstoque  === 'function') atualizarTabelaEstoque();
      if (typeof atualizarSelectProdutos === 'function') atualizarSelectProdutos();
      if (typeof atualizarHistorico      === 'function') atualizarHistorico();
      if (typeof carregarCrediarios      === 'function') carregarCrediarios();
      if (typeof initDespesas            === 'function') initDespesas();
      if (typeof atualizarDashboard      === 'function') atualizarDashboard();
      if (typeof atualizarHome           === 'function') atualizarHome();

      if (dados.ultimaAtualizacao) {
        const el = document.getElementById('ultimaDataBackup');
        if (el) el.textContent = `Última sincronização: ${dados.ultimaAtualizacao}`;
      }
      mostrarStatus('Dados carregados ✓', 'success');
    } else {
      mostrarStatus('Nuvem vazia — usando dados locais', 'info');
      if (typeof atualizarHome === 'function') atualizarHome();
    }
  } catch (err) {
    console.error('Erro ao carregar Firebase:', err);
    mostrarStatus('Sem conexão com a nuvem', 'error');
  }
}

// ── Carregar perfil do usuário (role + lojaId) ────────────────────────────────
async function carregarPerfil(uid) {
  try {
    const snap = await get(child(ref(db), `usuarios/${uid}`));
    if (snap.exists()) {
      const perfil = snap.val();

      if (perfil.role === 'owner') {
        // Owner escolhe a loja na tela de seleção — não define currentLojaId aqui
        window.currentOwnerLojas = perfil.lojas || {};
        window.currentLojaId = null;
      } else if (perfil.lojaId) {
        window.currentLojaId = perfil.lojaId;
      } else {
        console.warn('[Auth] Usuário sem lojaId. Usando fallback "usestylo". Execute o script de migração.');
        window.currentLojaId = 'usestylo';
      }

      console.log('[Auth] Perfil carregado para UID', uid, '→ loja:', window.currentLojaId, '| role:', perfil.role);
      return perfil;
    }
    console.warn('[Auth] UID sem perfil no banco:', uid);
  } catch (err) {
    console.error('[Auth] Erro ao ler perfil (verifique as regras do Firebase):', err.message);
  }
  window.currentLojaId = 'usestylo';
  return { role: 'vendedor', nome: '' };
}

// ── Inicializar app após autenticação ─────────────────────────────────────────
async function inicializarApp(user) {
  const perfil = await carregarPerfil(user.uid);

  window.currentUser     = user;
  window.currentUserRole = perfil.role || perfil.rule || 'vendedor';
  window.currentUserNome = perfil.nome || user.email;

  ocultarTelaLogin();

  if (window.currentUserRole === 'owner') {
    _mostrarSeletorLoja(perfil.nome || user.email.split('@')[0]);
    return;
  }

  _finalizarInicioApp();
}

function _finalizarInicioApp() {
  const badgeNome = document.getElementById('authUserNome');
  const badgeRole = document.getElementById('authUserRole');
  const badge     = document.getElementById('authUserBadge');
  if (badgeNome) badgeNome.textContent = window.currentUserNome || '';
  if (badgeRole) badgeRole.textContent = _labelRole(window.currentUserRole);
  if (badge)     badge.style.display   = 'flex';

  if (typeof aplicarPermissoes === 'function') aplicarPermissoes(window.currentUserRole);

  carregarDadosFirebase();
}

// ── Seletor de loja para role "owner" ─────────────────────────────────────────
function _mostrarSeletorLoja(nomeOwner) {
  const overlay = document.getElementById('lojaOverlay');
  if (!overlay) return;

  const lista = document.getElementById('lojaLista');
  const lojas = window.currentOwnerLojas || {};
  const keys  = Object.keys(lojas);

  if (lista) {
    if (keys.length === 0) {
      lista.innerHTML = '<p class="loja-vazia">Nenhuma loja configurada. Adicione lojas no perfil do owner no Firebase.</p>';
    } else {
      lista.innerHTML = keys.map(id => {
        const nome = typeof lojas[id] === 'string' ? lojas[id] : id;
        return `<button class="loja-item" onclick="ownerSelecionarLoja('${id}', '${nome.replace(/'/g,"\\'")}')">
          <span class="loja-item-icone">🏪</span>
          <div class="loja-item-info">
            <span class="loja-item-nome">${nome}</span>
            <span class="loja-item-id">${id}</span>
          </div>
          <svg class="loja-item-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>`;
      }).join('');
    }
  }

  const ownerEl = document.getElementById('lojaSaudacao');
  if (ownerEl) ownerEl.textContent = `Olá, ${nomeOwner}`;

  overlay.style.display = 'flex';
}

window.ownerSelecionarLoja = function(lojaId, nomeLoja) {
  window.currentLojaId = lojaId;

  const overlay = document.getElementById('lojaOverlay');
  if (overlay) {
    overlay.classList.add('loja-saindo');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('loja-saindo');
    }, 400);
  }

  const badgeNome = document.getElementById('authUserNome');
  const badgeRole = document.getElementById('authUserRole');
  const badge     = document.getElementById('authUserBadge');
  if (badgeNome) badgeNome.textContent = `${window.currentUserNome} — ${nomeLoja}`;
  if (badgeRole) badgeRole.textContent = 'Owner';
  if (badge)     badge.style.display   = 'flex';

  if (typeof aplicarPermissoes === 'function') aplicarPermissoes('admin');

  carregarDadosFirebase();
};

function _labelRole(role) {
  return { admin: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor', owner: 'Owner' }[role] || role;
}

// ── Login / Logout expostos globalmente ───────────────────────────────────────
window.authFazerLogin = async function() {
  const email = (document.getElementById('authEmail')?.value || '').trim();
  const senha  =  document.getElementById('authSenha')?.value || '';
  const errEl  =  document.getElementById('authErro');
  const btnEl  =  document.getElementById('authBtnEntrar');

  if (!email || !senha) {
    if (errEl) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.style.display = 'flex'; }
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Entrando...'; }
  if (errEl) errEl.style.display = 'none';

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    const msgs = {
      'auth/invalid-email':          'E-mail inválido.',
      'auth/user-not-found':         'Usuário não encontrado.',
      'auth/wrong-password':         'Senha incorreta.',
      'auth/invalid-credential':     'E-mail ou senha incorretos.',
      'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
      'auth/network-request-failed': 'Sem conexão com a internet.',
    };
    const msg = msgs[err.code] || 'Erro ao entrar. Tente novamente.';
    mostrarTelaLogin(msg);
  }
};

window.authFazerLogout = async function() {
  if (typeof showConfirm === 'function') {
    showConfirm('Deseja sair do sistema?', async () => {
      await _executarLogout();
    }, { okLabel: 'Sair', danger: true, icon: '🔒', iconTipo: 'aviso' });
  } else {
    await _executarLogout();
  }
};

async function _executarLogout() {
  window.currentUser       = null;
  window.currentUserRole   = null;
  window.currentUserNome   = null;
  window.currentLojaId     = null;
  window.currentOwnerLojas = null;

  const badge = document.getElementById('authUserBadge');
  if (badge) badge.style.display = 'none';

  localStorage.removeItem('estoque');
  localStorage.removeItem('vendas');
  localStorage.removeItem('crediarios');
  localStorage.removeItem('historicoCrediariosPagos');
  localStorage.removeItem('despesas');
  localStorage.removeItem('dashMetas');

  window.estoque = [];
  window.vendas  = [];

  await signOut(auth);
  mostrarTelaLogin();
}

window.addEventListener('DOMContentLoaded', () => {
  const senhaInput = document.getElementById('authSenha');
  if (senhaInput) {
    senhaInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') window.authFazerLogin();
    });
  }
  const emailInput = document.getElementById('authEmail');
  if (emailInput) {
    emailInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('authSenha')?.focus();
    });
  }
});

// ── Alterar senha (requer reautenticação) ─────────────────────────────────────
window.authAlterarSenha = async function(senhaAtual, novaSenha) {
  const user = auth.currentUser;
  if (!user) throw 'Usuário não autenticado.';
  const cred = EmailAuthProvider.credential(user.email, senhaAtual);
  try {
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    const msgs = {
      'auth/wrong-password':     'Senha atual incorreta.',
      'auth/invalid-credential': 'Senha atual incorreta.',
      'auth/too-many-requests':  'Muitas tentativas. Aguarde alguns minutos.',
    };
    throw msgs[err.code] || 'Erro ao verificar senha atual.';
  }
  try {
    await updatePassword(user, novaSenha);
  } catch (err) {
    throw 'Erro ao atualizar a senha. Tente novamente.';
  }
};

// ── Persistência configurada na inicialização (não só no login) ──────────────
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ── Sentinela principal — nada carrega sem auth ───────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.classList.remove('auth-verificando');

  if (user) {
    await inicializarApp(user);
  } else {
    mostrarTelaLogin();
  }
});

// ── Auto-salvamento (só executa com auth) ─────────────────────────────────────
let autoSaveTimer = null;
window.autoSalvarFirebase = () => {
  if (!window.currentUser) return;
  clearTimeout(autoSaveTimer);
  mostrarStatus('Salvando...', 'saving');
  autoSaveTimer = setTimeout(() => {
    const dados = {
      estoque:                  window.estoque || [],
      vendas:                   window.vendas  || [],
      crediarios:               JSON.parse(localStorage.getItem('crediarios'))               || [],
      historicoCrediariosPagos: JSON.parse(localStorage.getItem('historicoCrediariosPagos')) || [],
      despesas:                 JSON.parse(localStorage.getItem('despesas'))                 || [],
      dashMetas:                JSON.parse(localStorage.getItem('dashMetas'))                || { faturamento: 10000, lucro: 4000, vendas: 100, metaDiaria: 500 },
      ultimaAtualizacao:        new Date().toLocaleString('pt-BR'),
      _savedBy:                 window.currentUser.uid,
    };
    // ALTERAÇÃO: usa getLojaRef() em vez de ref(db, 'backup')
    set(getLojaRef(), dados)
      .then(() => {
        mostrarStatus('Salvo na nuvem ✓', 'success');
        const el = document.getElementById('ultimaDataBackup');
        if (el) el.textContent = `Última sincronização: ${dados.ultimaAtualizacao}`;
      })
      .catch(err => {
        console.error('Erro ao salvar Firebase:', err);
        mostrarStatus('Erro ao salvar na nuvem', 'error');
      });
  }, 1500);
};
