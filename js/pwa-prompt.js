/**
 * pwa-prompt.js — Detecção de iPhone/iOS e prompt de instalação PWA
 * Use Stylo — Sistema de Vendas
 */

(function () {

  // ── Chaves de persistência ────────────────────────────────────────────────
  var CHAVE_NUNCA    = 'pwa_nunca_mostrar';
  var CHAVE_SESSAO   = 'pwa_sessao_dispensado';
  var CHAVE_24H      = 'pwa_nao_instalar_ate'; // timestamp epoch ms

  // ── Detecções ─────────────────────────────────────────────────────────────

  function isIOS() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      // iPad com iPadOS 13+ reporta-se como Mac, mas tem toque
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  function isStandalone() {
    return (
      navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  function deveExibir() {
    if (!isIOS())        return false; // Não é iOS
    if (isStandalone())  return false; // Já está instalado como PWA
    if (localStorage.getItem(CHAVE_NUNCA))  return false; // Usuário disse "nunca"
    if (sessionStorage.getItem(CHAVE_SESSAO)) return false; // Já dispensou nesta sessão
    var ate24h = localStorage.getItem(CHAVE_24H);
    if (ate24h && Date.now() < parseInt(ate24h, 10)) return false; // Dentro do cooldown de 24h
    return true;
  }

  // ── Controle do modal ─────────────────────────────────────────────────────

  function pwaAbrir() {
    var el = document.getElementById('pwaOverlay');
    if (!el) return;
    el.style.display = 'flex';
    // Força reflow para a animação funcionar
    void el.offsetHeight;
    el.classList.add('pwa-visivel');
    document.body.style.overflow = 'hidden';
  }

  function pwaFecharAnimado(callback) {
    var el = document.getElementById('pwaOverlay');
    if (!el) return;
    el.classList.remove('pwa-visivel');
    el.classList.add('pwa-saindo');
    document.body.style.overflow = '';
    setTimeout(function () {
      el.style.display = 'none';
      el.classList.remove('pwa-saindo');
      if (typeof callback === 'function') callback();
    }, 380);
  }

  // ── Ações dos botões — expostas globalmente ───────────────────────────────

  window.pwaFechar = function () {
    pwaFecharAnimado();
  };

  window.pwaLembrarDepois = function () {
    sessionStorage.setItem(CHAVE_SESSAO, '1');
    pwaFecharAnimado();
  };

  window.pwaNuncaMostrar = function () {
    localStorage.setItem(CHAVE_NUNCA, '1');
    pwaFecharAnimado();
  };

  // "Não quero instalar" no tutorial — cooldown de 24 horas
  window.pwaNaoInstalar = function () {
    localStorage.setItem(CHAVE_24H, String(Date.now() + 24 * 60 * 60 * 1000));
    pwaFecharAnimado();
  };

  window.pwaAbrirTutorial = function () {
    var corpo    = document.getElementById('pwaCorpo');
    var tutorial = document.getElementById('pwaTutorial');
    if (!corpo || !tutorial) return;
    corpo.style.display    = 'none';
    tutorial.style.display = 'block';
    // Rola o sheet para o topo ao abrir tutorial
    var sheet = document.querySelector('.pwa-sheet');
    if (sheet) sheet.scrollTop = 0;
  };

  // ── Inicialização — aguarda o DOM estar pronto ────────────────────────────

  function init() {
    if (!deveExibir()) return;
    // Aguarda a página carregar completamente antes de exibir
    setTimeout(pwaAbrir, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
