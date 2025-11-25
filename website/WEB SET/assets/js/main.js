document.addEventListener('DOMContentLoaded', () => {
  // Announcement removed
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const revealTargets = document.querySelectorAll('.reveal');
  const menuToggle = document.querySelector('.menu-toggle');
  const menuPanel = document.querySelector('.menu-panel');
  const menuClose = menuPanel ? menuPanel.querySelector('.menu-panel__close') : null;
  const menuBackdrop = menuPanel ? menuPanel.querySelector('.menu-panel__backdrop') : null;
  const languageButtons = document.querySelectorAll('.language-toggle__btn');
  const i18nNodes = document.querySelectorAll('[data-i18n]');

  const translations = {
    'nav.clinical': {
      en: 'Clinical',
      zh: '临床应用'
    },
    'nav.life': {
      en: 'Life Sciences',
      zh: '生命科学'
    },
    'nav.evidence': {
      en: 'Clinical Evidence',
      zh: '临床证据'
    },
    'nav.media': {
      en: 'Media Center',
      zh: '媒体中心'
    },
    'nav.about': {
      en: 'About',
      zh: '关于我们'
    },
    'cta.contact': {
      en: 'Contact Us',
      zh: '联系我们'
    },
    'cta.request': {
      en: 'Request a trial',
      zh: '申请试用'
    },
    'cta.learnMore': {
      en: 'Learn more',
      zh: '了解更多'
    },
    'contact.address': {
      en: '33 Irving Place<br>New York, NY 10003',
      zh: '纽约市欧文广场 33 号<br>New York, NY 10003'
    },
    'hero.title': {
      en: 'AI to solve cancer’s most critical issues',
      zh: '用 AI 解决癌症最关键的问题'
    },
    'hero.subtitle': {
      en: 'Revolutionizing pathology with next generation technology',
      zh: '以下一代技术重塑病理学'
    },
    'intro.lead': {
      en: 'As longstanding leaders in AI, cancerapp was among the first to apply the power of foundation models to cancer care and has since delivered numerous models that set new standards for size, scale, and performance.',
      zh: '作为人工智能领域的长期领导者，cancerapp 率先将基础模型的能力应用于癌症诊疗，并持续发布在规模、速度与表现上树立新标杆的模型。'
    },
    'intro.heading': {
      en: 'What We Provide',
      zh: '我们的能力'
    },
    'feature.diagnostic.title': {
      en: 'Diagnostic &amp; Biomarker AI',
      zh: '诊断与生物标志物 AI'
    },
    'feature.diagnostic.text': {
      en: 'Tissue-based AI-assisted applications to support cancer detection, subtyping, and molecular biomarker discovery from tissues.',
      zh: '基于组织切片的 AI 助手，支持肿瘤检测、分型以及直接从组织中发现分子标志物。'
    },
    'feature.tech.title': {
      en: 'AI Technology &amp; Services',
      zh: 'AI 技术与服务'
    },
    'feature.tech.text': {
      en: 'Foundation models and AI modules developed to accelerate research and development of novel computational pathology applications.',
      zh: '基础模型与 AI 模块套件，加速计算病理学应用的研发迭代。'
    },
    'feature.alba.title': {
      en: 'cancerapp Alba™',
      zh: 'cancerapp Alba™'
    },
    'feature.alba.text': {
      en: 'cancerapp’s proprietary multi-modal co-pilot designed to revolutionize pathology workflows and unlock precision medicine.',
      zh: 'cancerapp 自研的多模态副驾，重构病理流程并释放精准医疗潜力。'
    },
    'diagnostic.heading': {
      en: 'AI-Assisted Diagnostic &amp; Biomarker AI',
      zh: 'AI 辅助诊断与生物标志物'
    },
    'suite.lead': {
      en: 'cancerapp has developed powerful AI applications to support diagnostic decision making in cancer pathology. In addition, cancerapp’s novel AI technologies can reveal multiple molecular biomarkers directly from the tissue sample. Developed to assist the diagnostic workflow in pathology, cancerapp’s AI applications can alleviate time and resource pressures enabling pathologists to better balance their ever-growing workloads while still delivering informed, quality diagnoses.',
      zh: 'cancerapp 构建了面向病理诊断决策的强大 AI 应用，并可直接在组织样本中识别多种分子标志物。这些工具帮助病理科在高负荷下保持效率与质量，实现更科学的诊断流程。'
    },
    'suite.prostate.title': {
      en: 'cancerapp Prostate Suite',
      zh: 'cancerapp 前列腺套件'
    },
    'suite.prostate.text': {
      en: 'Comprehensive AI applications that aid in the detection and diagnosis of prostate cancer on H&amp;E-stained whole-slide images of prostate needle biopsies.',
      zh: '面向 H&amp;E 染色前列腺穿刺活检全视野图像的 AI 工具，辅助检测与诊断前列腺癌。'
    },
    'suite.breast.title': {
      en: 'cancerapp Breast Suite',
      zh: 'cancerapp 乳腺套件'
    },
    'suite.breast.text': {
      en: 'AI applications designed to support pathologists in the identification and classification of breast cancer on H&amp;E-stained whole-slide images from breast biopsy and excision specimens.',
      zh: '针对乳腺活检与切除标本的 H&amp;E 全视野图像，辅助病理医生完成乳腺癌识别与分型。'
    },
    'suite.pancancer.title': {
      en: 'cancerapp PanCancer Suite',
      zh: 'cancerapp 全癌套件'
    },
    'suite.pancancer.text': {
      en: 'Developed using Virchow and cumulatively trained on over 1.5 million slides, cancerapp’s PanCancer Suite is able to help pathologists identify the most subtle complexities of cancer in multiple tissue types including rare cancers.',
      zh: '基于 Virchow 系列模型并在超过 150 万张切片上训练，帮助病理医生洞察多组织类型甚至罕见癌症中的细微异常。'
    },
    'tech.heading': {
      en: 'AI Technology &amp; Services',
      zh: 'AI 技术与服务'
    },
    'tech.lead': {
      en: 'By licensing our advanced technology, you can develop customized AI models that adhere to the highest standards of privacy, security, and clinical excellence. Unlike traditional AI development, our versatile foundation models eliminate the need for task-specific training, saving valuable time and resources. Leverage cancerapp’s technology to streamline your AI development, optimize existing applications, and drive groundbreaking advancements in cancer.',
      zh: '通过授权 cancerapp 的先进技术，您可以在确保隐私、安全与临床标准的前提下快速定制 AI 模型。与传统方式不同，我们的基础模型无需从零训练，即可节省大量时间与资源，助力您优化现有应用并推动癌症领域的创新突破。'
    },
    'tech.label': {
      en: 'TECHNOLOGY',
      zh: '技术'
    },
    'tech.modules.heading': {
      en: 'PanCancer AI Modules',
      zh: 'PanCancer AI 模块'
    },
    'tech.modules.text': {
      en: 'Pre-built pan cancer modules that enable precise therapeutic targeting, novel biomarker identification, and optimized clinical trial design.',
      zh: '预构建的全癌种模块，支持精准靶向、全新生物标志物挖掘以及临床试验设计优化。'
    },
    'tech.foundation.heading': {
      en: 'Foundation Models',
      zh: '基础模型'
    },
    'tech.services.label': {
      en: 'SERVICES',
      zh: '服务'
    },
    'tech.services.text': {
      en: 'We offer comprehensive services ranging from AI and industry-specific expertise, custom AI development including development of prognostic or predictive applications, regulatory strategy, and commercialization services.',
      zh: '提供涵盖行业专家支持、定制化 AI 开发（含预后与预测应用）、合规策略以及商业化落地的全流程服务。'
    },
    'alba.heading': {
      en: 'cancerapp Alba™',
      zh: 'cancerapp Alba™'
    },
    'alba.text': {
      en: 'Alba™ is a revolutionary co-pilot designed to transform how pathologists work with technology. By integrating cutting-edge AI with intuitive voice and text commands, Alba streamlines cancer detection and diagnosis workflows and improves efficiency.',
      zh: 'Alba™ 是一款革命性的病理副驾，通过语音与文本交互整合先进 AI，简化癌症检测与诊断流程并显著提升效率。'
    },
    'showcase.heading': {
      en: 'In-Product Screens',
      zh: '产品界面展示'
    },
    'showcase.home': {
      en: 'Home – AI-driven case &amp; medical analysis',
      zh: '首页——AI 驱动的病例与医学分析'
    },
    'showcase.pathology': {
      en: 'Comprehensive pathology image display',
      zh: '全面的病理影像展示'
    },
    'showcase.charts': {
      en: 'Intelligent analysis charts',
      zh: '智能分析图表'
    },
    'showcase.case': {
      en: 'Case management &amp; viewer',
      zh: '病例管理与阅片'
    },
    'showcase.dialogue': {
      en: 'AI analysis dialogue',
      zh: 'AI 分析对话'
    },
    'showcase.dashboard': {
      en: 'AI pathology insights dashboard',
      zh: 'AI 病理洞察看板'
    },
    'news.eyebrow': {
      en: 'Latest News',
      zh: '最新动态'
    },
    'news.title': {
      en: 'Highlighting innovation in action',
      zh: '聚焦正在发生的创新'
    },
    'news.description': {
      en: 'cancerapp is in the news. See what we have been up to.',
      zh: 'cancerapp 频频登陆行业媒体，一览我们的最新进展。'
    },
    'news.cta': {
      en: 'Read more',
      zh: '阅读更多'
    },
    'contact.heading': {
      en: 'Contact Us to Learn More',
      zh: '联系我们，了解更多'
    },
    'contact.text': {
      en: 'Connect with the cancerapp team to explore how our advanced pathology AI can transform your organization.',
      zh: '与 cancerapp 团队联系，了解先进病理 AI 如何赋能您的组织。'
    },
    'footer.about': {
      en: 'About cancerapp',
      zh: '关于 cancerapp'
    },
    'footer.request': {
      en: 'Request a Trial',
      zh: '申请试用'
    },
    'footer.diagnostic': {
      en: 'Diagnostic AI',
      zh: '诊断 AI'
    },
    'footer.tech': {
      en: 'AI Tech &amp; Services',
      zh: 'AI 技术与服务'
    },
    'footer.publications': {
      en: 'Publications',
      zh: '研究出版物'
    },
    'footer.contactHeading': {
      en: 'Get in Touch',
      zh: '保持联系'
    },
    'footer.copyright': {
      en: '© <span data-current-year>2025</span> cancerapp Inc. All rights reserved.',
      zh: '© <span data-current-year>2025</span> cancerapp Inc. 保留所有权利。'
    },
    'footer.terms': {
      en: 'Terms &amp; Conditions',
      zh: '条款与条件'
    },
    'footer.privacy': {
      en: 'Privacy Policy',
      zh: '隐私政策'
    },
    'footer.disclaimer': {
      en: 'All trademarks are property of their respective owners.',
      zh: '所有商标均归其各自所有者所有。'
    }
  };

  const LANGUAGE_STORAGE_KEY = 'cancerapp-lang';

  const setLanguageButtonState = lang => {
    languageButtons.forEach(btn => {
      if (!btn.dataset.lang) return;
      btn.classList.toggle('is-active', btn.dataset.lang === lang);
    });
  };

  const applyLanguage = lang => {
    const nextLang = lang === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = nextLang === 'zh' ? 'zh-Hans' : 'en';
    document.body.dataset.lang = nextLang;

    i18nNodes.forEach(node => {
      const key = node.dataset.i18n;
      const translation = translations[key];
      if (!translation) return;
      const value = translation[nextLang] || translation.en;
      if (typeof value === 'string') {
        node.innerHTML = value;
      }
    });

    setLanguageButtonState(nextLang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
  };

  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
  applyLanguage(storedLanguage);

  languageButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetLang = btn.dataset.lang || 'en';
      applyLanguage(targetLang);
    });
  });

  // Announcement bar: close + persist (so header can hug top)
  // No announcement bar present

  const toggleHeaderState = () => {
    if (!header) return;
    const threshold = hero ? hero.offsetHeight * 0.3 : 180;
    if (window.scrollY > threshold) {
      header.classList.add('site-header--scrolled');
    } else {
      header.classList.remove('site-header--scrolled');
    }
  };

  toggleHeaderState();
  window.addEventListener('scroll', toggleHeaderState, { passive: true });

  if (revealTargets.length) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );

    revealTargets.forEach(target => observer.observe(target));
  }

  const closeMenuPanel = () => {
    if (!menuPanel) return;
    menuPanel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.focus({ preventScroll: true });
    }
  };

  const openMenuPanel = () => {
    if (!menuPanel) return;
    menuPanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'true');
    }
  };

  if (menuToggle && menuPanel) {
    menuToggle.addEventListener('click', () => {
      if (document.body.classList.contains('menu-open')) {
        closeMenuPanel();
      } else {
        openMenuPanel();
      }
    });
  }

  if (menuClose) {
    menuClose.addEventListener('click', closeMenuPanel);
  }

  if (menuBackdrop) {
    menuBackdrop.addEventListener('click', closeMenuPanel);
  }

  document.addEventListener('keyup', event => {
    if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenuPanel();
    }
  });

  // Footer copyright year (自动年份)
  const yearEl = document.querySelector('[data-current-year]');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
});
