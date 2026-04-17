(function () {
  const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  function applyTelegramTheme() {
    const root = document.documentElement;
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

    Object.entries(themeMap).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(key, value);
      }
    });
  }

  if (webApp) {
    webApp.ready();
    webApp.expand();
    applyTelegramTheme();
    webApp.onEvent('themeChanged', applyTelegramTheme);
  }
})();
