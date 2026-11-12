const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * react-native-android-widget exposes resizeMode and default dimensions, but
 * does not expose Android's minResizeWidth/minResizeHeight provider attributes.
 * Add those attributes after its config plugin has generated the provider XML.
 */
module.exports = function withWidgetResizeConstraints(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const xmlDir = path.join(config.modRequest.projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
    const constraints = [
      { provider: 'todayandroidwidget', width: '180dp', height: '110dp' },
      { provider: 'calendarandroidwidget', width: '180dp', height: '160dp' },
    ];

    if (!fs.existsSync(xmlDir)) {
      throw new Error('FlowOS widget resize patch could not find Android res/xml directory');
    }

    const xmlFiles = fs.readdirSync(xmlDir).filter(file => file.endsWith('.xml'));
    for (const constraint of constraints) {
      const file = xmlFiles.find(name => name.toLowerCase().includes(constraint.provider));
      if (!file) {
        throw new Error(`FlowOS widget resize patch could not find provider XML for ${constraint.provider}`);
      }

      const filePath = path.join(xmlDir, file);
      let source = fs.readFileSync(filePath, 'utf8');
      const rootStart = source.indexOf('<appwidget-provider');
      const rootEnd = rootStart < 0 ? -1 : source.indexOf('>', rootStart);
      if (rootStart < 0 || rootEnd < 0) {
        throw new Error(`FlowOS widget resize patch could not parse provider XML: ${file}`);
      }

      let openingTag = source.slice(rootStart, rootEnd + 1);
      const attributes = {
        'android:minResizeWidth': constraint.width,
        'android:minResizeHeight': constraint.height,
      };
      for (const [name, value] of Object.entries(attributes)) {
        const prefix = `${name}="`;
        const valueStart = openingTag.indexOf(prefix);
        if (valueStart >= 0) {
          const valueEnd = openingTag.indexOf('"', valueStart + prefix.length);
          if (valueEnd < 0) throw new Error(`FlowOS widget resize patch found a malformed ${name} in ${file}`);
          openingTag = openingTag.slice(0, valueStart) + prefix + value + '"' + openingTag.slice(valueEnd + 1);
        } else {
          openingTag = openingTag.slice(0, -1) + ` ${name}="${value}">`;
        }
      }

      source = source.slice(0, rootStart) + openingTag + source.slice(rootEnd + 1);
      fs.writeFileSync(filePath, source);
    }

    return config;
  }]);
};
