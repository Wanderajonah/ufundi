const { withAndroidColorsNight, AndroidConfig } = require('expo/config-plugins');

// SDK 57 / Android 16+ makes edge-to-edge mandatory. The OS owns the
// navigation bar and enforces its own contrast scrim. The previous approach of
// setting enforceNavigationBarContrast=false is no longer effective since the
// SDK overrides it. We keep only the night-mode navigation bar color override
// to ensure the dark theme nav bar stays black.

function withAndroidNavigationBarTheme(config) {
  config = withAndroidColorsNight(config, (config) => {
    config.modResults = AndroidConfig.Colors.setColorItem(
      AndroidConfig.Resources.buildResourceItem({
        name: 'navigationBarColor',
        value: '#000000',
      }),
      config.modResults
    );
    return config;
  });

  return config;
}

module.exports = withAndroidNavigationBarTheme;
