/**
 * Skepsi — Minimalist Blog Engine
 *
 * Static blog powered by markdown files.
 * Articles are listed in articles/posts.json and stored as .md files.
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const heroSection     = document.getElementById('hero-section');
  const articleList     = document.getElementById('article-list');
  const articlesContainer = document.getElementById('articles-container');
  const loadingState    = document.getElementById('loading-state');
  const emptyState      = document.getElementById('empty-state');
  const articleReader   = document.getElementById('article-reader');
  const articleTitle    = document.getElementById('article-title');
  const articleDate     = document.getElementById('article-date');
  const articleContent  = document.getElementById('article-content');
  const backButton      = document.getElementById('back-button');
  const themeToggle     = document.getElementById('theme-toggle');
  const footerYear      = document.getElementById('footer-year');
  const progressBar     = document.getElementById('progress-bar');
  const tocMobile       = document.getElementById('toc-mobile');
  const tocMobileToggle = document.getElementById('toc-mobile-toggle');
  const tocMobileList   = document.getElementById('toc-mobile-list');
  const tocChevron      = document.getElementById('toc-chevron');
  const tocDesktop      = document.getElementById('toc-desktop');
  const tocDesktopList  = document.getElementById('toc-desktop-list');
  const articleNav      = document.getElementById('article-nav');
  const navPrev         = document.getElementById('nav-prev');
  const navPrevTitle    = document.getElementById('nav-prev-title');
  const navNext         = document.getElementById('nav-next');
  const navNextTitle    = document.getElementById('nav-next-title');
  const shareButton     = document.getElementById('share-button');
  const shareIcon       = document.getElementById('share-icon');
  const shareLabel      = document.getElementById('share-label');
  const tabArticles     = document.getElementById('tab-articles');
  const tabShots        = document.getElementById('tab-shots');
  const shotsView       = document.getElementById('shots-view');
  const shotsContainer  = document.getElementById('shots-container');
  const shotsLoading    = document.getElementById('shots-loading');

  // --- State ---
  let tocHeadings    = [];
  let scrollRAF      = null;
  let revealObserver = null;
  let activeTab      = 'articles';
  let activeShot     = null;

  // --- Footer year ---
  footerYear.textContent = new Date().getFullYear();

  // --- Theme ---
  function getStoredTheme() { return localStorage.getItem('skepsi-theme'); }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('skepsi-theme', theme);
  }

  function initTheme() {
    const stored = getStoredTheme();
    applyTheme(stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }

  themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  });

  initTheme();

  // --- Marked ---
  marked.setOptions({ breaks: true, gfm: true });

  // --- Date helpers ---
  function formatDate(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function formatDateShort(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // --- URL helpers ---
  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function setParams(obj) {
    const url = new URL(window.location);
    Object.entries(obj).forEach(([k, v]) => {
      if (v == null) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    });
    return url;
  }

  // --- Routing ---
  function navigateToArticle(slug) {
    window.history.pushState({}, '', setParams({ article: slug, tab: null, shot: null }));
    loadArticle(slug);
  }

  function navigateToHome() {
    window.history.pushState({}, '', setParams({ article: null, tab: null, shot: null }));
    showArticleList();
    setActiveTab('articles');
  }

  function navigateToShots(shotIndex) {
    const params = { article: null, tab: 'shots', shot: shotIndex != null ? shotIndex : null };
    window.history.pushState({}, '', setParams(params));
    showShotsView(shotIndex);
  }

  // --- Slugify ---
  function slugify(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  }

  // --- Tabs ---
  function setActiveTab(tab) {
    activeTab = tab;
    tabArticles.classList.toggle('tab-active', tab === 'articles');
    tabShots.classList.toggle('tab-active', tab === 'shots');
  }

  tabArticles.addEventListener('click', () => {
    if (activeTab === 'articles' && articleReader.classList.contains('hidden')) return;
    navigateToHome();
  });

  tabShots.addEventListener('click', () => {
    if (activeTab === 'shots') return;
    navigateToShots();
  });

  // --- Back button ---
  backButton.addEventListener('click', () => {
    navigateToHome();
  });

  // --- Views ---
  function showArticleList() {
    heroSection.classList.remove('hidden');
    articleList.classList.remove('hidden');
    shotsView.classList.add('hidden');
    articleReader.classList.add('hidden');
    progressBar.classList.add('hidden');
    progressBar.style.width = '0%';
    document.title = 'Skepsi';
    cleanupArticleView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showShotsView(highlightIndex) {
    heroSection.classList.add('hidden');
    articleList.classList.add('hidden');
    articleReader.classList.add('hidden');
    progressBar.classList.add('hidden');
    progressBar.style.width = '0%';
    shotsView.classList.remove('hidden');
    shotsView.classList.remove('page-enter');
    void shotsView.offsetWidth;
    shotsView.classList.add('page-enter');
    document.title = 'Shots! — Skepsi';
    setActiveTab('shots');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadShots(highlightIndex);
  }

  function showArticleReader() {
    heroSection.classList.add('hidden');
    articleList.classList.add('hidden');
    shotsView.classList.add('hidden');
    articleReader.classList.remove('hidden');
    articleReader.classList.remove('page-enter');
    void articleReader.offsetWidth;
    articleReader.classList.add('page-enter');
    progressBar.classList.remove('hidden');
    window.scrollTo({ top: 0 });
  }

  function cleanupArticleView() {
    tocHeadings = [];
    tocDesktopList.innerHTML = '';
    tocMobileList.innerHTML = '';
    tocMobile.classList.add('hidden');
    tocDesktop.classList.add('hidden');
    tocMobileList.classList.add('hidden');
    tocChevron.style.transform = '';
    articleNav.classList.add('hidden');
    navPrev.classList.add('hidden');
    navNext.classList.add('hidden');
    if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
  }

  // --- Progress bar ---
  function updateProgressBar() {
    if (articleReader.classList.contains('hidden')) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = Math.min(docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0, 100) + '%';
  }

  // --- TOC ---
  function generateTOC() {
    const headings = articleContent.querySelectorAll('h1, h2, h3');
    tocHeadings = [];
    if (headings.length < 2) { tocMobile.classList.add('hidden'); return; }

    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = slugify(heading.textContent) || `heading-${index}`;
      let baseId = heading.id, counter = 1;
      while (tocHeadings.some((h) => h.id === heading.id)) heading.id = `${baseId}-${counter++}`;
      tocHeadings.push({ id: heading.id, text: heading.textContent, level: heading.tagName.toLowerCase(), element: heading });
    });

    [tocDesktopList, tocMobileList].forEach((list, isM) => {
      list.innerHTML = '';
      tocHeadings.forEach((h) => {
        const a = document.createElement('a');
        a.href = `#${h.id}`;
        a.textContent = h.text;
        a.className = isM
          ? `toc-link-mobile${h.level === 'h3' ? ' toc-link-mobile-h3' : ''}`
          : `toc-link${h.level === 'h3' ? ' toc-link-h3' : ''}`;
        if (!isM) a.setAttribute('data-toc-id', h.id);
        a.addEventListener('click', (e) => {
          e.preventDefault();
          if (isM) { tocMobileList.classList.add('hidden'); tocChevron.style.transform = ''; }
          document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
        });
        list.appendChild(a);
      });
    });

    tocMobile.classList.remove('hidden');
    tocDesktop.classList.remove('hidden');
  }

  function updateActiveTOC() {
    if (!tocHeadings.length) return;
    const scrollPos = window.scrollY + 120;
    let activeId = tocHeadings[0]?.id;
    for (let i = tocHeadings.length - 1; i >= 0; i--) {
      if (tocHeadings[i].element.offsetTop <= scrollPos) { activeId = tocHeadings[i].id; break; }
    }
    tocDesktopList.querySelectorAll('.toc-link').forEach((l) =>
      l.classList.toggle('active', l.getAttribute('data-toc-id') === activeId));
  }

  tocMobileToggle.addEventListener('click', () => {
    const hidden = tocMobileList.classList.contains('hidden');
    tocMobileList.classList.toggle('hidden');
    tocChevron.style.transform = hidden ? 'rotate(180deg)' : '';
  });

  // --- Scroll reveal ---
  function setupScrollReveal() {
    articleContent.querySelectorAll('h1,h2,h3,p,blockquote,pre,ul,ol,.table-wrapper,table,hr,img')
      .forEach((el) => el.classList.add('reveal'));
    document.getElementById('article-meta')?.classList.add('reveal');

    revealObserver = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('revealed'); revealObserver.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
  }

  // --- Scroll handler ---
  function onScroll() {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => { updateProgressBar(); updateActiveTOC(); scrollRAF = null; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Load articles index ---
  async function loadArticlesIndex() {
    try {
      const posts = await (await fetch('articles/posts.json')).json();
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      loadingState.classList.add('hidden');
      posts.length ? renderArticleList(posts) : emptyState.classList.remove('hidden');
    } catch {
      loadingState.textContent = 'Could not load articles.';
    }
  }

  function renderArticleList(posts) {
    articlesContainer.innerHTML = '';
    posts.forEach((post) => {
      const item = document.createElement('div');
      item.className = 'article-item';
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'article-link cursor-pointer';
      link.setAttribute('data-slug', post.slug);
      link.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
          <div class="min-w-0 flex-1">
            <h2 class="text-base sm:text-lg md:text-xl font-serif font-normal leading-snug mb-0.5 sm:mb-1">${post.title}</h2>
            ${post.excerpt ? `<p class="text-sm text-black/40 dark:text-white/40 font-light line-clamp-2 sm:line-clamp-1">${post.excerpt}</p>` : ''}
          </div>
          <time class="text-xs font-mono text-black/30 dark:text-white/30 whitespace-nowrap sm:pt-1.5 tracking-wide">${formatDateShort(post.date)}</time>
        </div>`;
      link.addEventListener('click', (e) => { e.preventDefault(); navigateToArticle(post.slug); });
      item.appendChild(link);
      articlesContainer.appendChild(item);
    });
  }

  // --- Load article ---
  async function loadArticle(slug) {
    cleanupArticleView();
    showArticleReader();
    setActiveTab('articles');
    articleContent.innerHTML = '<p class="text-black/30 dark:text-white/30 font-light">Loading...</p>';
    try {
      const posts = await (await fetch('articles/posts.json')).json();
      const post = posts.find((p) => p.slug === slug);
      if (!post) {
        articleTitle.textContent = 'Article not found';
        articleDate.textContent = '';
        articleContent.innerHTML = '<p class="text-black/40 dark:text-white/40">This article does not exist.</p>';
        return;
      }
      const mdRes = await fetch(`articles/${post.slug}.md`);
      if (!mdRes.ok) throw new Error('Not found');
      const content = (await mdRes.text()).replace(/^---[\s\S]*?---\n*/, '');

      articleTitle.textContent = post.title;
      articleDate.textContent = formatDate(post.date);
      articleContent.innerHTML = marked.parse(content);

      articleContent.querySelectorAll('table').forEach((table) => {
        if (!table.parentElement.classList.contains('table-wrapper')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'table-wrapper';
          table.parentNode.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });

      generateTOC();
      setupScrollReveal();
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      renderArticleNav(slug, posts);
      document.title = post.title;
    } catch {
      articleTitle.textContent = 'Error';
      articleDate.textContent = '';
      articleContent.innerHTML = '<p class="text-black/40 dark:text-white/40">Could not load this article.</p>';
    }
  }

  // --- Prev / Next nav ---
  function renderArticleNav(currentSlug, sortedPosts) {
    const idx = sortedPosts.findIndex((p) => p.slug === currentSlug);
    if (idx === -1) { articleNav.classList.add('hidden'); return; }
    const prev = idx < sortedPosts.length - 1 ? sortedPosts[idx + 1] : null;
    const next = idx > 0 ? sortedPosts[idx - 1] : null;
    if (!prev && !next) { articleNav.classList.add('hidden'); return; }
    articleNav.classList.remove('hidden');
    if (prev) { navPrev.classList.remove('hidden'); navPrevTitle.textContent = prev.title; navPrev.onclick = (e) => { e.preventDefault(); navigateToArticle(prev.slug); }; } else navPrev.classList.add('hidden');
    if (next) { navNext.classList.remove('hidden'); navNextTitle.textContent = next.title; navNext.onclick = (e) => { e.preventDefault(); navigateToArticle(next.slug); }; } else navNext.classList.add('hidden');
  }

  // --- Shots ---
  let shotsLoaded = false;

  async function loadShots(highlightIndex) {
    if (!shotsLoaded) {
      try {
        const text = await (await fetch('articles/shots.md')).text();
        const blocks = text.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter((s) => s.length > 0);
        shotsLoading.classList.add('hidden');
        renderShots(blocks);
        shotsLoaded = true;
      } catch {
        shotsLoading.textContent = 'Could not load shots.';
        return;
      }
    }
    if (highlightIndex != null) {
      const idx = parseInt(highlightIndex, 10);
      if (!isNaN(idx)) requestAnimationFrame(() => activateShot(idx, true));
    } else {
      deactivateShot();
    }
  }

  function renderShots(blocks) {
    shotsContainer.innerHTML = '';
    blocks.forEach((block, i) => {
      const lines = block.split('\n');
      const firstLine = lines[0].trim();
      const datePattern = /^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/;
      let date = '', body = '';
      if (datePattern.test(firstLine)) { date = firstLine; body = lines.slice(1).join('\n').trim(); }
      else { body = block; }

      const html = marked.parseInline(body);
      const card = document.createElement('div');
      card.className = 'shot-card';
      card.id = `shot-${i}`;
      card.style.animationDelay = `${i * 0.07}s`;
      card.setAttribute('data-shot-index', i);

      card.innerHTML = `
        <div class="shot-header">
          <div class="shot-avatar" aria-hidden="true">P</div>
          <div class="shot-meta">
            <span class="shot-name">Pixcel25</span>
            <span class="shot-handle">@pixcel25</span>
          </div>
        </div>
        <p class="shot-text">${html}</p>
        <div class="shot-footer">
          ${date ? `<time class="shot-date">${date}</time>` : '<span class="shot-date"></span>'}
          <button class="shot-share-btn" aria-label="Share this shot" data-index="${i}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="18" cy="5" r="3" stroke-width="1.8"/>
              <circle cx="6" cy="12" r="3" stroke-width="1.8"/>
              <circle cx="18" cy="19" r="3" stroke-width="1.8"/>
              <path stroke-width="1.8" d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
            </svg>
            <span class="shot-share-label">Share</span>
          </button>
        </div>`;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.shot-share-btn')) return;
        const idx = parseInt(card.getAttribute('data-shot-index'), 10);
        if (activeShot === idx) {
          deactivateShot();
          window.history.replaceState({}, '', setParams({ shot: null }));
        } else {
          activateShot(idx, false);
          window.history.replaceState({}, '', setParams({ tab: 'shots', shot: idx }));
        }
      });

      const shareBtn = card.querySelector('.shot-share-btn');
      shareBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(shareBtn.getAttribute('data-index'), 10);
        const fullUrl = setParams({ tab: 'shots', shot: idx }).toString();
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(fullUrl);
          else {
            const inp = document.createElement('input');
            inp.value = fullUrl; inp.setAttribute('readonly', ''); inp.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(inp); inp.select(); document.execCommand('copy'); inp.remove();
          }
          const label = shareBtn.querySelector('.shot-share-label');
          label.textContent = 'Copied!';
          shareBtn.classList.add('shot-share-copied');
          setTimeout(() => { label.textContent = 'Share'; shareBtn.classList.remove('shot-share-copied'); }, 2000);
        } catch {}
      });

      shotsContainer.appendChild(card);
    });
  }

  function activateShot(idx, scroll) {
    deactivateShot();
    activeShot = idx;
    const card = document.getElementById(`shot-${idx}`);
    if (!card) return;
    card.classList.add('shot-highlighted');
    if (scroll) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  function deactivateShot() {
    if (activeShot != null) document.getElementById(`shot-${activeShot}`)?.classList.remove('shot-highlighted');
    activeShot = null;
  }

  // --- Article share button ---
  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(window.location.href);
        else {
          const inp = document.createElement('input');
          inp.value = window.location.href; inp.setAttribute('readonly', ''); inp.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(inp); inp.select(); document.execCommand('copy'); inp.remove();
        }
        shareIcon.classList.remove('share-animate'); void shareIcon.offsetWidth; shareIcon.classList.add('share-animate');
        shareButton.classList.add('copied'); shareLabel.textContent = 'Copied!';
        setTimeout(() => { shareButton.classList.remove('copied'); shareLabel.textContent = 'Share'; }, 2000);
      } catch {}
    });
  }

  // --- Browser back/forward ---
  window.addEventListener('popstate', () => {
    const slug = getParam('article');
    const tab  = getParam('tab');
    const shot = getParam('shot');
    if (slug) loadArticle(slug);
    else if (tab === 'shots') showShotsView(shot);
    else { showArticleList(); setActiveTab('articles'); }
  });

  // --- Init ---
  async function init() {
    await loadArticlesIndex();
    const slug = getParam('article');
    const tab  = getParam('tab');
    const shot = getParam('shot');
    if (slug) loadArticle(slug);
    else if (tab === 'shots') showShotsView(shot);
    else setActiveTab('articles');
  }

  init();
})();
