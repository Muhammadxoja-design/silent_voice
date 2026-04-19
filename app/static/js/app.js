(function () {
  const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.documentElement;

  function applyThemeMap(themeMap) {
    Object.entries(themeMap).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(key, value);
      }
    });
  }

  function applyTelegramTheme() {
    const params = webApp && webApp.themeParams ? webApp.themeParams : {};
    const themeMap = {
      '--tg-theme-bg-color': params.bg_color,
      '--tg-theme-secondary-bg-color': params.secondary_bg_color,
      '--tg-theme-text-color': params.text_color,
      '--tg-theme-hint-color': params.hint_color,
      '--tg-theme-link-color': params.link_color,
      '--tg-theme-button-color': params.button_color,
      '--tg-theme-button-text-color': params.button_text_color,
      '--tg-theme-section-bg-color': params.secondary_bg_color,
      '--tg-theme-section-separator-color': params.section_separator_color,
      '--tg-theme-destructive-text-color': params.destructive_text_color
    };

    applyThemeMap(themeMap);
  }

  function applyUserTheme() {
    const userTheme = window.__SV_USER_THEME__ || {};
    const themeMap = {
      '--tg-theme-bg-color': userTheme.bgColor,
      '--tg-theme-secondary-bg-color': userTheme.cardColor,
      '--tg-theme-section-bg-color': userTheme.cardColor,
      '--tg-theme-button-color': userTheme.buttonColor,
      '--tg-theme-link-color': userTheme.buttonColor,
      '--tg-theme-text-color': userTheme.textColor
    };

    applyThemeMap(themeMap);
  }

  function syncBrowserThemeColor() {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      return;
    }

    const computed = window.getComputedStyle(root);
    const color = computed.getPropertyValue('--tg-theme-button-color').trim()
      || computed.getPropertyValue('--tg-theme-bg-color').trim();

    if (color) {
      metaTheme.setAttribute('content', color);
    }
  }

  if (webApp) {
    webApp.ready();
    webApp.expand();
    applyTelegramTheme();
    applyUserTheme();
    syncBrowserThemeColor();
    webApp.onEvent('themeChanged', function () {
      applyTelegramTheme();
      applyUserTheme();
      syncBrowserThemeColor();
    });
  } else {
    applyUserTheme();
    syncBrowserThemeColor();
  }
})();
