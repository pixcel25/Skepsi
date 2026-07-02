/**
 * Skepsi — Minimalist Blog Engine
 * 
 * Static blog powered by markdown files.
 * Articles are listed in articles/posts.json and stored as .md files.
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const heroSection = document.getElementById('hero-section');
  const articleList = document.getElementById('article-list');
  const articlesContainer = document.getElementById('articles-container');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const articleReader = document.getElementById('article-reader');
  const articleTitle = document.getElementById('article-title');
  const articleDate = document.getElementById('article-date');
  const articleContent = document.getElementById('article-content');
  const backButton = document.getElementById('back-button');
  const themeToggle = document.getElementById('theme-toggle');
  const footerYear = document.getElementById('footer-year');
  const progressBar = document.getElementById('progress-bar');
  const tocMobile = document.getElementById('toc-mobile');
  const tocMobileToggle = document.getElementById('toc-mobile-toggle');
  const tocMobileList = document.getElementById('toc-mobile-list');
  const tocChevron = document.getElementById('toc-chevron');
  const tocDesktop = document.getElementById('toc-desktop');
  const tocDesktopList = document.getElementById('toc-desktop-list');
  const articleNav = document.getElementById('article-nav');
  const navPrev = document.getElementById('nav-prev');
  const navPrevTitle = document.getElementById('nav-prev-title');
  const navNext = document.getElementById('nav-next');
  const navNextTitle = document.getElementById('nav-next-title');
  const shareButton = document.getElementById('share-button');
  const shareIcon = document.getElementById('share-icon');
  const shareLabel = document.getElementById('share-label');

  // --- State ---
  let tocHeadings = [];
  let scrollRAF = null;
  let revealObserver = null;

  // --- Set footer year ---
  footerYear.textContent = new Date().getFullYear();

  // --- Theme Management ---
  function getStoredTheme() {
    return localStorage.getItem('skepsi-theme');
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('skepsi-theme', theme);
  }

  function initTheme() {
    const stored = getStoredTheme();
    if (stored) {
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });

  initTheme();

  // --- Markdown Configuration ---
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // --- Date Formatting ---
  function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  function formatDateShort(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  // --- Routing ---
  function getArticleSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('article');
  }

  function navigateToArticle(slug) {
    const url = new URL(window.location);
    url.searchParams.set('article', slug);
    window.history.pushState({}, '', url);
    loadArticle(slug);
  }

  function navigateToHome() {
    const url = new URL(window.location);
    url.searchParams.delete('article');
    window.history.pushState({}, '', url);
    showArticleList();
  }

  // --- Slugify heading text for IDs ---
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // --- Views ---
  function showArticleList() {
    heroSection.classList.remove('hidden');
    articleList.classList.remove('hidden');
    articleReader.classList.add('hidden');
    progressBar.classList.add('hidden');
    progressBar.style.width = '0%';
    document.title = 'Skepsi';
    cleanupArticleView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showArticleReader() {
    heroSection.classList.add('hidden');
    articleList.classList.add('hidden');
    articleReader.classList.remove('hidden');
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
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }
  }

  // --- Reading Progress Bar ---
  function updateProgressBar() {
    if (articleReader.classList.contains('hidden')) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = Math.min(progress, 100) + '%';
  }

  // --- Table of Contents ---
  function generateTOC() {
    const headings = articleContent.querySelectorAll('h1, h2, h3');
    tocHeadings = [];

    if (headings.length < 2) {
      // Not enough headings to warrant a TOC
      tocMobile.classList.add('hidden');
      return;
    }

    headings.forEach((heading, index) => {
      // Assign an ID if it doesn't have one
      if (!heading.id) {
        heading.id = slugify(heading.textContent) || `heading-${index}`;
      }

      // Avoid duplicate IDs
      let baseId = heading.id;
      let counter = 1;
      while (tocHeadings.some((h) => h.id === heading.id)) {
        heading.id = `${baseId}-${counter++}`;
      }

      const level = heading.tagName.toLowerCase();
      tocHeadings.push({
        id: heading.id,
        text: heading.textContent,
        level: level,
        element: heading,
      });
    });

    // Render desktop TOC
    tocDesktopList.innerHTML = '';
    tocHeadings.forEach((h) => {
      const link = document.createElement('a');
      link.href = `#${h.id}`;
      link.textContent = h.text;
      link.className = `toc-link${h.level === 'h3' ? ' toc-link-h3' : ''}`;
      link.setAttribute('data-toc-id', h.id);
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
      });
      tocDesktopList.appendChild(link);
    });

    // Render mobile TOC
    tocMobileList.innerHTML = '';
    tocHeadings.forEach((h) => {
      const link = document.createElement('a');
      link.href = `#${h.id}`;
      link.textContent = h.text;
      link.className = `toc-link-mobile${h.level === 'h3' ? ' toc-link-mobile-h3' : ''}`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // Collapse mobile TOC after clicking
        tocMobileList.classList.add('hidden');
        tocChevron.style.transform = '';
        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
      });
      tocMobileList.appendChild(link);
    });

    // Show TOC containers
    tocMobile.classList.remove('hidden');
    tocDesktop.classList.remove('hidden');
  }

  // --- Active TOC Highlighting ---
  function updateActiveTOC() {
    if (tocHeadings.length === 0) return;

    const scrollPos = window.scrollY + 120; // Offset for fixed navbar
    let activeId = tocHeadings[0]?.id;

    for (let i = tocHeadings.length - 1; i >= 0; i--) {
      const heading = tocHeadings[i].element;
      if (heading.offsetTop <= scrollPos) {
        activeId = tocHeadings[i].id;
        break;
      }
    }

    // Update desktop TOC
    tocDesktopList.querySelectorAll('.toc-link').forEach((link) => {
      if (link.getAttribute('data-toc-id') === activeId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // --- Mobile TOC Toggle ---
  tocMobileToggle.addEventListener('click', () => {
    const isHidden = tocMobileList.classList.contains('hidden');
    tocMobileList.classList.toggle('hidden');
    tocChevron.style.transform = isHidden ? 'rotate(180deg)' : '';
  });

  // --- Scroll Reveal (IntersectionObserver) ---
  function setupScrollReveal() {
    // Add reveal class to content sections
    const revealTargets = articleContent.querySelectorAll(
      'h1, h2, h3, p, blockquote, pre, ul, ol, .table-wrapper, table, hr, img'
    );

    revealTargets.forEach((el) => {
      el.classList.add('reveal');
    });

    // Also reveal the article meta
    const meta = document.getElementById('article-meta');
    if (meta) meta.classList.add('reveal');

    // Create observer
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    // Observe all reveal targets
    document.querySelectorAll('.reveal').forEach((el) => {
      revealObserver.observe(el);
    });
  }

  // --- Combined Scroll Handler ---
  function onScroll() {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      updateProgressBar();
      updateActiveTOC();
      scrollRAF = null;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Load Articles Index ---
  async function loadArticlesIndex() {
    try {
      const response = await fetch('articles/posts.json');
      if (!response.ok) throw new Error('Failed to load articles index');
      const posts = await response.json();

      // Sort by date descending (newest first)
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));

      loadingState.classList.add('hidden');

      if (posts.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }

      renderArticleList(posts);
    } catch (error) {
      console.error('Error loading articles:', error);
      loadingState.textContent = 'Could not load articles.';
    }
  }

  // --- Render Article List ---
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
            <h2 class="text-base sm:text-lg md:text-xl font-serif font-normal leading-snug mb-0.5 sm:mb-1">
              ${post.title}
            </h2>
            ${post.excerpt ? `<p class="text-sm text-black/40 dark:text-white/40 font-light line-clamp-2 sm:line-clamp-1">${post.excerpt}</p>` : ''}
          </div>
          <time class="text-xs font-mono text-black/30 dark:text-white/30 whitespace-nowrap sm:pt-1.5 tracking-wide">
            ${formatDateShort(post.date)}
          </time>
        </div>
      `;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToArticle(post.slug);
      });

      item.appendChild(link);
      articlesContainer.appendChild(item);
    });
  }

  // --- Load Single Article ---
  async function loadArticle(slug) {
    cleanupArticleView();
    showArticleReader();
    articleContent.innerHTML = '<p class="text-black/30 dark:text-white/30 font-light">Loading...</p>';

    try {
      // Load posts.json to get metadata
      const indexResponse = await fetch('articles/posts.json');
      const posts = await indexResponse.json();
      const post = posts.find((p) => p.slug === slug);

      if (!post) {
        articleTitle.textContent = 'Article not found';
        articleDate.textContent = '';
        articleContent.innerHTML = '<p class="text-black/40 dark:text-white/40">This article does not exist.</p>';
        return;
      }

      // Load the markdown file
      const mdResponse = await fetch(`articles/${post.slug}.md`);
      if (!mdResponse.ok) throw new Error('Markdown file not found');
      const markdown = await mdResponse.text();

      // Strip front-matter if present (lines between --- delimiters)
      const content = markdown.replace(/^---[\s\S]*?---\n*/m, '');

      // Render
      articleTitle.textContent = post.title;
      articleDate.textContent = formatDate(post.date);
      articleContent.innerHTML = marked.parse(content);

      // Wrap tables in scrollable container for mobile
      articleContent.querySelectorAll('table').forEach((table) => {
        if (!table.parentElement.classList.contains('table-wrapper')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'table-wrapper';
          table.parentNode.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });

      // Generate TOC from headings
      generateTOC();

      // Setup scroll-reveal animations
      setupScrollReveal();

      // Render prev/next navigation
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      renderArticleNav(slug, posts);
      document.title = `${post.title}`;
    } catch (error) {
      console.error('Error loading article:', error);
      articleTitle.textContent = 'Error';
      articleDate.textContent = '';
      articleContent.innerHTML = '<p class="text-black/40 dark:text-white/40">Could not load this article.</p>';
    }
  }

  // --- Prev / Next Article Navigation ---
  function renderArticleNav(currentSlug, sortedPosts) {
    const currentIndex = sortedPosts.findIndex((p) => p.slug === currentSlug);
    if (currentIndex === -1) {
      articleNav.classList.add('hidden');
      return;
    }

    const prev = currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null;
    const next = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null;

    if (!prev && !next) {
      articleNav.classList.add('hidden');
      return;
    }

    articleNav.classList.remove('hidden');

    if (prev) {
      navPrev.classList.remove('hidden');
      navPrevTitle.textContent = prev.title;
      navPrev.onclick = (e) => {
        e.preventDefault();
        navigateToArticle(prev.slug);
      };
    } else {
      navPrev.classList.add('hidden');
    }

    if (next) {
      navNext.classList.remove('hidden');
      navNextTitle.textContent = next.title;
      navNext.onclick = (e) => {
        e.preventDefault();
        navigateToArticle(next.slug);
      };
    } else {
      navNext.classList.add('hidden');
    }
  }

  // --- Back Button ---
  backButton.addEventListener('click', () => {
    navigateToHome();
  });

  // --- Share Button ---
  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);

        // Trigger animation
        shareIcon.classList.remove('share-animate');
        void shareIcon.offsetWidth; // trigger reflow
        shareIcon.classList.add('share-animate');

        // Update state
        shareButton.classList.add('copied');
        shareLabel.textContent = 'Copied!';

        setTimeout(() => {
          shareButton.classList.remove('copied');
          shareLabel.textContent = 'Share';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    });
  }

  // --- Handle browser back/forward ---
  window.addEventListener('popstate', () => {
    const slug = getArticleSlug();
    if (slug) {
      loadArticle(slug);
    } else {
      showArticleList();
    }
  });

  // --- Initialize ---
  async function init() {
    await loadArticlesIndex();

    const slug = getArticleSlug();
    if (slug) {
      loadArticle(slug);
    }
  }

  init();
})();
